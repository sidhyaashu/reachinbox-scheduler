import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutboxDispatcher } from '../dispatcher.js';
import { runStartupReconciliation } from '../recovery.js';
import * as queueModule from '@reachinbox/queue';

describe('OutboxDispatcher & Scheduler', () => {
  let mockOutboxRepo: any;
  let mockEmailRepo: any;
  let dispatcher: OutboxDispatcher;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockOutboxRepo = {
      fetchPendingEvents: vi.fn(),
      markDispatched: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      getPendingCount: vi.fn().mockResolvedValue(0),
    };

    mockEmailRepo = {
      updateStatus: vi.fn().mockResolvedValue({ id: 'email-1', status: 'QUEUED' }),
    };

    dispatcher = new OutboxDispatcher(mockOutboxRepo, mockEmailRepo, {
      pollIntervalMs: 100,
      batchSize: 10,
    });
  });

  it('dispatches pending outbox event with correct delay to BullMQ', async () => {
    const addEmailJobSpy = vi.spyOn(queueModule, 'addEmailJob').mockResolvedValue('job-123');

    const futureTime = new Date(Date.now() + 5000).toISOString();
    const mockEvent = {
      id: 'outbox-event-1',
      aggregateType: 'EMAIL',
      aggregateId: 'email-1',
      eventType: 'EMAIL_SCHEDULED',
      payload: {
        emailId: 'email-1',
        userId: 'user-1',
        senderId: 'sender-1',
        recipient: 'lead@example.com',
        subject: 'Hello',
        scheduledAt: futureTime,
      },
      status: 'PENDING' as const,
      retryCount: 0,
      createdAt: new Date(),
    };

    mockOutboxRepo.fetchPendingEvents.mockResolvedValueOnce([mockEvent]);

    const count = await dispatcher.processBatch();

    expect(count).toBe(1);
    expect(addEmailJobSpy).toHaveBeenCalledTimes(1);

    const [jobData, delayMs] = addEmailJobSpy.mock.calls[0];
    expect(jobData.emailId).toBe('email-1');
    expect(jobData.recipient).toBe('lead@example.com');
    // Delay should be approximately 5000ms
    expect(delayMs).toBeGreaterThan(4000);
    expect(delayMs).toBeLessThanOrEqual(5500);

    expect(mockOutboxRepo.markDispatched).toHaveBeenCalledWith('outbox-event-1');
    expect(mockEmailRepo.updateStatus).toHaveBeenCalledWith('email-1', ['SCHEDULED'], 'QUEUED');
  });

  it('calculates 0 delay for past or immediate scheduled emails', async () => {
    const addEmailJobSpy = vi.spyOn(queueModule, 'addEmailJob').mockResolvedValue('job-past');

    const pastTime = new Date(Date.now() - 10000).toISOString();
    const mockEvent = {
      id: 'outbox-event-past',
      aggregateType: 'EMAIL',
      aggregateId: 'email-past',
      eventType: 'EMAIL_SCHEDULED',
      payload: {
        emailId: 'email-past',
        userId: 'user-1',
        senderId: 'sender-1',
        recipient: 'lead2@example.com',
        subject: 'Immediate Send',
        scheduledAt: pastTime,
      },
      status: 'PENDING' as const,
      retryCount: 0,
      createdAt: new Date(),
    };

    mockOutboxRepo.fetchPendingEvents.mockResolvedValueOnce([mockEvent]);

    await dispatcher.processBatch();

    expect(addEmailJobSpy).toHaveBeenCalledTimes(1);
    const [, delayMs] = addEmailJobSpy.mock.calls[0];
    expect(delayMs).toBe(0);
  });

  it('marks event as failed if payload is corrupted', async () => {
    const mockCorruptedEvent = {
      id: 'outbox-corrupted',
      aggregateType: 'EMAIL',
      aggregateId: 'email-corrupted',
      eventType: 'EMAIL_SCHEDULED',
      payload: {}, // Missing required fields
      status: 'PENDING' as const,
      retryCount: 0,
      createdAt: new Date(),
    };

    mockOutboxRepo.fetchPendingEvents.mockResolvedValueOnce([mockCorruptedEvent]);

    await dispatcher.processBatch();

    expect(mockOutboxRepo.markFailed).toHaveBeenCalledWith('outbox-corrupted');
    expect(mockOutboxRepo.markDispatched).not.toHaveBeenCalled();
  });

  it('reconciles pending count correctly during startup', async () => {
    mockOutboxRepo.getPendingCount.mockResolvedValueOnce(5);
    const count = await runStartupReconciliation(mockOutboxRepo);
    expect(count).toBe(5);
  });
});
