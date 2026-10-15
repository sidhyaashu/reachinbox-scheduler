import { initTelemetry } from '@reachinbox/shared';

// Initialize Azure Application Insights before starting scheduler
initTelemetry('reachinbox-scheduler');

import express from 'express';
import { config } from './config.js';
import { OutboxDispatcher } from './dispatcher.js';
import { runStartupReconciliation } from './recovery.js';
import { query, closePool } from '@reachinbox/database';
import { closeEmailQueue, closeSharedRedis } from '@reachinbox/queue';

const app = express();
const dispatcher = new OutboxDispatcher(undefined, undefined, {
  pollIntervalMs: config.OUTBOX_POLL_INTERVAL_MS,
  batchSize: config.OUTBOX_BATCH_SIZE,
});

// Health check routes
app.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'UP', service: 'scheduler', uptime: process.uptime() });
});

app.get('/health/ready', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.status(200).json({ status: 'READY', service: 'scheduler', timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(503).json({ status: 'NOT_READY', error: err.message });
  }
});

const server = app.listen(config.SCHEDULER_PORT, async () => {
  console.log(`[Scheduler Service] Health server listening on port ${config.SCHEDULER_PORT}`);
  try {
    // 1. Run startup recovery
    await runStartupReconciliation();
    // 2. Start continuous zero-cron dispatch loop
    dispatcher.start();
  } catch (err) {
    console.error('[Scheduler Service] Critical error during startup:', err);
    process.exit(1);
  }
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`[Scheduler Service] Received ${signal}. Shutting down gracefully...`);
  await dispatcher.stop();

  server.close(async () => {
    try {
      await closeEmailQueue();
      await closeSharedRedis();
      await closePool();
      console.log('[Scheduler Service] All connections closed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('[Scheduler Service] Error during graceful shutdown:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('[Scheduler Service] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
