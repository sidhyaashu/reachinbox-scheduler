import { Router, Request, Response } from 'express';
import { query } from '@reachinbox/database';

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/ready', async (_req: Request, res: Response) => {
    try {
      await query('SELECT 1');
      res.status(200).json({
        status: 'READY',
        database: 'CONNECTED',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(503).json({
        status: 'NOT_READY',
        database: 'DISCONNECTED',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  return router;
}
