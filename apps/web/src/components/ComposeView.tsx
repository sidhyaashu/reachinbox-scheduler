'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSchedulerStore } from '../lib/store';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  ChevronDown,
  Upload,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  List,
  ListOrdered,
  Outdent,
  Indent,
  Quote,
  Strikethrough,
  Calendar,
  X,
  FileText,
  Check,
  CheckCircle2,
  Info,
  Users,
  Mail,
  Layers,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { parseLeadsFromTextOrCsv, parseRichEmailContent } from '../lib/utils';
import { useToast } from './Toast';

interface AttachmentFile {
  name: string;
  sizeText: string;
  previewUrl?: string | null;
}

export function ComposeView() {
  const router = useRouter();
  const {
    closeCompose,
    scheduleCampaign,
    user,
    sender,
    composeDraft,
    setComposeDraft,
    clearComposeDraft,
    activeTab,
    setActiveTab,
  } = useSchedulerStore();
  const { success, error } = useToast();

  const rawSenderName = sender?.name || user?.name || '';
  const cleanSenderName = rawSenderName ? rawSenderName.replace(/\s*\((Gmail|ReachInbox Mailbox)\)$/i, '') : '';

  const [toInput, setToInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>(() => composeDraft?.recipients || []);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [subject, setSubject] = useState(() => composeDraft?.subject || '');
  const [body, setBody] = useState(() => composeDraft?.body || '');
  const [selectedSenderEmail, setSelectedSenderEmail] = useState('');

  // Initial delay & hourly limit from sender or draft or defaults
  const [delaySeconds, setDelaySeconds] = useState(() => composeDraft?.delaySeconds ?? 2);
  const [hourlyLimit, setHourlyLimit] = useState(() => composeDraft?.hourlyLimit ?? 200);

  // Sync sender info once loaded
  useEffect(() => {
    if (sender) {
      setSelectedSenderEmail(sender.email);
      if (sender.minDelaySeconds && !composeDraft) setDelaySeconds(sender.minDelaySeconds);
      if (sender.hourlyLimit && !composeDraft) setHourlyLimit(sender.hourlyLimit);
    } else if (user?.email) {
      setSelectedSenderEmail(user.email);
    } else {
      setSelectedSenderEmail('outreach@reachinbox.ai');
    }
  }, [sender, user, composeDraft]);

  // Send Later Popover state
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => {
    if (composeDraft?.scheduledAt) return composeDraft.scheduledAt;
    const d = new Date(Date.now() + 60 * 60 * 1000); // 1 hour ahead
    d.setSeconds(0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  // Keep draft in sync with changes
  useEffect(() => {
    setComposeDraft({
      recipients,
      subject,
      body,
      delaySeconds,
      hourlyLimit,
      scheduledAt,
    });
  }, [recipients, subject, body, delaySeconds, hourlyLimit, scheduledAt, setComposeDraft]);

  const handleBack = () => {
    setComposeDraft({
      recipients,
      subject,
      body,
      delaySeconds,
      hourlyLimit,
      scheduledAt,
    });
    closeCompose();
    window.history.pushState(null, '', `/dashboard?tab=${activeTab}`);
  };

  // Keyboard shortcut: Escape to close Send Later popover or return to email list
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (sendLaterOpen) {
          setSendLaterOpen(false);
        } else {
          handleBack();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sendLaterOpen, recipients, subject, body, delaySeconds, hourlyLimit, scheduledAt, activeTab]);

  // Real attachments state
  const [attachment, setAttachment] = useState<AttachmentFile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Initialize contentEditable with draft/body on mount
  useEffect(() => {
    if (editorRef.current && body) {
      editorRef.current.innerHTML = parseRichEmailContent(body);
    }
  }, []);

  const handleEditorInput = () => {
    if (editorRef.current) {
      setBody(editorRef.current.innerHTML);
    }
  };

  const executeCommand = (cmd: string, arg: string | undefined = undefined) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand(cmd, false, arg);
      setBody(editorRef.current.innerHTML);
    }
  };

  const insertTag = (tag: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertText', false, tag);
      setBody(editorRef.current.innerHTML);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict file extension validation (.csv or .txt)
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.csv' && ext !== '.txt') {
      error('Invalid File Type', 'Only .csv and .txt files are supported.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { validEmails } = parseLeadsFromTextOrCsv(text);
      if (validEmails.length > 0) {
        // Deduplicate with existing
        const merged = Array.from(new Set([...recipients, ...validEmails]));
        setRecipients(merged);
        success('Leads Imported', `Loaded ${validEmails.length} recipients from ${file.name}`);
      } else {
        error('Import Error', 'No valid email addresses found in the uploaded file');
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeInKb = (file.size / 1024).toFixed(1);
    const sizeText = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${sizeInKb} KB`;

    let previewUrl: string | null = null;
    if (file.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(file);
    }

    setAttachment({
      name: file.name,
      sizeText,
      previewUrl,
    });

    success('File Attached', `${file.name} attached`);
    e.target.value = '';
  };

  const setPresetSchedule = (hoursAhead: number, targetHour?: number) => {
    const d = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
    if (typeof targetHour === 'number') {
      d.setHours(targetHour, 0, 0, 0);
    } else {
      d.setSeconds(0, 0);
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    setScheduledAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  const handleAddRecipient = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = toInput.trim().replace(',', '');
      if (trimmed && trimmed.includes('@')) {
        if (!recipients.includes(trimmed)) {
          setRecipients((prev) => [...prev, trimmed]);
        }
        setToInput('');
      }
    }
  };

  const handleBlurRecipient = () => {
    const trimmed = toInput.trim().replace(',', '');
    if (trimmed && trimmed.includes('@')) {
      if (!recipients.includes(trimmed)) {
        setRecipients((prev) => [...prev, trimmed]);
      }
      setToInput('');
    }
  };

  const handleSend = async () => {
    if (recipients.length === 0) {
      error('Missing Recipient', 'Please add at least one recipient email or upload a CSV lead list');
      return;
    }
    if (!subject.trim()) {
      error('Missing Subject', 'Please enter a subject line for your outreach');
      return;
    }
    if (!body.trim()) {
      error('Empty Email', 'Please write a message body');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await scheduleCampaign({
        recipients,
        subject,
        body,
        scheduledAt: new Date(scheduledAt).toISOString(),
        delaySecondsBetweenSends: delaySeconds,
        hourlyLimit,
        senderId: sender?.id,
      });

      success('Outreach Scheduled', `Successfully queued ${res.scheduledCount} emails into BullMQ!`);
      clearComposeDraft();
      closeCompose();
      window.history.pushState(null, '', '/dashboard?tab=scheduled');
    } catch (err: any) {
      error('Scheduling Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const visiblePills = showAllRecipients ? recipients : recipients.slice(0, 3);
  const remainingCount = Math.max(0, recipients.length - 3);
  const overflowRecipients = recipients.slice(3);
  const previewRecipients = overflowRecipients.slice(0, 20);
  const hasMoreThan20 = overflowRecipients.length > 20;
  const excessCount = overflowRecipients.length - 20;

  // Available sender accounts (prioritizes logged-in user & database sender)
  const senderOptions = Array.from(
    new Set([
      selectedSenderEmail,
      sender?.email,
      user?.email,
      !sender?.email && !user?.email ? 'outreach@reachinbox.ai' : null,
    ].filter(Boolean) as string[])
  );

  return (
    <div className="flex-1 flex flex-col bg-white overflow-y-auto">
      {/* Top Header - Responsive across 7 breakpoints */}
      <div className="flex items-center justify-between px-3 2xs:px-4 xs:px-5 sm:px-6 md:px-8 py-3.5 border-b border-slate-100 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2.5 2xs:gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Back to email list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm 2xs:text-base font-bold text-slate-900 tracking-tight">
            Compose New Email
          </h1>
        </div>

        {/* Right Action Icons & Send Later button */}
        <div className="flex items-center gap-2 2xs:gap-3">
          {/* Discard Draft button if any content exists */}
          {composeDraft && (composeDraft.recipients.length > 0 || composeDraft.subject || composeDraft.body) && (
            <button
              type="button"
              onClick={() => {
                clearComposeDraft();
                setRecipients([]);
                setSubject('');
                setBody('');
                if (editorRef.current) editorRef.current.innerHTML = '';
                success('Draft Cleared', 'Draft has been discarded');
                closeCompose();
                window.history.pushState(null, '', `/dashboard?tab=${activeTab}`);
              }}
              className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors px-2.5 py-1 rounded-lg hover:bg-red-50 cursor-pointer"
              title="Discard draft"
            >
              Discard
            </button>
          )}

          {/* Clock icon for schedule modal */}
          <Popover open={sendLaterOpen} onOpenChange={setSendLaterOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="p-1.5 text-slate-500 hover:text-[#00a84e] transition-colors cursor-pointer"
                title="Schedule send time"
              >
                <Clock className="w-4 h-4" />
              </button>
            </PopoverTrigger>

            {/* Floating Popover */}
            <PopoverContent
              align="end"
              className="w-72 2xs:w-80 p-4 2xs:p-5 rounded-2xl bg-white border border-slate-100 shadow-2xl space-y-4 z-50"
            >
              <h3 className="font-bold text-sm text-slate-900">Send Later</h3>

              {/* Date & Time Picker */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Pick date &amp; time
                </label>
                <div className="relative flex items-center">
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="h-10 text-xs bg-[#f4f6f8] border-none rounded-xl pr-9 text-slate-800 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                </div>
              </div>

              {/* Quick Preset Options */}
              <div className="flex flex-col gap-1 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPresetSchedule(0.2)}
                  className="w-full text-left py-2 px-2.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#00a84e] transition-colors cursor-pointer"
                >
                  In 10 Minutes
                </button>
                <button
                  type="button"
                  onClick={() => setPresetSchedule(24, 9)}
                  className="w-full text-left py-2 px-2.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#00a84e] transition-colors cursor-pointer"
                >
                  Tomorrow, 9:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => setPresetSchedule(24, 14)}
                  className="w-full text-left py-2 px-2.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#00a84e] transition-colors cursor-pointer"
                >
                  Tomorrow, 2:00 PM
                </button>
              </div>

              {/* Popover Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSendLaterOpen(false)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 cursor-pointer"
                >
                  Cancel
                </button>
                <Button
                  onClick={() => setSendLaterOpen(false)}
                  variant="greenOutline"
                  size="sm"
                  className="h-8 px-4 text-xs font-semibold cursor-pointer"
                >
                  Done
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Green Outlined Send Later button */}
          <Button
            onClick={handleSend}
            disabled={isSubmitting}
            variant="greenOutline"
            className="h-9 px-4 2xs:px-5 rounded-full text-xs font-bold border-2 border-[#00a84e] text-[#00a84e] hover:bg-[#e8f5e9] cursor-pointer disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? 'Scheduling...' : 'Send Later'}
          </Button>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="max-w-4xl w-full mx-auto px-3 2xs:px-4 xs:px-6 sm:px-8 py-5 sm:py-6 flex flex-col gap-4">
        {/* FROM Field */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 py-1">
          <div className="flex items-center gap-1.5 w-16 shrink-0 select-none">
            <span className="text-xs font-semibold text-slate-400">
              From
            </span>
            <TooltipProvider>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button type="button" className="text-slate-400 hover:text-slate-600 transition-colors cursor-help" aria-label="From details">
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px] p-2.5 max-w-[240px]">
                  <p className="font-semibold text-white mb-0.5">Sender Mailbox</p>
                  <p>{sender?.authType === 'oauth2_google' ? 'Connected directly via Google Gmail OAuth2. Emails are delivered from your personal Gmail without passwords.' : 'The authenticated account used to dispatch this campaign.'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4f6f8] hover:bg-slate-100 border border-transparent hover:border-slate-200 text-xs font-medium text-slate-800 cursor-pointer transition-colors max-w-sm">
                  {sender?.authType === 'oauth2_google' && (
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.645-5.2 3.645-9.15z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.73-2.1-6.67-4.93H1.28v3.15C3.3 21.36 7.35 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.33 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.57H1.28C.46 8.2 0 10.04 0 12s.46 3.8 1.28 5.43l4.05-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.3 2.64 1.28 6.57l4.05 3.15c.94-2.83 3.57-4.97 6.67-4.97z"/>
                    </svg>
                  )}
                  <div className="flex items-center gap-1.5 truncate">
                    {cleanSenderName ? (
                      <>
                        <span className="font-semibold text-slate-900 truncate">{cleanSenderName}</span>
                        <span className="text-slate-500 font-normal truncate">&lt;{selectedSenderEmail || 'outreach@reachinbox.ai'}&gt;</span>
                      </>
                    ) : (
                      <span className="truncate">{selectedSenderEmail || 'outreach@reachinbox.ai'}</span>
                    )}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5 cursor-pointer" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72 bg-white border border-slate-100 shadow-xl">
                {senderOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt}
                    onClick={() => setSelectedSenderEmail(opt)}
                    className="flex items-center justify-between text-xs cursor-pointer py-2"
                  >
                    <div className="flex flex-col truncate pr-2">
                      {cleanSenderName && (opt === selectedSenderEmail || opt === sender?.email) ? (
                        <>
                          <span className="font-semibold text-slate-900 truncate">{cleanSenderName}</span>
                          <span className="text-[11px] text-slate-400 truncate">{opt}</span>
                        </>
                      ) : (
                        <span className="truncate">{opt}</span>
                      )}
                    </div>
                    {selectedSenderEmail === opt && <Check className="w-3.5 h-3.5 text-[#00a84e] shrink-0" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                <DropdownMenuItem
                  onClick={() => {
                    closeCompose();
                    setActiveTab('integrations');
                    window.history.pushState(null, '', '/dashboard?tab=integrations');
                  }}
                  className="flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer py-2"
                >
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Configure SaaS Integrations</span>
                </DropdownMenuItem>
                {sender?.authType !== 'oauth2_google' && (
                  <DropdownMenuItem
                    onClick={() => {
                      window.location.href = `/auth/google?returnTo=${encodeURIComponent('/dashboard?compose=true')}`;
                    }}
                    className="flex items-center gap-2 text-xs font-semibold text-[#00873d] hover:bg-emerald-50 cursor-pointer py-2"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.645-5.2 3.645-9.15z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.73-2.1-6.67-4.93H1.28v3.15C3.3 21.36 7.35 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.33 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.57H1.28C.46 8.2 0 10.04 0 12s.46 3.8 1.28 5.43l4.05-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.3 2.64 1.28 6.57l4.05 3.15c.94-2.83 3.57-4.97 6.67-4.97z"/>
                    </svg>
                    <span>+ Connect your Gmail</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {sender?.authType === 'oauth2_google' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold bg-emerald-50 text-[#00873d] border border-emerald-200/70 select-none shadow-2xs" title="Connected directly via Google Gmail OAuth2 (No password needed)">
                <CheckCircle2 className="w-3 h-3 text-[#00a84e]" />
                Gmail OAuth2
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/auth/google?returnTo=${encodeURIComponent('/dashboard?compose=true')}`;
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-white hover:bg-emerald-50 text-slate-700 hover:text-[#00873d] border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer shadow-xs"
                title="Connect your Gmail account via Google OAuth2 to send emails directly without passwords"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.645-5.2 3.645-9.15z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.73-2.1-6.67-4.93H1.28v3.15C3.3 21.36 7.35 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.33 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.57H1.28C.46 8.2 0 10.04 0 12s.46 3.8 1.28 5.43l4.05-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.3 2.64 1.28 6.57l4.05 3.15c.94-2.83 3.57-4.97 6.67-4.97z"/>
                </svg>
                <span>+ Connect your Gmail</span>
              </button>
            )}
          </div>
        </div>

        {/* TO Field + Upload List */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 py-1 border-t border-slate-100 pt-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 flex-1 min-w-0">
            <span className="text-xs font-semibold text-slate-400 w-12 shrink-0 select-none">
              To
            </span>

            {/* Recipient Pills */}
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
              {visiblePills.map((email, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 2xs:px-3 py-1 rounded-full text-xs font-medium bg-[#e8f5e9] text-[#00873d] border border-[#c8e6c9]"
                >
                  <span className="truncate max-w-[180px] 2xs:max-w-xs">{email}</span>
                  <X
                    className="w-3 h-3 hover:text-red-500 cursor-pointer shrink-0 ml-0.5"
                    onClick={() => setRecipients(recipients.filter((r) => r !== email))}
                  />
                </span>
              ))}

              {remainingCount > 0 && !showAllRecipients && (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setShowAllRecipients(true)}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#e8f5e9] text-[#00873d] border border-[#c8e6c9] hover:bg-[#d5ebd7] cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95"
                      >
                        +{remainingCount}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      align="start"
                      sideOffset={8}
                      className="bg-white text-slate-900 border border-slate-200/90 shadow-2xl rounded-2xl p-4 max-w-sm sm:max-w-md w-80 sm:w-96 text-left z-50 pointer-events-auto"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#e8f5e9] flex items-center justify-center text-[#00a84e] shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <span>Additional Recipients</span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e8f5e9] text-[#00873d]">
                                +{remainingCount}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Total {recipients.length} recipients in outreach campaign
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                          {hasMoreThan20 ? `Showing 20 of ${remainingCount}` : `All ${remainingCount} listed`}
                        </span>
                      </div>

                      {/* Dynamic Recipient List (up to 20, then ... and +X more) */}
                      <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
                        {previewRecipients.map((email, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition-colors truncate max-w-[220px]"
                            title={email}
                          >
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{email}</span>
                          </span>
                        ))}
                        {hasMoreThan20 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#e8f5e9] text-[#00873d] border border-[#c8e6c9]">
                            ... and +{excessCount} more
                          </span>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Click badge to expand in editor</span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAllRecipients(true);
                          }}
                          className="text-xs font-semibold text-[#00873d] hover:underline cursor-pointer"
                        >
                          Expand All &rarr;
                        </span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {showAllRecipients && recipients.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllRecipients(false)}
                  className="text-[11px] font-semibold text-[#00873d] hover:underline px-2 cursor-pointer"
                >
                  Show less
                </button>
              )}

              <input
                type="text"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                onKeyDown={handleAddRecipient}
                onBlur={handleBlurRecipient}
                placeholder={recipients.length === 0 ? 'Enter email (e.g. lead@example.com)' : 'Add more...'}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                className="text-xs bg-transparent border-none text-slate-800 placeholder:text-slate-400 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 shadow-none flex-1 min-w-[160px] py-1 cursor-text selection:bg-[#00a84e] selection:text-white"
              />
            </div>
          </div>

          {/* Upload List Button */}
          <div className="shrink-0 self-end sm:self-auto flex items-center gap-1.5">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00a84e] hover:text-[#00873d] transition-colors cursor-pointer bg-[#e8f5e9]/50 hover:bg-[#e8f5e9] px-3 py-1.5 rounded-lg"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>+ Upload List (CSV)</span>
            </button>
            <TooltipProvider>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-help"
                    aria-label="Upload constraints and matching rules"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px] p-3 max-w-[270px] space-y-1.5 shadow-xl">
                  <p className="font-bold text-white text-xs">Upload Constraints & Rules</p>
                  <p className="text-slate-200">• <strong className="text-white">Formats:</strong> .CSV or .TXT files</p>
                  <p className="text-slate-200">• <strong className="text-white">Providers:</strong> Any domain (Gmail, Outlook, Yahoo, custom corporate domains like @company.com)</p>
                  <p className="text-slate-200">• <strong className="text-white">Delimiters:</strong> Commas, tabs, semicolons, or newlines</p>
                  <p className="text-slate-200">• <strong className="text-white">Smart Match:</strong> Auto-skips header rows (email, leads, name) & automatically deduplicates</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* SUBJECT Field */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 py-1 border-t border-slate-100 pt-3">
          <span className="text-xs font-semibold text-slate-400 w-12 shrink-0 select-none">
            Subject
          </span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 text-xs bg-transparent border-none text-slate-800 placeholder:text-slate-400 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 shadow-none py-1 cursor-text selection:bg-[#00a84e] selection:text-white"
          />
        </div>

        {/* INLINE SETTINGS: Delay between 2 emails & Hourly Limit */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 py-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              Delay between 2 emails
            </span>
            <TooltipProvider>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button type="button" className="text-slate-400 hover:text-slate-600 transition-colors cursor-help" aria-label="Delay details">
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px] p-2.5 max-w-[230px]">
                  <p className="font-semibold text-white mb-0.5">Inter-Send Delay (seconds)</p>
                  <p>Mandatory pause between consecutive email sends. Prevents spam filters and protects domain reputation.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <input
              type="number"
              min={0}
              max={3600}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-14 h-8 rounded-xl bg-[#f4f6f8] text-center text-xs font-bold text-slate-800 border-none outline-none focus:outline-none focus:ring-1 focus:ring-[#00a84e] cursor-text"
            />
            <span className="text-xs text-slate-400">sec</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              Hourly Limit
            </span>
            <TooltipProvider>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button type="button" className="text-slate-400 hover:text-slate-600 transition-colors cursor-help" aria-label="Hourly limit details">
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px] p-2.5 max-w-[230px]">
                  <p className="font-semibold text-white mb-0.5">Hourly Rate Limit</p>
                  <p>Maximum emails sent per hour. When exceeded, extra emails are safely deferred to the next hour and trigger a Slack alert.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <input
              type="number"
              min={1}
              max={5000}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Math.max(1, parseInt(e.target.value, 10) || 200))}
              className="w-16 h-8 rounded-xl bg-[#f4f6f8] text-center text-xs font-bold text-slate-800 border-none outline-none focus:outline-none focus:ring-1 focus:ring-[#00a84e] cursor-text"
            />
          </div>
        </div>

        {/* RICH TEXT EDITOR BOX */}
        <div className="rounded-2xl bg-[#f8fafc] border border-slate-200/80 p-3 2xs:p-4 space-y-3 mt-1 focus-within:border-[#00a84e] focus-within:ring-2 focus-within:ring-[#00a84e]/15 transition-all">
          {/* Real Attachment Input (Hidden) */}
          <input
            type="file"
            ref={attachmentInputRef}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.csv,.txt"
            onChange={handleAttachmentUpload}
          />

          {/* Formatting Toolbar (Includes Paperclip Attachment like Gmail) */}
          <div className="flex flex-wrap items-center gap-1 pb-3 border-b border-slate-200/60 text-slate-500">
            <button
              type="button"
              onClick={() => executeCommand('undo')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors"
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('redo')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors"
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <button
              type="button"
              onClick={() => executeCommand('bold')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors font-bold"
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('italic')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors italic"
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('underline')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors underline"
              title="Underline"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('strikeThrough')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors"
              title="Strikethrough"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <button
              type="button"
              onClick={() => executeCommand('insertUnorderedList')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors"
              title="Bullet List"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('insertOrderedList')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors"
              title="Numbered List"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('formatBlock', 'blockquote')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors"
              title="Quote"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            {/* Attachment Button positioned in toolbar like Gmail */}
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors relative"
              title="Attach a file"
            >
              <Paperclip className="w-3.5 h-3.5" />
              {attachment && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#00a84e] text-white text-[8px] font-bold flex items-center justify-center pointer-events-none">
                  1
                </span>
              )}
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <button
              type="button"
              onClick={() => insertTag('{{name}}')}
              className="px-2 py-1 rounded text-[11px] font-semibold bg-[#e8f5e9] text-[#00873d] hover:bg-[#d2ecd5] cursor-pointer transition-colors"
              title="Insert Lead Name placeholder"
            >
              + {'{{name}}'}
            </button>
          </div>

          {/* Real Rich Text Editor (contentEditable) */}
          <div
            ref={editorRef}
            contentEditable
            onInput={handleEditorInput}
            spellCheck={false}
            data-placeholder="Type your message here... Use {{name}} to personalize per lead."
            className="min-h-[180px] sm:min-h-[220px] w-full bg-transparent border-none text-xs sm:text-sm text-slate-800 outline-none focus:outline-none focus:ring-0 leading-relaxed cursor-text selection:bg-[#00a84e] selection:text-white [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-[#00a84e] [&_blockquote]:pl-3 [&_blockquote]:italic [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-slate-400 [&:empty]:before:pointer-events-none"
          />
        </div>

        {/* Real Dynamic Attachment Card */}
        {attachment && (
          <div className="pt-2">
            <div className="w-56 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm relative group">
              {attachment.previewUrl ? (
                <div className="h-24 w-full bg-slate-100 overflow-hidden relative">
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="h-20 w-full bg-slate-50 flex items-center justify-center text-slate-400 relative">
                  <FileText className="w-8 h-8 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="p-2.5">
                <p className="text-[11px] font-bold text-slate-900 truncate" title={attachment.name}>
                  {attachment.name}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{attachment.sizeText}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
