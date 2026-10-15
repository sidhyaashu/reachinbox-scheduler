import { create } from 'zustand';
import { apiClient, UserProfile, EmailRecord, ScheduleBatchPayload } from './api-client';

interface SchedulerState {
  // User & Profile
  user: UserProfile | null;
  // Navigation & Active View
  activeTab: 'scheduled' | 'sent';
  // Email Records
  scheduledEmails: EmailRecord[];
  sentEmails: EmailRecord[];
  counts: { scheduled: number; sent: number };
  // Selected Email for Detail View (Image 6)
  selectedEmail: EmailRecord | null;
  detailOpen: boolean;
  // Compose Screen state
  composeOpen: boolean;
  sendLaterOpen: boolean;
  // Search
  searchQuery: string;
  searchResults: EmailRecord[] | null;
  isSearching: boolean;
  // Global Loading States
  isLoading: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;

  // Actions
  loadDashboard: () => Promise<void>;
  setActiveTab: (tab: 'scheduled' | 'sent') => void;
  selectEmail: (email: EmailRecord) => void;
  closeDetail: () => void;
  openCompose: () => void;
  closeCompose: () => void;
  openSendLater: () => void;
  closeSendLater: () => void;
  setSearchQuery: (query: string) => void;
  cancelEmail: (emailId: string) => Promise<void>;
  scheduleCampaign: (payload: ScheduleBatchPayload) => Promise<{ scheduledCount: number }>;
  logout: () => Promise<void>;
}

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'oliver.brown@domain.io',
    name: 'Oliver Brown',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  activeTab: 'scheduled',
  scheduledEmails: [],
  sentEmails: [],
  counts: { scheduled: 12, sent: 785 },
  selectedEmail: null,
  detailOpen: false,
  composeOpen: false,
  sendLaterOpen: false,
  searchQuery: '',
  searchResults: null,
  isSearching: false,
  isLoading: true,
  isRefreshing: false,
  errorMessage: null,

  loadDashboard: async () => {
    set({ isLoading: true, errorMessage: null });
    try {
      // 1. Load user, scheduled, and sent concurrently via centralized API client
      const [summary, scheduledRes, sentRes] = await Promise.all([
        apiClient.dashboard.getSummary().catch(() => null),
        apiClient.emails.getScheduled(1, 100).catch(() => ({ items: [], total: 0 })),
        apiClient.emails.getSent(1, 100).catch(() => ({ items: [], total: 0 })),
      ]);

      const user = summary?.user
        ? {
            id: summary.user.id,
            email: summary.user.email || 'oliver.brown@domain.io',
            name: summary.user.name || 'Oliver Brown',
            avatarUrl: summary.user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          }
        : get().user;

      const scheduledItems = scheduledRes.items.length > 0 ? scheduledRes.items : [];
      const sentItems = sentRes.items.length > 0 ? sentRes.items : [];

      set({
        user,
        scheduledEmails: scheduledItems,
        sentEmails: sentItems,
        counts: {
          scheduled: Math.max(scheduledRes.total, scheduledItems.length),
          sent: Math.max(sentRes.total, sentItems.length),
        },
        isLoading: false,
        isRefreshing: false,
      });
    } catch (err: any) {
      set({ isLoading: false, isRefreshing: false, errorMessage: err.message });
    }
  },

  setActiveTab: (tab: 'scheduled' | 'sent') => {
    set({ activeTab: tab, selectedEmail: null, detailOpen: false });
  },

  selectEmail: (email: EmailRecord) => {
    set({ selectedEmail: email, detailOpen: true });
  },

  closeDetail: () => {
    set({ selectedEmail: null, detailOpen: false });
  },

  openCompose: () => {
    set({ composeOpen: true, detailOpen: false });
  },

  closeCompose: () => {
    set({ composeOpen: false, sendLaterOpen: false });
  },

  openSendLater: () => {
    set({ sendLaterOpen: true });
  },

  closeSendLater: () => {
    set({ sendLaterOpen: false });
  },

  setSearchQuery: async (query: string) => {
    set({ searchQuery: query });
    if (!query.trim() || query.length < 2) {
      set({ searchResults: null, isSearching: false });
      return;
    }

    set({ isSearching: true });
    try {
      const res = await apiClient.search.searchEmails(query);
      set({ searchResults: res.items, isSearching: false });
    } catch {
      set({ isSearching: false });
    }
  },

  cancelEmail: async (emailId: string) => {
    await apiClient.emails.cancel(emailId);
    set((state) => ({
      scheduledEmails: state.scheduledEmails.filter((e) => e.id !== emailId),
      counts: {
        ...state.counts,
        scheduled: Math.max(0, state.counts.scheduled - 1),
      },
      selectedEmail: null,
      detailOpen: false,
    }));
  },

  scheduleCampaign: async (payload: ScheduleBatchPayload) => {
    const res = await apiClient.emails.scheduleBatch(payload);
    await get().loadDashboard();
    return res;
  },

  logout: async () => {
    await apiClient.auth.logout();
    set({ user: null });
  },
}));
