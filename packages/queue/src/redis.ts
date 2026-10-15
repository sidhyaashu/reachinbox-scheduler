import { Redis, RedisOptions } from 'ioredis';

let sharedRedis: Redis | null = null;

export function getRedisConfig(): RedisOptions {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
  };
}

export function createRedisClient(customOptions?: RedisOptions): Redis {
  const options = { ...getRedisConfig(), ...customOptions };
  const client = new Redis(options);

  client.on('error', (err) => {
    // Only log once or at debug to prevent log storms
    console.error('[Redis Client Error]', err.message);
  });

  return client;
}

export function getSharedRedis(): Redis {
  if (!sharedRedis) {
    sharedRedis = createRedisClient();
  }
  return sharedRedis;
}

export async function closeSharedRedis(): Promise<void> {
  if (sharedRedis) {
    await sharedRedis.quit();
    sharedRedis = null;
  }
}
