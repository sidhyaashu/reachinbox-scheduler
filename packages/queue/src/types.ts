export interface EmailJobData {
  emailId: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body?: string;
  scheduledAt: string;
  attemptNumber?: number;
  enqueuedAt?: string;
}

export const EMAIL_QUEUE_NAME = 'reachinbox-email-queue';

export const EMAIL_JOB_NAME = 'send-email';
