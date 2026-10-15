'use client';

import React, { useState, useRef } from 'react';
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
  Check,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { parseLeadsFromTextOrCsv } from '../lib/utils';
import { useToast } from './Toast';

export function ComposeView() {
  const { closeCompose, scheduleCampaign, user } = useSchedulerStore();
  const { success, error } = useToast();

  const [toInput, setToInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([
    'tame@jmail.com',
    'lame@jmail.com',
    'dame@jmail.com',
    'lead4@jmail.com',
    'lead5@jmail.com',
    'lead6@jmail.com',
    'lead7@jmail.com',
  ]);
  const [subject, setSubject] = useState('Meeting follow-up - Scheduled');
  const [body, setBody] = useState(
    'Hey {{name}},\n\nJust wanted to follow up on our previous discussion regarding our scaling infrastructure.'
  );
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);

  // Send Later Popover state
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000); // 1 hour ahead
    d.setSeconds(0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const [hasAttachment, setHasAttachment] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { validEmails } = parseLeadsFromTextOrCsv(text);
      if (validEmails.length > 0) {
        setRecipients(validEmails);
        success('Leads Imported', `Loaded ${validEmails.length} recipients from ${file.name}`);
      } else {
        error('Import Error', 'No valid email addresses found in CSV');
      }
    };
    reader.readAsText(file);
  };

  const setPresetSchedule = (hoursAhead: number) => {
    const d = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
    d.setSeconds(0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    setScheduledAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  const handleAddRecipient = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = toInput.trim().replace(',', '');
      if (trimmed && trimmed.includes('@')) {
        setRecipients((prev) => [...prev, trimmed]);
        setToInput('');
      }
    }
  };

  const handleSend = async () => {
    if (recipients.length === 0) {
      error('Missing Recipient', 'Please add at least one recipient or upload a list');
      return;
    }
    if (!subject.trim()) {
      error('Missing Subject', 'Please enter an email subject');
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
      });

      success('Campaign Scheduled', `Successfully queued ${res.scheduledCount} emails into BullMQ!`);
      closeCompose();
    } catch (err: any) {
      error('Scheduling Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const visiblePills = recipients.slice(0, 3);
  const remainingCount = Math.max(0, recipients.length - 3);

  return (
    <div className="flex-1 flex flex-col bg-white overflow-y-auto">
      {/* Top Header matching Images 3, 5, 7 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={closeCompose}
            className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Back to inbox"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Compose New Email
          </h1>
        </div>

        {/* Right Action Icons & Send Later button */}
        <div className="flex items-center gap-3">
          {/* Attachment Icon */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setHasAttachment(!hasAttachment)}
              className="p-1.5 text-slate-500 hover:text-slate-800 transition-colors"
              title="Toggle attachment"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            {hasAttachment && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#00a84e] text-white text-[9px] font-bold flex items-center justify-center">
                1
              </span>
            )}
          </div>

          {/* Clock icon to open Send Later popover */}
          <Popover open={sendLaterOpen} onOpenChange={setSendLaterOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="p-1.5 text-slate-500 hover:text-[#00a84e] transition-colors"
                title="Schedule send time"
              >
                <Clock className="w-4 h-4" />
              </button>
            </PopoverTrigger>

            {/* Floating Popover matching Image 3 */}
            <PopoverContent
              align="end"
              className="w-80 p-5 rounded-2xl bg-white border border-slate-100 shadow-2xl space-y-4"
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
                    className="h-10 text-xs bg-[#f4f6f8] border-none rounded-xl pr-9 text-slate-800"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                </div>
              </div>

              {/* Quick Preset Options matching Image 3 */}
              <div className="flex flex-col gap-1 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPresetSchedule(24)}
                  className="w-full text-left py-2 px-2.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#00a84e] transition-colors"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setPresetSchedule(12)}
                  className="w-full text-left py-2 px-2.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#00a84e] transition-colors"
                >
                  Tomorrow, 10:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => setPresetSchedule(14)}
                  className="w-full text-left py-2 px-2.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#00a84e] transition-colors"
                >
                  Tomorrow, 11:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => setPresetSchedule(18)}
                  className="w-full text-left py-2 px-2.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#00a84e] transition-colors"
                >
                  Tomorrow, 3:00 PM
                </button>
              </div>

              {/* Popover Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSendLaterOpen(false)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1"
                >
                  Cancel
                </button>
                <Button
                  onClick={() => setSendLaterOpen(false)}
                  variant="greenOutline"
                  size="sm"
                  className="h-8 px-4 text-xs font-semibold"
                >
                  Done
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Green Outlined Send Later button matching Figma */}
          <Button
            onClick={handleSend}
            disabled={isSubmitting}
            variant="greenOutline"
            className="h-9 px-5 rounded-full text-xs font-bold border-2 border-[#00a84e] text-[#00a84e] hover:bg-[#e8f5e9]"
          >
            {isSubmitting ? 'Scheduling...' : 'Send Later'}
          </Button>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="max-w-4xl w-full mx-auto px-6 py-6 flex flex-col gap-4">
        {/* FROM Field */}
        <div className="flex items-center gap-6 py-1">
          <span className="text-xs font-semibold text-slate-400 w-12 shrink-0">
            From
          </span>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4f6f8] text-xs font-medium text-slate-800">
            <span>{user?.email || 'oliver.brown@domain.io'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        {/* TO Field + Upload List */}
        <div className="flex items-center justify-between gap-4 py-1 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-6 flex-1 min-w-0">
            <span className="text-xs font-semibold text-slate-400 w-12 shrink-0">
              To
            </span>

            {/* Recipient Pills matching Image 7 */}
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
              {visiblePills.map((email, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#e8f5e9] text-[#00873d] border border-[#c8e6c9]"
                >
                  <span>{email}</span>
                  <X
                    className="w-3 h-3 hover:text-red-500 cursor-pointer"
                    onClick={() => setRecipients(recipients.filter((r) => r !== email))}
                  />
                </span>
              ))}

              {remainingCount > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#e8f5e9] text-[#00873d] border border-[#c8e6c9]">
                  +{remainingCount}
                </span>
              )}

              <input
                type="text"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                onKeyDown={handleAddRecipient}
                placeholder={recipients.length === 0 ? 'recipient@example.com' : 'Add more...'}
                className="text-xs bg-transparent border-none text-slate-800 placeholder:text-slate-400 focus:outline-none flex-1 min-w-[120px] py-1"
              />
            </div>
          </div>

          {/* Upload List Button matching Image 5 & 7 */}
          <div className="shrink-0">
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00a84e] hover:text-[#00873d] transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload List</span>
            </button>
          </div>
        </div>

        {/* SUBJECT Field */}
        <div className="flex items-center gap-6 py-1 border-t border-slate-100 pt-3">
          <span className="text-xs font-semibold text-slate-400 w-12 shrink-0">
            Subject
          </span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 text-xs bg-transparent border-none text-slate-800 placeholder:text-slate-400 focus:outline-none py-1"
          />
        </div>

        {/* INLINE SETTINGS: Delay between 2 emails & Hourly Limit matching Image 3 & 5 */}
        <div className="flex flex-wrap items-center gap-6 py-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500 font-medium">
              Delay between 2 emails
            </span>
            <input
              type="number"
              min={1}
              max={60}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 2)}
              className="w-14 h-8 rounded-xl bg-[#f4f6f8] text-center text-xs font-bold text-slate-800 border-none focus:outline-none focus:ring-1 focus:ring-[#00a84e]"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500 font-medium">
              Hourly Limit
            </span>
            <input
              type="number"
              min={10}
              max={1000}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 200)}
              className="w-16 h-8 rounded-xl bg-[#f4f6f8] text-center text-xs font-bold text-slate-800 border-none focus:outline-none focus:ring-1 focus:ring-[#00a84e]"
            />
          </div>
        </div>

        {/* RICH TEXT EDITOR BOX matching Image 3 & 5 */}
        <div className="rounded-2xl bg-[#f8fafc] border border-slate-200/80 p-4 space-y-3 mt-2">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-slate-200/60 text-slate-500">
            <button type="button" className="p-1 hover:text-slate-900" title="Undo">
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-slate-900" title="Redo">
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <span className="text-xs font-bold px-1 select-none text-slate-600">TT</span>
            <button type="button" className="p-1 hover:text-slate-900" title="Bold">
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-slate-900" title="Italic">
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-slate-900" title="Underline">
              <Underline className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <button type="button" className="p-1 hover:text-slate-900" title="Align Left">
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-slate-900" title="Numbered List">
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-slate-900" title="Bullet List">
              <List className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-slate-900" title="Outdent">
              <Outdent className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-slate-900" title="Indent">
              <Indent className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-slate-900" title="Quote">
              <Quote className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-slate-900" title="Strikethrough">
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Text Area */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type Your Reply..."
            rows={10}
            className="w-full bg-transparent border-none text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
          />
        </div>

        {/* Attachment Card matching Image 5 & 7 */}
        {hasAttachment && (
          <div className="pt-2">
            <div className="w-48 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm relative group">
              <div className="h-24 w-full bg-slate-100 overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=400&auto=format&fit=crop&q=80"
                  alt="Tennis Coach Profile"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setHasAttachment(false)}
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="p-2.5">
                <p className="text-[11px] font-bold text-slate-900 truncate">
                  Tennis_Coach_Profile.png
                </p>
                <p className="text-[10px] text-slate-400">1.2 MB</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
