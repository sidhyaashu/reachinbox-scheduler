import { OutboxRepository } from '@reachinbox/database';

export async function runStartupReconciliation(
  outboxRepo: OutboxRepository = new OutboxRepository()
): Promise<number> {
  console.log('[Scheduler Recovery] Running startup outbox reconciliation...');
  try {
    // 1. Reset any in-flight 'PROCESSING' events that were interrupted by a server restart back to 'PENDING'
    const resetCount = await outboxRepo.reconcileInFlightEvents();
    if (resetCount > 0) {
      console.log(
        `[Scheduler Recovery] Recovered ${resetCount} interrupted in-flight outbox event(s) and restored to PENDING.`
      );
    }

    // 2. Count total pending events ready for dispatch
    const pendingCount = await outboxRepo.getPendingCount();
    if (pendingCount > 0) {
      console.log(
        `[Scheduler Recovery] Detected ${pendingCount} pending outbox event(s) awaiting BullMQ dispatch. Dispatcher will process them immediately.`
      );
    } else {
      console.log('[Scheduler Recovery] Outbox is completely reconciled. No orphaned events detected.');
    }
    return pendingCount;
  } catch (err) {
    console.error('[Scheduler Recovery] Error during startup reconciliation:', err);
    throw err;
  }
}

