'use client';

import React from 'react';
import { EmailRecord } from '../lib/api';
import { formatDateTime } from '../lib/utils';
import { CheckCircle2, AlertTriangle, ExternalLink, Send } from 'lucide-react';

interface SentTableProps {
  emails: EmailRecord[];
  loading: boolean;
  onOpenCompose: () => void;
}

export function SentTable({ emails, loading, onOpenCompose }: SentTableProps) {
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
            <div className="h-6 bg-slate-800 rounded w-24"></div>
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-surface-card border border-border/80 rounded-2xl p-12 text-center shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
          <Send className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-semibold text-slate-100 mb-1">No sent emails yet</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
          Once your scheduled emails are delivered through Ethereal SMTP, they will appear here with live preview links!
        </p>
        <button
          onClick={onOpenCompose}
          className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-all shadow-lg shadow-brand-500/25"
        >
          + Compose & Schedule
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
              <th className="py-3.5 px-6 font-semibold">Sent At</th>
              <th className="py-3.5 px-6 font-semibold">Delivery Status</th>
              <th className="py-3.5 px-6 font-semibold text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-slate-200">
            {emails.map((email) => {
              const isSent = email.status === 'SENT';

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
                  <td className="py-4 px-6 text-slate-300 whitespace-nowrap">
                    {formatDateTime(email.sent_at || email.created_at)}
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    {isSent ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Delivered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    {email.ethereal_message_url ? (
                      <a
                        href={email.ethereal_message_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 transition-all hover:text-white"
                      >
                        <span>View Preview</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500 italic">No preview link</span>
                    )}
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
