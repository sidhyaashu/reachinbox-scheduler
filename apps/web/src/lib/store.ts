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

export const hasDraftContent = (draft: Partial<ComposeDraft> | null | undefined): boolean => {
  if (!draft) return false;
  const hasRecipients = Array.isArray(draft.recipients) && draft.recipients.some((r) => r && r.trim().length > 0);
  const hasSubject = Boolean(draft.subject && draft.subject.trim().length > 0);
  const cleanBody = (draft.body || '').replace(/<[^>]*>/g, '').trim();
  const hasBody = cleanBody.length > 0;
  return hasRecipients || hasSubject || hasBody;
};

interface SchedulerState {
  // User & Profile
  user: UserProfile | null;
  sender: DashboardSummary['sender'] | null;
  slackIntegration: DashboardSummary['slackIntegration'] | null;
  // Navigation & Active View
  activeTab: 'scheduled' | 'sent' | 'archive' | 'drafts' | 'trash' | 'integrations';
  mobileSidebarOpen: boolean;
  filterStatus: 'ALL' | 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';
  // Email Records
  scheduledEmails: EmailRecord[];
  sentEmails: EmailRecord[];
  archivedEmailIds: string[];
  trashedEmailIds: string[];
  starredEmailIds: string[];
  counts: { scheduled: number; sent: number; archive: number; drafts: number; trash: number };
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
  setActiveTab: (tab: 'scheduled' | 'sent' | 'archive' | 'drafts' | 'trash' | 'integrations') => void;
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
  moveToTrash: (emailId: string) => Promise<void>;
  restoreFromTrash: (emailId: string) => void;
  permanentDeleteEmail: (emailId: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
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

const getInitialTrashed = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('reachinbox_trashed_emails');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getInitialDraft = (): ComposeDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('reachinbox_compose_draft');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return hasDraftContent(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const initialDraft = getInitialDraft();
const initialArchived = getInitialArchived();
const initialTrashed = getInitialTrashed();
const initialStarred = getInitialStarred();

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
  user: null,
  sender: null,
  slackIntegration: null,
  activeTab: 'scheduled',
  mobileSidebarOpen: false,
  filterStatus: 'ALL',
  scheduledEmails: [],
  sentEmails: [],
  archivedEmailIds: initialArchived,
  trashedEmailIds: initialTrashed,
  starredEmailIds: initialStarred,
  counts: {
    scheduled: 0,
    sent: 0,
    archive: initialArchived.length,
    drafts: hasDraftContent(initialDraft) ? 1 : 0,
    trash: initialTrashed.length,
  },
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
    if (!get().user) {
      set({ isLoading: true, errorMessage: null });
    } else {
      set({ isRefreshing: true, errorMessage: null });
    }
    try {
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
      const trashedIds = get().trashedEmailIds;

      const activeScheduled = scheduledItems.filter(
        (e) => !archivedIds.includes(e.id) && !trashedIds.includes(e.id)
      );
      const activeSent = sentItems.filter(
        (e) => !archivedIds.includes(e.id) && !trashedIds.includes(e.id)
      );
      const activeArchived = [...scheduledItems, ...sentItems].filter(
        (e) => archivedIds.includes(e.id) && !trashedIds.includes(e.id)
      );
      const activeTrashed = [...scheduledItems, ...sentItems].filter((e) => trashedIds.includes(e.id));

      const currentSelected = get().selectedEmail;
      let updatedSelected = currentSelected;
      let shouldOpenDetail = get().detailOpen;
      if (currentSelected) {
        const found = [...scheduledItems, ...sentItems].find((e) => e.id === currentSelected.id);
        if (found) {
          updatedSelected = found;
        }
      } else if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlEmailId = params.get('emailId');
        if (urlEmailId) {
          const found = [...scheduledItems, ...sentItems].find((e) => e.id === urlEmailId);
          if (found) {
            updatedSelected = found;
            shouldOpenDetail = true;
          }
        }
      }

      set({
        user,
        sender: summary?.sender || null,
        slackIntegration: summary?.slackIntegration || null,
        scheduledEmails: scheduledItems,
        sentEmails: sentItems,
        selectedEmail: updatedSelected,
        detailOpen: shouldOpenDetail,
        counts: {
          scheduled: activeScheduled.length,
          sent: activeSent.length,
          archive: activeArchived.length,
          drafts: hasDraftContent(get().composeDraft) ? 1 : 0,
          trash: activeTrashed.length,
        },
        isLoading: false,
        isRefreshing: false,
      });
    } catch (err: any) {
      set({ isLoading: false, isRefreshing: false, errorMessage: err.message });
    }
  },

  setActiveTab: (tab: 'scheduled' | 'sent' | 'archive' | 'drafts' | 'trash' | 'integrations') => {
    set({
      activeTab: tab,
      filterStatus: 'ALL',
      selectedEmail: null,
      detailOpen: false,
      composeOpen: false,
      mobileSidebarOpen: false,
    });
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
    const valid = hasDraftContent(updated);
    if (typeof window !== 'undefined') {
      if (valid) {
        localStorage.setItem('reachinbox_compose_draft', JSON.stringify(updated));
      } else {
        localStorage.removeItem('reachinbox_compose_draft');
      }
    }
    set((state) => ({
      composeDraft: valid ? updated : null,
      counts: { ...state.counts, drafts: valid ? 1 : 0 },
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
        const trashedIds = state.trashedEmailIds;
        const activeScheduled = state.scheduledEmails.filter(
          (e) => !updated.includes(e.id) && !trashedIds.includes(e.id)
        );
        const activeSent = state.sentEmails.filter(
          (e) => !updated.includes(e.id) && !trashedIds.includes(e.id)
        );
        return {
          archivedEmailIds: updated,
          detailOpen: false,
          selectedEmail: null,
          counts: {
            ...state.counts,
            archive: updated.filter((id) => !trashedIds.includes(id)).length,
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
      const trashedIds = state.trashedEmailIds;
      const activeScheduled = state.scheduledEmails.filter(
        (e) => !updated.includes(e.id) && !trashedIds.includes(e.id)
      );
      const activeSent = state.sentEmails.filter(
        (e) => !updated.includes(e.id) && !trashedIds.includes(e.id)
      );
      return {
        archivedEmailIds: updated,
        counts: {
          ...state.counts,
          archive: updated.filter((id) => !trashedIds.includes(id)).length,
          scheduled: activeScheduled.length,
          sent: activeSent.length,
        },
      };
    });
  },

  moveToTrash: async (emailId: string) => {
    const currentTrashed = get().trashedEmailIds;
    const updatedTrashed = currentTrashed.includes(emailId) ? currentTrashed : [...currentTrashed, emailId];
    if (typeof window !== 'undefined') {
      localStorage.setItem('reachinbox_trashed_emails', JSON.stringify(updatedTrashed));
    }

    set((state) => {
      const archivedEmailIds = state.archivedEmailIds.filter((id) => id !== emailId);
      const scheduledEmails = state.scheduledEmails;
      const sentEmails = state.sentEmails;
      const activeScheduled = scheduledEmails.filter((e) => !archivedEmailIds.includes(e.id) && !updatedTrashed.includes(e.id));
      const activeSent = sentEmails.filter((e) => !archivedEmailIds.includes(e.id) && !updatedTrashed.includes(e.id));
      const activeArchived = [...scheduledEmails, ...sentEmails].filter((e) => archivedEmailIds.includes(e.id) && !updatedTrashed.includes(e.id));
      const activeTrashed = [...scheduledEmails, ...sentEmails].filter((e) => updatedTrashed.includes(e.id));

      return {
        trashedEmailIds: updatedTrashed,
        archivedEmailIds,
        selectedEmail: state.selectedEmail?.id === emailId ? null : state.selectedEmail,
        detailOpen: state.selectedEmail?.id === emailId ? false : state.detailOpen,
        counts: {
          ...state.counts,
          scheduled: activeScheduled.length,
          sent: activeSent.length,
          archive: activeArchived.length,
          trash: activeTrashed.length,
        },
      };
    });

    try {
      await apiClient.emails.cancel(emailId);
    } catch (err) {
      console.warn('[store] Background cancel error:', err);
    }
  },

  restoreFromTrash: (emailId: string) => {
    const updated = get().trashedEmailIds.filter((id) => id !== emailId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('reachinbox_trashed_emails', JSON.stringify(updated));
    }
    set((state) => {
      const scheduledEmails = state.scheduledEmails;
      const sentEmails = state.sentEmails;
      const archivedEmailIds = state.archivedEmailIds;
      const activeScheduled = scheduledEmails.filter((e) => !archivedEmailIds.includes(e.id) && !updated.includes(e.id));
      const activeSent = sentEmails.filter((e) => !archivedEmailIds.includes(e.id) && !updated.includes(e.id));
      const activeArchived = [...scheduledEmails, ...sentEmails].filter((e) => archivedEmailIds.includes(e.id) && !updated.includes(e.id));
      const activeTrashed = [...scheduledEmails, ...sentEmails].filter((e) => updated.includes(e.id));

      return {
        trashedEmailIds: updated,
        counts: {
          ...state.counts,
          scheduled: activeScheduled.length,
          sent: activeSent.length,
          archive: activeArchived.length,
          trash: activeTrashed.length,
        },
      };
    });
  },

  permanentDeleteEmail: async (emailId: string) => {
    const updatedTrashed = get().trashedEmailIds.filter((id) => id !== emailId);
    const updatedArchived = get().archivedEmailIds.filter((id) => id !== emailId);
    const updatedStarred = get().starredEmailIds.filter((id) => id !== emailId);

    if (typeof window !== 'undefined') {
      localStorage.setItem('reachinbox_trashed_emails', JSON.stringify(updatedTrashed));
      localStorage.setItem('reachinbox_archived_emails', JSON.stringify(updatedArchived));
      localStorage.setItem('reachinbox_starred_emails', JSON.stringify(updatedStarred));
    }

    set((state) => {
      const scheduledEmails = state.scheduledEmails.filter((e) => e.id !== emailId);
      const sentEmails = state.sentEmails.filter((e) => e.id !== emailId);
      const searchResults = state.searchResults ? state.searchResults.filter((e) => e.id !== emailId) : null;
      const activeScheduled = scheduledEmails.filter((e) => !updatedArchived.includes(e.id) && !updatedTrashed.includes(e.id));
      const activeSent = sentEmails.filter((e) => !updatedArchived.includes(e.id) && !updatedTrashed.includes(e.id));
      const activeArchived = [...scheduledEmails, ...sentEmails].filter((e) => updatedArchived.includes(e.id) && !updatedTrashed.includes(e.id));
      const activeTrashed = [...scheduledEmails, ...sentEmails].filter((e) => updatedTrashed.includes(e.id));

      return {
        scheduledEmails,
        sentEmails,
        searchResults,
        trashedEmailIds: updatedTrashed,
        archivedEmailIds: updatedArchived,
        starredEmailIds: updatedStarred,
        selectedEmail: state.selectedEmail?.id === emailId ? null : state.selectedEmail,
        detailOpen: state.selectedEmail?.id === emailId ? false : state.detailOpen,
        counts: {
          ...state.counts,
          scheduled: activeScheduled.length,
          sent: activeSent.length,
          archive: activeArchived.length,
          trash: activeTrashed.length,
        },
      };
    });

    try {
      await apiClient.emails.delete(emailId);
    } catch (err) {
      console.warn('[store] Background delete error:', err);
    }
  },

  emptyTrash: async () => {
    const trashedIds = [...get().trashedEmailIds];
    if (trashedIds.length === 0) return;

    if (typeof window !== 'undefined') {
      localStorage.setItem('reachinbox_trashed_emails', JSON.stringify([]));
    }

    set((state) => {
      const scheduledEmails = state.scheduledEmails.filter((e) => !trashedIds.includes(e.id));
      const sentEmails = state.sentEmails.filter((e) => !trashedIds.includes(e.id));
      return {
        trashedEmailIds: [],
        scheduledEmails,
        sentEmails,
        counts: { ...state.counts, trash: 0 },
      };
    });

    await Promise.allSettled(trashedIds.map((id) => apiClient.emails.delete(id)));
  },

  setSearchQuery: async (query: string) => {
    set({ searchQuery: query });
    const trimmed = query.trim();
    if (!trimmed) {
      set({ searchResults: null, isSearching: false });
      return;
    }

    const reqId = ++activeSearchRequestId;
    set({ isSearching: true });

    const q = trimmed.toLowerCase();
    const all = [...get().scheduledEmails, ...get().sentEmails];
    const localMatches = all.filter(
      (e) =>
        (e.recipient && e.recipient.toLowerCase().includes(q)) ||
        (e.subject && e.subject.toLowerCase().includes(q)) ||
        (e.body && e.body.toLowerCase().includes(q))
    );

    try {
      const res = await apiClient.search.searchEmails(trimmed);
      if (reqId === activeSearchRequestId && get().searchQuery === query) {
        const items = res.items && res.items.length > 0 ? res.items : localMatches;
        set({ searchResults: items, isSearching: false });
      }
    } catch {
      if (reqId === activeSearchRequestId) {
        set({ searchResults: localMatches, isSearching: false });
      }
    }
  },

  cancelEmail: async (emailId: string) => {
    await get().moveToTrash(emailId);
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
