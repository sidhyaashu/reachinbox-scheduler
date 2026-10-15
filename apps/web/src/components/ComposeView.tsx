'use client';

import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { parseLeadsFromTextOrCsv } from '../lib/utils';
import { useToast } from './Toast';

interface AttachmentFile {
  name: string;
  sizeText: string;
  previewUrl?: string | null;
}

export function ComposeView() {
  const { closeCompose, scheduleCampaign, user, sender } = useSchedulerStore();
  const { success, error } = useToast();

  const [toInput, setToInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedSenderEmail, setSelectedSenderEmail] = useState('');

  // Initial delay & hourly limit from sender or defaults
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);

  // Sync sender info once loaded
  useEffect(() => {
    if (sender) {
      setSelectedSenderEmail(sender.email);
      if (sender.minDelaySeconds) setDelaySeconds(sender.minDelaySeconds);
      if (sender.hourlyLimit) setHourlyLimit(sender.hourlyLimit);
    } else if (user?.email) {
      setSelectedSenderEmail(user.email);
    } else {
      setSelectedSenderEmail('outreach@reachinbox.ai');
    }
  }, [sender, user]);

  // Send Later Popover state
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000); // 1 hour ahead
    d.setSeconds(0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  // Real attachments state
  const [attachment, setAttachment] = useState<AttachmentFile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  // Formatting helpers for rich text toolbar
  const insertFormatting = (prefix: string, suffix: string = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.slice(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;
    const newBody = body.slice(0, start) + replacement + body.slice(end);
    setBody(newBody);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + replacement.length - suffix.length);
    }, 0);
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
      closeCompose();
    } catch (err: any) {
      error('Scheduling Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const visiblePills = showAllRecipients ? recipients : recipients.slice(0, 3);
  const remainingCount = Math.max(0, recipients.length - 3);

  // Available sender accounts
  const senderOptions = Array.from(
    new Set([
      selectedSenderEmail,
      sender?.email,
      user?.email,
      'outreach@reachinbox.ai',
    ].filter(Boolean) as string[])
  );

  return (
    <div className="flex-1 flex flex-col bg-white overflow-y-auto">
      {/* Top Header - Responsive across 7 breakpoints */}
      <div className="flex items-center justify-between px-3 2xs:px-4 xs:px-5 sm:px-6 md:px-8 py-3.5 border-b border-slate-100 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2.5 2xs:gap-3">
          <button
            type="button"
            onClick={closeCompose}
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
          {/* Real Attachment Trigger */}
          <input
            type="file"
            ref={attachmentInputRef}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.csv,.txt"
            onChange={handleAttachmentUpload}
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              className="p-1.5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              title="Attach a file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            {attachment && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#00a84e] text-white text-[9px] font-bold flex items-center justify-center pointer-events-none">
                1
              </span>
            )}
          </div>

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
                    className="h-10 text-xs bg-[#f4f6f8] border-none rounded-xl pr-9 text-slate-800 cursor-pointer"
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
          <span className="text-xs font-semibold text-slate-400 w-12 shrink-0 select-none">
            From
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4f6f8] text-xs font-medium text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors w-fit">
                <span>{selectedSenderEmail || 'outreach@reachinbox.ai'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 bg-white border border-slate-100 shadow-xl">
              {senderOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt}
                  onClick={() => setSelectedSenderEmail(opt)}
                  className="flex items-center justify-between text-xs cursor-pointer py-2"
                >
                  <span className="truncate">{opt}</span>
                  {selectedSenderEmail === opt && <Check className="w-3.5 h-3.5 text-[#00a84e]" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
                <button
                  type="button"
                  onClick={() => setShowAllRecipients(true)}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#e8f5e9] text-[#00873d] border border-[#c8e6c9] hover:bg-[#d5ebd7] cursor-pointer"
                  title="Click to expand all recipients"
                >
                  +{remainingCount}
                </button>
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
                className="text-xs bg-transparent border-none text-slate-800 placeholder:text-slate-400 focus:outline-none flex-1 min-w-[160px] py-1 cursor-text"
              />
            </div>
          </div>

          {/* Upload List Button */}
          <div className="shrink-0 self-end sm:self-auto">
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
            className="flex-1 text-xs bg-transparent border-none text-slate-800 placeholder:text-slate-400 focus:outline-none py-1 cursor-text"
          />
        </div>

        {/* INLINE SETTINGS: Delay between 2 emails & Hourly Limit */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 py-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500 font-medium">
              Delay between 2 emails
            </span>
            <input
              type="number"
              min={0}
              max={3600}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-14 h-8 rounded-xl bg-[#f4f6f8] text-center text-xs font-bold text-slate-800 border-none focus:outline-none focus:ring-1 focus:ring-[#00a84e] cursor-text"
            />
            <span className="text-xs text-slate-400">sec</span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500 font-medium">
              Hourly Limit
            </span>
            <input
              type="number"
              min={1}
              max={5000}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Math.max(1, parseInt(e.target.value, 10) || 200))}
              className="w-16 h-8 rounded-xl bg-[#f4f6f8] text-center text-xs font-bold text-slate-800 border-none focus:outline-none focus:ring-1 focus:ring-[#00a84e] cursor-text"
            />
          </div>
        </div>

        {/* RICH TEXT EDITOR BOX */}
        <div className="rounded-2xl bg-[#f8fafc] border border-slate-200/80 p-3 2xs:p-4 space-y-3 mt-1">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-1 pb-3 border-b border-slate-200/60 text-slate-500">
            <button
              type="button"
              onClick={() => document.execCommand?.('undo')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors"
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => document.execCommand?.('redo')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors"
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <button
              type="button"
              onClick={() => insertFormatting('**', '**')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors"
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('*', '*')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors"
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('__', '__')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors"
              title="Underline"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('~~', '~~')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors"
              title="Strikethrough"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <button
              type="button"
              onClick={() => insertFormatting('\n- ')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors"
              title="Bullet List"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('\n1. ')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors"
              title="Numbered List"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('\n> ')}
              className="p-1.5 rounded hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors"
              title="Quote"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <button
              type="button"
              onClick={() => insertFormatting('{{name}}')}
              className="px-2 py-1 rounded text-[11px] font-semibold bg-[#e8f5e9] text-[#00873d] hover:bg-[#d2ecd5] cursor-pointer transition-colors"
              title="Insert Lead Name placeholder"
            >
              + {'{{name}}'}
            </button>
          </div>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message here... Use {{name}} to personalize per lead."
            rows={9}
            className="w-full bg-transparent border-none text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed cursor-text"
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
