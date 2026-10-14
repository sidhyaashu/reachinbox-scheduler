import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { requestIdMiddleware } from './middleware/request-id.js';
import { errorHandler } from './middleware/error-handler.js';
import { createEmailRouter } from './routes/email.routes.js';
import { createHealthRouter } from './routes/health.routes.js';
import { NotFoundError } from '@reachinbox/shared';

export function createApp(): Express {
  const app = express();

  // Basic security and parsing middlewares
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestIdMiddleware);

  // Health checks
  app.use('/health', createHealthRouter());

  // API v1 routes
  app.use('/api/v1/emails', createEmailRouter());

  // 404 Handler
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
