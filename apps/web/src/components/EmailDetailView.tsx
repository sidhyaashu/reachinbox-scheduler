'use client';

import React, { useState } from 'react';
import { useSchedulerStore } from '../lib/store';
import {
  ArrowLeft,
  Star,
  Archive,
  Trash2,
  ChevronDown,
  Paperclip,
  CheckCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useToast } from './Toast';

export function EmailDetailView() {
  const { selectedEmail, closeDetail, cancelEmail, user } = useSchedulerStore();
  const { success, error } = useToast();
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
  const [recipientName] = recipientEmail.split('@');
  const formattedRecipient = recipientName
    .split('.')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

  const subject = selectedEmail.subject || 'Oliver, hello there! | MJWYT44 BM#52W01';

  return (
    <div className="flex-1 flex flex-col bg-white overflow-y-auto">
      {/* Top Header matching Image 6 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        {/* Left: Back Arrow + Subject */}
        <div className="flex items-center gap-3 overflow-hidden">
          <button
            type="button"
            onClick={closeDetail}
            className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shrink-0"
            title="Back to email list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900 truncate tracking-tight">
            {subject}
          </h1>
        </div>

        {/* Right: Actions + User Avatar */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsStarred(!isStarred)}
            className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
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
            onClick={() => success('Archived', 'Email archived to folder')}
            className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
            title="Delete / Cancel email"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          <Avatar className="w-8 h-8">
            <AvatarImage
              src={
                user?.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
              }
              alt="User"
            />
            <AvatarFallback>OB</AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Main Email Message Body matching Image 6 */}
      <div className="max-w-4xl w-full mx-auto px-8 py-8 flex flex-col gap-6">
        {/* Sender Info Line */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Sender Initial Avatar */}
            <div className="w-10 h-10 rounded-full bg-[#00a84e] text-white font-bold flex items-center justify-center shrink-0">
              A
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-slate-900 text-sm">
                  Amanda Clark
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  &lt;sender@example.com&gt;
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                <span>to me</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-400 font-normal">
            Nov 3, 10:23 AM
          </div>
        </div>

        {/* Message Content */}
        <div className="text-sm text-slate-800 leading-relaxed space-y-4 pt-2">
          <p>Hey Oliver,</p>
          <p>You&apos;ve just RECEIVED something</p>

          {/* Callout Box matching Image 6 */}
          <div className="my-4 p-4 rounded-xl bg-[#fffbeb] border-l-4 border-amber-400 text-slate-800 space-y-2">
            <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
              <span>⚡</span>
              <span>Extremely Exclusive—Only 4 Spots Worldwide Per Year | $25,000 investment</span>
              <span>⚡</span>
            </div>
            <div className="text-xs text-slate-700 flex items-center gap-1.5">
              <span>⚡</span>
              <span>
                To explore securing your private transformation, simply reply right now with{' '}
                <strong className="text-slate-900 font-bold">&quot;FLY OUT FIX&quot;</strong> .
              </span>
            </div>
          </div>

          <p>Your coach for world-class performance,</p>
          <p className="font-medium text-slate-900">Grant</p>
          <p className="italic text-slate-500 text-xs pt-1">
            P.S. Always remember that you can develop world class technique! 🚀
          </p>

          {/* If there was custom body in database, render preview if different */}
          {selectedEmail.body && !selectedEmail.body.includes('FLY OUT FIX') && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Scheduled Body Content:
              </span>
              <div
                className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-100"
                dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
              />
            </div>
          )}
        </div>

        {/* Attachments Section matching Image 6 */}
        <div className="pt-6 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">
            Attachments (2)
          </span>

          <div className="flex flex-wrap items-center gap-4">
            {/* Attachment 1 */}
            <div className="w-52 rounded-2xl overflow-hidden border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
              <div className="h-28 w-full overflow-hidden bg-slate-100 relative">
                {/* Tennis player photo thumbnail matching screenshot */}
                <img
                  src="https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=400&auto=format&fit=crop&q=80"
                  alt="Tennis Coach Profile"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="p-3">
                <p className="text-xs font-bold text-slate-900 truncate">
                  Tennis_Coach_Profile.png
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">1.2 MB</p>
              </div>
            </div>

            {/* Attachment 2 */}
            <div className="w-52 rounded-2xl overflow-hidden border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
              <div className="h-28 w-full overflow-hidden bg-slate-100 relative">
                <img
                  src="https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=400&auto=format&fit=crop&q=80"
                  alt="Tennis Coach Profile 2"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="p-3">
                <p className="text-xs font-bold text-slate-900 truncate">
                  Tennis_Coach_Profile2.png
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">1.2 MB</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ethereal preview link if sent */}
        {selectedEmail.etherealMessageUrl && (
          <div className="mt-4 p-4 rounded-xl bg-[#e8f5e9] border border-[#c8e6c9] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-[#00873d]">
              <CheckCircle className="w-4 h-4 shrink-0 text-[#00a84e]" />
              <span>Delivered via Ethereal SMTP</span>
            </div>
            <a
              href={selectedEmail.etherealMessageUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-[#00a84e] hover:underline"
            >
              Open Ethereal Preview ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
