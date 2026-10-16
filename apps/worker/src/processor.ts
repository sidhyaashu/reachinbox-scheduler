import axios from 'axios';
import { Job } from 'bullmq';
import { EmailJobData, addEmailJob } from '@reachinbox/queue';
import { EmailRepository, SenderRepository } from '@reachinbox/database';
import { WorkerRateLimiter } from './rate-limiter.js';
import { MailerService } from './mailer.js';
import { AlertService } from './alert.service.js';

export class EmailProcessor {
  constructor(
    private readonly emailRepo: EmailRepository = new EmailRepository(),
    private readonly senderRepo: SenderRepository = new SenderRepository(),
    private readonly rateLimiter: WorkerRateLimiter = new WorkerRateLimiter(),
    private readonly mailerService: MailerService = new MailerService(senderRepo),
    private readonly alertService: AlertService = new AlertService()
  ) {}

  async processJob(job: Job<EmailJobData>): Promise<{ status: string; previewUrl?: string | null }> {
    const data = job.data;
    console.log(`[EmailProcessor] Processing job ${job.id} for email ${data.emailId} to ${data.recipient}`);

    // 1. Fetch current email record from database
    const email = await this.emailRepo.findById(data.emailId);
    if (!email) {
      console.warn(`[EmailProcessor] Email ${data.emailId} no longer exists in DB. Skipping job.`);
      return { status: 'SKIPPED_NOT_FOUND' };
    }

    if (email.status === 'CANCELLED') {
      console.log(`[EmailProcessor] Email ${data.emailId} was cancelled by user. Skipping.`);
      return { status: 'SKIPPED_CANCELLED' };
    }

    if (email.status === 'SENT') {
      console.log(`[EmailProcessor] Email ${data.emailId} was already sent. Skipping duplicate.`);
      return { status: 'SKIPPED_ALREADY_SENT' };
    }

    // 2. Fetch sender settings
    const sender = await this.senderRepo.findById(data.senderId);
    const hourlyLimit = sender?.hourlyLimit || 200;
    const minDelaySeconds = sender?.minDelaySeconds || 2;
    const senderEmail = sender?.email || data.senderId;

    // 3. Evaluate atomic hourly rate limit
    const rateCheck = await this.rateLimiter.checkHourlyLimit(data.senderId, hourlyLimit);
    if (!rateCheck.allowed && rateCheck.msUntilNextHour && rateCheck.nextHourDate) {
      console.warn(
        `[EmailProcessor] Sender ${senderEmail} reached limit (${hourlyLimit}/hr). Deferring email ${data.emailId} by ${rateCheck.msUntilNextHour}ms.`
      );

      // Reschedule into BullMQ for the next hour window (Zero-Drop Guarantee)
      await addEmailJob(data, rateCheck.msUntilNextHour);

      // Update state in DB
      await this.emailRepo.updateStatus(
        data.emailId,
        ['QUEUED', 'PROCESSING', 'SCHEDULED'],
        'DEFERRED',
        {
          lastError: `Hourly limit of ${hourlyLimit} reached. Rescheduled to ${rateCheck.nextHourDate.toISOString()}`,
        }
      );

      // Dispatch real Slack OAuth alert (if connected)
      await this.alertService.notifyRateLimitHit({
        userId: data.userId,
        senderEmail,
        senderId: data.senderId,
        hourlyLimit,
        nextWindowDate: rateCheck.nextHourDate,
      });

      return { status: 'DEFERRED' };
    }

    // 4. Mark status as PROCESSING in DB (Atomic Compare-And-Swap Claim)
    const claimed = await this.emailRepo.updateStatus(
      data.emailId,
      ['QUEUED', 'SCHEDULED', 'DEFERRED'],
      'PROCESSING'
    );
    if (!claimed) {
      console.warn(
        `[EmailProcessor] Email ${data.emailId} could not be transitioned to PROCESSING. Already claimed by another worker or status changed. Skipping.`
      );
      return { status: 'SKIPPED_ALREADY_CLAIMED' };
    }

    try {
      // 5. Enforce minimum inter-send spacing delay across workers
      await this.rateLimiter.enforceInterSendDelay(data.senderId, minDelaySeconds);

      // 6. Deliver email via Ethereal SMTP / Gmail API
      const sendResult = await this.mailerService.sendMail({
        to: data.recipient,
        subject: data.subject,
        body: email.body || data.subject,
        sender,
        attachments: (email.attachments as any) || (data.attachments as any) || undefined,
      });

      // 7. Transition to SENT in DB with preview URL
      await this.emailRepo.updateStatus(
        data.emailId,
        ['PROCESSING'],
        'SENT',
        {
          sentAt: new Date(),
          etherealMessageUrl: sendResult.etherealPreviewUrl,
          incrementAttempts: true,
        }
      );

      console.log(
        `[EmailProcessor] Successfully sent email ${data.emailId} to ${data.recipient}. Preview URL: ${sendResult.etherealPreviewUrl || 'N/A'}`
      );

      // 8. Asynchronously index/update email document in Elasticsearch
      this.indexToSearch({
        id: data.emailId,
        userId: data.userId,
        senderId: data.senderId,
        recipient: data.recipient,
        subject: data.subject,
        body: email.body || data.subject,
        status: 'SENT',
        scheduledAt: email.scheduledAt instanceof Date ? email.scheduledAt.toISOString() : String(email.scheduledAt),
        sentAt: new Date().toISOString(),
        etherealMessageUrl: sendResult.etherealPreviewUrl,
        createdAt: email.createdAt instanceof Date ? email.createdAt.toISOString() : String(email.createdAt),
      });

      return {
        status: 'SENT',
        previewUrl: sendResult.etherealPreviewUrl,
      };
    } catch (err: any) {
      console.error(`[EmailProcessor] Delivery error for email ${data.emailId}:`, err.message);

      // Error classification
      const isPermanent = this.isPermanentError(err);
      if (isPermanent) {
        await this.emailRepo.updateStatus(
          data.emailId,
          ['PROCESSING'],
          'FAILED',
          {
            lastError: `Permanent failure: ${err.message}`,
            incrementAttempts: true,
          }
        );

        this.indexToSearch({
          id: data.emailId,
          userId: data.userId,
          senderId: data.senderId,
          recipient: data.recipient,
          subject: data.subject,
          body: email.body || data.subject,
          status: 'FAILED',
          scheduledAt: email.scheduledAt instanceof Date ? email.scheduledAt.toISOString() : String(email.scheduledAt),
          sentAt: null,
          etherealMessageUrl: null,
          createdAt: email.createdAt instanceof Date ? email.createdAt.toISOString() : String(email.createdAt),
        });

        return { status: 'FAILED' };
      }

      // Transient failure: update attempts and let BullMQ retry with exponential backoff
      await this.emailRepo.updateStatus(
        data.emailId,
        ['PROCESSING'],
        'QUEUED',
        {
          lastError: `Transient failure: ${err.message}`,
          incrementAttempts: true,
        }
      );

      throw err;
    }
  }

  private isPermanentError(err: any): boolean {
    const code = err.responseCode || err.code;
    // 5xx SMTP codes are permanent mailbox/domain failures (550, 551, 552, 553, 554)
    if (typeof code === 'number' && code >= 500 && code < 600) {
      return true;
    }
    if (
      err.message &&
      (err.message.includes('Gmail API delivery error (400)') ||
        err.message.includes('Gmail API delivery error (403)') ||
        err.message.includes('No recipients defined') ||
        err.message.includes('Invalid login'))
    ) {
      return true;
    }
    return false;
  }

  async markJobFailed(emailId: string, errorMessage: string): Promise<void> {
    try {
      await this.emailRepo.updateStatus(
        emailId,
        ['QUEUED', 'PROCESSING', 'SCHEDULED', 'DEFERRED'],
        'FAILED',
        {
          lastError: `Delivery failed: ${errorMessage}`,
          incrementAttempts: true,
        }
      );
    } catch (e: any) {
      console.error(`[EmailProcessor] Failed to set status to FAILED for email ${emailId}:`, e.message);
    }
  }

  private indexToSearch(doc: any): void {
    if (process.env.NODE_ENV === 'test' && !process.env.SEARCH_SERVICE_URL) {
      return;
    }

    const searchUrl =
      process.env.SEARCH_SERVICE_URL ||
      (process.env.NODE_ENV === 'production' ? 'http://search:4004' : 'http://localhost:4004');

    axios
      .post(`${searchUrl}/api/v1/search/index`, doc, { timeout: 3000 })
      .catch((err: any) => {
        console.warn(`[EmailProcessor] Async search indexing failed for email ${doc.id}:`, err.message);
      });
  }
}
