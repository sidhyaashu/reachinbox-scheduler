import { Router, Request, Response } from 'express';
import { pingElasticsearch } from '../es-client.js';

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'UP', service: 'search', uptime: process.uptime() });
  });

  router.get('/ready', async (_req: Request, res: Response) => {
    const isReady = await pingElasticsearch();
    if (isReady) {
      res.status(200).json({ status: 'READY', service: 'search', elasticsearch: 'CONNECTED' });
    } else {
      res.status(503).json({ status: 'NOT_READY', service: 'search', elasticsearch: 'DISCONNECTED' });
    }
  });

  return router;
}
