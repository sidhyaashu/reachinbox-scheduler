export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
}

export interface EmailRecord {
  id: string;
  user_id: string;
  sender_id: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'QUEUED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'DEFERRED' | 'CANCELLED';
  scheduled_at: string;
  sent_at?: string;
  ethereal_message_url?: string;
  attempts: number;
  last_error?: string;
  created_at: string;
}

export interface DashboardSummary {
  user: {
    id: string;
    email: string;
    name: string;
    avatar_url?: string;
  };
  metrics: {
    totalScheduled: number;
    totalSent: number;
    totalFailed: number;
    totalDeferred: number;
    deliverySuccessRate: number;
  };
  slack: {
    connected: boolean;
    channelName?: string;
  };
  defaultSender?: {
    id: string;
    email: string;
    hourlyLimit: number;
    minDelaySeconds: number;
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
  installedAt?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Ensure cookies are passed
  });

  if (!res.ok) {
    let errMsg = `Request failed with status ${res.status}`;
    try {
      const errorJson = await res.json();
      errMsg = errorJson?.error?.message || errorJson?.message || errMsg;
    } catch {
      // keep fallback
    }
    throw new Error(errMsg);
  }

  const json = await res.json();
  return json.data ?? json;
}

export const api = {
  async getCurrentUser(): Promise<{ user: UserProfile; defaultSenderId?: string } | null> {
    try {
      return await request<{ user: UserProfile; defaultSenderId?: string }>('/auth/me');
    } catch {
      return null;
    }
  },

  async loginWithDemo(email = 'alex.founder@reachinbox.ai', name = 'Alex Founder'): Promise<{ user: UserProfile }> {
    return request<{ user: UserProfile }>('/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    });
  },

  async logout(): Promise<void> {
    await request('/auth/logout', { method: 'POST' });
  },

  async getDashboardSummary(): Promise<DashboardSummary> {
    return request<DashboardSummary>('/api/v1/dashboard/summary');
  },

  async getScheduledEmails(page = 1, limit = 50): Promise<{ emails: EmailRecord[]; total: number }> {
    return request<{ emails: EmailRecord[]; total: number }>(`/api/v1/emails/scheduled?page=${page}&limit=${limit}`);
  },

  async getSentEmails(page = 1, limit = 50): Promise<{ emails: EmailRecord[]; total: number }> {
    return request<{ emails: EmailRecord[]; total: number }>(`/api/v1/emails/sent?page=${page}&limit=${limit}`);
  },

  async scheduleBatch(payload: ScheduleBatchPayload): Promise<{ scheduledCount: number; jobIds: string[] }> {
    return request<{ scheduledCount: number; jobIds: string[] }>('/api/v1/emails/batch-schedule', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async cancelEmail(id: string): Promise<{ success: boolean; id: string; status: string }> {
    return request<{ success: boolean; id: string; status: string }>(`/api/v1/emails/${id}/cancel`, {
      method: 'POST',
    });
  },

  async searchEmails(query: string, status?: string): Promise<{ results: EmailRecord[]; total: number }> {
    const params = new URLSearchParams({ q: query });
    if (status) params.append('status', status);
    return request<{ results: EmailRecord[]; total: number }>(`/api/v1/search?${params.toString()}`);
  },

  async getSlackStatus(): Promise<SlackStatus> {
    return request<SlackStatus>('/integrations/slack/status');
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
};
