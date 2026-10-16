'use client';

import React, { useState } from 'react';
import { X, Zap, Bell, CheckCircle2, AlertCircle, ExternalLink, Unlink } from 'lucide-react';
import { SlackStatus, apiClient } from '../lib/api-client';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SlackStatus | null;
  onRefresh: () => void;
}

export function SlackModal({ isOpen, onClose, status, onRefresh }: SlackModalProps) {
  const [testingAlert, setTestingAlert] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connectingWebhook, setConnectingWebhook] = useState(false);
  const [mode, setMode] = useState<'oauth' | 'webhook'>('oauth');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelName, setChannelName] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const handleTestAlert = async () => {
    setTestingAlert(true);
    setMessage(null);
    try {
      const res = await apiClient.integrations.sendSlackTestAlert();
      setMessage({ text: res.message || 'Test alert sent successfully to Slack!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to send test alert', type: 'error' });
    } finally {
      setTestingAlert(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setMessage(null);
    try {
      await apiClient.integrations.disconnectSlack();
      onRefresh();
      onClose();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to disconnect Slack', type: 'error' });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleConnectWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;
    setConnectingWebhook(true);
    setMessage(null);
    try {
      const res = await apiClient.integrations.connectSlackWebhook(webhookUrl.trim(), channelName.trim() || undefined);
      setMessage({ text: res.message || 'Slack Webhook connected and verified successfully!', type: 'success' });
      onRefresh();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to connect Slack webhook', type: 'error' });
    } finally {
      setConnectingWebhook(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#0e131f] border border-border/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#0b101d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Slack Integration</h2>
              <p className="text-xs text-slate-400">Multi-tenant real-time rate limit alerts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {message && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {status?.connected ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-surface border border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Connection Status</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Connected
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                  <span className="text-slate-400">Workspace:</span>
                  <span className="font-semibold text-slate-200">{status.teamName || 'Primary Workspace'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Alert Channel:</span>
                  <span className="font-semibold text-brand-400">#{String(status.channelName || 'general').replace(/^#+/, '')}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestAlert}
                  disabled={testingAlert}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-surface border border-border hover:border-brand-500/50 text-slate-200 text-xs font-semibold transition-all hover:bg-surface-hover disabled:opacity-50"
                >
                  <Bell className="w-3.5 h-3.5 text-brand-400" />
                  <span>{testingAlert ? 'Sending Alert...' : 'Send Test Alert'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-all disabled:opacity-50"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>{disconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center p-1 bg-surface rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setMode('oauth')}
                  className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-all ${
                    mode === 'oauth'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚡ Slack OAuth (1-Click)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('webhook')}
                  className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-all ${
                    mode === 'webhook'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🔗 Custom Webhook URL
                </button>
              </div>

              {mode === 'oauth' ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-300">
                    Authenticate your Slack workspace via OAuth2 to automatically deliver rate-limit alerts directly to your team channel.
                  </p>

                  <div className="p-3.5 rounded-xl bg-surface border border-border text-xs text-slate-400 space-y-1.5">
                    <div className="font-semibold text-slate-200">How it works:</div>
                    <p>• Zero jobs dropped during 1,000+ email bursts.</p>
                    <p>• Automated notifications dispatched the moment hourly limits trigger deferrals.</p>
                  </div>

                  <a
                    href="/integrations/slack/authorize"
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#4a154b] hover:bg-[#5c1b5d] text-white text-xs font-semibold transition-all shadow-lg"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Connect with Slack OAuth</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </a>

                  <p className="text-[11px] text-slate-500 leading-relaxed text-center">
                    Note: To connect external workspaces, ensure <em>Activate Public Distribution</em> is turned on in your Slack App Dashboard.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleConnectWebhook} className="space-y-3">
                  <p className="text-xs text-slate-300">
                    Paste an Incoming Webhook URL from any Slack workspace or channel. Perfect for workspaces with restricted OAuth app permissions.
                  </p>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Slack Webhook URL <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="url"
                        required
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://hooks.slack.com/services/T.../B.../..."
                        className="w-full px-3 py-2 text-xs rounded-xl bg-surface border border-border text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Channel Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={channelName}
                        onChange={(e) => setChannelName(e.target.value)}
                        placeholder="#rate-limit-alerts"
                        className="w-full px-3 py-2 text-xs rounded-xl bg-surface border border-border text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={connectingWebhook || !webhookUrl.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-all shadow-lg disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    <span>{connectingWebhook ? 'Verifying Webhook...' : 'Connect & Verify Webhook'}</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
