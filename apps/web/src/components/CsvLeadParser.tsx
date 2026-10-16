'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2, Sparkles } from 'lucide-react';
import { parseLeadsFromTextOrCsv } from '../lib/utils';

interface CsvLeadParserProps {
  onLeadsChange: (leads: string[]) => void;
}

export function CsvLeadParser({ onLeadsChange }: CsvLeadParserProps) {
  const [mode, setMode] = useState<'single' | 'bulk'>('bulk');
  const [singleEmail, setSingleEmail] = useState('');
  const [rawText, setRawText] = useState('');
  const [stats, setStats] = useState<{ validCount: number; invalidCount: number }>({
    validCount: 0,
    invalidCount: 0,
  });
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSingleEmailChange = (val: string) => {
    setSingleEmail(val);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(val.trim())) {
      onLeadsChange([val.trim().toLowerCase()]);
    } else {
      onLeadsChange([]);
    }
  };

  const processContent = (content: string, name?: string) => {
    setRawText(content);
    if (name) setFileName(name);
    const result = parseLeadsFromTextOrCsv(content);
    setStats({
      validCount: result.validEmails.length,
      invalidCount: result.invalidCount,
    });
    onLeadsChange(result.validEmails);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processContent(text, file.name);
    };
    reader.readAsText(file);
  };

  const loadSampleLeads = () => {
    const sampleLeads = [
      'alex.hunter@stripe.com',
      'sarah.connor@openai.com',
      'david.kim@notion.so',
      'elena.rostova@datadog.com',
      'marcus.vance@linear.app',
    ].join('\n');

    processContent(sampleLeads, 'sample_leads.csv');
  };

  const clearAll = () => {
    setRawText('');
    setFileName(null);
    setStats({ validCount: 0, invalidCount: 0 });
    setSingleEmail('');
    onLeadsChange([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Recipient Leads
        </label>
        <div className="flex items-center bg-surface p-0.5 rounded-lg border border-border text-xs">
          <button
            type="button"
            onClick={() => {
              setMode('bulk');
              processContent(rawText);
            }}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              mode === 'bulk'
                ? 'bg-brand-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bulk Leads / CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('single');
              handleSingleEmailChange(singleEmail);
            }}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              mode === 'single'
                ? 'bg-brand-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Single Lead
          </button>
        </div>
      </div>

      {mode === 'single' ? (
        <div>
          <input
            type="email"
            placeholder="e.g. founder@acme.com"
            value={singleEmail}
            onChange={(e) => handleSingleEmailChange(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-surface text-sm text-slate-100 placeholder-slate-500 rounded-xl border border-border focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* File drop zone & Actions */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-dashed border-border hover:border-brand-500/60 bg-surface/50 hover:bg-surface text-slate-300 hover:text-white transition-all text-xs font-medium"
            >
              <UploadCloud className="w-4 h-4 text-brand-400" />
              <span>{fileName ? `File: ${fileName}` : 'Upload CSV / Text File'}</span>
            </button>

            <button
              type="button"
              onClick={loadSampleLeads}
              className="flex items-center gap-1.5 py-3 px-3.5 rounded-xl border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 text-xs font-medium transition-all"
              title="Fill with 5 verified sample leads"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load Sample Leads</span>
            </button>

            {stats.validCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="p-3 rounded-xl border border-border bg-surface hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
                title="Clear leads"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Paste or Preview Textarea */}
          <div className="relative">
            <textarea
              rows={3}
              placeholder="Or paste comma-separated or newline-separated emails here..."
              value={rawText}
              onChange={(e) => processContent(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface text-xs text-slate-200 placeholder-slate-500 rounded-xl border border-border focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
            />
          </div>

          {/* Live detection counter banner */}
          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-[#0b101d] border border-border">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-3.5 h-3.5 ${stats.validCount > 0 ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="text-slate-300 font-medium">
                {stats.validCount} valid lead{stats.validCount === 1 ? '' : 's'} detected
              </span>
            </div>
            {stats.invalidCount > 0 && (
              <div className="flex items-center gap-1 text-amber-400">
                <AlertCircle className="w-3 h-3" />
                <span>{stats.invalidCount} invalid rows ignored</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
