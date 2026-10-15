import { createApp } from './app.js';
import { config } from './config.js';
import { ensureEmailIndex } from './index-manager.js';
import { closeElasticClient } from './es-client.js';

const app = createApp();

const server = app.listen(config.SEARCH_PORT, async () => {
  console.log(`[Search Service] Listening on port ${config.SEARCH_PORT} in ${config.NODE_ENV} mode`);
  try {
    await ensureEmailIndex();
  } catch (err: any) {
    console.warn('[Search Service] Could not initialize Elasticsearch index on startup (cluster may be offline):', err.message);
  }
});

async function gracefulShutdown(signal: string) {
  console.log(`[Search Service] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await closeElasticClient();
      console.log('[Search Service] Elasticsearch client closed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('[Search Service] Error during shutdown:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('[Search Service] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
