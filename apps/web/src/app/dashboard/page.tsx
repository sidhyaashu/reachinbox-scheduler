'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSchedulerStore } from '../../lib/store';
import { Sidebar } from '../../components/Sidebar';
import { EmailList } from '../../components/EmailList';
import { ComposeView } from '../../components/ComposeView';
import { EmailDetailView } from '../../components/EmailDetailView';
import { Search, Filter, RotateCw, Menu, X, Check, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useToast } from '../../components/Toast';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    loadDashboard,
    setSearchQuery,
    composeOpen,
    openCompose,
    closeCompose,
    detailOpen,
    selectEmail,
    closeDetail,
    selectedEmail,
    scheduledEmails,
    sentEmails,
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
  const [spinning, setSpinning] = useState(false);

  // 1. Initial dashboard data loading
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // 2. Auth Route Guard: unauthenticated visitors are redirected to Login with returnTo
  useEffect(() => {
    if (!isLoading && !user) {
      const returnUrl = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/dashboard';
      router.replace(`/?returnTo=${encodeURIComponent(returnUrl)}`);
    }
  }, [isLoading, user, router]);

  // 3. Synchronize URL query parameters with active views & browser history (Back/Forward)
  const urlTab = searchParams.get('tab');
  const urlCompose = searchParams.get('compose');
  const urlEmailId = searchParams.get('emailId');
  const urlStatus = searchParams.get('status');

  useEffect(() => {
    // Sync tab
    if (urlTab === 'sent' && activeTab !== 'sent') {
      setActiveTab('sent');
    } else if (urlTab === 'scheduled' && activeTab !== 'scheduled') {
      setActiveTab('scheduled');
    } else if (urlTab === 'archive' && activeTab !== 'archive') {
      setActiveTab('archive');
    } else if (urlTab === 'drafts' && activeTab !== 'drafts') {
      setActiveTab('drafts');
    }

    // Sync Compose view
    if (urlCompose === 'true') {
      if (!composeOpen) openCompose();
    } else {
      if (composeOpen) closeCompose();
    }

    // Sync Email Detail view
    if (urlEmailId) {
      const allEmails = [...scheduledEmails, ...sentEmails];
      const match = allEmails.find((e) => e.id === urlEmailId);
      if (match && (!selectedEmail || selectedEmail.id !== urlEmailId)) {
        selectEmail(match);
      }
    } else {
      if (detailOpen) closeDetail();
    }

    // Sync Filter status
    if (urlStatus && ['ALL', 'SCHEDULED', 'PROCESSING', 'SENT', 'FAILED'].includes(urlStatus)) {
      if (filterStatus !== urlStatus) {
        setFilterStatus(urlStatus as any);
      }
    }
  }, [
    urlTab,
    urlCompose,
    urlEmailId,
    urlStatus,
    activeTab,
    composeOpen,
    detailOpen,
    selectedEmail,
    scheduledEmails,
    sentEmails,
    filterStatus,
    setActiveTab,
    openCompose,
    closeCompose,
    selectEmail,
    closeDetail,
    setFilterStatus,
  ]);

  // 4. Handle browser Back/Forward buttons via popstate without triggering Next.js full-page reloads
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') as any;
      if (tab && ['scheduled', 'sent', 'archive', 'drafts'].includes(tab)) {
        setActiveTab(tab);
      }
      if (params.get('compose') === 'true') {
        openCompose();
      } else {
        closeCompose();
      }
      const emailId = params.get('emailId');
      if (emailId) {
        const allEmails = [...scheduledEmails, ...sentEmails];
        const match = allEmails.find((e) => e.id === emailId);
        if (match) selectEmail(match);
      } else {
        closeDetail();
      }
      const status = params.get('status') as any;
      if (status && ['ALL', 'SCHEDULED', 'PROCESSING', 'SENT', 'FAILED'].includes(status)) {
        setFilterStatus(status);
      } else {
        setFilterStatus('ALL');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    scheduledEmails,
    sentEmails,
    setActiveTab,
    openCompose,
    closeCompose,
    selectEmail,
    closeDetail,
    setFilterStatus,
  ]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery]);

  const handleRefresh = async () => {
    setSpinning(true);
    await loadDashboard();
    setSpinning(false);
    info('Refreshed', 'Inbox updated from PostgreSQL & BullMQ');
  };

  const clearSearch = () => {
    setLocalSearch('');
    setSearchQuery('');
  };

  const handleFilterChange = (status: 'ALL' | 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED') => {
    setFilterStatus(status);
    const params = new URLSearchParams(window.location.search);
    if (status === 'ALL') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    // Synchronize active tab with filter category
    if (status === 'SENT' && activeTab !== 'sent') {
      setActiveTab('sent');
      params.set('tab', 'sent');
    } else if ((status === 'SCHEDULED' || status === 'PROCESSING') && activeTab !== 'scheduled') {
      setActiveTab('scheduled');
      params.set('tab', 'scheduled');
    }
    window.history.pushState(null, '', `/dashboard?${params.toString()}`);
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
              {/* Search Pill Input matching Figma */}
              <div className="relative flex-1 max-w-xl">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
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

              {/* Refresh icon */}
              <button
                type="button"
                onClick={handleRefresh}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Refresh inbox"
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

            {/* Email Rows List */}
            <div className="flex-1 overflow-y-auto px-3 2xs:px-4 xs:px-5 sm:px-6 md:px-8 py-2">
              <EmailList />
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
