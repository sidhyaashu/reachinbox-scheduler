'use client';

import React, { useState } from 'react';
import { useSchedulerStore } from '../lib/store';
import {
  ArrowLeft,
  Star,
  Archive,
  Trash2,
  ChevronDown,
  CheckCircle,
  ExternalLink,
  Clock,
  AlertCircle,
  Mail,
  UserCheck,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { formatFigmaScheduleTime } from '../lib/utils';
import { useToast } from './Toast';

export function EmailDetailView() {
  const { selectedEmail, closeDetail, cancelEmail, user, sender } = useSchedulerStore();
  const { success, error, info } = useToast();
  const [isStarred, setIsStarred] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!selectedEmail) return null;

  const handleDelete = async () => {
    if (confirm('Cancel and delete this email from the queue?')) {
      setDeleting(true);
      try {
        await cancelEmail(selectedEmail.id);
        success('Email Cancelled', 'The scheduled outreach was removed from the queue');
        closeDetail();
      } catch (err: any) {
        error('Cancellation failed', err.message);
      } finally {
        setDeleting(false);
      }
    }
  };

  const recipientEmail = selectedEmail.recipient || 'recipient@example.com';
  const [recipientPrefix] = recipientEmail.split('@');
  const formattedRecipient = recipientPrefix
    .split('.')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

  const senderEmail = sender?.email || user?.email || 'outreach@reachinbox.ai';
  const senderName = sender?.name || user?.name || 'ReachInbox Mailbox';
  const senderInitial = (senderName[0] || 'R').toUpperCase();

  const isScheduled = selectedEmail.status === 'SCHEDULED' || selectedEmail.status === 'QUEUED';
  const isSent = selectedEmail.status === 'SENT';
  const isFailed = selectedEmail.status === 'FAILED';

  const scheduledFormatted = selectedEmail.scheduledAt
    ? formatFigmaScheduleTime(selectedEmail.scheduledAt)
    : 'Not scheduled';

  return (
    <div className="flex-1 flex flex-col bg-white overflow-y-auto">
      {/* Top Header - Responsive across 7 breakpoints */}
      <div className="flex items-center justify-between px-3 2xs:px-4 xs:px-6 sm:px-8 py-3.5 border-b border-slate-100 sticky top-0 bg-white z-10">
        {/* Left: Back Arrow + Subject */}
        <div className="flex items-center gap-2.5 2xs:gap-3 overflow-hidden flex-1 min-w-0 pr-2">
          <button
            type="button"
            onClick={closeDetail}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shrink-0 cursor-pointer"
            title="Back to email list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm 2xs:text-base font-bold text-slate-900 truncate tracking-tight">
            {selectedEmail.subject || 'Outreach campaign'}
          </h1>
        </div>

        {/* Right: Actions + User Avatar */}
        <div className="flex items-center gap-1.5 2xs:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsStarred(!isStarred)}
            className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
            title="Star email"
          >
            <Star
              className={`w-4 h-4 ${
                isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => info('Archived', 'Email archived')}
            className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer hidden 2xs:block"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer disabled:cursor-not-allowed"
            title="Delete / Cancel email"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden xs:block" />

          <Avatar className="w-7 h-7 2xs:w-8 2xs:h-8 hidden xs:flex">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="User" />}
            <AvatarFallback className="bg-[#00a84e] text-white text-xs font-semibold">
              {(user?.name?.[0] || 'U').toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Main Email Message Body */}
      <div className="max-w-4xl w-full mx-auto px-3 2xs:px-4 xs:px-6 sm:px-8 py-5 sm:py-8 flex flex-col gap-6">
        {/* Status Callout Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 2xs:p-4 rounded-2xl bg-[#f8fafc] border border-slate-200/70">
          <div className="flex items-center gap-2 text-xs">
            {isScheduled && (
              <>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-[#ffedd5] text-[#c2410c] border border-[#fed7aa]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Scheduled for: {scheduledFormatted}</span>
                </span>
              </>
            )}
            {isSent && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-[#e8f5e9] text-[#00873d] border border-[#c8e6c9]">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Sent successfully</span>
              </span>
            )}
            {isFailed && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-red-50 text-red-700 border border-red-200">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Failed</span>
              </span>
            )}
          </div>

          {selectedEmail.etherealMessageUrl && (
            <a
              href={selectedEmail.etherealMessageUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00a84e] hover:text-[#00873d] bg-white border border-[#00a84e]/30 px-3 py-1 rounded-full shadow-xs transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Live Ethereal Preview ↗</span>
            </a>
          )}
        </div>

        {/* Sender & Recipient Information */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00a84e] text-white font-bold flex items-center justify-center shrink-0 text-sm">
              {senderInitial}
            </div>
            <div>
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="font-bold text-slate-900 text-sm">
                  {senderName}
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  &lt;{senderEmail}&gt;
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                <span>to</span>
                <span className="font-semibold text-slate-700">{formattedRecipient}</span>
                <span className="text-slate-400 font-normal">&lt;{recipientEmail}&gt;</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-400 font-normal sm:text-right shrink-0">
            {new Date(selectedEmail.createdAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>

        {/* Message Body Content */}
        <div className="text-sm text-slate-800 leading-relaxed space-y-4 pt-1">
          {selectedEmail.body ? (
            <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-slate-800 bg-[#f8fafc]/50 p-4 2xs:p-6 rounded-2xl border border-slate-100">
              {selectedEmail.body}
            </div>
          ) : (
            <p className="text-slate-400 italic text-xs">No email message content provided.</p>
          )}
        </div>

        {/* Metadata Details */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 2xs:grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">
              Email ID
            </span>
            <span className="font-mono text-slate-700 text-[11px] truncate block mt-0.5">
              {selectedEmail.id}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">
              Delivery Attempts
            </span>
            <span className="text-slate-700 font-semibold block mt-0.5">
              {selectedEmail.attempts || 0}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 2xs:col-span-2 sm:col-span-1">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">
              Outbox State
            </span>
            <span className="text-[#00873d] font-semibold block mt-0.5">
              {selectedEmail.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
