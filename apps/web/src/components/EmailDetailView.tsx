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
  Paperclip,
  FileText,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { formatFigmaScheduleTime, formatDateTime, formatRelativeTime, parseRichEmailContent } from '../lib/utils';
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
    trashedEmailIds,
    archiveEmail,
    unarchiveEmail,
    moveToTrash,
    restoreFromTrash,
    permanentDeleteEmail,
  } = useSchedulerStore();
  const { success, error, info } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    if (!selectedEmail?.id) return;
    navigator.clipboard.writeText(selectedEmail.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleBack = () => {
    closeDetail();
    router.replace(`/dashboard?tab=${activeTab}`, { scroll: false });
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
    const email = selectedEmail;
    setConfirmOpen(false);
    handleBack();
    try {
      if (activeTab === 'trash') {
        await permanentDeleteEmail(email.id);
        success('Email Permanently Deleted', 'Email was permanently removed');
      } else {
        await moveToTrash(email.id, email);
        success('Email Moved to Trash', 'Email was moved to Trash');
      }
    } catch (err: any) {
      error('Action failed', err.message);
    }
  };

  const recipientEmail = selectedEmail.recipient || '';
  const recipientPrefix = recipientEmail.includes('@') ? recipientEmail.split('@')[0] : recipientEmail;
  const formattedRecipient = recipientPrefix
    ? recipientPrefix
        .split(/[._-]/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ')
    : 'Recipient';

  const senderEmail = sender?.email || user?.email || '';
  const senderName = sender?.name || user?.name || (user?.email ? user.email.split('@')[0] : 'Sender');
  const senderInitial = (senderName[0] || 'S').toUpperCase();

  const isScheduled = selectedEmail.status === 'SCHEDULED' || selectedEmail.status === 'QUEUED';
  const isProcessing = selectedEmail.status === 'PROCESSING';
  const isDeferred = selectedEmail.status === 'DEFERRED';
  const isSent = selectedEmail.status === 'SENT';
  const isFailed = selectedEmail.status === 'FAILED';
  const isPending = isScheduled || isProcessing || isDeferred;

  const scheduledFormatted = selectedEmail.scheduledAt
    ? formatFigmaScheduleTime(selectedEmail.scheduledAt)
    : 'Not scheduled';

  const deliveryChannel =
    sender?.authType === 'oauth2_google'
      ? 'Google Gmail API (OAuth2)'
      : sender?.hasCustomSmtp
      ? `Custom SMTP (${sender.smtpHost})`
      : 'Ethereal Sandbox Relay';

  const interSendDelay = sender?.minDelaySeconds ?? 2;
  const hourlyQuota = sender?.hourlyLimit ?? 200;

  let turnaroundText: string | null = null;
  if (selectedEmail.sentAt && selectedEmail.scheduledAt) {
    const schedMs = new Date(selectedEmail.scheduledAt).getTime();
    const sentMs = new Date(selectedEmail.sentAt).getTime();
    const diffSec = ((sentMs - schedMs) / 1000).toFixed(1);
    turnaroundText = `${diffSec}s dispatch turnaround`;
  }

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
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {isScheduled && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold bg-[#ffedd5] text-[#c2410c] border border-[#fed7aa]">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Scheduled: {scheduledFormatted}</span>
                <span className="font-bold text-[#9a3412]">({formatRelativeTime(selectedEmail.scheduledAt)})</span>
              </span>
            )}
            {isProcessing && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Actively Sending • Worker holding inter-send delay slot</span>
              </span>
            )}
            {isDeferred && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>Rate Limited ({hourlyQuota}/hr quota reached) • Rescheduling to next window</span>
              </span>
            )}
            {isSent && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold bg-[#e8f5e9] text-[#00873d] border border-[#c8e6c9]">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Delivered via {deliveryChannel}</span>
                {turnaroundText && <span className="text-slate-400 font-normal">({turnaroundText})</span>}
              </span>
            )}
            {isFailed && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold bg-red-50 text-red-700 border border-red-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Delivery Failed: {selectedEmail.lastError || 'Permanent delivery failure'}</span>
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

        {/* Real Attachments Display */}
        {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
          <div className="pt-2 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Paperclip className="w-3.5 h-3.5 text-[#00a84e]" />
              <span>Attachments ({selectedEmail.attachments.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {selectedEmail.attachments.map((att, idx) => {
                const isImage =
                  att.contentType?.startsWith('image/') ||
                  /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.filename);
                const fileDataUrl = att.content
                  ? `data:${att.contentType || (isImage ? 'image/png' : 'application/octet-stream')};base64,${att.content}`
                  : '#';
                const formattedSize = att.size
                  ? att.size > 1024 * 1024
                    ? `${(att.size / (1024 * 1024)).toFixed(1)} MB`
                    : `${(att.size / 1024).toFixed(1)} KB`
                  : null;

                return (
                  <div
                    key={idx}
                    className="flex flex-col rounded-2xl border border-slate-200/90 overflow-hidden bg-white shadow-xs hover:shadow-md transition-shadow group"
                  >
                    {isImage && att.content ? (
                      <div className="h-32 w-full bg-slate-100 overflow-hidden relative">
                        <img
                          src={fileDataUrl}
                          alt={att.filename}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                    ) : (
                      <div className="h-24 w-full bg-slate-50 flex items-center justify-center text-slate-400">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                    <div className="p-3 flex items-center justify-between gap-2 border-t border-slate-100 bg-white">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate" title={att.filename}>
                          {att.filename}
                        </p>
                        {formattedSize && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{formattedSize}</p>
                        )}
                      </div>
                      <a
                        href={fileDataUrl}
                        download={att.filename}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#e8f5e9] text-slate-600 hover:text-[#00873d] transition-colors shrink-0 cursor-pointer"
                        title={`Download ${att.filename}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Comprehensive Delivery Pipeline & Telemetry Panel */}
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Delivery Pipeline & Queue Telemetry
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#00a84e] animate-pulse" />
              <span>Zero-Cron Outbox Architecture</span>
            </div>
          </div>

          <div className="grid grid-cols-1 2xs:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {/* Card 1: Outbox State & Lifecycle */}
            <div className="p-3.5 rounded-2xl bg-[#f8fafc] border border-slate-200/80 space-y-1">
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                Outbox State
              </span>
              <div className="flex items-center gap-1.5 pt-0.5">
                {isSent ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e8f5e9] text-[#00873d] border border-[#c8e6c9]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00a84e]" />
                    <span>SENT</span>
                  </span>
                ) : isProcessing ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                    <span>PROCESSING</span>
                  </span>
                ) : isDeferred ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>DEFERRED</span>
                  </span>
                ) : isScheduled ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ffedd5] text-[#c2410c] border border-[#fed7aa]">
                    <Clock className="w-3 h-3 text-[#ea580c]" />
                    <span>QUEUED</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                    <AlertCircle className="w-3 h-3 text-red-600" />
                    <span>FAILED</span>
                  </span>
                )}
                <span className="text-[11px] text-slate-500 font-medium truncate">
                  {selectedEmail.attempts || 0} attempt{(selectedEmail.attempts || 0) === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1">
                {isSent
                  ? 'Delivered to SMTP/API and indexed in Elasticsearch'
                  : isProcessing
                  ? 'Job claimed by worker, respecting Redis inter-send delay'
                  : isDeferred
                  ? 'Deferred due to rate limiting. Rescheduled for next hour window'
                  : isScheduled
                  ? 'Persistent in PostgreSQL outbox & delayed in BullMQ Redis'
                  : 'Delivery encountered a permanent failure'}
              </p>
            </div>

            {/* Card 2: Active Rate Limit Policy */}
            <div className="p-3.5 rounded-2xl bg-[#f8fafc] border border-slate-200/80 space-y-1">
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                Active Rate Limiter
              </span>
              <div className="space-y-0.5 pt-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Inter-Send Delay:</span>
                  <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200/60 shadow-2xs">
                    {interSendDelay} sec
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500 font-medium">Hourly Quota:</span>
                  <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200/60 shadow-2xs">
                    {hourlyQuota} / hr
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 pt-0.5">
                Atomic sliding-window enforced via Redis slot scheduling
              </p>
            </div>

            {/* Card 3: Dispatch Channel & Mailbox */}
            <div className="p-3.5 rounded-2xl bg-[#f8fafc] border border-slate-200/80 space-y-1">
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                Delivery Provider
              </span>
              <p className="font-semibold text-slate-800 text-xs truncate pt-0.5" title={deliveryChannel}>
                {deliveryChannel}
              </p>
              <p className="text-[11px] text-slate-500 truncate" title={senderEmail}>
                From: {senderEmail || 'Default Relay'}
              </p>
              {selectedEmail.etherealMessageUrl && (
                <a
                  href={selectedEmail.etherealMessageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00873d] hover:underline pt-0.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>View Ethereal Preview</span>
                </a>
              )}
            </div>

            {/* Card 4: Execution Timing & Latency */}
            <div className="p-3.5 rounded-2xl bg-[#f8fafc] border border-slate-200/80 space-y-1 md:col-span-2">
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                Execution Timeline
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-0.5">
                <div>
                  <span className="text-slate-400 block text-[10px]">Target Scheduled Time:</span>
                  <span className="text-slate-800 font-semibold block">{formatDateTime(selectedEmail.scheduledAt)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Actual Delivered Time:</span>
                  <span className="text-slate-800 font-semibold block">
                    {selectedEmail.sentAt ? (
                      formatDateTime(selectedEmail.sentAt)
                    ) : isPending ? (
                      <span className="text-[#c2410c] font-bold">Pending ({formatRelativeTime(selectedEmail.scheduledAt)})</span>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              </div>
              {turnaroundText && (
                <p className="text-[10px] font-semibold text-[#00873d] pt-1">
                  ✓ Dispatch precision: {turnaroundText}
                </p>
              )}
            </div>

            {/* Card 5: Email UUID */}
            <div className="p-3.5 rounded-2xl bg-[#f8fafc] border border-slate-200/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                  Email ID (UUID)
                </span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#00873d] hover:text-[#005f2b] cursor-pointer"
                >
                  {copiedId ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="font-mono text-slate-700 text-[11px] truncate pt-1 select-all" title={selectedEmail.id}>
                {selectedEmail.id}
              </p>
              <p className="text-[10px] text-slate-400 pt-0.5">
                Persisted in PostgreSQL `emails` table
              </p>
            </div>
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
                <DialogTitle>
                  {activeTab === 'trash' ? 'Permanently Delete Email' : 'Move Email to Trash'}
                </DialogTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeTab === 'trash'
                    ? 'This action cannot be undone'
                    : 'You can restore this email anytime from Trash'}
                </p>
              </div>
            </div>
            <DialogDescription className="text-slate-600 pt-2 text-xs sm:text-sm">
              {activeTab === 'trash' ? (
                <>
                  Are you sure you want to permanently delete the email to{' '}
                  <strong className="text-slate-900 font-semibold">{selectedEmail.recipient}</strong>?
                  It will be completely removed from the database.
                </>
              ) : (
                <>
                  Move outreach email to{' '}
                  <strong className="text-slate-900 font-semibold">{selectedEmail.recipient}</strong> to Trash?
                  Any pending scheduled dispatch will be paused.
                </>
              )}
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
              <Trash2 className="w-4 h-4" />
              <span>{activeTab === 'trash' ? 'Delete Permanently' : 'Move to Trash'}</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
