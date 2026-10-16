import { describe, it, expect } from 'vitest';
import { ScheduleEmailSchema, BatchScheduleEmailSchema, EmailQuerySchema } from '../schemas/email.schema.js';
import { validateConfig, BaseConfigSchema } from '../schemas/config.schema.js';

describe('Shared Email Schemas', () => {
  it('validates a valid single email schedule payload', () => {
    const validData = {
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      recipient: 'lead@example.com',
      subject: 'Hello from ReachInbox',
      body: '<p>Testing cold outreach scheduler</p>',
      scheduledAt: new Date(Date.now() + 60000).toISOString(),
      idempotencyKey: 'idemp-key-12345',
    };

    const parsed = ScheduleEmailSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.recipient).toBe('lead@example.com');
      expect(parsed.data.scheduledAt).toBeInstanceOf(Date);
    }
  });

  it('rejects an invalid recipient email address', () => {
    const invalidData = {
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      recipient: 'not-an-email',
      subject: 'Hello',
      body: 'Body',
      scheduledAt: new Date().toISOString(),
    };

    const parsed = ScheduleEmailSchema.safeParse(invalidData);
    expect(parsed.success).toBe(false);
  });

  it('validates a batch schedule request with CSV leads', () => {
    const validBatch = {
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      subject: 'Sequence Step 1',
      body: 'Hi {{name}}, great to connect.',
      leads: [
        { email: 'alex@company.com', name: 'Alex' },
        { email: 'sarah@agency.com', name: 'Sarah' },
      ],
      startTime: new Date().toISOString(),
      delayBetweenEmailsSeconds: 2,
      hourlyLimit: 150,
    };

    const parsed = BatchScheduleEmailSchema.safeParse(validBatch);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.leads.length).toBe(2);
      expect(parsed.data.hourlyLimit).toBe(150);
    }
  });

  it('applies defaults to EmailQuerySchema', () => {
    const parsed = EmailQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.limit).toBe(20);
      expect(parsed.data.sortBy).toBe('scheduledAt');
      expect(parsed.data.sortOrder).toBe('asc');
    }
  });
});

describe('Shared Config Validation', () => {
  it('parses valid base configuration with sensible defaults', () => {
    const config = validateConfig(BaseConfigSchema, {});
    expect(config.PGPORT).toBe(5432);
    expect(config.REDIS_PORT).toBe(6379);
    expect(config.SCHEDULER_CONCURRENCY).toBe(10);
    expect(config.WORKER_CONCURRENCY).toBe(5);
    expect(config.EMAIL_QUEUE_NAME).toBe('reachinbox-email-queue');
  });

  it('throws descriptive error on invalid config input', () => {
    expect(() =>
      validateConfig(BaseConfigSchema, {
        ELASTICSEARCH_NODE: 'not-a-valid-url',
      })
    ).toThrowError(/\[ConfigValidationError\]/);
  });
});
