/**
 * Core Domain Enums & Interfaces
 */

export const EmailStatus = {
  SCHEDULED: 'SCHEDULED',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  DEFERRED: 'DEFERRED',
  CANCELLED: 'CANCELLED',
} as const;

export type EmailStatusType = (typeof EmailStatus)[keyof typeof EmailStatus];

export const OutboxStatus = {
  PENDING: 'PENDING',
  DISPATCHED: 'DISPATCHED',
  FAILED: 'FAILED',
} as const;

export type OutboxStatusType = (typeof OutboxStatus)[keyof typeof OutboxStatus];

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Sender {
  id: string;
  userId: string;
  email: string;
  name: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  hourlyLimit: number;
  minDelaySeconds: number;
  authType?: 'smtp' | 'oauth2_google';
  googleRefreshToken?: string | null;
  googleAccessToken?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailAttachment {
  filename: string;
  contentType?: string;
  content: string; // base64 encoded
  size?: number;
}

export interface EmailRecord {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatusType;
  scheduledAt: Date;
  sentAt?: Date | null;
  etherealMessageUrl?: string | null;
  idempotencyKey?: string | null;
  attempts: number;
  lastError?: string | null;
  attachments?: EmailAttachment[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OutboxEvent {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: OutboxStatusType;
  retryCount: number;
  dispatchedAt?: Date | null;
  createdAt: Date;
}

export interface SlackIntegration {
  id: string;
  userId: string;
  teamId: string;
  teamName: string;
  channelId?: string | null;
  channelName?: string | null;
  webhookUrl?: string | null;
  accessToken: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitEvent {
  id: string;
  senderId: string;
  windowStart: Date;
  count: number;
  notifiedSlack: boolean;
  createdAt: Date;
}

/**
 * Standard API Envelopes
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown[];
}

export interface ApiFailureResponse {
  success: false;
  error: ApiErrorEnvelope;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse;
