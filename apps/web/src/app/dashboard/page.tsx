'use client';

import React, { useEffect, useState } from 'react';
import { useSchedulerStore } from '../../lib/store';
import { Sidebar } from '../../components/Sidebar';
import { EmailList } from '../../components/EmailList';
import { ComposeView } from '../../components/ComposeView';
import { EmailDetailView } from '../../components/EmailDetailView';
import { Search, Filter, RotateCw, Menu, X, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useToast } from '../../components/Toast';

export default function DashboardPage() {
  const {
    loadDashboard,
    setSearchQuery,
    composeOpen,
    detailOpen,
    activeTab,
    filterStatus,
    setFilterStatus,
    setMobileSidebarOpen,
    user,
  } = useSchedulerStore();

  const { info } = useToast();
  const [localSearch, setLocalSearch] = useState('');
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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
            <div className="font-mono font-black text-xl tracking-tight select-none">
              ONB
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
                  className="w-full h-9 2xs:h-10 pl-9 pr-8 rounded-full bg-[#f4f6f8] text-xs text-slate-800 placeholder:text-slate-400 border-none focus:outline-none focus:ring-1 focus:ring-[#00a84e] cursor-text"
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
                    onClick={() => setFilterStatus('ALL')}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>All Statuses</span>
                    {filterStatus === 'ALL' && <Check className="w-3.5 h-3.5 text-[#00a84e]" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setFilterStatus('SCHEDULED')}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>Scheduled</span>
                    {filterStatus === 'SCHEDULED' && <Check className="w-3.5 h-3.5 text-[#00a84e]" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setFilterStatus('SENT')}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>Sent</span>
                    {filterStatus === 'SENT' && <Check className="w-3.5 h-3.5 text-[#00a84e]" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setFilterStatus('PROCESSING')}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>Processing</span>
                    {filterStatus === 'PROCESSING' && <Check className="w-3.5 h-3.5 text-[#00a84e]" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setFilterStatus('FAILED')}
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
