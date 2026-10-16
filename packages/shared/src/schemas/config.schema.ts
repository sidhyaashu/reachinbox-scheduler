import { z } from 'zod';

export const BaseConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // PostgreSQL
  DATABASE_URL: z.string().url().optional(),
  PGHOST: z.string().default('localhost'),
  PGPORT: z.coerce.number().default(5432),
  PGUSER: z.string().default('postgres'),
  PGPASSWORD: z.string().default('postgres'),
  PGDATABASE: z.string().default('reachinbox'),
  PGMAX: z.coerce.number().default(20),
  PGIDLE_TIMEOUT_MILLIS: z.coerce.number().default(30000),

  // Redis & BullMQ
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  EMAIL_QUEUE_NAME: z.string().default('reachinbox-email-queue'),

  // Elasticsearch
  ELASTICSEARCH_NODE: z.string().url().default('http://localhost:9200'),
  ELASTICSEARCH_INDEX: z.string().default('reachinbox-emails'),
  ELASTICSEARCH_USERNAME: z.string().optional(),
  ELASTICSEARCH_PASSWORD: z.string().optional(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:4000/auth/google/callback'),
  SESSION_SECRET: z.string().min(16).default('development-session-secret-must-be-long-enough'),

  // Slack OAuth
  SLACK_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_SECRET: z.string().default(''),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:4000/integrations/slack/callback'),

  // Service Ports
  GATEWAY_PORT: z.coerce.number().default(4000),
  EMAIL_API_PORT: z.coerce.number().default(4001),
  SCHEDULER_PORT: z.coerce.number().default(4002),
  WORKER_PORT: z.coerce.number().default(4003),
  SEARCH_PORT: z.coerce.number().default(4004),

  // Worker & Scheduler Settings
  SCHEDULER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(10),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
  MIN_INTER_SEND_DELAY_SECONDS: z.coerce.number().int().min(0).default(2),
  DEFAULT_HOURLY_LIMIT: z.coerce.number().int().min(1).default(200),
});

export type BaseConfig = z.infer<typeof BaseConfigSchema>;

export function validateConfig<T extends z.ZodTypeAny>(schema: T, env: Record<string, unknown> = process.env): z.infer<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(`[ConfigValidationError] Environment variable configuration error: ${JSON.stringify(formatted, null, 2)}`);
  }
  return result.data;
}
