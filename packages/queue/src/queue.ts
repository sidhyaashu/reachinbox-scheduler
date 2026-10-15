import { Queue, JobsOptions } from 'bullmq';
import { getRedisConfig } from './redis.js';
import { EMAIL_QUEUE_NAME, EMAIL_JOB_NAME, EmailJobData } from './types.js';

let emailQueue: Queue<EmailJobData> | null = null;

export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueue) {
    const queueName = process.env.EMAIL_QUEUE_NAME || EMAIL_QUEUE_NAME;
    emailQueue = new Queue<EmailJobData>(queueName, {
      connection: getRedisConfig(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: {
          age: 3600 * 24, // Keep completed jobs for 24h for observability
          count: 5000,
        },
        removeOnFail: {
          age: 3600 * 48, // Keep failed jobs for 48h
          count: 5000,
        },
      },
    });
  }
  return emailQueue;
}

export async function addEmailJob(
  data: EmailJobData,
  delayMs: number = 0,
  customOptions?: JobsOptions
): Promise<string> {
  const queue = getEmailQueue();
  const safeDelay = Math.max(0, Math.floor(delayMs));

  const job = await queue.add(EMAIL_JOB_NAME, data, {
    jobId: data.emailId, // Deterministic ID prevents duplicate BullMQ jobs
    delay: safeDelay,
    ...customOptions,
  });

  return job.id || data.emailId;
}

export async function removeEmailJob(emailId: string): Promise<boolean> {
  try {
    const queue = getEmailQueue();
    const job = await queue.getJob(emailId);
    if (job) {
      await job.remove();
      return true;
    }
  } catch (err) {
    console.warn(`[Queue] Could not remove BullMQ job ${emailId}:`, err);
  }
  return false;
}

export async function closeEmailQueue(): Promise<void> {
  if (emailQueue) {
    await emailQueue.close();
    emailQueue = null;
  }
}
