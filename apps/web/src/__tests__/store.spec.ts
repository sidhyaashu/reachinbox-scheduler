import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSchedulerStore } from '../lib/store.js';
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
      counts: { scheduled: 0, sent: 0 },
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

  it('manages compose drafts with partial updates and clears correctly', () => {
    const store = useSchedulerStore.getState();
    expect(store.composeDraft).toBeNull();

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

    // Update body partially
    useSchedulerStore.getState().setComposeDraft({ body: 'Hello Alex, check our product.' });
    expect(useSchedulerStore.getState().composeDraft?.body).toBe('Hello Alex, check our product.');
    expect(useSchedulerStore.getState().composeDraft?.subject).toBe('Special Outreach Offer');

    // Clear draft
    useSchedulerStore.getState().clearComposeDraft();
    expect(useSchedulerStore.getState().composeDraft).toBeNull();
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

  it('performs email cancellation via apiClient and removes from scheduledEmails', async () => {
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
      counts: { scheduled: 1, sent: 0 },
      selectedEmail: mockEmail,
      detailOpen: true,
    });

    vi.spyOn(apiClient.emails, 'cancel').mockResolvedValueOnce({
      id: 'email-cancel-me',
      status: 'CANCELLED',
      message: 'Email cancelled',
    });

    await useSchedulerStore.getState().cancelEmail('email-cancel-me');

    expect(useSchedulerStore.getState().scheduledEmails).toHaveLength(0);
    expect(useSchedulerStore.getState().counts.scheduled).toBe(0);
    expect(useSchedulerStore.getState().detailOpen).toBe(false);
    expect(useSchedulerStore.getState().selectedEmail).toBeNull();
  });
});
