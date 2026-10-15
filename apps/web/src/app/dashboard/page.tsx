'use client';

import React, { useEffect, useState } from 'react';
import { useSchedulerStore } from '../../lib/store';
import { Sidebar } from '../../components/Sidebar';
import { EmailList } from '../../components/EmailList';
import { ComposeView } from '../../components/ComposeView';
import { EmailDetailView } from '../../components/EmailDetailView';
import { Search, Filter, RotateCw } from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function DashboardPage() {
  const {
    loadDashboard,
    searchQuery,
    setSearchQuery,
    isRefreshing,
    composeOpen,
    detailOpen,
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
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery]);

  const handleRefresh = async () => {
    setSpinning(true);
    await loadDashboard();
    setSpinning(false);
    info('Refreshed', 'Inbox updated from PostgreSQL & BullMQ');
  };

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden text-slate-900 font-sans">
      {/* 1. Left Sidebar matching Figma Images 2 and 4 */}
      <Sidebar />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {composeOpen ? (
          // Compose Screen matching Images 3, 5, 7
          <ComposeView />
        ) : detailOpen ? (
          // Detail View matching Image 6
          <EmailDetailView />
        ) : (
          // Standard List View matching Images 2 and 4
          <div className="flex-1 flex flex-col h-screen overflow-hidden">
            {/* Top Bar with Search & Icons */}
            <div className="px-6 py-3.5 border-b border-slate-100 flex items-center gap-3 bg-white shrink-0">
              {/* Search Pill Input matching Figma */}
              <div className="relative flex-1 max-w-xl">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder="Search"
                  className="w-full h-10 pl-10 pr-4 rounded-full bg-[#f4f6f8] text-xs text-slate-800 placeholder:text-slate-400 border-none focus:outline-none focus:ring-1 focus:ring-[#00a84e]"
                />
              </div>

              {/* Filter funnel icon matching Figma */}
              <button
                type="button"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                title="Filter emails"
              >
                <Filter className="w-4 h-4" />
              </button>

              {/* Refresh icon matching Figma */}
              <button
                type="button"
                onClick={handleRefresh}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                title="Refresh queue"
              >
                <RotateCw className={`w-4 h-4 ${spinning ? 'animate-spin text-[#00a84e]' : ''}`} />
              </button>
            </div>

            {/* Email Rows List */}
            <div className="flex-1 overflow-y-auto px-6 py-2">
              <EmailList />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
