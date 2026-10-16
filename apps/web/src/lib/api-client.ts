import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * Centralized API Client for ReachInbox Scheduler
 * All backend API calls go through this client. No hardcoded endpoints in TSX components.
 */

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  createdAt?: string;
}

export interface EmailAttachment {
  filename: string;
  contentType?: string;
  content: string; // base64 encoded string
  size?: number;
}

export interface EmailRecord {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'QUEUED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'DEFERRED' | 'CANCELLED' | 'DRAFT';
  scheduledAt: string;
  sentAt?: string | null;
  etherealMessageUrl?: string | null;
  attempts: number;
  lastError?: string | null;
  attachments?: EmailAttachment[] | null;
  createdAt: string;
  updatedAt?: string;
}

export interface DashboardSummary {
  user: UserProfile;
  sender?: {
    id: string;
    email: string;
    name: string;
    hourlyLimit: number;
    minDelaySeconds: number;
    authType?: 'smtp' | 'oauth2_google';
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    hasCustomSmtp?: boolean;
  } | null;
  stats: {
    totalScheduled: number;
    totalSent: number;
  };
  scheduledEmails: EmailRecord[];
  sentEmails: EmailRecord[];
  slackIntegration: {
    connected: boolean;
    teamName?: string;
    channelName?: string;
  };
  queueMetrics?: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
}

export interface ScheduleBatchPayload {
  recipients: string[];
  subject: string;
  body: string;
  scheduledAt: string;
  senderId?: string;
  delaySecondsBetweenSends?: number;
  hourlyLimit?: number;
  attachments?: EmailAttachment[];
}

export interface SlackStatus {
  connected: boolean;
  teamName?: string;
  channelName?: string;
}

type UnauthorizedListener = () => void;
const unauthorizedListeners: Set<UnauthorizedListener> = new Set();

export function onUnauthorized(callback: UnauthorizedListener): () => void {
  unauthorizedListeners.add(callback);
  return () => {
    unauthorizedListeners.delete(callback);
  };
}

function notifyUnauthorized(): void {
  unauthorizedListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('[API] Error in onUnauthorized listener:', e);
    }
  });
}

/**
 * Pre-configured Axios instance
 * Enforces withCredentials: true for reachinbox_session HTTP-only cookie
 */
export const axiosInstance: AxiosInstance = axios.create({
  baseURL: '',
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor: global 401 Unauthorized detection and normalized error extraction
axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    if (error.response?.status === 401) {
      notifyUnauthorized();
    }
    const errMsg =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(errMsg));
  }
);

async function request<T>(
  url: string,
  options: { method?: string; data?: any; params?: any; headers?: any } = {}
): Promise<T> {
  const res = await axiosInstance.request<any>({
    url,
    method: options.method || 'GET',
    data: options.data,
    params: options.params,
    headers: options.headers,
  });

  return res.data?.data !== undefined ? res.data.data : res.data;
}

export const apiClient = {
  auth: {
    onUnauthorized,
    async getCurrentUser(): Promise<UserProfile | null> {
      try {
        const res = await request<any>('/auth/me');
        if (res?.user) {
          return {
            id: res.user.id,
            email: res.user.email,
            name: res.user.name,
            avatarUrl: res.user.avatarUrl ?? null,
          };
        }
        if (res?.id) {
          return {
            id: res.id,
            email: res.email,
            name: res.name,
            ...(res.avatarUrl !== undefined ? { avatarUrl: res.avatarUrl } : {}),
          };
        }
        return null;
      } catch {
        return null;
      }
    },

    async loginDemo(email: string, name?: string): Promise<void> {
      await request('/auth/demo-login', {
        method: 'POST',
        data: { email: email.trim(), name: name?.trim() },
      });
    },

    async logout(): Promise<void> {
      await request('/auth/logout', { method: 'POST' });
    },
  },

  dashboard: {
    async getSummary(): Promise<DashboardSummary> {
      return request<DashboardSummary>('/api/v1/dashboard/summary');
    },
  },

  emails: {
    async getScheduled(page = 1, limit = 50): Promise<{ items: EmailRecord[]; total: number }> {
      const res = await request<any>('/api/v1/emails/scheduled', {
        params: { page, limit },
      });
      const items = (Array.isArray(res) ? res : res.items || res.data || []) as EmailRecord[];
      const total = res.meta?.total ?? res.total ?? items.length;
      return { items, total };
    },

    async getSent(page = 1, limit = 50): Promise<{ items: EmailRecord[]; total: number }> {
      const res = await request<any>('/api/v1/emails/sent', {
        params: { page, limit },
      });
      const items = (Array.isArray(res) ? res : res.items || res.data || []) as EmailRecord[];
      const total = res.meta?.total ?? res.total ?? items.length;
      return { items, total };
    },

    async scheduleBatch(payload: ScheduleBatchPayload): Promise<{ scheduledCount: number; emails: EmailRecord[] }> {
      const leads = payload.recipients.map((email) => ({ email }));
      return request<{ scheduledCount: number; emails: EmailRecord[] }>('/api/v1/emails/batch', {
        method: 'POST',
        data: {
          senderId: payload.senderId,
          leads,
          subject: payload.subject,
          body: payload.body,
          startTime: payload.scheduledAt,
          delayBetweenEmailsSeconds: payload.delaySecondsBetweenSends || 2,
          hourlyLimit: payload.hourlyLimit || 200,
          attachments: payload.attachments,
        },
      });
    },

    async delete(emailId: string): Promise<void> {
      await request(`/api/v1/emails/${emailId}`, {
        method: 'DELETE',
      });
    },

    async cancel(emailId: string): Promise<void> {
      await request(`/api/v1/emails/${emailId}`, {
        method: 'DELETE',
      });
    },
  },

  search: {
    async searchEmails(query: string): Promise<{ items: EmailRecord[]; total: number }> {
      const res = await request<any>('/api/v1/search', {
        params: { q: query },
      });
      const items = (Array.isArray(res) ? res : res.items || res.data || []) as EmailRecord[];
      const total = res.meta?.total ?? res.total ?? items.length;
      return { items, total };
    },
  },

  slack: {
    async getStatus(): Promise<SlackStatus> {
      try {
        return await request<SlackStatus>('/integrations/slack/status');
      } catch {
        return { connected: false };
      }
    },
    async sendTestAlert(): Promise<{ success: boolean; message: string }> {
      return request<{ success: boolean; message: string }>('/integrations/slack/test-alert', {
        method: 'POST',
      });
    },
    async disconnect(): Promise<{ disconnected: boolean }> {
      return request<{ disconnected: boolean }>('/integrations/slack/disconnect', {
        method: 'POST',
      });
    },
  },

  integrations: {
    async getSlackStatus(): Promise<SlackStatus> {
      try {
        return await request<SlackStatus>('/integrations/slack/status');
      } catch {
        return { connected: false };
      }
    },
    async sendSlackTestAlert(): Promise<{ success: boolean; message: string }> {
      return request<{ success: boolean; message: string }>('/integrations/slack/test-alert', {
        method: 'POST',
      });
    },
    async disconnectSlack(): Promise<{ disconnected: boolean }> {
      return request<{ disconnected: boolean }>('/integrations/slack/disconnect', {
        method: 'POST',
      });
    },
    async disconnectGoogle(): Promise<{ message: string }> {
      return request<{ message: string }>('/auth/google/disconnect', {
        method: 'POST',
      });
    },
    async saveSmtp(config: {
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPass: string;
      smtpSecure?: boolean;
      name?: string;
      email?: string;
      hourlyLimit?: number;
      minDelaySeconds?: number;
    }): Promise<{ success: boolean; data: { message: string; sender: any } }> {
      return request('/auth/smtp/save', {
        method: 'POST',
        data: config,
      });
    },
    async disconnectSmtp(): Promise<{ message: string }> {
      return request<{ message: string }>('/auth/smtp/disconnect', {
        method: 'POST',
      });
    },
  },
};
