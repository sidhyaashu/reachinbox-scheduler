import { OutboxRepository, EmailRepository } from '@reachinbox/database';

export async function runStartupReconciliation(
  outboxRepo: OutboxRepository = new OutboxRepository(),
  emailRepo: EmailRepository = new EmailRepository()
): Promise<number> {
  console.log('[Scheduler Recovery] Running startup outbox & persistence reconciliation...');
  try {
    // 1. Reset any in-flight 'PROCESSING' outbox events that were interrupted by a server restart back to 'PENDING'
    const resetOutboxCount = await outboxRepo.reconcileInFlightEvents();
    if (resetOutboxCount > 0) {
      console.log(
        `[Scheduler Recovery] Recovered ${resetOutboxCount} interrupted in-flight outbox event(s) and restored to PENDING.`
      );
    }

    // 2. Reset any in-flight 'PROCESSING' emails that were interrupted by a server crash back to 'QUEUED'
    const resetEmailCount = await emailRepo.reconcileInFlightEmails();
    if (resetEmailCount > 0) {
      console.log(
        `[Scheduler Recovery] Recovered ${resetEmailCount} interrupted in-flight email(s) and restored to QUEUED.`
      );
    }

    // 3. Count total pending events ready for dispatch
    const pendingCount = await outboxRepo.getPendingCount();
    if (pendingCount > 0) {
      console.log(
        `[Scheduler Recovery] Detected ${pendingCount} pending outbox event(s) awaiting BullMQ dispatch. Dispatcher will process them immediately.`
      );
    } else {
      console.log('[Scheduler Recovery] Outbox and email state are completely reconciled.');
    }
    return pendingCount;
  } catch (err) {
    console.error('[Scheduler Recovery] Error during startup reconciliation:', err);
    throw err;
  }
}


