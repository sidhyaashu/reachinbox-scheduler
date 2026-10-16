import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSchedulerStore, hasDraftContent } from '../lib/store.js';
import { apiClient, EmailRecord } from '../lib/api-client.js';

describe('Zustand Scheduler Store', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Reset Zustand store state to defaults
    useSchedulerStore.setState({
      user: null,
      sender: null,
      activeTab: 'scheduled',
      mobileSidebarOpen: false,
      filterStatus: 'ALL',
      scheduledEmails: [],
      sentEmails: [],
      archivedEmailIds: [],
      trashedEmailIds: [],
      starredEmailIds: [],
      counts: { scheduled: 0, sent: 0, archive: 0, drafts: 0, trash: 0 },
      selectedEmail: null,
      detailOpen: false,
      composeOpen: false,
      sendLaterOpen: false,
      composeDraft: null,
      searchQuery: '',
      searchResults: null,
      isSearching: false,
      isLoading: false,
      isRefreshing: false,
      errorMessage: null,
    });
  });

  it('updates activeTab and resets detailOpen & filterStatus correctly', () => {
    useSchedulerStore.getState().setActiveTab('sent');
    expect(useSchedulerStore.getState().activeTab).toBe('sent');
    expect(useSchedulerStore.getState().detailOpen).toBe(false);
    expect(useSchedulerStore.getState().filterStatus).toBe('ALL');
  });

  it('correctly evaluates hasDraftContent', () => {
    expect(hasDraftContent(null)).toBe(false);
    expect(hasDraftContent({ recipients: [], subject: '', body: '' })).toBe(false);
    expect(hasDraftContent({ recipients: [], subject: '   ', body: '<p><br></p>' })).toBe(false);
    expect(hasDraftContent({ recipients: ['alex@company.com'], subject: '', body: '' })).toBe(true);
    expect(hasDraftContent({ recipients: [], subject: 'Hello', body: '' })).toBe(true);
    expect(hasDraftContent({ recipients: [], subject: '', body: 'Sample message' })).toBe(true);
  });

  it('manages compose drafts with partial updates and clears correctly', () => {
    const store = useSchedulerStore.getState();
    expect(store.composeDraft).toBeNull();
    expect(store.counts.drafts).toBe(0);

    store.setComposeDraft({
      subject: 'Special Outreach Offer',
      recipients: ['alex@company.com'],
    });

    expect(useSchedulerStore.getState().composeDraft).toEqual({
      recipients: ['alex@company.com'],
      subject: 'Special Outreach Offer',
      body: '',
      delaySeconds: 2,
      hourlyLimit: 200,
      scheduledAt: '',
    });
    expect(useSchedulerStore.getState().counts.drafts).toBe(1);

    // Update body partially
    useSchedulerStore.getState().setComposeDraft({ body: 'Hello Alex, check our product.' });
    expect(useSchedulerStore.getState().composeDraft?.body).toBe('Hello Alex, check our product.');
    expect(useSchedulerStore.getState().composeDraft?.subject).toBe('Special Outreach Offer');

    // Clear draft resets count to 0
    useSchedulerStore.getState().clearComposeDraft();
    expect(useSchedulerStore.getState().composeDraft).toBeNull();
    expect(useSchedulerStore.getState().counts.drafts).toBe(0);
  });

  it('selects email and toggles detailOpen', () => {
    const mockEmail: EmailRecord = {
      id: 'email-1',
      userId: 'user-1',
      senderId: 'sender-1',
      recipient: 'lead@startup.co',
      subject: 'Follow up',
      body: 'Checking in',
      status: 'SCHEDULED',
      scheduledAt: new Date().toISOString(),
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    useSchedulerStore.getState().selectEmail(mockEmail);
    expect(useSchedulerStore.getState().selectedEmail).toEqual(mockEmail);
    expect(useSchedulerStore.getState().detailOpen).toBe(true);

    useSchedulerStore.getState().closeDetail();
    expect(useSchedulerStore.getState().selectedEmail).toBeNull();
    expect(useSchedulerStore.getState().detailOpen).toBe(false);
  });

  it('handles search query clearing and results reset', async () => {
    useSchedulerStore.getState().setSearchQuery('');
    expect(useSchedulerStore.getState().searchQuery).toBe('');
    expect(useSchedulerStore.getState().searchResults).toBeNull();
    expect(useSchedulerStore.getState().isSearching).toBe(false);
  });

  it('moves email to trash optimistically and updates counts instantly', async () => {
    const mockEmail: EmailRecord = {
      id: 'email-cancel-me',
      userId: 'user-1',
      senderId: 'sender-1',
      recipient: 'lead@startup.co',
      subject: 'Follow up',
      body: 'Checking in',
      status: 'SCHEDULED',
      scheduledAt: new Date().toISOString(),
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    useSchedulerStore.setState({
      scheduledEmails: [mockEmail],
      counts: { scheduled: 1, sent: 0, archive: 0, drafts: 0, trash: 0 },
      selectedEmail: mockEmail,
      detailOpen: true,
    });

    vi.spyOn(apiClient.emails, 'cancel').mockResolvedValueOnce();

    await useSchedulerStore.getState().cancelEmail('email-cancel-me');

    expect(useSchedulerStore.getState().trashedEmailIds).toContain('email-cancel-me');
    expect(useSchedulerStore.getState().counts.scheduled).toBe(0);
    expect(useSchedulerStore.getState().counts.trash).toBe(1);
    expect(useSchedulerStore.getState().detailOpen).toBe(false);
    expect(useSchedulerStore.getState().selectedEmail).toBeNull();

    // Restore from trash
    useSchedulerStore.getState().restoreFromTrash('email-cancel-me');
    expect(useSchedulerStore.getState().trashedEmailIds).not.toContain('email-cancel-me');
    expect(useSchedulerStore.getState().counts.scheduled).toBe(1);
    expect(useSchedulerStore.getState().counts.trash).toBe(0);
  });
});
