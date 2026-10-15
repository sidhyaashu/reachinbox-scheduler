'use client';

import React from 'react';
import { Clock, Send, CheckCircle, ShieldCheck } from 'lucide-react';
import { DashboardSummary } from '../lib/api';

interface MetricsOverviewProps {
  summary: DashboardSummary | null;
  loading: boolean;
}

export function MetricsOverview({ summary, loading }: MetricsOverviewProps) {
  const metrics = summary?.metrics;
  const sender = summary?.defaultSender;

  const cards = [
    {
      title: 'Scheduled Emails',
      value: loading ? '—' : (metrics?.totalScheduled ?? 0).toLocaleString(),
      subtext: 'Awaiting send time in queue',
      icon: Clock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      borderColor: 'border-amber-400/20',
    },
    {
      title: 'Delivered (Sent)',
      value: loading ? '—' : (metrics?.totalSent ?? 0).toLocaleString(),
      subtext: 'Verified via Ethereal SMTP',
      icon: Send,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400/10',
      borderColor: 'border-emerald-400/20',
    },
    {
      title: 'Delivery Rate',
      value: loading ? '—' : `${(metrics?.deliverySuccessRate ?? 100).toFixed(1)}%`,
      subtext: `${metrics?.totalFailed ?? 0} failed / ${metrics?.totalDeferred ?? 0} deferred`,
      icon: CheckCircle,
      color: 'text-brand-400',
      bgColor: 'bg-brand-400/10',
      borderColor: 'border-brand-400/20',
    },
    {
      title: 'Rate Limit Quota',
      value: loading ? '—' : `${sender?.hourlyLimit ?? 200}/hr`,
      subtext: `Min ${sender?.minDelaySeconds ?? 2}s spacing per sender`,
      icon: ShieldCheck,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-400/10',
      borderColor: 'border-indigo-400/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className={`p-5 rounded-2xl bg-surface-card border ${c.borderColor} shadow-lg transition-all hover:translate-y-[-2px]`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 tracking-wide uppercase">
                {c.title}
              </span>
              <div className={`p-2 rounded-xl ${c.bgColor}`}>
                <Icon className={`w-4 h-4 ${c.color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight mb-1">{c.value}</div>
            <div className="text-xs text-slate-400">{c.subtext}</div>
          </div>
        );
      })}
    </div>
  );
}
