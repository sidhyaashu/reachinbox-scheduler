'use client';

import React, { useState, useEffect } from 'react';
import { useSchedulerStore } from '../lib/store';
import { apiClient } from '../lib/api-client';
import { useToast } from './Toast';
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Unlink,
  Bell,
  Mail,
  Zap,
  Activity,
  ShieldCheck,
  RotateCw,
  Search,
  Sparkles,
  Server,
  Radio,
  Sliders,
  Check,
  Send,
} from 'lucide-react';
import { Button } from './ui/button';
import { ConfirmModal } from './ui/confirm-modal';
import { SmtpConfigModal } from './SmtpConfigModal';
import { useRouter } from 'next/navigation';

export function IntegrationsView() {
  const router = useRouter();
  const {
    user,
    sender,
    slackIntegration,
    loadDashboard,
    openCompose,
  } = useSchedulerStore();

  const { success, error, info } = useToast();
  const [testingSlack, setTestingSlack] = useState(false);
  const [disconnectingSlack, setDisconnectingSlack] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const [disconnectingSmtp, setDisconnectingSmtp] = useState(false);
  const [smtpModalOpen, setSmtpModalOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'email' | 'alerts' | 'infra'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'google' | 'slack' | 'smtp' | null;
    title: string;
    description: string;
    confirmText: string;
    notice?: string;
  }>({
    isOpen: false,
    type: null,
    title: '',
    description: '',
    confirmText: '',
  });

  // Clean sender name (removes helper suffix)
  const rawSenderName = sender?.name || user?.name || '';
  const cleanSenderName = rawSenderName
    ? rawSenderName.replace(/\s*\((Gmail|ReachInbox Mailbox)\)$/i, '')
    : 'Authenticated Mailbox';

  const isGoogleConnected = sender?.authType === 'oauth2_google';
  const isCustomSmtpConnected = Boolean(sender?.hasCustomSmtp);
  const isSlackConnected = Boolean(slackIntegration?.connected);

  // Check for success URL parameters after OAuth redirects
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('google') === 'connected') {
      success('Google Gmail account connected successfully via OAuth2!');
      router.replace('/dashboard?tab=integrations', { scroll: false });
      loadDashboard();
    } else if (urlParams.get('slack') === 'connected') {
      success('Slack workspace connected successfully for rate-limit alerts!');
      router.replace('/dashboard?tab=integrations', { scroll: false });
      loadDashboard();
    }
  }, [success, loadDashboard]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadDashboard();
      success('Integration status refreshed');
    } catch {
      error('Failed to refresh status');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTestSlack = async () => {
    setTestingSlack(true);
    try {
      const res = await apiClient.integrations.sendSlackTestAlert();
      success(res.message || 'Test alert successfully broadcasted to Slack!');
    } catch (err: any) {
      error(err.message || 'Failed to dispatch Slack test alert');
    } finally {
      setTestingSlack(false);
    }
  };

  const promptDisconnectSlack = () => {
    setConfirmModal({
      isOpen: true,
      type: 'slack',
      title: 'Disconnect Slack Notification Service?',
      description: 'Are you sure you want to disconnect Slack? Rate-limit breach alerts (1,000+ job spikes) will no longer be broadcasted to your channel.',
      confirmText: 'Disconnect Slack',
      notice: 'Your team channel will stop receiving real-time webhook notices when sending limits are reached.',
    });
  };

  const promptDisconnectGoogle = () => {
    setConfirmModal({
      isOpen: true,
      type: 'google',
      title: 'Disconnect Google Gmail Service?',
      description: 'Are you sure you want to disconnect your Google account? ReachInbox will fall back to sandboxed SMTP dispatch.',
      confirmText: 'Disconnect Account',
      notice: 'Campaigns will route through sandboxed Ethereal SMTP instead of your personal or workspace Gmail mailbox.',
    });
  };

  const promptDisconnectSmtp = () => {
    setConfirmModal({
      isOpen: true,
      type: 'smtp',
      title: 'Disconnect Custom SMTP Relay?',
      description: 'Are you sure you want to disconnect your custom SMTP credentials? ReachInbox will safely fall back to the sandboxed Ethereal SMTP dispatch.',
      confirmText: 'Disconnect SMTP',
      notice: 'Campaigns will route through sandboxed Ethereal SMTP preview links instead of your direct SMTP server.',
    });
  };

  const handleExecuteConfirm = async () => {
    if (confirmModal.type === 'google') {
      setDisconnectingGoogle(true);
      try {
        await apiClient.integrations.disconnectGoogle();
        await loadDashboard();
        success('Google account disconnected successfully');
        setConfirmModal((prev) => ({ ...prev, isOpen: false, type: null }));
      } catch (err: any) {
        error(err.message || 'Failed to disconnect Google account');
      } finally {
        setDisconnectingGoogle(false);
      }
    } else if (confirmModal.type === 'slack') {
      setDisconnectingSlack(true);
      try {
        await apiClient.integrations.disconnectSlack();
        await loadDashboard();
        success('Slack integration disconnected');
        setConfirmModal((prev) => ({ ...prev, isOpen: false, type: null }));
      } catch (err: any) {
        error(err.message || 'Failed to disconnect Slack');
      } finally {
        setDisconnectingSlack(false);
      }
    } else if (confirmModal.type === 'smtp') {
      setDisconnectingSmtp(true);
      try {
        await apiClient.integrations.disconnectSmtp();
        await loadDashboard();
        success('Custom SMTP disconnected. Sandbox fallback restored.');
        setConfirmModal((prev) => ({ ...prev, isOpen: false, type: null }));
      } catch (err: any) {
        error(err.message || 'Failed to disconnect custom SMTP');
      } finally {
        setDisconnectingSmtp(false);
      }
    }
  };

  const handleConnectGoogle = () => {
    window.location.href = `/auth/google?returnTo=${encodeURIComponent('/dashboard?tab=integrations&google=connected')}`;
  };

  const handleConnectSlack = () => {
    window.location.href = '/integrations/slack/authorize';
  };

  // Card filter logic
  const matchesSearch = (title: string, desc: string) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return title.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-16 animate-in fade-in duration-300">
      {/* Top Banner & Header matching GCP / Modern SaaS Developer Console */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Integrations & Connected Services
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-[#00873d] border border-emerald-200/80">
              SaaS Marketplace
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Enable and manage OAuth2 mailboxes, real-time alert webhooks, and distributed queue infrastructure for your workspace.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-9 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold gap-1.5"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00a84e]' : 'text-slate-500'}`} />
            <span>Refresh Status</span>
          </Button>

          <Button
            size="sm"
            onClick={() => window.open('/admin/queues', '_blank')}
            className="h-9 px-3.5 rounded-xl bg-[#00a84e] hover:bg-[#009243] text-white text-xs font-semibold gap-1.5 shadow-xs"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>BullMQ Monitor</span>
            <ExternalLink className="w-3 h-3 opacity-70 ml-0.5" />
          </Button>
        </div>
      </div>

      {/* KPI / Status Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Connected Services Count */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#00a84e] flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Services Active</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">
                {(isGoogleConnected ? 1 : 0) + (isSlackConnected ? 1 : 0) + (isCustomSmtpConnected ? 1 : 0) + 1} <span className="text-xs font-normal text-slate-500">of 4 configured</span>
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-[#00873d] border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00a84e] animate-pulse" />
            Online
          </span>
        </div>

        {/* Primary Dispatch Mailbox */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Primary Mailbox</p>
              {isGoogleConnected ? (
                <>
                  <p className="text-sm font-bold text-slate-900 truncate mt-0.5" title={cleanSenderName}>
                    {cleanSenderName}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{sender?.email || user?.email}</p>
                </>
              ) : isCustomSmtpConnected ? (
                <>
                  <p className="text-sm font-bold text-slate-900 truncate mt-0.5" title={cleanSenderName}>
                    {cleanSenderName}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{sender?.smtpUser || sender?.email || user?.email}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-slate-900 truncate mt-0.5">
                    ReachInbox Sandbox Relay
                  </p>
                  <p className="text-[11px] text-amber-600 font-medium truncate">sandbox@reachinbox.email (Ethereal)</p>
                </>
              )}
            </div>
          </div>
          {isGoogleConnected ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0 ml-2">
              Gmail OAuth2
            </span>
          ) : isCustomSmtpConnected ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200/80 shrink-0 ml-2">
              Custom SMTP
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 shrink-0 ml-2">
              Sandbox Mode
            </span>
          )}
        </div>

        {/* Slack Alerts */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Rate-Limit Alerts</p>
              <p className="text-sm font-bold text-slate-900 truncate mt-0.5">
                {isSlackConnected ? `#${slackIntegration?.channelName || 'general'}` : 'Not Enabled'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {isSlackConnected ? (slackIntegration?.teamName || 'Slack Workspace') : 'Rate-limit breaches unhooked'}
              </p>
            </div>
          </div>
          {isSlackConnected ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0 ml-2">
              Active
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 shrink-0 ml-2">
              Standby
            </span>
          )}
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Services
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('email')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'email'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Email Dispatchers
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('alerts')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'alerts'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Observability & Alerts
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('infra')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'infra'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Infrastructure
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search integrations..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-[#00a84e] transition-all"
          />
        </div>
      </div>

      {/* GCP-Style Service Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* CARD 1: Google Gmail OAuth2 Dispatcher */}
        {(activeCategory === 'all' || activeCategory === 'email') &&
          matchesSearch('Google Gmail', 'OAuth2 email sending gmail.send cold outreach') && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4">
                {/* Header with Google Logo & Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2.5 shadow-2xs">
                      <svg className="w-full h-full" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.645-5.2 3.645-9.15z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.73-2.1-6.67-4.93H1.28v3.15C3.3 21.36 7.35 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.33 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.57H1.28C.46 8.2 0 10.04 0 12s.46 3.8 1.28 5.43l4.05-3.15z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.3 2.64 1.28 6.57l4.05 3.15c.94-2.83 3.57-4.97 6.67-4.97z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        Google Gmail Service
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Email Dispatch & OAuth2 Mailbox (gmail.send)
                      </p>
                    </div>
                  </div>

                  {isGoogleConnected ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#00873d] border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00a84e] animate-pulse" />
                      Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      Not Enabled
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 leading-relaxed">
                  Authorize ReachInbox to dispatch scheduled campaigns directly through your personal or Google Workspace Gmail account with zero password sharing using offline token exchange.
                </p>

                {/* Connected State Details (GCP Service Detail View) */}
                {isGoogleConnected ? (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Connected Account:</span>
                      <span className="font-bold text-slate-900">{cleanSenderName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Authenticated Email:</span>
                      <span className="font-mono text-slate-800 font-semibold">{sender?.email || user?.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Authorization Scope:</span>
                      <span className="text-emerald-700 font-semibold">gmail.send (Offline Refresh)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Hourly Throughput Limit:</span>
                      <span className="font-medium text-slate-700">{sender?.hourlyLimit || 200} emails/hr • {sender?.minDelaySeconds || 2}s delay</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500">Dispatch Health:</span>
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00a84e]" />
                        Healthy & Active
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-amber-900 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      <span>Ready to Connect with Google</span>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      Connecting enables real email delivery to any inbox worldwide directly from your verified Google address without SMTP credentials.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="px-5 sm:px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3">
                {isGoogleConnected ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={promptDisconnectGoogle}
                      disabled={disconnectingGoogle}
                      className="h-8.5 px-3 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold gap-1.5"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>{disconnectingGoogle ? 'Disconnecting...' : 'Disable Service'}</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => {
                        openCompose();
                        router.replace('/dashboard?tab=integrations&compose=true', { scroll: false });
                      }}
                      className="h-8.5 px-4 rounded-xl bg-[#00a84e] hover:bg-[#009243] text-white text-xs font-semibold gap-1.5 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Compose Email</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleConnectGoogle}
                    className="w-full h-9 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-xs gap-2 shadow-xs transition-all hover:border-slate-400"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.645-5.2 3.645-9.15z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.73-2.1-6.67-4.93H1.28v3.15C3.3 21.36 7.35 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.33 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.57H1.28C.46 8.2 0 10.04 0 12s.46 3.8 1.28 5.43l4.05-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.3 2.64 1.28 6.57l4.05 3.15c.94-2.83 3.57-4.97 6.67-4.97z"/>
                    </svg>
                    <span>Enable Service with Google</span>
                  </Button>
                )}
              </div>
            </div>
          )}

        {/* CARD 2: Slack Alerting Service */}
        {(activeCategory === 'all' || activeCategory === 'alerts') &&
          matchesSearch('Slack Notifications', 'Rate-limit threshold alerts webhooks') && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4">
                {/* Header with Slack Logo & Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#4a154b]/5 border border-purple-100 flex items-center justify-center p-2.5 shadow-2xs">
                      {/* Slack Vector Logo */}
                      <svg className="w-full h-full" viewBox="0 0 24 24">
                        <path fill="#E01E5A" d="M6 14.5a2.5 2.5 0 1 1-2.5-2.5h2.5v2.5zm1.25 0a2.5 2.5 0 0 1 5 0v6.25a2.5 2.5 0 1 1-5 0V14.5z"/>
                        <path fill="#36C5F0" d="M9.5 6a2.5 2.5 0 1 1 2.5-2.5v2.5H9.5zm0 1.25a2.5 2.5 0 0 1 0 5H3.25a2.5 2.5 0 0 1 0-5H9.5z"/>
                        <path fill="#2EB67D" d="M18 9.5a2.5 2.5 0 1 1 2.5 2.5H18V9.5zm-1.25 0a2.5 2.5 0 0 1-5 0V3.25a2.5 2.5 0 1 1 5 0V9.5z"/>
                        <path fill="#ECB22E" d="M14.5 18a2.5 2.5 0 1 1-2.5 2.5V18h2.5zm0-1.25a2.5 2.5 0 0 1 0-5h6.25a2.5 2.5 0 1 1 0 5H14.5z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        Slack Notification Service
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Real-time Rate-Limit & Queue Breach Monitoring
                      </p>
                    </div>
                  </div>

                  {isSlackConnected ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#00873d] border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00a84e] animate-pulse" />
                      Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      Not Enabled
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 leading-relaxed">
                  Broadcast automated webhook alerts to your team&apos;s Slack channel whenever an outreach burst reaches hourly sending thresholds (1,000+ job spikes) or emails are deferred.
                </p>

                {/* Connected State Details */}
                {isSlackConnected ? (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Connected Workspace:</span>
                      <span className="font-bold text-slate-900">{slackIntegration?.teamName || 'Primary Workspace'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Alert Destination Channel:</span>
                      <span className="font-mono text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                        #{slackIntegration?.channelName || 'general'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Trigger Conditions:</span>
                      <span className="font-medium text-slate-700">Hourly limit breach & queue deferrals</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500">Connection Health:</span>
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00a84e]" />
                        Active Webhook
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <Bell className="w-3.5 h-3.5 text-purple-600" />
                      <span>Zero-Lag Rate Limit Notifications</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Connect your team workspace via OAuth to receive instantaneous notifications when outreach volume exceeds mailbox limits.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="px-5 sm:px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3">
                {isSlackConnected ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={promptDisconnectSlack}
                      disabled={disconnectingSlack}
                      className="h-8.5 px-3 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold gap-1.5"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>{disconnectingSlack ? 'Disconnecting...' : 'Disable Service'}</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={handleTestSlack}
                      disabled={testingSlack}
                      className="h-8.5 px-4 rounded-xl bg-[#4a154b] hover:bg-[#5c1b5d] text-white text-xs font-semibold gap-1.5 shadow-xs"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>{testingSlack ? 'Sending...' : 'Send Test Alert'}</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleConnectSlack}
                    className="w-full h-9 rounded-xl bg-[#4a154b] hover:bg-[#5c1b5d] text-white font-semibold text-xs gap-2 shadow-xs transition-all"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Enable Service with Slack</span>
                  </Button>
                )}
              </div>
            </div>
          )}

        {/* CARD 3: Custom SMTP Mailbox Relay */}
        {(activeCategory === 'all' || activeCategory === 'email' || activeCategory === 'infra') &&
          matchesSearch('Custom SMTP Mailbox Relay', 'SMTP server host port password sendgrid ses mailgun ethereal sandbox relay') && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center p-2.5 shadow-2xs text-blue-600">
                      <Server className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Custom SMTP Mailbox Relay
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Direct Domain Dispatch & Custom Mail Server
                      </p>
                    </div>
                  </div>

                  {isCustomSmtpConnected ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#00873d] border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00a84e] animate-pulse" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      Sandbox Fallback
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {isCustomSmtpConnected
                    ? 'Your custom SMTP mail server credentials are authenticated and active. Scheduled emails will be dispatched directly through your verified server.'
                    : 'Dispatch emails directly through SendGrid, Mailgun, AWS SES, or Gmail App Password. Until configured, ReachInbox safely routes dispatches through Ethereal sandbox with live preview links.'}
                </p>

                {isCustomSmtpConnected ? (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Relay Host:</span>
                      <span className="font-mono text-slate-800 font-semibold">{sender?.smtpHost}:{sender?.smtpPort || 587}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Authenticated User:</span>
                      <span className="font-mono text-slate-800">{sender?.smtpUser || sender?.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Encryption:</span>
                      <span className="font-medium text-slate-700">{sender?.smtpPort === 465 ? 'SSL/TLS (Port 465)' : 'STARTTLS (Port 587)'}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500">Status:</span>
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00a84e]" />
                        Direct Dispatch Ready
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Current Relay:</span>
                      <span className="font-mono text-slate-800 font-semibold">smtp.ethereal.email:587</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Mode:</span>
                      <span className="font-medium text-amber-700">Safe Sandbox (Live Preview Links)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Credentials:</span>
                      <span className="text-slate-500">None required (Dynamic Ethereal accounts)</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 sm:px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3">
                {isCustomSmtpConnected ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={promptDisconnectSmtp}
                      disabled={disconnectingSmtp}
                      className="h-8.5 px-3 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold gap-1.5"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>{disconnectingSmtp ? 'Disconnecting...' : 'Disable Service'}</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSmtpModalOpen(true)}
                      className="h-8.5 px-3.5 rounded-xl border-slate-300 text-slate-700 hover:bg-white text-xs font-semibold gap-1.5 shadow-2xs"
                    >
                      <Sliders className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit Settings</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setSmtpModalOpen(true)}
                    className="w-full h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-2 shadow-xs transition-all"
                  >
                    <Server className="w-4 h-4" />
                    <span>Configure Custom SMTP Relay</span>
                  </Button>
                )}
              </div>
            </div>
          )}

        {/* CARD 4: BullMQ Queue Engine */}
        {(activeCategory === 'all' || activeCategory === 'infra' || activeCategory === 'alerts') &&
          matchesSearch('BullMQ Distributed Engine', 'Redis job queues worker concurrency delayed jobs') && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center p-2.5 shadow-2xs text-amber-600">
                      <Radio className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        BullMQ Queue Engine
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Redis Streams & Worker Concurrency
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#00873d] border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00a84e] animate-pulse" />
                    Operational
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Persistent Redis-backed queue manager handling delayed email dispatch, 5x worker concurrency, sliding-window rate limit token buckets, and automatic server restart reconciliation.
                </p>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Queue Identifier:</span>
                    <span className="font-mono text-slate-800 font-semibold">bullmq:emails</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Worker Concurrency:</span>
                    <span className="font-medium text-slate-700">5 Parallel Email Dispatches</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Persistence Model:</span>
                    <span className="text-emerald-700 font-semibold">Redis AOF + Transactional Outbox</span>
                  </div>
                </div>
              </div>

              <div className="px-5 sm:px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">Bull-Board Observability Dashboard</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open('/admin/queues', '_blank')}
                  className="h-8 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold gap-1"
                >
                  <span>Open Monitor</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </Button>
              </div>
            </div>
          )}
      </div>

      {/* Cross-Platform Shadcn UI Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false, type: null }))}
        onConfirm={handleExecuteConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={confirmModal.confirmText}
        cancelText="Cancel"
        variant="danger"
        isLoading={disconnectingGoogle || disconnectingSlack || disconnectingSmtp}
      >
        {confirmModal.notice && (
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 leading-relaxed flex items-start gap-2">
            <span className="font-bold text-amber-800 shrink-0">Note:</span>
            <span>{confirmModal.notice}</span>
          </div>
        )}
      </ConfirmModal>

      {/* Custom SMTP Configuration Modal */}
      <SmtpConfigModal
        isOpen={smtpModalOpen}
        onClose={() => setSmtpModalOpen(false)}
        onSaved={loadDashboard}
      />
    </div>
  );
}
