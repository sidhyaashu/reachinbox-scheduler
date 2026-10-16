'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSchedulerStore } from '../../lib/store';
import { Sidebar } from '../../components/Sidebar';
import { EmailList } from '../../components/EmailList';
import { ComposeView } from '../../components/ComposeView';
import { EmailDetailView } from '../../components/EmailDetailView';
import { IntegrationsView } from '../../components/IntegrationsView';
import { Search, Filter, RotateCw, Menu, X, Check, Loader2, Mail, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useToast } from '../../components/Toast';
import { formatRelativeTime } from '../../lib/utils';
import { EmailRecord } from '../../lib/api-client';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    loadDashboard,
    setSearchQuery,
    searchResults,
    isSearching,
    composeOpen,
    openCompose,
    closeCompose,
    detailOpen,
    selectEmail,
    closeDetail,
    selectedEmail,
    scheduledEmails,
    sentEmails,
    counts,
    sender,
    activeTab,
    setActiveTab,
    filterStatus,
    setFilterStatus,
    setMobileSidebarOpen,
    user,
    isLoading,
  } = useSchedulerStore();

  const { info } = useToast();
  const [localSearch, setLocalSearch] = useState('');
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [isSearchMenuOpen, setIsSearchMenuOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const searchContainerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // 1. Initial dashboard data loading & Continuous Real-time Background Sync (Zero refresh required)
  useEffect(() => {
    loadDashboard();

    // Real-time polling every 2.5 seconds when tab is active
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadDashboard();
    }, 2500);

    // Instant sync on tab focus or visibility resume
    const handleSyncOnActive = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadDashboard();
      }
    };

    window.addEventListener('focus', handleSyncOnActive);
    document.addEventListener('visibilitychange', handleSyncOnActive);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleSyncOnActive);
      document.removeEventListener('visibilitychange', handleSyncOnActive);
    };
  }, [loadDashboard]);

  // 2. Auth Route Guard: unauthenticated visitors are redirected to Login with returnTo
  useEffect(() => {
    if (!isLoading && !user) {
      const returnUrl = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/dashboard';
      router.replace(`/?returnTo=${encodeURIComponent(returnUrl)}`);
    }
  }, [isLoading, user, router]);

  // 3. Synchronize URL query parameters with active views on mount & URL search param changes ONLY
  const urlTab = searchParams.get('tab');
  const urlCompose = searchParams.get('compose');
  const urlEmailId = searchParams.get('emailId');
  const urlStatus = searchParams.get('status');

  useEffect(() => {
    const state = useSchedulerStore.getState();

    // 1. Sync tab
    if (urlTab && ['scheduled', 'sent', 'archive', 'drafts', 'trash', 'integrations'].includes(urlTab)) {
      if (state.activeTab !== urlTab) {
        state.setActiveTab(urlTab as any);
      }
    }

    // 2. Sync Compose view
    if (urlCompose === 'true') {
      if (!state.composeOpen) state.openCompose();
    } else {
      if (state.composeOpen) state.closeCompose();
    }

    // 3. Sync Email Detail view
    if (urlEmailId) {
      const allEmails = [...state.scheduledEmails, ...state.sentEmails];
      const match = allEmails.find((e) => e.id === urlEmailId);
      if (match && (!state.selectedEmail || state.selectedEmail.id !== urlEmailId)) {
        state.selectEmail(match);
      }
    } else {
      if (state.detailOpen) state.closeDetail();
    }

    // 4. Sync Filter status
    if (urlStatus && ['ALL', 'SCHEDULED', 'PROCESSING', 'SENT', 'FAILED'].includes(urlStatus)) {
      if (state.filterStatus !== urlStatus) {
        state.setFilterStatus(urlStatus as any);
      }
    } else if (!urlStatus && state.filterStatus !== 'ALL') {
      state.setFilterStatus('ALL');
    }
  }, [urlTab, urlCompose, urlEmailId, urlStatus]);

  // 4. Handle browser Back/Forward buttons via popstate without triggering Next.js full-page reloads
  useEffect(() => {
    const handlePopState = () => {
      const state = useSchedulerStore.getState();
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') as any;
      if (tab && ['scheduled', 'sent', 'archive', 'drafts', 'trash', 'integrations'].includes(tab)) {
        state.setActiveTab(tab);
      }
      if (params.get('compose') === 'true') {
        state.openCompose();
      } else {
        state.closeCompose();
      }
      const emailId = params.get('emailId');
      if (emailId) {
        const allEmails = [...state.scheduledEmails, ...state.sentEmails];
        const match = allEmails.find((e) => e.id === emailId);
        if (match) state.selectEmail(match);
      } else {
        state.closeDetail();
      }
      const status = params.get('status') as any;
      if (status && ['ALL', 'SCHEDULED', 'PROCESSING', 'SENT', 'FAILED'].includes(status)) {
        state.setFilterStatus(status);
      } else {
        state.setFilterStatus('ALL');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Debounced search with visual debouncing state
  useEffect(() => {
    if (!localSearch.trim()) {
      setIsDebouncing(false);
      setSearchQuery('');
      return;
    }

    setIsDebouncing(true);
    const timer = setTimeout(() => {
      setSearchQuery(localSearch);
      setIsDebouncing(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery]);

  // Close debouncer menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsSearchMenuOpen(false);
      searchInputRef.current?.blur();
    } else if (e.key === 'Enter') {
      setIsSearchMenuOpen(false);
      setSearchQuery(localSearch);
    }
  };

  const handleRefresh = async () => {
    setSpinning(true);
    await loadDashboard();
    setSpinning(false);
    info('Refreshed', 'Inbox updated from PostgreSQL & BullMQ');
  };

  const clearSearch = () => {
    setLocalSearch('');
    setSearchQuery('');
    setIsSearchMenuOpen(false);
  };

  const allEmails = React.useMemo(() => {
    return [...scheduledEmails, ...sentEmails];
  }, [scheduledEmails, sentEmails]);

  const localFilteredMatches = React.useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    if (!q) return [];
    return allEmails.filter(
      (e) =>
        (e.recipient && e.recipient.toLowerCase().includes(q)) ||
        (e.subject && e.subject.toLowerCase().includes(q)) ||
        (e.body && e.body.toLowerCase().includes(q))
    );
  }, [allEmails, localSearch]);

  const debouncedMenuResults = React.useMemo(() => {
    if (searchResults !== null && searchResults.length > 0) {
      return searchResults;
    }
    return localFilteredMatches;
  }, [searchResults, localFilteredMatches]);

  const handleSelectSearchResult = (email: EmailRecord) => {
    setIsSearchMenuOpen(false);
    selectEmail(email);
    const targetTab = email.status === 'SENT' ? 'sent' : 'scheduled';
    if (activeTab !== targetTab) {
      setActiveTab(targetTab);
    }
    const params = new URLSearchParams(window.location.search);
    params.set('tab', targetTab);
    params.set('emailId', email.id);
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  };

  const handleFilterChange = (status: 'ALL' | 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED') => {
    setFilterStatus(status);
    const params = new URLSearchParams(window.location.search);
    if (status === 'ALL') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    // Synchronize active tab with filter category when in scheduled or sent
    if ((status === 'SENT' || status === 'FAILED') && activeTab === 'scheduled') {
      setActiveTab('sent');
      params.set('tab', 'sent');
    } else if ((status === 'SCHEDULED' || status === 'PROCESSING') && activeTab === 'sent') {
      setActiveTab('scheduled');
      params.set('tab', 'scheduled');
    }
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  };

  // Full loading screen before auth or dashboard initial data is confirmed
  if (isLoading && !user) {
    return (
      <div className="min-h-screen w-full bg-[#fcfcfc] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00a84e]" />
      </div>
    );
  }

  // If unauthenticated and finished loading, show spinner while router redirects
  if (!user) {
    return (
      <div className="min-h-screen w-full bg-[#fcfcfc] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00a84e]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden text-slate-900 font-sans">
      {/* 1. Left Sidebar (Desktop + Mobile Drawer) */}
      <Sidebar />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header Bar (Visible below 'md' 768px breakpoint) */}
        <div className="md:hidden flex items-center justify-between px-3 2xs:px-4 py-3 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 select-none">
              <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#00a84e] to-[#22c55e] flex items-center justify-center text-white shadow-xs">
                <svg className="w-3 h-3 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <span className="font-brand font-extrabold text-base tracking-tight text-slate-900">
                reach<span className="text-[#00a84e]">inbox</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#e8f5e9] text-[#00873d] capitalize">
              {activeTab}
            </span>
            <div className="w-7 h-7 rounded-full bg-[#00a84e] text-white flex items-center justify-center font-bold text-xs">
              {(user?.name?.[0] || 'U').toUpperCase()}
            </div>
          </div>
        </div>

        {composeOpen ? (
          // Compose Screen matching Figma
          <ComposeView />
        ) : detailOpen ? (
          // Detail View matching Figma
          <EmailDetailView />
        ) : (
          // Standard List View
          <div className="flex-1 flex flex-col h-screen overflow-hidden">
            {/* Top Search & Filter Bar - Responsive across 7 breakpoints */}
            <div className="px-3 2xs:px-4 xs:px-5 sm:px-6 md:px-8 py-3 border-b border-slate-100 flex items-center gap-2 2xs:gap-3 bg-white shrink-0">
              {/* Search Pill Input with Floating Debounced Results Menu */}
              <div ref={searchContainerRef} className="relative flex-1 max-w-xl">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={localSearch}
                  onChange={(e) => {
                    setLocalSearch(e.target.value);
                    setIsSearchMenuOpen(true);
                  }}
                  onFocus={() => setIsSearchMenuOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search emails by recipient or subject..."
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full h-9 2xs:h-10 pl-9 pr-8 rounded-full bg-[#f4f6f8] text-xs text-slate-800 placeholder:text-slate-400 border-none outline-none focus:outline-none focus:ring-1 focus:ring-[#00a84e] cursor-text selection:bg-[#00a84e] selection:text-white"
                />
                {localSearch && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Debounced Search Results Menu - Gmail / Email Client Style */}
                {isSearchMenuOpen && (
                  <div
                    className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 duration-150 backdrop-blur-sm"
                    style={{ maxHeight: 'min(440px, calc(100vh - 140px))' }}
                  >
                    {/* Header Strip */}
                    <div className="px-3.5 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium select-none">
                      {isDebouncing || isSearching ? (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00a84e]" />
                          <span>Searching for &ldquo;{localSearch}&rdquo;...</span>
                        </div>
                      ) : localSearch.trim() ? (
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <span>Search Results</span>
                          <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-50 text-[#00873d]">
                            {debouncedMenuResults.length} found
                          </span>
                        </div>
                      ) : (
                        <span className="font-semibold text-slate-700">Quick Filters &amp; Views</span>
                      )}

                      <div className="flex items-center gap-2">
                        {isDebouncing ? (
                          <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            debouncing 250ms
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-sans">Esc</kbd> to close
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Results / Suggestions Body */}
                    <div className="flex-1 overflow-y-auto">
                      {isDebouncing || isSearching ? (
                        /* Loading state with pulse animation */
                        <div className="p-2 space-y-1.5">
                          {[1, 2, 3].map((n) => (
                            <div key={n} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 animate-pulse">
                              <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
                              <div className="flex-1 space-y-1.5">
                                <div className="h-3 w-1/3 bg-slate-200 rounded" />
                                <div className="h-2.5 w-2/3 bg-slate-100 rounded" />
                              </div>
                              <div className="h-5 w-16 bg-slate-200 rounded-full" />
                            </div>
                          ))}
                        </div>
                      ) : localSearch.trim() ? (
                        debouncedMenuResults.length > 0 ? (
                          /* Matching Results List */
                          <div className="p-1.5 divide-y divide-slate-100/70">
                            {debouncedMenuResults.slice(0, 8).map((email) => {
                              const isSent = email.status === 'SENT';
                              const isScheduled =
                                email.status === 'SCHEDULED' ||
                                email.status === 'QUEUED' ||
                                email.status === 'DEFERRED';
                              const isFailed = email.status === 'FAILED';
                              const recipientInitial = (email.recipient?.[0] || 'R').toUpperCase();

                              return (
                                <div
                                  key={email.id}
                                  onClick={() => handleSelectSearchResult(email)}
                                  className="group flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-emerald-50/40 hover:border-emerald-100 transition-colors cursor-pointer"
                                >
                                  {/* Left: Avatar + Details */}
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div
                                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                        isSent
                                          ? 'bg-[#e8f5e9] text-[#00873d]'
                                          : isScheduled
                                          ? 'bg-[#fef3c7] text-[#b45309]'
                                          : isFailed
                                          ? 'bg-[#fee2e2] text-[#b91c1c]'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {recipientInitial}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-xs text-slate-900 truncate">
                                          {email.recipient}
                                        </span>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-xs text-slate-600 truncate group-hover:text-slate-900 transition-colors">
                                          {email.subject || '(No subject)'}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                        {email.body ? email.body.slice(0, 75) : 'No message body preview'}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Right: Status badge & timestamp */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span
                                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                        isSent
                                          ? 'bg-[#e8f5e9] text-[#00873d]'
                                          : isScheduled
                                          ? 'bg-[#fef3c7] text-[#b45309]'
                                          : isFailed
                                          ? 'bg-[#fee2e2] text-[#b91c1c]'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      {isSent && <CheckCircle2 className="w-2.5 h-2.5" />}
                                      {isScheduled && <Clock className="w-2.5 h-2.5" />}
                                      {isFailed && <AlertCircle className="w-2.5 h-2.5" />}
                                      {email.status}
                                    </span>
                                    <span className="text-[10px] text-slate-400 hidden sm:inline">
                                      {formatRelativeTime(email.scheduledAt)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          /* No Results Found inside the menu matching user screenshot */
                          <div className="py-7 px-4 text-center">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#00a84e] flex items-center justify-center mx-auto mb-2.5">
                              <Mail className="w-5 h-5" />
                            </div>
                            <p className="text-xs font-semibold text-slate-800">No matching emails found</p>
                            <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                              No results match &ldquo;{localSearch}&rdquo;. Try another recipient or subject keyword.
                            </p>
                            <div className="mt-3.5 flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={clearSearch}
                                className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
                              >
                                Clear search
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsSearchMenuOpen(false);
                                  openCompose();
                                }}
                                className="text-xs px-2.5 py-1 rounded-md bg-[#e8f5e9] hover:bg-[#d4edda] text-[#00873d] font-medium transition-colors cursor-pointer"
                              >
                                + Compose New Email
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        /* Empty Search state: Quick Filters & Views */
                        <div className="p-2 space-y-1">
                          <div
                            onClick={() => {
                              setActiveTab('scheduled');
                              setIsSearchMenuOpen(false);
                            }}
                            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                <Clock className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-xs font-medium text-slate-700">Scheduled Emails</span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-semibold">{scheduledEmails.length}</span>
                          </div>

                          <div
                            onClick={() => {
                              setActiveTab('sent');
                              setIsSearchMenuOpen(false);
                            }}
                            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-xs font-medium text-slate-700">Sent Emails</span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-semibold">{sentEmails.length}</span>
                          </div>

                          <div
                            onClick={() => {
                              setActiveTab('drafts');
                              setIsSearchMenuOpen(false);
                            }}
                            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                                <Mail className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-xs font-medium text-slate-700">Drafts</span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-semibold">{counts.drafts}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer / Shortcuts Strip */}
                    <div className="px-3.5 py-2 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 select-none">
                      <div className="flex items-center gap-2">
                        <span>
                          <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-sans">Enter</kbd> to view full list
                        </span>
                        <span>•</span>
                        <span>
                          <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-sans">Esc</kbd> to close
                        </span>
                      </div>
                      {localSearch && (
                        <button
                          type="button"
                          onClick={clearSearch}
                          className="text-[#00a84e] hover:underline font-medium cursor-pointer"
                        >
                          Clear query
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Filter funnel dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${
                      filterStatus !== 'ALL'
                        ? 'bg-[#e8f5e9] text-[#00873d]'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                    title="Filter emails"
                  >
                    <Filter className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 bg-white border border-slate-100 shadow-xl">
                  <DropdownMenuItem
                    onClick={() => handleFilterChange('ALL')}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>All Statuses</span>
                    {filterStatus === 'ALL' && <Check className="w-3.5 h-3.5 text-[#00a84e]" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleFilterChange('SCHEDULED')}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>Scheduled</span>
                    {filterStatus === 'SCHEDULED' && <Check className="w-3.5 h-3.5 text-[#00a84e]" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleFilterChange('SENT')}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>Sent</span>
                    {filterStatus === 'SENT' && <Check className="w-3.5 h-3.5 text-[#00a84e]" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleFilterChange('PROCESSING')}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>Processing</span>
                    {filterStatus === 'PROCESSING' && <Check className="w-3.5 h-3.5 text-[#00a84e]" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleFilterChange('FAILED')}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>Failed</span>
                    {filterStatus === 'FAILED' && <Check className="w-3.5 h-3.5 text-[#00a84e]" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Real-time Sync Live Beacon */}
              <div
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 select-none shrink-0"
                title="Real-time sync active: email deliveries, queue transitions, and counts update live without manual refresh"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-semibold text-emerald-800">Live</span>
              </div>

              {/* Gmail OAuth2 Status / Connect Button */}
              {sender?.authType === 'oauth2_google' ? (
                <div
                  className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#00873d] border border-emerald-200/70 select-none shrink-0"
                  title="Your Gmail account is connected via Google OAuth2. Emails are sent directly from your Gmail without passwords."
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00a84e]" />
                  <span>Gmail Connected</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `/auth/google?returnTo=${encodeURIComponent('/dashboard')}`;
                  }}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white hover:bg-emerald-50 text-slate-700 hover:text-[#00873d] border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer shadow-xs shrink-0"
                  title="Connect your Gmail account via Google OAuth2 to send emails directly without passwords"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.645-5.2 3.645-9.15z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.73-2.1-6.67-4.93H1.28v3.15C3.3 21.36 7.35 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.33 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.57H1.28C.46 8.2 0 10.04 0 12s.46 3.8 1.28 5.43l4.05-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.3 2.64 1.28 6.57l4.05 3.15c.94-2.83 3.57-4.97 6.67-4.97z"/>
                  </svg>
                  <span>Connect your Gmail</span>
                </button>
              )}

              {/* Refresh icon */}
              <button
                type="button"
                onClick={handleRefresh}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Refresh inbox immediately"
              >
                <RotateCw className={`w-4 h-4 ${spinning ? 'animate-spin text-[#00a84e]' : ''}`} />
              </button>

              {/* Active Filter Pill */}
              {filterStatus !== 'ALL' && (
                <div className="hidden xs:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e8f5e9] text-[#00873d] shrink-0 border border-[#bbf7d0]">
                  <span>Status: {filterStatus.charAt(0) + filterStatus.slice(1).toLowerCase()}</span>
                  <button
                    type="button"
                    onClick={() => handleFilterChange('ALL')}
                    className="hover:text-emerald-900 cursor-pointer p-0.5 rounded-full"
                    title="Clear filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Email Rows List or Integrations View */}
            <div className="flex-1 overflow-y-auto px-3 2xs:px-4 xs:px-5 sm:px-6 md:px-8 py-2">
              {activeTab === 'integrations' ? <IntegrationsView /> : <EmailList />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-[#fcfcfc] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00a84e]" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
