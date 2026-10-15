import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createSearchRouter } from './routes/search.routes.js';
import { createHealthRouter } from './routes/health.routes.js';

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health checks
  app.use('/health', createHealthRouter());

  // Search API routes
  app.use('/api/v1/search', createSearchRouter());

  // Error handling
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[SearchService Error]', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'SEARCH_SERVICE_ERROR',
        message: err.message,
      },
    });
  });

  return app;
}
