'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSchedulerStore } from '../lib/store';
import { EmailRecord } from '../lib/api-client';
import { Skeleton } from './ui/skeleton';
import { formatFigmaScheduleTime } from '../lib/utils';
import { Clock, Star, Mail, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export function EmailList() {
  const router = useRouter();
  const {
    activeTab,
    scheduledEmails,
    sentEmails,
    searchResults,
    isLoading,
    filterStatus,
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
    const [namePart] = email.recipient.split('@');
    if (namePart.includes('.')) {
      return namePart
        .split('.')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  };

  // Determine current list and apply filter if active
  const rawList = activeTab === 'scheduled' ? scheduledEmails : sentEmails;
  const filteredList =
    filterStatus === 'ALL'
      ? rawList
      : rawList.filter((e) => {
          if (filterStatus === 'SCHEDULED') return e.status === 'SCHEDULED' || e.status === 'QUEUED';
          if (filterStatus === 'SENT') return e.status === 'SENT';
          if (filterStatus === 'PROCESSING') return e.status === 'PROCESSING';
          if (filterStatus === 'FAILED') return e.status === 'FAILED';
          return true;
        });

  const emails = searchResults !== null ? searchResults : filteredList;

  if (isLoading) {
    return (
      <div className="w-full space-y-3 py-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 py-3.5 px-3 border-b border-slate-100">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-4 flex-1 w-full" />
            <Skeleton className="h-4 w-4 hidden sm:block" />
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4">
        <div className="w-12 h-12 rounded-2xl bg-[#e8f5e9] flex items-center justify-center text-[#00a84e] mb-3">
          <Mail className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">
          No {searchResults !== null ? 'matching' : activeTab === 'scheduled' ? 'scheduled' : 'sent'} emails found
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
          {activeTab === 'scheduled'
            ? 'Compose a new outreach email or upload leads to populate the queue.'
            : 'Sent campaign deliveries and live Ethereal preview links will appear here.'}
        </p>
        <button
          type="button"
          onClick={() => {
            openCompose();
            router.push(`/dashboard?tab=${activeTab}&compose=true`);
          }}
          className="text-xs font-semibold text-[#00a84e] bg-[#e8f5e9] hover:bg-[#d4edda] px-4 py-2 rounded-full transition-colors cursor-pointer"
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
        const isFailed = email.status === 'FAILED';
        const isProcessing = email.status === 'PROCESSING';

        // Render status badge based on exact state
        const renderBadge = () => {
          if (isFailed) {
            return (
              <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                <AlertCircle className="w-3 h-3" />
                <span>Failed</span>
              </span>
            );
          }
          if (isProcessing) {
            return (
              <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Sending</span>
              </span>
            );
          }
          if (isScheduled) {
            return (
              <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#ffedd5] text-[#c2410c] border border-[#fed7aa]">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{formatFigmaScheduleTime(email.scheduledAt)}</span>
              </span>
            );
          }
          return (
            <span className="shrink-0 inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-medium bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0]">
              <CheckCircle2 className="w-3 h-3 text-[#00a84e]" />
              <span>Sent</span>
            </span>
          );
        };

        return (
          <div
            key={email.id}
            onClick={() => {
              selectEmail(email);
              router.push(`/dashboard?tab=${activeTab}&emailId=${email.id}`);
            }}
            className="group flex flex-col sm:flex-row sm:items-center justify-between py-3 2xs:py-3.5 px-2.5 2xs:px-3 hover:bg-slate-50/80 cursor-pointer transition-colors text-sm gap-2 sm:gap-4"
          >
            {/* Mobile Layout: Stacked for < sm (320px - 639px) */}
            <div className="flex sm:hidden items-center justify-between gap-2 w-full">
              <span className="font-bold text-slate-900 truncate text-xs 2xs:text-sm">
                To: {recipientName}
              </span>
              <div className="flex items-center gap-2">
                {renderBadge()}
                <button
                  type="button"
                  onClick={(e) => toggleStar(e, email.id)}
                  className="p-1 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer shrink-0"
                  title="Star email"
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="sm:hidden text-xs text-slate-600 truncate flex items-center gap-1.5">
              <span className="font-semibold text-slate-900 truncate">
                {email.subject || 'Outreach campaign'}
              </span>
              <span className="text-slate-400 truncate font-normal">
                - {email.body ? email.body.replace(/<[^>]*>/g, '') : 'No message body'}
              </span>
            </div>

            {/* Desktop Layout: Horizontal Row for >= sm (640px - 1536px+) */}
            <div className="hidden sm:flex items-center gap-3.5 overflow-hidden flex-1 min-w-0 pr-2">
              {/* Recipient */}
              <span className="font-bold text-slate-900 shrink-0 w-36 md:w-44 truncate">
                To: {recipientName}
              </span>

              {/* Status Badge */}
              {renderBadge()}

              {/* Subject & Preview Snippet */}
              <div className="overflow-hidden truncate flex items-center gap-1.5 min-w-0 flex-1">
                <span className="font-bold text-slate-900 truncate">
                  {email.subject || 'Outreach campaign'}
                </span>
                <span className="text-slate-400 truncate font-normal">
                  - {email.body ? email.body.replace(/<[^>]*>/g, '') : 'No message body'}
                </span>
              </div>
            </div>

            {/* Desktop Star Action */}
            <div className="hidden sm:flex items-center shrink-0">
              <button
                type="button"
                onClick={(e) => toggleStar(e, email.id)}
                className="p-1 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
                title="Star email"
              >
                <Star
                  className={`w-4 h-4 ${
                    isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                  }`}
                />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
