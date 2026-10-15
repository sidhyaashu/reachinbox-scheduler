import { createApp } from './app.js';
import { config } from './config.js';
import { closeSharedRedis, closeEmailQueue } from '@reachinbox/queue';
import { closePool } from '@reachinbox/database';

const app = createApp();

const server = app.listen(config.GATEWAY_PORT, () => {
  console.log(`[API Gateway] Listening on port ${config.GATEWAY_PORT} in ${config.NODE_ENV} mode`);
  console.log(`[API Gateway] Live BullMQ Board available at http://localhost:${config.GATEWAY_PORT}/admin/queues`);
});

async function gracefulShutdown(signal: string) {
  console.log(`[API Gateway] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await closeEmailQueue();
      await closeSharedRedis();
      await closePool();
      console.log('[API Gateway] All connections closed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('[API Gateway] Error during shutdown:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('[API Gateway] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
