import { BaseConfigSchema, validateConfig } from '@reachinbox/shared';
import { z } from 'zod';

const GatewayConfigSchema = BaseConfigSchema.extend({
  EMAIL_API_URL: z.string().url().default('http://localhost:4001'),
  SEARCH_SERVICE_URL: z.string().url().default('http://localhost:4004'),
  WEB_URL: z.string().url().default('http://localhost:3000'),
});

export const config = validateConfig(GatewayConfigSchema, process.env);
export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;
