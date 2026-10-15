import { create } from 'zustand';
import { apiClient, UserProfile, EmailRecord, ScheduleBatchPayload, DashboardSummary } from './api-client';

interface SchedulerState {
  // User & Profile
  user: UserProfile | null;
  sender: DashboardSummary['sender'] | null;
  // Navigation & Active View
  activeTab: 'scheduled' | 'sent';
  mobileSidebarOpen: boolean;
  filterStatus: 'ALL' | 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';
  // Email Records
  scheduledEmails: EmailRecord[];
  sentEmails: EmailRecord[];
  counts: { scheduled: number; sent: number };
  // Selected Email for Detail View
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
  setMobileSidebarOpen: (open: boolean) => void;
  setFilterStatus: (status: 'ALL' | 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED') => void;
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
  user: null,
  sender: null,
  activeTab: 'scheduled',
  mobileSidebarOpen: false,
  filterStatus: 'ALL',
  scheduledEmails: [],
  sentEmails: [],
  counts: { scheduled: 0, sent: 0 },
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
      // Load summary and email records in parallel
      const [summary, scheduledRes, sentRes] = await Promise.all([
        apiClient.dashboard.getSummary().catch(() => null),
        apiClient.emails.getScheduled(1, 100).catch(() => ({ items: [], total: 0 })),
        apiClient.emails.getSent(1, 100).catch(() => ({ items: [], total: 0 })),
      ]);

      let user = summary?.user || null;
      if (!user) {
        const me = await apiClient.auth.getCurrentUser().catch(() => null);
        if (me) {
          user = {
            id: me.id,
            email: me.email,
            name: me.name,
            avatarUrl: null,
          };
        }
      }

      // If still unauthenticated, provide clean fallback profile
      if (!user) {
        user = {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'demo@reachinbox.ai',
          name: 'Demo User',
          avatarUrl: null,
        };
      }

      const scheduledItems = scheduledRes.items.length > 0 ? scheduledRes.items : (summary?.scheduledEmails || []);
      const sentItems = sentRes.items.length > 0 ? sentRes.items : (summary?.sentEmails || []);

      const scheduledCount = summary?.stats?.totalScheduled ?? Math.max(scheduledRes.total, scheduledItems.length);
      const sentCount = summary?.stats?.totalSent ?? Math.max(sentRes.total, sentItems.length);

      set({
        user,
        sender: summary?.sender || null,
        scheduledEmails: scheduledItems,
        sentEmails: sentItems,
        counts: {
          scheduled: scheduledCount,
          sent: sentCount,
        },
        isLoading: false,
        isRefreshing: false,
      });
    } catch (err: any) {
      set({ isLoading: false, isRefreshing: false, errorMessage: err.message });
    }
  },

  setActiveTab: (tab: 'scheduled' | 'sent') => {
    set({ activeTab: tab, selectedEmail: null, detailOpen: false, mobileSidebarOpen: false });
  },

  setMobileSidebarOpen: (open: boolean) => {
    set({ mobileSidebarOpen: open });
  },

  setFilterStatus: (status: 'ALL' | 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED') => {
    set({ filterStatus: status });
  },

  selectEmail: (email: EmailRecord) => {
    set({ selectedEmail: email, detailOpen: true, mobileSidebarOpen: false });
  },

  closeDetail: () => {
    set({ selectedEmail: null, detailOpen: false });
  },

  openCompose: () => {
    set({ composeOpen: true, detailOpen: false, mobileSidebarOpen: false });
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
    set({ activeTab: 'scheduled', composeOpen: false });
    return res;
  },

  logout: async () => {
    await apiClient.auth.logout();
    set({ user: null });
  },
}));
