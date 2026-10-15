import { create } from 'zustand';
import { apiClient, UserProfile, EmailRecord, ScheduleBatchPayload, DashboardSummary } from './api-client';

export interface ComposeDraft {
  recipients: string[];
  subject: string;
  body: string;
  delaySeconds: number;
  hourlyLimit: number;
  scheduledAt: string;
}

interface SchedulerState {
  // User & Profile
  user: UserProfile | null;
  sender: DashboardSummary['sender'] | null;
  // Navigation & Active View
  activeTab: 'scheduled' | 'sent' | 'archive' | 'drafts';
  mobileSidebarOpen: boolean;
  filterStatus: 'ALL' | 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';
  // Email Records
  scheduledEmails: EmailRecord[];
  sentEmails: EmailRecord[];
  archivedEmailIds: string[];
  starredEmailIds: string[];
  counts: { scheduled: number; sent: number; archive: number; drafts: number };
  // Selected Email for Detail View
  selectedEmail: EmailRecord | null;
  detailOpen: boolean;
  // Compose Screen state
  composeOpen: boolean;
  sendLaterOpen: boolean;
  composeDraft: ComposeDraft | null;
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
  setActiveTab: (tab: 'scheduled' | 'sent' | 'archive' | 'drafts') => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setFilterStatus: (status: 'ALL' | 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED') => void;
  selectEmail: (email: EmailRecord) => void;
  closeDetail: () => void;
  openCompose: () => void;
  closeCompose: () => void;
  openSendLater: () => void;
  closeSendLater: () => void;
  setComposeDraft: (draft: Partial<ComposeDraft>) => void;
  clearComposeDraft: () => void;
  toggleStar: (emailId: string) => void;
  archiveEmail: (emailId: string) => void;
  unarchiveEmail: (emailId: string) => void;
  setSearchQuery: (query: string) => void;
  cancelEmail: (emailId: string) => Promise<void>;
  scheduleCampaign: (payload: ScheduleBatchPayload) => Promise<{ scheduledCount: number }>;
  logout: () => Promise<void>;
}

let activeSearchRequestId = 0;

const getInitialStarred = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('reachinbox_starred_emails');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getInitialArchived = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('reachinbox_archived_emails');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getInitialDraft = (): ComposeDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('reachinbox_compose_draft');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const initialDraft = getInitialDraft();
const initialArchived = getInitialArchived();
const initialStarred = getInitialStarred();

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
  user: null,
  sender: null,
  activeTab: 'scheduled',
  mobileSidebarOpen: false,
  filterStatus: 'ALL',
  scheduledEmails: [],
  sentEmails: [],
  archivedEmailIds: initialArchived,
  starredEmailIds: initialStarred,
  counts: { scheduled: 0, sent: 0, archive: initialArchived.length, drafts: initialDraft ? 1 : 0 },
  selectedEmail: null,
  detailOpen: false,
  composeOpen: false,
  sendLaterOpen: false,
  composeDraft: initialDraft,
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
      if (!user || !user.avatarUrl) {
        const me = await apiClient.auth.getCurrentUser().catch(() => null);
        if (me) {
          user = {
            id: user?.id || me.id,
            email: user?.email || me.email,
            name: user?.name || me.name,
            avatarUrl: user?.avatarUrl || me.avatarUrl || null,
          };
        }
      }

      const scheduledItems = scheduledRes.items.length > 0 ? scheduledRes.items : (summary?.scheduledEmails || []);
      const sentItems = sentRes.items.length > 0 ? sentRes.items : (summary?.sentEmails || []);

      const archivedIds = get().archivedEmailIds;
      const activeScheduled = scheduledItems.filter((e) => !archivedIds.includes(e.id));
      const activeSent = sentItems.filter((e) => !archivedIds.includes(e.id));

      set({
        user,
        sender: summary?.sender || null,
        scheduledEmails: scheduledItems,
        sentEmails: sentItems,
        counts: {
          scheduled: activeScheduled.length,
          sent: activeSent.length,
          archive: archivedIds.length,
          drafts: get().composeDraft ? 1 : 0,
        },
        isLoading: false,
        isRefreshing: false,
      });
    } catch (err: any) {
      set({ isLoading: false, isRefreshing: false, errorMessage: err.message });
    }
  },

  setActiveTab: (tab: 'scheduled' | 'sent' | 'archive' | 'drafts') => {
    if (tab === 'drafts') {
      set({ composeOpen: true, detailOpen: false, mobileSidebarOpen: false });
      return;
    }
    set({ activeTab: tab, selectedEmail: null, detailOpen: false, composeOpen: false, mobileSidebarOpen: false });
  },

  setMobileSidebarOpen: (open: boolean) => {
    set({ mobileSidebarOpen: open });
  },

  setFilterStatus: (status: 'ALL' | 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED') => {
    set({ filterStatus: status });
  },

  selectEmail: (email: EmailRecord) => {
    set({ selectedEmail: email, detailOpen: true, composeOpen: false, mobileSidebarOpen: false });
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

  setComposeDraft: (draft: Partial<ComposeDraft>) => {
    const existing = get().composeDraft || {
      recipients: [],
      subject: '',
      body: '',
      delaySeconds: 2,
      hourlyLimit: 200,
      scheduledAt: '',
    };
    const updated: ComposeDraft = {
      recipients: draft.recipients !== undefined ? draft.recipients : existing.recipients,
      subject: draft.subject !== undefined ? draft.subject : existing.subject,
      body: draft.body !== undefined ? draft.body : existing.body,
      delaySeconds: draft.delaySeconds !== undefined ? draft.delaySeconds : existing.delaySeconds,
      hourlyLimit: draft.hourlyLimit !== undefined ? draft.hourlyLimit : existing.hourlyLimit,
      scheduledAt: draft.scheduledAt !== undefined ? draft.scheduledAt : existing.scheduledAt,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('reachinbox_compose_draft', JSON.stringify(updated));
    }
    set((state) => ({
      composeDraft: updated,
      counts: { ...state.counts, drafts: 1 },
    }));
  },

  clearComposeDraft: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('reachinbox_compose_draft');
    }
    set((state) => ({
      composeDraft: null,
      counts: { ...state.counts, drafts: 0 },
    }));
  },

  toggleStar: (emailId: string) => {
    const current = get().starredEmailIds;
    const updated = current.includes(emailId)
      ? current.filter((id) => id !== emailId)
      : [...current, emailId];
    if (typeof window !== 'undefined') {
      localStorage.setItem('reachinbox_starred_emails', JSON.stringify(updated));
    }
    set({ starredEmailIds: updated });
  },

  archiveEmail: (emailId: string) => {
    const current = get().archivedEmailIds;
    if (!current.includes(emailId)) {
      const updated = [...current, emailId];
      if (typeof window !== 'undefined') {
        localStorage.setItem('reachinbox_archived_emails', JSON.stringify(updated));
      }
      set((state) => {
        const activeScheduled = state.scheduledEmails.filter((e) => !updated.includes(e.id));
        const activeSent = state.sentEmails.filter((e) => !updated.includes(e.id));
        return {
          archivedEmailIds: updated,
          detailOpen: false,
          selectedEmail: null,
          counts: {
            ...state.counts,
            archive: updated.length,
            scheduled: activeScheduled.length,
            sent: activeSent.length,
          },
        };
      });
    }
  },

  unarchiveEmail: (emailId: string) => {
    const updated = get().archivedEmailIds.filter((id) => id !== emailId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('reachinbox_archived_emails', JSON.stringify(updated));
    }
    set((state) => {
      const activeScheduled = state.scheduledEmails.filter((e) => !updated.includes(e.id));
      const activeSent = state.sentEmails.filter((e) => !updated.includes(e.id));
      return {
        archivedEmailIds: updated,
        counts: {
          ...state.counts,
          archive: updated.length,
          scheduled: activeScheduled.length,
          sent: activeSent.length,
        },
      };
    });
  },

  setSearchQuery: async (query: string) => {
    set({ searchQuery: query });
    if (!query.trim() || query.length < 2) {
      set({ searchResults: null, isSearching: false });
      return;
    }

    const reqId = ++activeSearchRequestId;
    set({ isSearching: true });
    try {
      const res = await apiClient.search.searchEmails(query);
      if (reqId === activeSearchRequestId && get().searchQuery === query) {
        set({ searchResults: res.items, isSearching: false });
      }
    } catch {
      if (reqId === activeSearchRequestId) {
        set({ isSearching: false });
      }
    }
  },

  cancelEmail: async (emailId: string) => {
    await apiClient.emails.cancel(emailId);
    set((state) => {
      const scheduledEmails = state.scheduledEmails.filter((e) => e.id !== emailId);
      const sentEmails = state.sentEmails.filter((e) => e.id !== emailId);
      const searchResults = state.searchResults ? state.searchResults.filter((e) => e.id !== emailId) : null;
      const archivedEmailIds = state.archivedEmailIds.filter((id) => id !== emailId);
      const starredEmailIds = state.starredEmailIds.filter((id) => id !== emailId);

      if (typeof window !== 'undefined') {
        localStorage.setItem('reachinbox_archived_emails', JSON.stringify(archivedEmailIds));
        localStorage.setItem('reachinbox_starred_emails', JSON.stringify(starredEmailIds));
      }

      return {
        scheduledEmails,
        sentEmails,
        searchResults,
        archivedEmailIds,
        starredEmailIds,
        counts: {
          ...state.counts,
          scheduled: scheduledEmails.filter((e) => !archivedEmailIds.includes(e.id)).length,
          sent: sentEmails.filter((e) => !archivedEmailIds.includes(e.id)).length,
          archive: archivedEmailIds.length,
        },
        selectedEmail: state.selectedEmail?.id === emailId ? null : state.selectedEmail,
        detailOpen: state.selectedEmail?.id === emailId ? false : state.detailOpen,
      };
    });
  },

  scheduleCampaign: async (payload: ScheduleBatchPayload) => {
    const res = await apiClient.emails.scheduleBatch(payload);
    get().clearComposeDraft();
    await get().loadDashboard();
    set({ activeTab: 'scheduled', composeOpen: false });
    return res;
  },

  logout: async () => {
    await apiClient.auth.logout();
    set({ user: null, sender: null });
  },
}));

// Global listener for 401 Unauthorized to invalidate session state immediately
apiClient.auth.onUnauthorized(() => {
  useSchedulerStore.setState({
    user: null,
    sender: null,
    isLoading: false,
  });
});
