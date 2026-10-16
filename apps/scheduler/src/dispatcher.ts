import { OutboxRepository, EmailRepository } from '@reachinbox/database';
import { addEmailJob, EmailJobData } from '@reachinbox/queue';
import type { OutboxEvent } from '@reachinbox/shared';

export interface DispatcherOptions {
  pollIntervalMs?: number;
  batchSize?: number;
  concurrency?: number;
}

/**
 * Concurrency limiter that processes items concurrently up to a specified limit.
 * Prevents exhausting database connection pools and message brokers.
 */
export async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      const item = items[idx];
      if (item !== undefined) {
        results[idx] = await fn(item);
      }
    }
  };

  const poolSize = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: poolSize }, () => worker());
  await Promise.all(workers);
  return results;
}

export class OutboxDispatcher {
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  constructor(
    private readonly outboxRepo: OutboxRepository = new OutboxRepository(),
    private readonly emailRepo: EmailRepository = new EmailRepository(),
    private readonly options: DispatcherOptions = {}
  ) {}

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[OutboxDispatcher] Starting continuous event-driven outbox polling loop (zero-cron)...');
    this.scheduleNext(0);
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[OutboxDispatcher] Stopped outbox polling loop.');
  }

  private scheduleNext(delayMs: number): void {
    if (!this.isRunning) return;
    this.timer = setTimeout(async () => {
      try {
        const processedCount = await this.processBatch();
        // If we processed items, check again immediately to drain backlog; else wait poll interval
        const nextDelay = processedCount > 0 ? 50 : (this.options.pollIntervalMs || 1000);
        this.scheduleNext(nextDelay);
      } catch (err) {
        console.error('[OutboxDispatcher] Error processing outbox batch:', err);
        this.scheduleNext(this.options.pollIntervalMs || 1000);
      }
    }, delayMs);
  }

  /**
   * Fetches, claims, and dispatches a single batch of outbox events.
   * Concurrency-safe across multiple scheduler instances via CTE FOR UPDATE SKIP LOCKED.
   * Dispatches events with bounded concurrency to protect DB connection pools and Redis.
   */
  public async processBatch(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const batchSize = this.options.batchSize || 100;
      const concurrency = Math.max(1, this.options.concurrency || 10);
      const events: OutboxEvent[] = await this.outboxRepo.fetchAndClaimPendingEvents(batchSize);

      if (events.length === 0) {
        return 0;
      }

      await mapConcurrent(events, concurrency, (event) => this.dispatchEvent(event));

      return events.length;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Dispatches a single outbox event to BullMQ and marks it DISPATCHED.
   */
  public async dispatchEvent(event: OutboxEvent): Promise<void> {
    const payload = event.payload as unknown as {
      emailId: string;
      userId: string;
      senderId: string;
      recipient: string;
      subject: string;
      scheduledAt: string;
    };

    if (!payload || !payload.emailId || !payload.scheduledAt) {
      console.error(`[OutboxDispatcher] Corrupted outbox event payload for event ${event.id}:`, event.payload);
      await this.outboxRepo.markFailed(event.id);
      return;
    }

    try {
      const targetTime = new Date(payload.scheduledAt).getTime();
      const now = Date.now();
      const delayMs = Math.max(0, targetTime - now);

      const jobData: EmailJobData = {
        emailId: payload.emailId,
        userId: payload.userId,
        senderId: payload.senderId,
        recipient: payload.recipient,
        subject: payload.subject,
        scheduledAt: payload.scheduledAt,
        attemptNumber: 0,
        enqueuedAt: new Date().toISOString(),
        attachments: (payload as any).attachments,
      };

      // 1. Enqueue to BullMQ with deterministic jobId
      await addEmailJob(jobData, delayMs);

      // 2. Mark event as DISPATCHED in database only after BullMQ confirms receipt
      await this.outboxRepo.markDispatched(event.id);

      // 3. Transition email status to QUEUED
      await this.emailRepo.updateStatus(payload.emailId, ['SCHEDULED'], 'QUEUED');

      console.log(
        `[OutboxDispatcher] Dispatched email ${payload.emailId} to BullMQ (delay: ${delayMs}ms, scheduledAt: ${payload.scheduledAt})`
      );
    } catch (err: any) {
      console.error(`[OutboxDispatcher] Failed to dispatch event ${event.id}:`, err.message);
      await this.outboxRepo.markFailed(event.id);
    }
  }
}
