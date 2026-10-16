'use client';

import React from 'react';
import { useSchedulerStore } from '../lib/store';
import { Clock, Send, ChevronDown, ExternalLink, LogOut, X, Archive, FileText, CheckCircle2, Layers, Trash2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { apiClient } from '../lib/api-client';
import { getFallbackInitials } from '../lib/utils';


export function Sidebar() {
  const router = useRouter();
  const {
    user,
    sender,
    activeTab,
    setActiveTab,
    counts,
    openCompose,
    closeCompose,
    closeDetail,
    logout,
    mobileSidebarOpen,
    setMobileSidebarOpen,
  } = useSchedulerStore();

  // If user is not yet populated, fetch directly from OAuth profile session
  React.useEffect(() => {
    if (!user) {
      apiClient.auth.getCurrentUser().then((me) => {
        if (me) {
          useSchedulerStore.setState({ user: me });
        }
      });
    }
  }, [user]);

  // Dismiss mobile drawer on Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileSidebarOpen) {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileSidebarOpen, setMobileSidebarOpen]);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const displayName = user?.name || (user?.email ? user.email.split('@')[0] : 'Oliver Brown');
  const displayEmail = user?.email || 'oliver@reachinbox.ai';
  const initials = getFallbackInitials(user?.name, user?.email);

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full">
      {/* Top Section */}
      <div className="flex flex-col gap-6">
        {/* Brand Logo "reachinbox" + close button on mobile */}
        <div className="px-1 flex items-center justify-between">
          <div className="flex items-center gap-2 select-none group cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#00a84e] to-[#22c55e] flex items-center justify-center text-white shadow-sm shadow-[#00a84e]/20 group-hover:scale-105 transition-transform duration-200">
              <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <span className="font-brand font-extrabold text-xl tracking-tight text-slate-900">
              reach<span className="text-[#00a84e]">inbox</span>
            </span>
          </div>
          {mobileSidebarOpen && (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 md:hidden cursor-pointer"
              title="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Compose Button - Green Outline Pill */}
        <Button
          onClick={() => {
            openCompose();
            closeDetail();
            setMobileSidebarOpen(false);
            window.history.pushState(null, '', `/dashboard?tab=${activeTab}&compose=true`);
          }}
          className="w-full h-10 rounded-full border-2 border-[#00a84e] bg-white text-[#00a84e] hover:bg-[#e8f5e9] font-semibold text-sm transition-all shadow-none cursor-pointer"
        >
          Compose
        </Button>

        {/* CORE Navigation */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase px-3 mb-2 select-none">
            CORE
          </span>

          {/* Scheduled Nav Pill */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('scheduled');
              closeCompose();
              closeDetail();
              setMobileSidebarOpen(false);
              window.history.pushState(null, '', '/dashboard?tab=scheduled');
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
              activeTab === 'scheduled'
                ? 'bg-[#e8f5e9] text-[#00873d] font-semibold'
                : 'text-slate-600 hover:bg-slate-50 font-normal'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className={`w-4 h-4 ${activeTab === 'scheduled' ? 'text-[#00873d]' : 'text-slate-500'}`} />
              <span>Scheduled</span>
            </div>
            <span
              className={`text-xs ${
                activeTab === 'scheduled' ? 'text-[#00873d] font-bold' : 'text-slate-400'
              }`}
            >
              {counts.scheduled}
            </span>
          </button>

          {/* Sent Nav Pill */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('sent');
              closeCompose();
              closeDetail();
              setMobileSidebarOpen(false);
              window.history.pushState(null, '', '/dashboard?tab=sent');
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
              activeTab === 'sent'
                ? 'bg-[#e8f5e9] text-[#00873d] font-semibold'
                : 'text-slate-600 hover:bg-slate-50 font-normal'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Send className={`w-4 h-4 ${activeTab === 'sent' ? 'text-[#00873d]' : 'text-slate-500'}`} />
              <span>Sent</span>
            </div>
            <span
              className={`text-xs ${
                activeTab === 'sent' ? 'text-[#00873d] font-bold' : 'text-slate-400'
              }`}
            >
              {counts.sent}
            </span>
          </button>

          {/* Drafts Nav Pill */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('drafts');
              closeCompose();
              closeDetail();
              setMobileSidebarOpen(false);
              window.history.pushState(null, '', '/dashboard?tab=drafts');
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
              activeTab === 'drafts'
                ? 'bg-[#e8f5e9] text-[#00873d] font-semibold'
                : 'text-slate-600 hover:bg-slate-50 font-normal'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileText className={`w-4 h-4 ${activeTab === 'drafts' ? 'text-[#00873d]' : 'text-slate-500'}`} />
              <span>Drafts</span>
            </div>
            {counts.drafts > 0 && (
              <span
                className={`text-xs ${
                  activeTab === 'drafts' ? 'text-[#00873d] font-bold' : 'text-slate-400'
                }`}
              >
                {counts.drafts}
              </span>
            )}
          </button>

          {/* Archive Nav Pill */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('archive');
              closeCompose();
              closeDetail();
              setMobileSidebarOpen(false);
              window.history.pushState(null, '', '/dashboard?tab=archive');
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
              activeTab === 'archive'
                ? 'bg-[#e8f5e9] text-[#00873d] font-semibold'
                : 'text-slate-600 hover:bg-slate-50 font-normal'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Archive className={`w-4 h-4 ${activeTab === 'archive' ? 'text-[#00873d]' : 'text-slate-500'}`} />
              <span>Archive</span>
            </div>
            {counts.archive > 0 && (
              <span
                className={`text-xs ${
                  activeTab === 'archive' ? 'text-[#00873d] font-bold' : 'text-slate-400'
                }`}
              >
                {counts.archive}
              </span>
            )}
          </button>

          {/* Trash Nav Pill */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('trash');
              closeCompose();
              closeDetail();
              setMobileSidebarOpen(false);
              window.history.pushState(null, '', '/dashboard?tab=trash');
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
              activeTab === 'trash'
                ? 'bg-[#e8f5e9] text-[#00873d] font-semibold'
                : 'text-slate-600 hover:bg-slate-50 font-normal'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Trash2 className={`w-4 h-4 ${activeTab === 'trash' ? 'text-[#00873d]' : 'text-slate-500'}`} />
              <span>Trash</span>
            </div>
            {counts.trash > 0 && (
              <span
                className={`text-xs ${
                  activeTab === 'trash' ? 'text-[#00873d] font-bold' : 'text-slate-400'
                }`}
              >
                {counts.trash}
              </span>
            )}
          </button>

          {/* Integrations Nav Pill (SaaS Connections: Gmail, Slack, SMTP) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('integrations');
              closeCompose();
              closeDetail();
              setMobileSidebarOpen(false);
              window.history.pushState(null, '', '/dashboard?tab=integrations');
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
              activeTab === 'integrations'
                ? 'bg-[#e8f5e9] text-[#00873d] font-semibold'
                : 'text-slate-600 hover:bg-slate-50 font-normal'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Layers className={`w-4 h-4 ${activeTab === 'integrations' ? 'text-[#00873d]' : 'text-slate-500'}`} />
              <span>Integrations</span>
            </div>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              SaaS
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Section: Profile Card with Shadcn Dropdown Menu (Replaced BullMQ Live footer) */}
      <div className="pt-3 border-t border-slate-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div
              className="flex items-center justify-between p-2 rounded-2xl bg-[#f4f6f8]/70 hover:bg-[#f4f6f8] cursor-pointer transition-colors group border border-transparent hover:border-slate-200/60 w-full"
              title="Account settings"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <Avatar className="w-9 h-9 shrink-0 ring-1 ring-slate-200/60">
                  {user?.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="bg-[#00a84e] text-white font-bold text-xs uppercase tracking-wider">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden text-left">
                  <span className="text-xs font-bold text-slate-900 truncate leading-tight">
                    {displayName}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">
                    {displayEmail}
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0 ml-1 transition-transform duration-200 group-data-[state=open]:rotate-180 cursor-pointer" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-56 lg:w-60 bg-white border border-slate-100 shadow-xl rounded-2xl p-1.5 z-50 mb-1"
          >
            {/* Account Info Header */}
            <div className="px-2.5 py-2 flex items-center gap-2.5 border-b border-slate-100 mb-1">
              <Avatar className="w-8 h-8 shrink-0">
                {user?.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={displayName} />
                ) : null}
                <AvatarFallback className="bg-[#00a84e] text-white font-bold text-[11px] uppercase">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold text-slate-900 truncate">{displayName}</span>
                <span className="text-[10px] text-slate-400 truncate">{displayEmail}</span>
              </div>
            </div>

            {/* Gmail Connection Option */}
            {sender?.authType === 'oauth2_google' ? (
              <div className="px-2.5 py-1.5 flex items-center justify-between text-xs text-slate-600 bg-emerald-50/70 rounded-xl my-1 border border-emerald-100">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00a84e]" />
                  <span className="font-semibold text-slate-800">Gmail Connected</span>
                </div>
                <span className="text-[10px] text-emerald-700 font-bold uppercase">OAuth2</span>
              </div>
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  window.location.href = `/auth/google?returnTo=${encodeURIComponent('/dashboard')}`;
                }}
                className="gap-2 text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl py-2 px-2.5 cursor-pointer my-1"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.645-5.2 3.645-9.15z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.73-2.1-6.67-4.93H1.28v3.15C3.3 21.36 7.35 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.33 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.57H1.28C.46 8.2 0 10.04 0 12s.46 3.8 1.28 5.43l4.05-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.3 2.64 1.28 6.57l4.05 3.15c.94-2.83 3.57-4.97 6.67-4.97z"/>
                </svg>
                <span>Connect your Gmail</span>
              </DropdownMenuItem>
            )}

            {/* BullMQ Live Monitor Shortcut */}
            <DropdownMenuItem
              onClick={() => window.open('/admin/queues', '_blank')}
              className="gap-2 text-xs font-medium cursor-pointer hover:bg-slate-50 rounded-xl py-2 px-2.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <div className="flex items-center justify-between flex-1">
                <span>BullMQ Live Monitor</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a84e]" />
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-slate-100" />

            {/* Sign Out Action */}
            <DropdownMenuItem
              onClick={handleLogout}
              className="gap-2 text-xs font-medium text-red-600 focus:text-red-600 cursor-pointer hover:bg-red-50 rounded-xl py-2 px-2.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar (Visible from 'md' 768px breakpoint upwards) */}
      <aside className="hidden md:flex w-56 lg:w-64 shrink-0 bg-white border-r border-slate-100 flex-col justify-between h-screen sticky top-0 px-3 lg:px-4 py-6 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer (Below 'md' 768px breakpoint) */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setMobileSidebarOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl p-5 flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
