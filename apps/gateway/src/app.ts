import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import crypto from 'crypto';
import { config } from './config.js';
import { setupBullBoard } from './bull-board.js';
import { createDashboardRouter } from './bff/dashboard.routes.js';

export function createApp(): Express {
  const app = express();

  // Basic security & parsing
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());

  // Request ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const reqId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    req.headers['x-request-id'] = reqId;
    res.setHeader('X-Request-ID', reqId);
    next();
  });

  // Health checks
  app.get('/health/live', (_req, res) => {
    res.status(200).json({ status: 'UP', service: 'gateway', uptime: process.uptime() });
  });

  app.get('/health/ready', (_req, res) => {
    res.status(200).json({ status: 'READY', service: 'gateway' });
  });

  // 1. Live BullMQ Dashboard (/admin/queues)
  const bullBoardRouter = setupBullBoard();
  app.use('/admin/queues', bullBoardRouter);

  // 2. BFF Dashboard Aggregation Routes (Scoped body parsing to preserve proxy streaming)
  app.use('/api/v1/dashboard', express.json({ limit: '10mb' }), createDashboardRouter());

  // 3. Reverse Proxy Route Dispatching to Microservices (Non-blocking streaming with fixRequestBody)
  // Forward /api/v1/emails to Email API Service (:4001)
  app.use(
    '/api/v1/emails',
    createProxyMiddleware({
      target: config.EMAIL_API_URL,
      changeOrigin: true,
      pathRewrite: { '^/api/v1/emails': '/api/v1/emails' },
      on: { proxyReq: fixRequestBody },
    })
  );

  // Forward /auth to Email API Service (:4001)
  app.use(
    '/auth',
    createProxyMiddleware({
      target: config.EMAIL_API_URL,
      changeOrigin: true,
      pathRewrite: { '^/auth': '/auth' },
      on: { proxyReq: fixRequestBody },
    })
  );

  // Forward /integrations/slack to Email API Service (:4001)
  app.use(
    '/integrations/slack',
    createProxyMiddleware({
      target: config.EMAIL_API_URL,
      changeOrigin: true,
      pathRewrite: { '^/integrations/slack': '/integrations/slack' },
      on: { proxyReq: fixRequestBody },
    })
  );

  // Forward /api/v1/search to Search Service (:4004)
  app.use(
    '/api/v1/search',
    createProxyMiddleware({
      target: config.SEARCH_SERVICE_URL,
      changeOrigin: true,
      pathRewrite: { '^/api/v1/search': '/api/v1/search' },
      on: { proxyReq: fixRequestBody },
    })
  );

  // Centralized Error Handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Gateway Error]', err);
    res.status(502).json({
      success: false,
      error: {
        code: 'BAD_GATEWAY',
        message: 'Downstream microservice communication error',
        details: [err.message],
      },
    });
  });

  return app;
}
