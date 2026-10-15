import { initTelemetry } from '@reachinbox/shared';

// Initialize Azure Application Insights before starting server
initTelemetry('reachinbox-api');

import { createApp } from './app.js';
import { config } from './config.js';
import { closePool } from '@reachinbox/database';

const app = createApp();
const PORT = config.EMAIL_API_PORT;

const server = app.listen(PORT, () => {
  console.log(`[Email API Service] Listening on port ${PORT} in ${config.NODE_ENV} mode`);
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`[Email API Service] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await closePool();
      console.log('[Email API Service] Database pool closed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('[Email API Service] Error during database shutdown:', err);
      process.exit(1);
    }
  });

  // Force close if graceful shutdown exceeds 10s
  setTimeout(() => {
    console.error('[Email API Service] Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
