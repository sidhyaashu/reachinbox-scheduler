'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  UserProfile,
  DashboardSummary,
  SlackStatus,
  EmailRecord,
  ScheduleBatchPayload,
} from '../../lib/api';
import { Header } from '../../components/Header';
import { MetricsOverview } from '../../components/MetricsOverview';
import { ScheduledTable } from '../../components/ScheduledTable';
import { SentTable } from '../../components/SentTable';
import { ComposeModal } from '../../components/ComposeModal';
import { SlackModal } from '../../components/SlackModal';
import { useToast } from '../../components/Toast';
import { Plus, RotateCw, Clock, Send, Search, X } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { success, error, info } = useToast();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);
  const [scheduledEmails, setScheduledEmails] = useState<EmailRecord[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailRecord[]>([]);

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EmailRecord[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Modals
  const [composeOpen, setComposeOpen] = useState(false);
  const [slackModalOpen, setSlackModalOpen] = useState(false);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const authRes = await api.getCurrentUser();
      if (!authRes?.user) {
        router.push('/');
        return;
      }
      setUser(authRes.user);

      const [summaryRes, slackRes, scheduledRes, sentRes] = await Promise.all([
        api.getDashboardSummary().catch(() => null),
        api.getSlackStatus().catch(() => ({ connected: false })),
        api.getScheduledEmails(1, 100).catch(() => ({ emails: [], total: 0 })),
        api.getSentEmails(1, 100).catch(() => ({ emails: [], total: 0 })),
      ]);

      if (summaryRes) setSummary(summaryRes);
      setSlackStatus(slackRes);
      setScheduledEmails(scheduledRes.emails || []);
      setSentEmails(sentRes.emails || []);
    } catch (err: any) {
      error('Failed to load dashboard', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Debounced Elasticsearch query
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.searchEmails(searchQuery);
        setSearchResults(res.results || []);
      } catch (err: any) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadData();
    info('Refreshed', 'Dashboard data updated');
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      success('Logged out', 'Session terminated');
      router.push('/');
    } catch (err: any) {
      error('Logout error', err.message);
    }
  };

  const handleCancelEmail = async (id: string) => {
    try {
      await api.cancelEmail(id);
      success('Email Cancelled', 'The scheduled send was removed from the queue');
      setScheduledEmails((prev) => prev.filter((e) => e.id !== id));
      if (summary) {
        setSummary({
          ...summary,
          metrics: {
            ...summary.metrics,
            totalScheduled: Math.max(0, summary.metrics.totalScheduled - 1),
          },
        });
      }
    } catch (err: any) {
      error('Cancellation Failed', err.message);
    }
  };

  const handleScheduleSubmit = async (payload: ScheduleBatchPayload) => {
    const res = await api.scheduleBatch(payload);
    success(
      'Campaign Scheduled!',
      `Successfully queued ${res.scheduledCount} email(s) into BullMQ without cron.`
    );
    await loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 animate-pulse flex items-center justify-center shadow-xl shadow-brand-500/20 mb-4">
          <Clock className="w-6 h-6 text-white" />
        </div>
        <div className="text-sm font-medium text-slate-300">Loading ReachInbox Workspace...</div>
      </div>
    );
  }

  // Filter list based on search or active tab
  const displayedScheduled = searchResults !== null
    ? searchResults.filter((e) => e.status === 'SCHEDULED' || e.status === 'DEFERRED' || e.status === 'QUEUED')
    : scheduledEmails;

  const displayedSent = searchResults !== null
    ? searchResults.filter((e) => e.status === 'SENT' || e.status === 'FAILED')
    : sentEmails;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        user={user}
        slackStatus={slackStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSlackModal={() => setSlackModalOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Top Heading & Primary Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Email Scheduler
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Outreach queues, deliverability rates, and scheduled campaign monitoring
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-surface border border-border text-slate-300 hover:text-white hover:border-slate-600 transition-all disabled:opacity-50"
              title="Refresh Data"
            >
              <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-brand-400' : ''}`} />
            </button>

            <button
              onClick={() => setComposeOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-all shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40"
            >
              <Plus className="w-4 h-4" />
              <span>Compose New Email</span>
            </button>
          </div>
        </div>

        {/* Deliverability & Queue Metrics */}
        <MetricsOverview summary={summary} loading={refreshing} />

        {/* Search Results Notice Banner */}
        {searchResults !== null && (
          <div className="flex items-center justify-between p-3.5 mb-6 rounded-xl bg-brand-500/10 border border-brand-500/30 text-xs text-brand-200">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-brand-400" />
              <span>
                Elasticsearch results for &quot;<strong>{searchQuery}</strong>&quot; ({searchResults.length} match{searchResults.length === 1 ? '' : 'es'})
              </span>
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="flex items-center gap-1 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filter</span>
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-border/80 mb-6">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center gap-2 pb-3.5 text-sm font-semibold transition-all relative ${
                activeTab === 'scheduled'
                  ? 'text-brand-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Scheduled Emails</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                activeTab === 'scheduled'
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'bg-surface text-slate-400'
              }`}>
                {displayedScheduled.length}
              </span>
              {activeTab === 'scheduled' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('sent')}
              className={`flex items-center gap-2 pb-3.5 text-sm font-semibold transition-all relative ${
                activeTab === 'sent'
                  ? 'text-brand-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Sent Emails</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                activeTab === 'sent'
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'bg-surface text-slate-400'
              }`}>
                {displayedSent.length}
              </span>
              {activeTab === 'sent' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* Tab Content Tables */}
        {activeTab === 'scheduled' ? (
          <ScheduledTable
            emails={displayedScheduled}
            loading={isSearching}
            onCancel={handleCancelEmail}
            onOpenCompose={() => setComposeOpen(true)}
          />
        ) : (
          <SentTable
            emails={displayedSent}
            loading={isSearching}
            onOpenCompose={() => setComposeOpen(true)}
          />
        )}
      </main>

      {/* Compose & Schedule Modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSubmit={handleScheduleSubmit}
        defaultHourlyLimit={summary?.defaultSender?.hourlyLimit || 200}
        defaultMinDelay={summary?.defaultSender?.minDelaySeconds || 2}
      />

      {/* Slack Integration Modal */}
      <SlackModal
        isOpen={slackModalOpen}
        onClose={() => setSlackModalOpen(false)}
        status={slackStatus}
        onRefresh={loadData}
      />
    </div>
  );
}
