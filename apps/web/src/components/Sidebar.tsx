'use client';

import React from 'react';
import { useSchedulerStore } from '../lib/store';
import { Clock, Send, ChevronDown, ExternalLink, LogOut } from 'lucide-react';
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

export function Sidebar() {
  const router = useRouter();
  const { user, activeTab, setActiveTab, counts, openCompose, logout } = useSchedulerStore();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-100 flex flex-col justify-between h-screen sticky top-0 px-4 py-6">
      <div className="flex flex-col gap-6">
        {/* Brand Logo "ONB" matching Figma exactly */}
        <div className="px-2 flex items-center gap-2">
          <div className="font-black text-2xl tracking-tighter text-black select-none font-mono">
            ONB
          </div>
        </div>

        {/* User Profile Card */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center justify-between p-2 rounded-2xl bg-[#f4f6f8]/70 hover:bg-[#f4f6f8] cursor-pointer transition-colors group">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarImage
                    src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                    alt={user?.name || 'Oliver Brown'}
                  />
                  <AvatarFallback>OB</AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden text-left">
                  <span className="text-xs font-bold text-slate-900 truncate leading-tight">
                    {user?.name || 'Oliver Brown'}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">
                    {user?.email || 'oliver.brown@domain.io'}
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0 ml-1" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white border border-slate-100 shadow-xl">
            <DropdownMenuItem
              onClick={() => window.open('/admin/queues', '_blank')}
              className="gap-2 text-xs font-medium cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>BullMQ Queue Monitor</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="gap-2 text-xs font-medium text-red-600 focus:text-red-600 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Compose Button - Pill Green Outline matching Figma */}
        <Button
          onClick={openCompose}
          className="w-full h-10 rounded-full border-2 border-[#00a84e] bg-white text-[#00a84e] hover:bg-[#e8f5e9] font-semibold text-sm transition-all shadow-none"
        >
          Compose
        </Button>

        {/* CORE Navigation */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase px-3 mb-2">
            CORE
          </span>

          {/* Scheduled Nav Pill */}
          <button
            type="button"
            onClick={() => setActiveTab('scheduled')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all ${
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
            onClick={() => setActiveTab('sent')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all ${
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
        </div>
      </div>

      {/* Footer System Status */}
      <div className="px-2 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#00a84e] animate-pulse" />
          <span>BullMQ Live</span>
        </span>
        <span>v1.0</span>
      </div>
    </aside>
  );
}
