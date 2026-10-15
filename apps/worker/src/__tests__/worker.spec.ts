import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkerRateLimiter } from '../rate-limiter.js';
import { EmailProcessor } from '../processor.js';
import * as queueModule from '@reachinbox/queue';

describe('WorkerRateLimiter', () => {
  let mockRedis: any;
  let limiter: WorkerRateLimiter;

  beforeEach(() => {
    mockRedis = {
      incr: vi.fn(),
      expire: vi.fn().mockResolvedValue(1),
      get: vi.fn(),
      set: vi.fn().mockResolvedValue('OK'),
    };
    limiter = new WorkerRateLimiter(mockRedis as any);
  });

  it('allows send when counter is within hourly limit', async () => {
    mockRedis.incr.mockResolvedValueOnce(50);
    const result = await limiter.checkHourlyLimit('sender-1', 100);

    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(50);
    expect(result.limit).toBe(100);
  });

  it('disallows send and computes next hour delay when hourly limit is breached', async () => {
    mockRedis.incr.mockResolvedValueOnce(101);
    const result = await limiter.checkHourlyLimit('sender-1', 100);

    expect(result.allowed).toBe(false);
    expect(result.currentCount).toBe(101);
    expect(result.msUntilNextHour).toBeDefined();
    expect(result.msUntilNextHour).toBeGreaterThan(0);
    expect(result.nextHourDate).toBeInstanceOf(Date);
  });
});

describe('EmailProcessor', () => {
  let mockEmailRepo: any;
  let mockSenderRepo: any;
  let mockRateLimiter: any;
  let mockMailer: any;
  let mockAlertService: any;
  let processor: EmailProcessor;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockEmailRepo = {
      findById: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue({ id: 'email-1', status: 'SENT' }),
    };

    mockSenderRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'sender-1',
        email: 'sender@reachinbox.ai',
        hourlyLimit: 100,
        minDelaySeconds: 2,
      }),
    };

    mockRateLimiter = {
      checkHourlyLimit: vi.fn(),
      enforceInterSendDelay: vi.fn().mockResolvedValue(0),
    };

    mockMailer = {
      sendMail: vi.fn().mockResolvedValue({
        messageId: 'msg-ethereal-123',
        etherealPreviewUrl: 'https://ethereal.email/message/test-preview',
      }),
    };

    mockAlertService = {
      notifyRateLimitHit: vi.fn().mockResolvedValue(undefined),
    };

    processor = new EmailProcessor(
      mockEmailRepo,
      mockSenderRepo,
      mockRateLimiter,
      mockMailer,
      mockAlertService
    );
  });

  it('delivers email and updates status to SENT when within rate limits', async () => {
    mockEmailRepo.findById.mockResolvedValueOnce({
      id: 'email-1',
      status: 'QUEUED',
      recipient: 'prospect@acme.com',
      subject: 'Demo test',
      body: 'Hello prospect',
    });

    mockRateLimiter.checkHourlyLimit.mockResolvedValueOnce({
      allowed: true,
      currentCount: 1,
      limit: 100,
    });

    const mockJob = {
      id: 'email-1',
      data: {
        emailId: 'email-1',
        userId: 'user-1',
        senderId: 'sender-1',
        recipient: 'prospect@acme.com',
        subject: 'Demo test',
        scheduledAt: new Date().toISOString(),
      },
    };

    const result = await processor.processJob(mockJob as any);

    expect(result.status).toBe('SENT');
    expect(result.previewUrl).toBe('https://ethereal.email/message/test-preview');
    expect(mockMailer.sendMail).toHaveBeenCalledTimes(1);
    expect(mockEmailRepo.updateStatus).toHaveBeenCalledWith(
      'email-1',
      ['PROCESSING'],
      'SENT',
      expect.objectContaining({
        etherealMessageUrl: 'https://ethereal.email/message/test-preview',
      })
    );
  });

  it('defers email to next hour window and triggers Slack alert when limit is exceeded', async () => {
    const addEmailJobSpy = vi.spyOn(queueModule, 'addEmailJob').mockResolvedValue('email-1');

    mockEmailRepo.findById.mockResolvedValueOnce({
      id: 'email-1',
      status: 'QUEUED',
      recipient: 'prospect@acme.com',
      subject: 'Demo test',
    });

    const nextHour = new Date(Date.now() + 1800000);
    mockRateLimiter.checkHourlyLimit.mockResolvedValueOnce({
      allowed: false,
      currentCount: 101,
      limit: 100,
      msUntilNextHour: 1800000,
      nextHourDate: nextHour,
    });

    const mockJob = {
      id: 'email-1',
      data: {
        emailId: 'email-1',
        userId: 'user-1',
        senderId: 'sender-1',
        recipient: 'prospect@acme.com',
        subject: 'Demo test',
        scheduledAt: new Date().toISOString(),
      },
    };

    const result = await processor.processJob(mockJob as any);

    expect(result.status).toBe('DEFERRED');
    expect(addEmailJobSpy).toHaveBeenCalledWith(mockJob.data, 1800000);
    expect(mockEmailRepo.updateStatus).toHaveBeenCalledWith(
      'email-1',
      ['QUEUED', 'PROCESSING', 'SCHEDULED'],
      'DEFERRED',
      expect.anything()
    );
    expect(mockAlertService.notifyRateLimitHit).toHaveBeenCalledTimes(1);
    expect(mockMailer.sendMail).not.toHaveBeenCalled();
  });

  it('skips processing if email was cancelled', async () => {
    mockEmailRepo.findById.mockResolvedValueOnce({
      id: 'email-1',
      status: 'CANCELLED',
    });

    const mockJob = {
      id: 'email-1',
      data: {
        emailId: 'email-1',
        senderId: 'sender-1',
      },
    };

    const result = await processor.processJob(mockJob as any);
    expect(result.status).toBe('SKIPPED_CANCELLED');
    expect(mockMailer.sendMail).not.toHaveBeenCalled();
  });
});
