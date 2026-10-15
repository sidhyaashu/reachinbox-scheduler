'use client';

import React, { useState } from 'react';
import { EmailRecord } from '../lib/api';
import { formatDateTime, formatRelativeTime } from '../lib/utils';
import { Clock, XCircle, AlertCircle, Calendar } from 'lucide-react';

interface ScheduledTableProps {
  emails: EmailRecord[];
  loading: boolean;
  onCancel: (id: string) => Promise<void>;
  onOpenCompose: () => void;
}

export function ScheduledTable({ emails, loading, onCancel, onOpenCompose }: ScheduledTableProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    if (confirm('Are you sure you want to cancel this scheduled email?')) {
      setCancellingId(id);
      try {
        await onCancel(id);
      } finally {
        setCancellingId(null);
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-card border border-border/80 rounded-2xl p-6 shadow-xl space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse flex items-center justify-between py-3 border-b border-border/40">
            <div className="space-y-2 w-1/3">
              <div className="h-4 bg-slate-800 rounded w-3/4"></div>
              <div className="h-3 bg-slate-800/60 rounded w-1/2"></div>
            </div>
            <div className="h-4 bg-slate-800 rounded w-1/4"></div>
            <div className="h-6 bg-slate-800 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-surface-card border border-border/80 rounded-2xl p-12 text-center shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-semibold text-slate-100 mb-1">No scheduled emails in queue</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
          You don&apos;t have any pending outreach emails right now. Schedule single emails or upload a lead CSV to get started!
        </p>
        <button
          onClick={onOpenCompose}
          className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-all shadow-lg shadow-brand-500/25"
        >
          + Compose New Email
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface-card border border-border/80 rounded-2xl shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#0b101d] text-slate-400 uppercase text-xs tracking-wider border-b border-border">
            <tr>
              <th className="py-3.5 px-6 font-semibold">Recipient</th>
              <th className="py-3.5 px-6 font-semibold">Subject</th>
              <th className="py-3.5 px-6 font-semibold">Scheduled For</th>
              <th className="py-3.5 px-6 font-semibold">Status</th>
              <th className="py-3.5 px-6 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-slate-200">
            {emails.map((email) => {
              const isCancelling = cancellingId === email.id;
              const isDeferred = email.status === 'DEFERRED';

              return (
                <tr key={email.id} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="py-4 px-6 font-medium text-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-brand-300 font-semibold shrink-0">
                        {email.recipient[0]?.toUpperCase()}
                      </div>
                      <span className="truncate max-w-[220px]">{email.recipient}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-300 max-w-[260px] truncate">
                    {email.subject}
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <span className="text-slate-100">{formatDateTime(email.scheduled_at)}</span>
                        <span className="text-xs text-brand-400 block">
                          ({formatRelativeTime(email.scheduled_at)})
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    {isDeferred ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        <AlertCircle className="w-3 h-3 text-purple-400" />
                        Deferred (Hourly Cap)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                        {email.status}
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleCancel(email.id)}
                      disabled={isCancelling}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{isCancelling ? 'Cancelling...' : 'Cancel'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
