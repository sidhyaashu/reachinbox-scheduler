'use client';

import React, { useState } from 'react';
import { X, Zap, Bell, CheckCircle2, AlertCircle, ExternalLink, Unlink, Loader2 } from 'lucide-react';
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

  const isConnected = Boolean(status?.connected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4a154b]/5 text-[#4a154b] border border-purple-100 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Slack Integration</h2>
              <p className="text-xs text-slate-500">Real-time alerts on rate-limit threshold breaches</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {message && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 border ${
                message.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#00a84e] shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium leading-relaxed">{message.text}</span>
            </div>
          )}

          {isConnected ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Connection Status</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#00873d] border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00a84e] animate-pulse"></span>
                    Connected
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 font-medium">Workspace:</span>
                  <span className="font-bold text-slate-900">{status?.teamName || 'Primary Workspace'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Alert Channel:</span>
                  <span className="font-mono text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                    #{String(status?.channelName || 'general').replace(/^#+/, '')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleTestAlert}
                  disabled={testingAlert}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#4a154b] hover:bg-[#5c1b5d] text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {testingAlert ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Alert...</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-3.5 h-3.5" />
                      <span>Send Test Alert</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>{disconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mode Switcher */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setMode('oauth')}
                  className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    mode === 'oauth'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ⚡ Slack OAuth (1-Click)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('webhook')}
                  className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    mode === 'webhook'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🔗 Custom Webhook URL
                </button>
              </div>

              {mode === 'oauth' ? (
                <div className="space-y-3.5">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Authenticate your Slack workspace via OAuth2 to automatically deliver rate-limit alerts directly to your team channel.
                  </p>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                    <div className="font-semibold text-slate-800">How it works:</div>
                    <p className="text-slate-500">• Zero jobs dropped during 1,000+ email bursts.</p>
                    <p className="text-slate-500">• Automated notifications dispatched the moment hourly limits trigger deferrals.</p>
                  </div>

                  <a
                    href="/integrations/slack/authorize"
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#4a154b] hover:bg-[#5c1b5d] text-white text-xs font-semibold transition-all shadow-sm"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Connect with Slack OAuth</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </a>

                  <p className="text-[11px] text-slate-400 leading-relaxed text-center">
                    Note: Works with any workspace where Public Distribution is activated.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleConnectWebhook} className="space-y-3.5">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Paste an Incoming Webhook URL from any Slack workspace or channel. Perfect for workspaces with restricted OAuth app permissions.
                  </p>

                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Slack Webhook URL <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="url"
                        required
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://hooks.slack.com/services/T.../B.../..."
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:border-[#00a84e] transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Channel Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={channelName}
                        onChange={(e) => setChannelName(e.target.value)}
                        placeholder="#rate-limit-alerts"
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:border-[#00a84e] transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={connectingWebhook || !webhookUrl.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#00a84e] hover:bg-[#009243] text-white text-xs font-semibold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {connectingWebhook ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying Webhook...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>Connect &amp; Verify Webhook</span>
                      </>
                    )}
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
