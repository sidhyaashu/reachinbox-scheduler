'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, SlackStatus } from '../lib/api';
import {
  Search,
  Sliders,
  ExternalLink,
  LogOut,
  ChevronDown,
  Mail,
  Zap,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface HeaderProps {
  user: UserProfile | null;
  slackStatus: SlackStatus | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenSlackModal: () => void;
  onLogout: () => void;
}

export function Header({
  user,
  slackStatus,
  searchQuery,
  onSearchChange,
  onOpenSlackModal,
  onLogout,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-[#090d16]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-brand-500/20 text-white font-bold">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-lg text-slate-100 tracking-tight">
              Reach<span className="text-brand-400">Inbox</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/20 font-medium">
              Scheduler
            </span>
          </div>
        </div>

        {/* Global Live Search Bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by recipient, subject, or content..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 bg-surface text-sm text-slate-200 placeholder-slate-500 rounded-lg border border-border focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Right Actions & Profile */}
        <div className="flex items-center gap-3">
          {/* Slack Integration Status Badge */}
          <button
            onClick={onOpenSlackModal}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              slackStatus?.connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-surface border-border text-slate-300 hover:border-slate-600 hover:text-white'
            }`}
            title="Slack Notification Integration"
          >
            <Zap className={`w-3.5 h-3.5 ${slackStatus?.connected ? 'text-emerald-400 fill-emerald-400/20' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">
              {slackStatus?.connected
                ? `Slack: #${slackStatus.channelName || 'alerts'}`
                : 'Connect Slack'}
            </span>
            {slackStatus?.connected ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            )}
          </button>

          {/* BullMQ Dashboard Link */}
          <a
            href="/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface border border-border text-slate-300 hover:border-brand-500/50 hover:text-white transition-all"
            title="Open Live BullMQ Board"
          >
            <Sliders className="w-3.5 h-3.5 text-brand-400" />
            <span className="hidden sm:inline">Queue Board</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>

          {/* User Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2.5 p-1 rounded-full hover:bg-surface border border-transparent hover:border-border transition-all"
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-brand-500/30"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center text-xs font-semibold ring-2 ring-brand-500/30">
                  {initials}
                </div>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 glass-dropdown rounded-xl shadow-2xl p-2 border border-border z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-border/50">
                  <p className="text-sm font-semibold text-slate-100 truncate">{user?.name || (user?.email ? user.email.split('@')[0] : 'User')}</p>
                  <p className="text-xs text-slate-400 truncate">{user?.email || ''}</p>
                </div>

                <div className="py-1">
                  <a
                    href="/admin/queues"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-surface-hover rounded-lg transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5 text-brand-400" />
                    <span>BullMQ Queue Inspector</span>
                  </a>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenSlackModal();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-surface-hover rounded-lg transition-colors text-left"
                  >
                    <Zap className="w-3.5 h-3.5 text-brand-400" />
                    <span>Manage Slack Integration</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-border/50">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
