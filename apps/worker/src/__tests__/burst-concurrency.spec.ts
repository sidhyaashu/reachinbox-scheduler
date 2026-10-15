import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkerRateLimiter } from '../rate-limiter.js';
import { EmailProcessor } from '../processor.js';
import * as queueModule from '@reachinbox/queue';

describe('1,000-Burst Concurrency & Rate Limiting Simulation', () => {
  let mockRedis: any;
  let redisCounter: number;
  let limiter: WorkerRateLimiter;

  beforeEach(() => {
    vi.restoreAllMocks();
    redisCounter = 0;

    // Simulate Redis atomic INCR and EXPIRE in memory
    mockRedis = {
      incr: vi.fn().mockImplementation(async () => {
        redisCounter += 1;
        return redisCounter;
      }),
      expire: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };

    limiter = new WorkerRateLimiter(mockRedis as any);
  });

  it('handles 1,000 concurrent rate check calls and accurately permits quota then defers excess', async () => {
    const hourlyLimit = 200;
    const totalBurst = 1000;

    // Fire 1,000 concurrent rate check requests
    const results = await Promise.all(
      Array.from({ length: totalBurst }, () => limiter.checkHourlyLimit('burst-sender-1', hourlyLimit))
    );

    const allowedCount = results.filter((r) => r.allowed).length;
    const deferredCount = results.filter((r) => !r.allowed).length;

    // Exactly 200 must be allowed, and exactly 800 must be deferred
    expect(allowedCount).toBe(200);
    expect(deferredCount).toBe(800);
    expect(redisCounter).toBe(1000);

    // Verify deferred items received positive delay to next hour window
    const firstDeferred = results.find((r) => !r.allowed);
    expect(firstDeferred?.msUntilNextHour).toBeGreaterThan(0);
    expect(firstDeferred?.nextHourDate).toBeInstanceOf(Date);
  });

  it('ensures EmailProcessor defers 1,000 burst without dropping any jobs', async () => {
    const addEmailJobSpy = vi.spyOn(queueModule, 'addEmailJob').mockResolvedValue('job-id');

    const mockEmailRepo: any = {
      findById: vi.fn().mockResolvedValue({
        id: 'email-burst',
        status: 'QUEUED',
        recipient: 'lead@test.com',
        subject: 'Burst Test',
      }),
      updateStatus: vi.fn().mockResolvedValue({ id: 'email-burst', status: 'DEFERRED' }),
    };

    const mockSenderRepo: any = {
      findById: vi.fn().mockResolvedValue({
        id: 'sender-burst',
        email: 'sender@reachinbox.ai',
        hourlyLimit: 10, // Small limit for test
        minDelaySeconds: 0,
      }),
    };

    const mockMailer: any = {
      sendMail: vi.fn().mockResolvedValue({
        messageId: 'ethereal-id',
        etherealPreviewUrl: 'https://ethereal.email/message/1',
      }),
    };

    const mockAlertService: any = {
      notifyRateLimitHit: vi.fn().mockResolvedValue(undefined),
    };

    const processor = new EmailProcessor(
      mockEmailRepo,
      mockSenderRepo,
      limiter,
      mockMailer,
      mockAlertService
    );

    // Run 50 jobs with limit 10
    const jobResults = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        processor.processJob({
          id: `job-${i}`,
          data: {
            emailId: `email-${i}`,
            userId: 'user-1',
            senderId: 'sender-burst',
            recipient: `lead-${i}@acme.com`,
            subject: 'Burst',
            scheduledAt: new Date().toISOString(),
          },
        } as any)
      )
    );

    const sentCount = jobResults.filter((r) => r.status === 'SENT').length;
    const deferredCount = jobResults.filter((r) => r.status === 'DEFERRED').length;

    expect(sentCount).toBe(10);
    expect(deferredCount).toBe(40);
    expect(mockMailer.sendMail).toHaveBeenCalledTimes(10);
    expect(addEmailJobSpy).toHaveBeenCalledTimes(40); // All 40 were safely re-queued for next hour
  });
});
