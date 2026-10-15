'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, ShieldCheck, Send, Sparkles } from 'lucide-react';
import { CsvLeadParser } from './CsvLeadParser';
import { ScheduleBatchPayload } from '../lib/api';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: ScheduleBatchPayload) => Promise<void>;
  defaultHourlyLimit?: number;
  defaultMinDelay?: number;
}

export function ComposeModal({
  isOpen,
  onClose,
  onSubmit,
  defaultHourlyLimit = 200,
  defaultMinDelay = 2,
}: ComposeModalProps) {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(defaultMinDelay);
  const [hourlyLimit, setHourlyLimit] = useState(defaultHourlyLimit);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize scheduledAt with now + 2 minutes
  useEffect(() => {
    if (isOpen) {
      const d = new Date(Date.now() + 2 * 60 * 1000);
      d.setSeconds(0, 0);
      // Format as YYYY-MM-DDTHH:mm for datetime-local input
      const pad = (n: number) => n.toString().padStart(2, '0');
      const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setScheduledAt(formatted);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const setPresetTime = (offsetMinutes: number) => {
    const d = new Date(Date.now() + offsetMinutes * 60 * 1000);
    d.setSeconds(0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    setScheduledAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  const handleInsertVariable = (variable: string) => {
    setBody((prev) => `${prev} {{${variable}}}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipients.length === 0) {
      alert('Please provide at least one valid recipient lead');
      return;
    }
    if (!subject.trim()) {
      alert('Please provide an email subject');
      return;
    }
    if (!body.trim()) {
      alert('Please provide email body content');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        recipients,
        subject,
        body,
        scheduledAt: new Date(scheduledAt).toISOString(),
        delaySecondsBetweenSends: delaySeconds,
        hourlyLimit,
      });
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to schedule campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#0e131f] border border-border/80 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#0b101d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Schedule Email Outreach</h2>
              <p className="text-xs text-slate-400">Zero-cron BullMQ persistent queue delivery</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Recipient Leads selector */}
          <CsvLeadParser onLeadsChange={setRecipients} />

          {/* Subject Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              placeholder="e.g. Quick question regarding Outbox deliverability"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface text-sm text-slate-100 placeholder-slate-500 rounded-xl border border-border focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              required
            />
          </div>

          {/* Body Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Email Content (HTML or Text)
              </label>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>Variables:</span>
                <button
                  type="button"
                  onClick={() => handleInsertVariable('firstName')}
                  className="px-2 py-0.5 rounded bg-surface border border-border hover:border-brand-500/40 text-brand-300"
                >
                  firstName
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertVariable('company')}
                  className="px-2 py-0.5 rounded bg-surface border border-border hover:border-brand-500/40 text-brand-300"
                >
                  company
                </button>
              </div>
            </div>
            <textarea
              rows={4}
              placeholder="Hey {{firstName}}, noticed your team is scaling outreach..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface text-sm text-slate-100 placeholder-slate-500 rounded-xl border border-border focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans"
              required
            />
          </div>

          {/* Scheduling Parameters Grid */}
          <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Clock className="w-4 h-4 text-brand-400" />
              <span>Deliverability & Rate Limiting Controls</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start Time */}
              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-300 font-medium">Start Schedule At</label>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPresetTime(0)}
                      className="px-2 py-0.5 rounded bg-surface-card border border-border text-slate-400 hover:text-white"
                    >
                      Now
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetTime(15)}
                      className="px-2 py-0.5 rounded bg-surface-card border border-border text-slate-400 hover:text-white"
                    >
                      In 15m
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetTime(60)}
                      className="px-2 py-0.5 rounded bg-surface-card border border-border text-slate-400 hover:text-white"
                    >
                      In 1 hr
                    </button>
                  </div>
                </div>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-3.5 py-2 bg-surface-card text-xs text-slate-200 rounded-lg border border-border focus:border-brand-500 focus:outline-none"
                  required
                />
              </div>

              {/* Inter-send Delay */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium">
                  Inter-Send Delay (seconds)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(parseInt(e.target.value) || 2)}
                    className="w-full px-3 py-2 bg-surface-card text-xs text-slate-200 rounded-lg border border-border focus:border-brand-500 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400 shrink-0">sec/send</span>
                </div>
              </div>

              {/* Hourly Quota */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium">
                  Hourly Limit Quota
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(parseInt(e.target.value) || 50)}
                    className="w-full px-3 py-2 bg-surface-card text-xs text-slate-200 rounded-lg border border-border focus:border-brand-500 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400 shrink-0">emails/hr</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 italic">
              * Any emails scheduled beyond your hourly limit are automatically postponed to the next hour window (zero-drop guarantee).
            </p>
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border text-slate-300 hover:text-white hover:bg-surface text-xs font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || recipients.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-all shadow-lg shadow-brand-500/25 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? 'Scheduling Campaign...'
                  : `Schedule ${recipients.length} Email${recipients.length === 1 ? '' : 's'}`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
