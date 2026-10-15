import { describe, it, expect, vi } from 'vitest';
import { createLogger, redactSensitiveData } from '../observability/logger.js';

describe('Structured JSON Logger & Redaction', () => {
  it('correctly redacts sensitive keys from metadata objects', () => {
    const rawData = {
      user: 'alice',
      password: 'super-secret-password',
      accessToken: 'xoxb-slack-secret-token',
      smtp_pass: 'smtp-password-123',
      nested: {
        authorization: 'Bearer secret-jwt',
        normalField: 'allowed-value',
      },
      list: [{ cookie: 'session=123' }, { id: 'safe-id' }],
    };

    const redacted = redactSensitiveData(rawData);

    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.accessToken).toBe('[REDACTED]');
    expect(redacted.smtp_pass).toBe('[REDACTED]');
    expect(redacted.nested.authorization).toBe('[REDACTED]');
    expect(redacted.nested.normalField).toBe('allowed-value');
    expect(redacted.list[0].cookie).toBe('[REDACTED]');
    expect(redacted.list[1].id).toBe('safe-id');
  });

  it('formats structured log JSON output with service and context', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('email-api', { environment: 'test' });

    logger.info('Email scheduled successfully', {
      requestId: 'req-123',
      userId: 'user-abc',
      durationMs: 42,
      metaPayload: 'test',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsedLog = JSON.parse(logSpy.mock.calls[0][0]);

    expect(parsedLog.level).toBe('info');
    expect(parsedLog.service).toBe('email-api');
    expect(parsedLog.message).toBe('Email scheduled successfully');
    expect(parsedLog.requestId).toBe('req-123');
    expect(parsedLog.userId).toBe('user-abc');
    expect(parsedLog.durationMs).toBe(42);
    expect(parsedLog.timestamp).toBeDefined();

    logSpy.mockRestore();
  });
});
