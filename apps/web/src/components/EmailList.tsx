'use client';

import React, { useState } from 'react';
import { useSchedulerStore } from '../lib/store';
import { EmailRecord } from '../lib/api-client';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { formatFigmaScheduleTime } from '../lib/utils';
import { Clock, Star, Mail } from 'lucide-react';

export function EmailList() {
  const {
    activeTab,
    scheduledEmails,
    sentEmails,
    searchResults,
    isLoading,
    selectEmail,
    openCompose,
  } = useSchedulerStore();

  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getRecipientDisplayName = (email: EmailRecord): string => {
    if (!email.recipient) return 'Recipient';
    // If recipient is an email address, extract clean name or formatted recipient
    const [namePart] = email.recipient.split('@');
    // Format "john.smith" -> "John Smith"
    if (namePart.includes('.')) {
      return namePart
        .split('.')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  };

  // Determine current list to render
  const rawList = activeTab === 'scheduled' ? scheduledEmails : sentEmails;
  const emails = searchResults !== null ? searchResults : rawList;

  if (isLoading) {
    return (
      <div className="w-full space-y-3 py-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3.5 px-4 border-b border-slate-100">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-4" />
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="w-12 h-12 rounded-2xl bg-[#e8f5e9] flex items-center justify-center text-[#00a84e] mb-3">
          <Mail className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">
          No {activeTab === 'scheduled' ? 'scheduled' : 'sent'} emails found
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
          {activeTab === 'scheduled'
            ? 'Compose a new outreach email or upload leads to populate the queue.'
            : 'Sent campaign deliveries and preview links will appear here.'}
        </p>
        <button
          onClick={openCompose}
          className="text-xs font-semibold text-[#00a84e] bg-[#e8f5e9] hover:bg-[#d4edda] px-4 py-2 rounded-full transition-colors"
        >
          + Compose New Email
        </button>
      </div>
    );
  }

  return (
    <div className="w-full divide-y divide-slate-100">
      {emails.map((email) => {
        const isStarred = starredIds.has(email.id);
        const recipientName = getRecipientDisplayName(email);
        const isScheduled = activeTab === 'scheduled' || email.status === 'SCHEDULED' || email.status === 'QUEUED';

        return (
          <div
            key={email.id}
            onClick={() => selectEmail(email)}
            className="group flex items-center justify-between py-3.5 px-3 hover:bg-slate-50/70 cursor-pointer transition-colors text-sm"
          >
            {/* Left Content */}
            <div className="flex items-center gap-3.5 overflow-hidden flex-1 min-w-0 pr-4">
              {/* Recipient */}
              <span className="font-bold text-slate-900 shrink-0 w-36 sm:w-44 truncate">
                To: {recipientName}
              </span>

              {/* Status Badge */}
              {isScheduled ? (
                <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#ffedd5] text-[#c2410c] border border-[#fed7aa]">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{formatFigmaScheduleTime(email.scheduledAt)}</span>
                </span>
              ) : (
                <span className="shrink-0 inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0]">
                  Sent
                </span>
              )}

              {/* Subject & Preview Snippet */}
              <div className="overflow-hidden truncate flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-slate-900 truncate">
                  {email.subject || 'Meeting follow-up'}
                </span>
                <span className="text-slate-400 truncate font-normal">
                  - {email.body ? email.body.replace(/<[^>]*>/g, '') : 'Just wanted to follow up on our discussion...'}
                </span>
              </div>
            </div>

            {/* Right Action: Star outline */}
            <button
              type="button"
              onClick={(e) => toggleStar(e, email.id)}
              className="p-1 text-slate-300 hover:text-amber-400 transition-colors shrink-0"
              title="Star email"
            >
              <Star
                className={`w-4 h-4 ${
                  isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                }`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
