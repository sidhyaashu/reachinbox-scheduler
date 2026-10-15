import { Worker } from 'bullmq';
import { EMAIL_QUEUE_NAME, getRedisConfig, EmailJobData } from '@reachinbox/queue';
import { EmailProcessor } from './processor.js';
import { config } from './config.js';

let workerInstance: Worker<EmailJobData> | null = null;

export function createEmailWorker(processor: EmailProcessor = new EmailProcessor()): Worker<EmailJobData> {
  if (workerInstance) {
    return workerInstance;
  }

  const concurrency = config.WORKER_CONCURRENCY || 5;
  console.log(`[EmailWorker] Initializing BullMQ Worker with concurrency = ${concurrency}`);

  workerInstance = new Worker<EmailJobData>(
    config.EMAIL_QUEUE_NAME || EMAIL_QUEUE_NAME,
    async (job) => {
      return processor.processJob(job);
    },
    {
      connection: getRedisConfig(),
      concurrency,
      lockDuration: 30000,
    }
  );

  workerInstance.on('completed', (job) => {
    console.log(`[EmailWorker] Job ${job.id} completed successfully.`);
  });

  workerInstance.on('failed', (job, err) => {
    console.error(`[EmailWorker] Job ${job?.id} failed with error:`, err.message);
  });

  workerInstance.on('error', (err) => {
    console.error('[EmailWorker] Worker encountered error:', err.message);
  });

  return workerInstance;
}

export async function closeEmailWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
