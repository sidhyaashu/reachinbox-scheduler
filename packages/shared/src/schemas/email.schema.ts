import { z } from 'zod';
import { EmailStatus } from '../types/index.js';

export const ScheduleEmailSchema = z.object({
  senderId: z.string().uuid({ message: 'Valid senderId (UUID) is required' }),
  recipient: z.string().email({ message: 'Valid recipient email address is required' }).max(255),
  subject: z.string().min(1, { message: 'Subject cannot be empty' }).max(500),
  body: z.string().min(1, { message: 'Body cannot be empty' }),
  scheduledAt: z
    .string()
    .datetime({ message: 'scheduledAt must be an ISO-8601 UTC string' })
    .transform((val) => new Date(val))
    .refine((date) => !isNaN(date.getTime()), { message: 'Invalid scheduledAt date' }),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export type ScheduleEmailInput = z.input<typeof ScheduleEmailSchema>;
export type ScheduleEmailOutput = z.output<typeof ScheduleEmailSchema>;

export const CsvLeadRowSchema = z.object({
  email: z.string().email({ message: 'Invalid lead email' }),
  name: z.string().optional(),
  company: z.string().optional(),
});

export type CsvLeadRow = z.infer<typeof CsvLeadRowSchema>;

export const BatchScheduleEmailSchema = z.object({
  senderId: z.string().uuid({ message: 'Valid senderId is required' }),
  subject: z.string().min(1, { message: 'Subject is required' }).max(500),
  body: z.string().min(1, { message: 'Body is required' }),
  leads: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
      })
    )
    .min(1, { message: 'At least one recipient lead is required' }),
  startTime: z
    .string()
    .datetime({ message: 'startTime must be an ISO-8601 UTC string' })
    .transform((val) => new Date(val)),
  delayBetweenEmailsSeconds: z.number().int().min(0).max(3600).default(2),
  hourlyLimit: z.number().int().min(1).max(5000).default(200),
});

export type BatchScheduleEmailInput = z.input<typeof BatchScheduleEmailSchema>;
export type BatchScheduleEmailOutput = z.output<typeof BatchScheduleEmailSchema>;

export const EmailQuerySchema = z.object({
  status: z.nativeEnum(EmailStatus).optional(),
  senderId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['scheduledAt', 'sentAt', 'createdAt']).default('scheduledAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type EmailQueryParams = z.infer<typeof EmailQuerySchema>;

export const CancelEmailParamSchema = z.object({
  id: z.string().uuid({ message: 'Valid email UUID is required' }),
});
