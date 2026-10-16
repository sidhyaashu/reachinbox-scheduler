'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './Toast';
import { apiClient } from '../lib/api-client';
import { useSchedulerStore } from '../lib/store';
import { Server, Eye, EyeOff, CheckCircle2, ShieldCheck, HelpCircle, Loader2 } from 'lucide-react';

interface SmtpConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function SmtpConfigModal({ isOpen, onClose, onSaved }: SmtpConfigModalProps) {
  const { user, sender, loadDashboard } = useSchedulerStore();
  const { success, error } = useToast();

  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFromName(sender?.name || user?.name || '');
      setFromEmail(sender?.email || user?.email || '');
      setSmtpUser(sender?.smtpUser || sender?.email || user?.email || '');
      setSmtpHost(sender?.smtpHost && sender.smtpHost !== 'smtp.ethereal.email' ? sender.smtpHost : 'smtp.gmail.com');
      setSmtpPort(sender?.smtpPort ? String(sender.smtpPort) : '587');
      setSmtpSecure(Boolean(sender?.smtpPort === 465));
      setSmtpPass('');
      setShowPassword(false);
    }
  }, [isOpen, sender, user]);

  const handleApplyPreset = (preset: 'gmail' | 'sendgrid' | 'mailgun' | 'ses') => {
    switch (preset) {
      case 'gmail':
        setSmtpHost('smtp.gmail.com');
        setSmtpPort('587');
        setSmtpSecure(false);
        break;
      case 'sendgrid':
        setSmtpHost('smtp.sendgrid.net');
        setSmtpPort('587');
        setSmtpUser('apikey');
        setSmtpSecure(false);
        break;
      case 'mailgun':
        setSmtpHost('smtp.mailgun.org');
        setSmtpPort('587');
        setSmtpSecure(false);
        break;
      case 'ses':
        setSmtpHost('email-smtp.us-east-1.amazonaws.com');
        setSmtpPort('587');
        setSmtpSecure(false);
        break;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpHost.trim()) {
      error('Missing Host', 'Please specify your SMTP server host');
      return;
    }
    if (!smtpUser.trim()) {
      error('Missing Username', 'Please enter your SMTP username');
      return;
    }
    if (!smtpPass.trim()) {
      error('Missing Password', 'Please enter your SMTP password or app password');
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.integrations.saveSmtp({
        smtpHost: smtpHost.trim(),
        smtpPort: parseInt(smtpPort, 10) || 587,
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim(),
        smtpSecure,
        name: fromName.trim() || user?.name || 'Mailbox Sender',
        email: fromEmail.trim() || user?.email || smtpUser.trim(),
      });

      await loadDashboard();
      success('SMTP Mailbox Saved', `Active delivery configured through ${smtpHost}`);
      onClose();
      if (onSaved) onSaved();
    } catch (err: any) {
      error('Connection Failed', err.message || 'Could not verify or save SMTP settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="sm:max-w-md md:max-w-lg p-6 bg-white rounded-2xl border border-slate-200 shadow-2xl">
        <form onSubmit={handleSave} className="space-y-4">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                  Configure Custom SMTP Mailbox
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Connect your custom domain or email provider to dispatch live outreach directly.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => handleApplyPreset('gmail')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors cursor-pointer"
            >
              Gmail (App Password)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('sendgrid')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors cursor-pointer"
            >
              SendGrid
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('mailgun')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors cursor-pointer"
            >
              Mailgun
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('ses')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors cursor-pointer"
            >
              Amazon SES
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">From Name</label>
              <Input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="e.g. Alex Founder"
                className="h-8.5 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">From Email Address</label>
              <Input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="e.g. alex@company.com"
                className="h-8.5 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">SMTP Host / Server</label>
              <Input
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
                required
                className="h-8.5 text-xs font-mono rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">Port</label>
              <Input
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
                required
                className="h-8.5 text-xs font-mono rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">Username / Account</label>
              <Input
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="username or email"
                required
                className="h-8.5 text-xs font-mono rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">Password / App Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="h-8.5 text-xs font-mono pr-8 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="smtpSecure"
                checked={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.checked)}
                className="rounded border-slate-300 text-[#00a84e] focus:ring-[#00a84e] cursor-pointer"
              />
              <label htmlFor="smtpSecure" className="font-medium text-slate-700 cursor-pointer">
                Use SSL / TLS (Default for port 465)
              </label>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">STARTTLS on 587</span>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-blue-900 leading-relaxed space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-blue-800">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-blue-600" />
              <span>Security &amp; Production Dispatch</span>
            </div>
            <p className="text-blue-700">
              Once saved, emails scheduled in ReachInbox are dispatched directly through this mailbox with your domain DKIM/SPF signatures. For Gmail, use an <strong>App Password</strong> generated with 2FA enabled.
            </p>
          </div>

          <DialogFooter className="flex sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 px-4 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="h-9 px-4 rounded-xl bg-[#00a84e] hover:bg-[#009243] text-white text-xs font-semibold gap-1.5 shadow-xs cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing &amp; Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Mailbox</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
