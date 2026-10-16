import axios from 'axios';
import {
  EmailRepository,
  SenderRepository,
  UserRepository,
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
    private readonly senderRepo: SenderRepository = new SenderRepository(),
    private readonly userRepo: UserRepository = new UserRepository()
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

    // 2. Validate sender exists or assign/create default from user profile
    let senderId = input.senderId;
    const sender = await this.senderRepo.findById(senderId);
    if (!sender) {
      const defaultSender = await this.senderRepo.findDefaultOrFirstByUserId(userId);
      if (defaultSender) {
        senderId = defaultSender.id;
      } else {
        const user = await this.userRepo.findById(userId);
        if (!user?.email) {
          throw new BadRequestError('Active account does not have a verified email address. Please connect a mailbox or sign in again.');
        }
        const userEmail = user.email;
        const userName = user.name || 'Verified Sender';
        const created = await this.senderRepo.upsertDefaultSender(
          userId,
          userEmail,
          { name: userName }
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
      attachments: (input as any).attachments || null,
    });

    // 4. Asynchronously index into Elasticsearch
    this.indexToSearch(record);

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
      if (input.delayBetweenEmailsSeconds !== undefined || input.hourlyLimit !== undefined) {
        await this.senderRepo.updateLimits(resolvedSenderId, {
          minDelaySeconds: input.delayBetweenEmailsSeconds,
          hourlyLimit: input.hourlyLimit,
        });
      }
    } else {
      const defaultSender = await this.senderRepo.findDefaultOrFirstByUserId(userId);
      if (defaultSender) {
        resolvedSenderId = defaultSender.id;
        if (input.delayBetweenEmailsSeconds !== undefined || input.hourlyLimit !== undefined) {
          await this.senderRepo.updateLimits(resolvedSenderId, {
            minDelaySeconds: input.delayBetweenEmailsSeconds,
            hourlyLimit: input.hourlyLimit,
          });
        }
      } else {
        const user = await this.userRepo.findById(userId);
        if (!user?.email) {
          throw new BadRequestError('Active account does not have a verified email address. Please connect a mailbox or sign in again.');
        }
        const userEmail = user.email;
        const userName = user.name || 'Verified Sender';
        const created = await this.senderRepo.upsertDefaultSender(
          userId,
          userEmail,
          {
            name: userName,
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
        attachments: (input as any).attachments || null,
      };
    });

    const emails = await this.emailRepo.createBatchEmailsWithOutbox(emailBatch);
    emails.forEach((rec) => this.indexToSearch(rec));

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

    // Update Elasticsearch index with CANCELLED status
    this.indexToSearch({ ...email, status: 'CANCELLED' });
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

    // Update Elasticsearch index with CANCELLED/deleted status
    this.indexToSearch({ ...email, status: 'CANCELLED' });
  }

  private indexToSearch(record: EmailRecord): void {
    if (process.env.NODE_ENV === 'test' && !process.env.SEARCH_SERVICE_URL) {
      return;
    }

    const searchUrl =
      process.env.SEARCH_SERVICE_URL ||
      (process.env.NODE_ENV === 'production' ? 'http://search:4004' : 'http://localhost:4004');

    axios
      .post(
        `${searchUrl}/api/v1/search/index`,
        {
          id: record.id,
          userId: record.userId,
          senderId: record.senderId,
          recipient: record.recipient,
          subject: record.subject,
          body: record.body,
          status: record.status,
          scheduledAt:
            record.scheduledAt instanceof Date
              ? record.scheduledAt.toISOString()
              : record.scheduledAt,
          sentAt: record.sentAt
            ? record.sentAt instanceof Date
              ? record.sentAt.toISOString()
              : record.sentAt
            : null,
          etherealMessageUrl: record.etherealMessageUrl || null,
          createdAt:
            record.createdAt instanceof Date
              ? record.createdAt.toISOString()
              : record.createdAt,
        },
        { timeout: 3000 }
      )
      .catch((err: any) => {
        // Non-blocking: log warning only so core scheduling flow is never impacted
        console.warn(`[EmailService] Async search indexing failed for email ${record.id}:`, err.message);
      });
  }
}
