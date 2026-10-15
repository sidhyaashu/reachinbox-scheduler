'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSchedulerStore } from '../lib/store';
import { EmailRecord } from '../lib/api-client';
import { Skeleton } from './ui/skeleton';
import { formatFigmaScheduleTime } from '../lib/utils';
import {
  Clock,
  Star,
  Mail,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArchiveRestore,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { useToast } from './Toast';

export function EmailList() {
  const router = useRouter();
  const { success, error } = useToast();
  const [emailToDelete, setEmailToDelete] = useState<EmailRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    activeTab,
    scheduledEmails,
    sentEmails,
    searchResults,
    isLoading,
    filterStatus,
    setFilterStatus,
    selectEmail,
    openCompose,
    starredEmailIds,
    toggleStar,
    archivedEmailIds,
    unarchiveEmail,
    cancelEmail,
  } = useSchedulerStore();

  const handleStarClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toggleStar(id);
  };

  const handleDeleteClick = (e: React.MouseEvent, email: EmailRecord) => {
    e.stopPropagation();
    setEmailToDelete(email);
  };

  const handleConfirmDelete = async () => {
    if (!emailToDelete) return;
    setIsDeleting(true);
    try {
      await cancelEmail(emailToDelete.id);
      success('Email Deleted', `Email to ${emailToDelete.recipient} was cancelled and removed`);
      setEmailToDelete(null);
    } catch (err: any) {
      error('Deletion Failed', err.message || 'Could not delete email');
    } finally {
      setIsDeleting(false);
    }
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
  let rawList: EmailRecord[] = [];
  if (activeTab === 'archive') {
    rawList = [...scheduledEmails, ...sentEmails].filter((e) => archivedEmailIds.includes(e.id));
  } else if (activeTab === 'scheduled') {
    rawList = scheduledEmails.filter((e) => !archivedEmailIds.includes(e.id));
  } else {
    rawList = sentEmails.filter((e) => !archivedEmailIds.includes(e.id));
  }

  if (filterStatus === 'SENT') {
    rawList = sentEmails.filter((e) => !archivedEmailIds.includes(e.id));
  } else if (filterStatus === 'SCHEDULED' || filterStatus === 'PROCESSING') {
    rawList = scheduledEmails.filter((e) => !archivedEmailIds.includes(e.id));
  } else if (filterStatus === 'FAILED') {
    rawList = [...scheduledEmails, ...sentEmails].filter((e) => !archivedEmailIds.includes(e.id));
  }

  const baseList = searchResults !== null ? searchResults : rawList;

  const filteredList =
    filterStatus === 'ALL'
      ? baseList
      : baseList.filter((e) => {
          if (filterStatus === 'SCHEDULED') {
            return e.status === 'SCHEDULED' || e.status === 'QUEUED' || e.status === 'DEFERRED';
          }
          if (filterStatus === 'SENT') return e.status === 'SENT';
          if (filterStatus === 'PROCESSING') return e.status === 'PROCESSING';
          if (filterStatus === 'FAILED') return e.status === 'FAILED';
          return true;
        });

  const emails = filteredList;

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
    const hasActiveFilter = filterStatus !== 'ALL';
    const isSearchActive = searchResults !== null;

    return (
      <div className="w-full flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4">
        <div className="w-12 h-12 rounded-2xl bg-[#e8f5e9] flex items-center justify-center text-[#00a84e] mb-3">
          <Mail className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">
          {isSearchActive
            ? 'No matching emails found'
            : hasActiveFilter
            ? `No emails found with status "${filterStatus.charAt(0) + filterStatus.slice(1).toLowerCase()}"`
            : `No ${activeTab === 'scheduled' ? 'scheduled' : 'sent'} emails found`}
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
          {isSearchActive
            ? 'Try searching with another keyword or clear the search query.'
            : hasActiveFilter
            ? 'Try selecting "All Statuses" or clear the filter to see all emails.'
            : activeTab === 'scheduled'
            ? 'Compose a new outreach email or upload leads to populate the queue.'
            : 'Sent campaign deliveries and live Ethereal preview links will appear here.'}
        </p>

        <div className="flex items-center gap-2.5">
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setFilterStatus('ALL');
                router.push(`/dashboard?tab=${activeTab}`);
              }}
              className="text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-full transition-colors cursor-pointer"
            >
              Clear Filter
            </button>
          )}

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
      </div>
    );
  }

  return (
    <div className="w-full divide-y divide-slate-100">
      {emails.map((email) => {
        const isStarred = starredEmailIds.includes(email.id);
        const recipientName = getRecipientDisplayName(email);
        const isDeferred = email.status === 'DEFERRED';
        const isScheduled = email.status === 'SCHEDULED' || email.status === 'QUEUED';
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
          if (isDeferred) {
            return (
              <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Rate Limited</span>
              </span>
            );
          }
          if (isScheduled || activeTab === 'scheduled') {
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
                {activeTab === 'archive' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      unarchiveEmail(email.id);
                    }}
                    className="p-1 text-slate-400 hover:text-[#00a84e] transition-colors cursor-pointer shrink-0"
                    title="Restore to inbox"
                  >
                    <ArchiveRestore className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => handleStarClick(e, email.id)}
                  className="p-1 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer shrink-0"
                  title={isStarred ? 'Unstar email' : 'Star email'}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteClick(e, email)}
                  className="p-1 text-slate-300 hover:text-red-500 transition-colors cursor-pointer shrink-0"
                  title="Delete email"
                >
                  <Trash2 className="w-3.5 h-3.5" />
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

            {/* Desktop Actions */}
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              {activeTab === 'archive' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    unarchiveEmail(email.id);
                  }}
                  className="p-1 text-slate-400 hover:text-[#00a84e] transition-colors cursor-pointer"
                  title="Restore to inbox"
                >
                  <ArchiveRestore className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => handleStarClick(e, email.id)}
                className="p-1 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
                title={isStarred ? 'Unstar email' : 'Star email'}
              >
                <Star
                  className={`w-4 h-4 ${
                    isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={(e) => handleDeleteClick(e, email)}
                className="p-1 text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                title="Delete email"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}

      {/* Shadcn Confirmation Dialog for Deletion */}
      <Dialog
        open={!!emailToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setEmailToDelete(null);
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
              <strong className="text-slate-900 font-semibold">{emailToDelete?.recipient}</strong>?
              It will be permanently removed from the scheduling queue and database.
            </DialogDescription>
          </DialogHeader>

          {emailToDelete && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 my-1 text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-slate-600">
                <span className="font-semibold text-slate-700 w-20 shrink-0">Recipient:</span>
                <span className="truncate text-slate-900 font-medium">{emailToDelete.recipient}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="font-semibold text-slate-700 w-20 shrink-0">Subject:</span>
                <span className="truncate text-slate-900 font-medium">{emailToDelete.subject || 'Outreach campaign'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="font-semibold text-slate-700 w-20 shrink-0">Status:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-white border border-slate-200 text-slate-700">
                  {emailToDelete.status}
                </span>
              </div>
              {emailToDelete.scheduledAt && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-semibold text-slate-700 w-20 shrink-0">Scheduled:</span>
                  <span className="text-slate-700">{formatFigmaScheduleTime(emailToDelete.scheduledAt)}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setEmailToDelete(null)}
              className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 border border-red-600 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {isDeleting ? (
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
