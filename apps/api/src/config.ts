import { BaseConfigSchema, validateConfig } from '@reachinbox/shared';

export const config = validateConfig(BaseConfigSchema, process.env);
