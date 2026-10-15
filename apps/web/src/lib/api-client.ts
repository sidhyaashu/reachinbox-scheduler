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

export interface EmailRecord {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'QUEUED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'DEFERRED' | 'CANCELLED';
  scheduledAt: string;
  sentAt?: string | null;
  etherealMessageUrl?: string | null;
  attempts: number;
  lastError?: string | null;
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
}

export interface SlackStatus {
  connected: boolean;
  teamName?: string;
  channelName?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Ensure reachinbox_session cookie is sent
  });

  if (!res.ok) {
    let errMsg = `Request failed with status ${res.status}`;
    try {
      const errorJson = await res.json();
      errMsg = errorJson?.error?.message || errorJson?.message || errMsg;
    } catch {
      // fallback
    }
    throw new Error(errMsg);
  }

  const json = await res.json();
  return json.data ?? json;
}

export const apiClient = {
  auth: {
    async getCurrentUser(): Promise<{ id: string; email: string; name: string } | null> {
      try {
        const res = await request<{ id: string; email: string; name: string }>('/auth/me');
        return res;
      } catch {
        return null;
      }
    },

    async loginDemo(email = 'alex.founder@reachinbox.ai', name = 'Oliver Brown'): Promise<void> {
      await request('/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ email, name }),
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
      const res = await request<{ items?: EmailRecord[]; data?: EmailRecord[]; meta?: { total: number }; total?: number }>(
        `/api/v1/emails/scheduled?page=${page}&limit=${limit}`
      );
      const items = (Array.isArray(res) ? res : res.items || res.data || []) as EmailRecord[];
      const total = res.meta?.total ?? res.total ?? items.length;
      return { items, total };
    },

    async getSent(page = 1, limit = 50): Promise<{ items: EmailRecord[]; total: number }> {
      const res = await request<{ items?: EmailRecord[]; data?: EmailRecord[]; meta?: { total: number }; total?: number }>(
        `/api/v1/emails/sent?page=${page}&limit=${limit}`
      );
      const items = (Array.isArray(res) ? res : res.items || res.data || []) as EmailRecord[];
      const total = res.meta?.total ?? res.total ?? items.length;
      return { items, total };
    },

    async scheduleBatch(payload: ScheduleBatchPayload): Promise<{ scheduledCount: number; emails: EmailRecord[] }> {
      const leads = payload.recipients.map((email) => ({ email }));
      return request<{ scheduledCount: number; emails: EmailRecord[] }>('/api/v1/emails/batch', {
        method: 'POST',
        body: JSON.stringify({
          senderId: payload.senderId,
          leads,
          subject: payload.subject,
          body: payload.body,
          startTime: payload.scheduledAt,
          delayBetweenEmailsSeconds: payload.delaySecondsBetweenSends || 2,
          hourlyLimit: payload.hourlyLimit || 200,
        }),
      });
    },

    async cancel(emailId: string): Promise<void> {
      try {
        await request(`/api/v1/emails/${emailId}`, {
          method: 'DELETE',
        });
      } catch {
        await request(`/api/v1/emails/${emailId}/cancel`, {
          method: 'POST',
        });
      }
    },
  },

  search: {
    async searchEmails(query: string): Promise<{ items: EmailRecord[]; total: number }> {
      const res = await request<{ items?: EmailRecord[]; data?: EmailRecord[]; meta?: { total: number }; total?: number }>(
        `/api/v1/search?q=${encodeURIComponent(query)}`
      );
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
  },
};
