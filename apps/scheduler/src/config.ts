import { BaseConfigSchema, validateConfig } from '@reachinbox/shared';
import { z } from 'zod';

const SchedulerConfigSchema = BaseConfigSchema.extend({
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().default(1000),
  OUTBOX_BATCH_SIZE: z.coerce.number().default(100),
});

export const config = validateConfig(SchedulerConfigSchema, process.env);
export type SchedulerConfig = z.infer<typeof SchedulerConfigSchema>;
