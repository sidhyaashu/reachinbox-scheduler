'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSchedulerStore } from '../lib/store';
import {
  ArrowLeft,
  Star,
  Archive,
  ArchiveRestore,
  Trash2,
  ChevronDown,
  CheckCircle,
  ExternalLink,
  Clock,
  AlertCircle,
  AlertTriangle,
  Mail,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { formatFigmaScheduleTime, formatDateTime, parseRichEmailContent } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { useToast } from './Toast';

export function EmailDetailView() {
  const router = useRouter();
  const {
    selectedEmail,
    closeDetail,
    cancelEmail,
    user,
    sender,
    activeTab,
    starredEmailIds,
    toggleStar,
    archivedEmailIds,
    archiveEmail,
    unarchiveEmail,
  } = useSchedulerStore();
  const { success, error, info } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleBack = () => {
    closeDetail();
    router.push(`/dashboard?tab=${activeTab}`);
  };

  // Keyboard shortcut: Escape to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  if (!selectedEmail) return null;

  const handleDelete = () => {
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await cancelEmail(selectedEmail.id);
      success('Email Deleted', 'The scheduled outreach was removed from the queue');
      setConfirmOpen(false);
      handleBack();
    } catch (err: any) {
      error('Deletion failed', err.message);
    } finally {
      setDeleting(false);
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
            onClick={handleBack}
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
            onClick={() => toggleStar(selectedEmail.id)}
            className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
            title={starredEmailIds.includes(selectedEmail.id) ? 'Unstar email' : 'Star email'}
          >
            <Star
              className={`w-4 h-4 ${
                starredEmailIds.includes(selectedEmail.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => {
              if (archivedEmailIds.includes(selectedEmail.id)) {
                unarchiveEmail(selectedEmail.id);
                success('Restored', 'Email restored to inbox');
              } else {
                archiveEmail(selectedEmail.id);
                success('Archived', 'Email moved to archive');
                handleBack();
              }
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer hidden 2xs:block"
            title={archivedEmailIds.includes(selectedEmail.id) ? 'Restore to inbox' : 'Archive email'}
          >
            {archivedEmailIds.includes(selectedEmail.id) ? (
              <ArchiveRestore className="w-4 h-4 text-[#00a84e]" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
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
            {formatDateTime(selectedEmail.createdAt)}
          </div>
        </div>

        {/* Message Body Content */}
        <div className="text-sm text-slate-800 leading-relaxed space-y-4 pt-1">
          {selectedEmail.body ? (
            <div className="font-sans text-xs sm:text-sm text-slate-800 bg-[#f8fafc]/50 p-4 2xs:p-6 rounded-2xl border border-slate-100 leading-relaxed [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-3 [&_blockquote]:italic">
              <div dangerouslySetInnerHTML={{ __html: parseRichEmailContent(selectedEmail.body) }} />
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

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setConfirmOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle>Cancel & Delete Email</DialogTitle>
                <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone</p>
              </div>
            </div>
            <DialogDescription className="text-slate-600 pt-2 text-xs sm:text-sm">
              Are you sure you want to cancel and delete this email to{' '}
              <strong className="text-slate-900 font-semibold">{selectedEmail.recipient}</strong>?
              It will be permanently removed from the scheduling queue and database.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 my-1 text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-semibold text-slate-700 w-20 shrink-0">Recipient:</span>
              <span className="truncate text-slate-900 font-medium">{selectedEmail.recipient}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-semibold text-slate-700 w-20 shrink-0">Subject:</span>
              <span className="truncate text-slate-900 font-medium">{selectedEmail.subject || 'Outreach campaign'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-semibold text-slate-700 w-20 shrink-0">Status:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-white border border-slate-200 text-slate-700">
                {selectedEmail.status}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setConfirmOpen(false)}
              className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 border border-red-600 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {deleting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Email</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
