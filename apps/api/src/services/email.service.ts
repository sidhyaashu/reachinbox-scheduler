import {
  EmailRepository,
  SenderRepository,
  CreateEmailParams,
} from '@reachinbox/database';
import {
  ScheduleEmailOutput,
  BatchScheduleEmailOutput,
  EmailQueryParams,
  EmailRecord,
  ConflictError,
  NotFoundError,
} from '@reachinbox/shared';
import { removeEmailJob } from '@reachinbox/queue';

export class EmailService {
  constructor(
    private readonly emailRepo: EmailRepository = new EmailRepository(),
    private readonly senderRepo: SenderRepository = new SenderRepository()
  ) {}

  /**
   * Schedules a single email with strict idempotency handling.
   */
  async scheduleEmail(
    userId: string,
    input: ScheduleEmailOutput
  ): Promise<EmailRecord> {
    // 1. Check idempotency key if provided
    if (input.idempotencyKey) {
      const existing = await this.emailRepo.findByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        // Verify payload consistency
        const isMatching =
          existing.recipient === input.recipient &&
          existing.subject === input.subject &&
          existing.body === input.body;

        if (isMatching) {
          return existing;
        }
        throw new ConflictError(
          `Idempotency key '${input.idempotencyKey}' was previously used with different payload parameters.`
        );
      }
    }

    // 2. Validate sender exists or assign/create default
    let senderId = input.senderId;
    const sender = await this.senderRepo.findById(senderId);
    if (!sender) {
      const defaultSender = await this.senderRepo.findDefaultOrFirstByUserId(userId);
      if (defaultSender) {
        senderId = defaultSender.id;
      } else {
        const created = await this.senderRepo.upsertDefaultSender(
          userId,
          'outreach@reachinbox.ai',
          { name: 'ReachInbox Sender' }
        );
        senderId = created.id;
      }
    }

    // 3. Atomically persist email + outbox event
    const record = await this.emailRepo.createEmailWithOutbox({
      userId,
      senderId,
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      scheduledAt: input.scheduledAt,
      idempotencyKey: input.idempotencyKey || null,
    });

    return record;
  }

  /**
   * Schedules a batch of emails (e.g. parsed from CSV) with progressive inter-send delays.
   */
  async batchScheduleEmails(
    userId: string,
    input: BatchScheduleEmailOutput
  ): Promise<{ scheduledCount: number; emails: EmailRecord[] }> {
    let resolvedSenderId: string;
    const sender = input.senderId ? await this.senderRepo.findById(input.senderId) : null;
    if (sender) {
      resolvedSenderId = sender.id;
    } else {
      const defaultSender = await this.senderRepo.findDefaultOrFirstByUserId(userId);
      if (defaultSender) {
        resolvedSenderId = defaultSender.id;
      } else {
        const created = await this.senderRepo.upsertDefaultSender(
          userId,
          'outreach@reachinbox.ai',
          {
            hourlyLimit: input.hourlyLimit,
            minDelaySeconds: input.delayBetweenEmailsSeconds,
          }
        );
        resolvedSenderId = created.id;
      }
    }

    const startTimestamp = input.startTime.getTime();
    const delayStepMs = input.delayBetweenEmailsSeconds * 1000;

    const emailBatch: CreateEmailParams[] = input.leads.map((lead, index) => {
      const scheduledAt = new Date(startTimestamp + index * delayStepMs);
      const personalizedBody = lead.name
        ? input.body.replace(/\{\{\s*name\s*\}\}/gi, lead.name)
        : input.body;

      return {
        userId,
        senderId: resolvedSenderId,
        recipient: lead.email,
        subject: input.subject,
        body: personalizedBody,
        scheduledAt,
        idempotencyKey: null,
      };
    });

    const emails = await this.emailRepo.createBatchEmailsWithOutbox(emailBatch);
    return {
      scheduledCount: emails.length,
      emails,
    };
  }

  async getScheduledEmails(
    userId: string,
    params: Partial<EmailQueryParams>
  ): Promise<{ items: EmailRecord[]; total: number; page: number; limit: number }> {
    const { items, total } = await this.emailRepo.findScheduled(userId, params);
    return {
      items,
      total,
      page: params.page || 1,
      limit: params.limit || 20,
    };
  }

  async getSentEmails(
    userId: string,
    params: Partial<EmailQueryParams>
  ): Promise<{ items: EmailRecord[]; total: number; page: number; limit: number }> {
    const { items, total } = await this.emailRepo.findSent(userId, params);
    return {
      items,
      total,
      page: params.page || 1,
      limit: params.limit || 20,
    };
  }

  async cancelEmail(userId: string, emailId: string): Promise<void> {
    const email = await this.emailRepo.findById(emailId);
    if (!email || email.userId !== userId) {
      throw new NotFoundError('Email', emailId);
    }

    // Try to update to CANCELLED for active queue jobs
    const cancelled = await this.emailRepo.cancelEmail(emailId, userId);
    if (!cancelled) {
      // If it was already completed (SENT, FAILED, or already CANCELLED), permanently delete it per user request
      await this.emailRepo.deleteEmail(emailId, userId);
    }

    // Proactively remove delayed job from BullMQ so it does not linger or execute
    try {
      await removeEmailJob(emailId);
    } catch (err) {
      console.warn(`[EmailService] Non-critical: Could not remove BullMQ job ${emailId}:`, err);
    }
  }

  async deleteEmail(userId: string, emailId: string): Promise<void> {
    const email = await this.emailRepo.findById(emailId);
    if (!email || email.userId !== userId) {
      throw new NotFoundError('Email', emailId);
    }

    await this.emailRepo.deleteEmail(emailId, userId);

    try {
      await removeEmailJob(emailId);
    } catch (err) {
      console.warn(`[EmailService] Non-critical: Could not remove BullMQ job ${emailId}:`, err);
    }
  }
}
