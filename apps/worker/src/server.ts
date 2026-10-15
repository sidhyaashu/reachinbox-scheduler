import { initTelemetry } from '@reachinbox/shared';

// Initialize Azure Application Insights before starting worker
initTelemetry('reachinbox-worker');

import express from 'express';
import { config } from './config.js';
import { createEmailWorker, closeEmailWorker } from './worker.js';
import { query, closePool } from '@reachinbox/database';
import { closeSharedRedis } from '@reachinbox/queue';

const app = express();

app.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'UP', service: 'worker', uptime: process.uptime() });
});

app.get('/health/ready', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.status(200).json({ status: 'READY', service: 'worker', timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(503).json({ status: 'NOT_READY', error: err.message });
  }
});

createEmailWorker();

const server = app.listen(config.WORKER_PORT, () => {
  console.log(`[Worker Service] Health server listening on port ${config.WORKER_PORT}`);
});

async function gracefulShutdown(signal: string) {
  console.log(`[Worker Service] Received ${signal}. Draining jobs and shutting down gracefully...`);

  server.close(async () => {
    try {
      await closeEmailWorker();
      await closeSharedRedis();
      await closePool();
      console.log('[Worker Service] All connections closed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('[Worker Service] Error during graceful shutdown:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('[Worker Service] Forced shutdown after timeout');
    process.exit(1);
  }, 15000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
