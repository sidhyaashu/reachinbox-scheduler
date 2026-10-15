'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Zap, Shield, Database, Search, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

export default function LoginPage() {
  const router = useRouter();
  const { success, error } = useToast();
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleDemoLogin = async () => {
    setLoadingDemo(true);
    try {
      await api.loginWithDemo();
      success('Logged in as Demo User', 'Welcome to ReachInbox Scheduler');
      router.push('/dashboard');
    } catch (err: any) {
      error('Demo login failed', err.message);
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-[#090d16]">
      {/* Background ambient lighting */}
      <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] bg-brand-600/15 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-brand-500/25">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-xl text-white tracking-tight">
              Reach<span className="text-brand-400">Inbox</span>
            </span>
            <span className="text-xs text-slate-400 ml-2 px-2 py-0.5 rounded-full bg-surface border border-border">
              Outbox Labs
            </span>
          </div>
        </div>

        <a
          href="/admin/queues"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-border bg-surface/50 hover:bg-surface transition-colors"
        >
          BullMQ Queue Monitor ↗
        </a>
      </header>

      {/* Main Hero & Login */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/25 text-brand-300 text-xs font-medium mb-6 animate-pulse">
          <Zap className="w-3.5 h-3.5 text-brand-400" />
          <span>Production-Grade Architecture • Zero Cron Jobs</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight max-w-3xl leading-[1.15] mb-6">
          High-Deliverability <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-brand-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            Email Scheduling Platform
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mb-10 leading-relaxed">
          Engineered for Outbox Labs. Backed by PostgreSQL Transactional Outbox, BullMQ delayed queues, Redis sliding-window hourly quotas, and Elasticsearch multi-tenant search.
        </p>

        {/* Authentication Card */}
        <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-surface-card border border-border shadow-2xl backdrop-blur-xl mb-12">
          <h2 className="text-lg font-semibold text-white mb-2">Access Outreach Dashboard</h2>
          <p className="text-xs text-slate-400 mb-6">
            Sign in with Google OAuth or launch an instant demo session to evaluate all system features.
          </p>

          <div className="space-y-3">
            {/* Google OAuth Button */}
            <a
              href="/auth/google"
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all shadow-lg hover:shadow-xl"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.645-5.2 3.645-9.15z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.73-2.1-6.67-4.93H1.28v3.15C3.3 21.36 7.35 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.33 14.27c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.28C.46 8.2 0 10.04 0 12s.46 3.8 1.28 5.42l4.05-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.3 2.64 1.28 6.58l4.05 3.15c.94-2.83 3.57-4.98 6.67-4.98z"
                />
              </svg>
              <span>Continue with Google</span>
            </a>

            {/* Quick Demo Login Button */}
            <button
              onClick={handleDemoLogin}
              disabled={loadingDemo}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-all shadow-lg shadow-brand-500/25 disabled:opacity-50"
            >
              <span>{loadingDemo ? 'Preparing Demo Session...' : 'Instant Demo Login (Evaluator)'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl w-full text-left">
          <div className="p-4 rounded-xl bg-surface/50 border border-border">
            <div className="flex items-center gap-2 text-brand-400 font-semibold text-sm mb-1.5">
              <Clock className="w-4 h-4" />
              <span>Zero-Cron BullMQ</span>
            </div>
            <p className="text-xs text-slate-400">
              Delayed Redis jobs reconciled via continuous transactional outbox polling. Survives restarts without lost jobs.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface/50 border border-border">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-1.5">
              <Shield className="w-4 h-4" />
              <span>Zero-Drop Rate Limiter</span>
            </div>
            <p className="text-xs text-slate-400">
              Redis sliding-window hourly quotas defer bursts to the next window and trigger live Slack rate-limit webhooks.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface/50 border border-border">
            <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm mb-1.5">
              <Search className="w-4 h-4" />
              <span>Elasticsearch 8</span>
            </div>
            <p className="text-xs text-slate-400">
              Tenant-scoped full-text search across subject, recipient, and body with async worker ingestion.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 border-t border-border/40 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>Outbox Labs Assignment • ReachInbox Scheduler</div>
        <div>Built with TypeScript, PostgreSQL, Redis, BullMQ, Elasticsearch & Next.js</div>
      </footer>
    </div>
  );
}
