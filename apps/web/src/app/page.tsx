'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { apiClient } from '../lib/api-client';
import { useToast } from '../components/Toast';
import { Loader2, AlertCircle } from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/dashboard';
  const sessionExpired = searchParams.get('sessionExpired') === 'true';
  const oauthError = searchParams.get('error');
  const oauthErrorDesc = searchParams.get('error_description');

  const { success, error } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // If already logged in, redirect directly to dashboard or returnTo
  useEffect(() => {
    let mounted = true;
    apiClient.auth
      .getCurrentUser()
      .then((currentUser) => {
        if (mounted && currentUser) {
          router.replace(returnTo);
        } else if (mounted) {
          setCheckingAuth(false);
        }
      })
      .catch(() => {
        if (mounted) setCheckingAuth(false);
      });
    return () => {
      mounted = false;
    };
  }, [router, returnTo]);

  const deriveDisplayName = (emailStr: string): string => {
    const prefix = emailStr.split('@')[0] || 'User';
    return prefix
      .split(/[._-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const loginEmail = email.trim();
    if (!loginEmail) {
      error('Email required', 'Please enter your email address to sign in.');
      return;
    }
    setLoading(true);
    try {
      const dynamicName = deriveDisplayName(loginEmail);
      await apiClient.auth.loginDemo(loginEmail, dynamicName);
      success('Welcome back', `Signed in as ${dynamicName}`);
      router.replace(returnTo);
    } catch (err: any) {
      error('Login failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen w-full bg-[#fcfcfc] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00a84e]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#fcfcfc] flex items-center justify-center p-3 2xs:p-4 xs:p-6 sm:p-8">
      <Card className="w-full max-w-[380px] p-6 2xs:p-8 sm:p-10 rounded-2xl border border-slate-100/80 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
        <CardContent className="p-0 flex flex-col items-center">
          {oauthError && (
            <div className="w-full mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{oauthErrorDesc || 'Google sign-in could not be completed. Please try again.'}</span>
            </div>
          )}

          {sessionExpired && !oauthError && (
            <div className="w-full mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Your session expired. Please sign in again.</span>
            </div>
          )}

          {/* Title */}
          <h1 className="text-xl 2xs:text-2xl font-bold tracking-tight text-slate-900 mb-6 2xs:mb-8 select-none">
            Login
          </h1>

          {/* Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-[#e8f5e9] hover:bg-[#dcf0dd] text-slate-800 text-xs 2xs:text-sm font-medium transition-all cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                d="M5.33 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.57H1.28C.46 8.2 0 10.04 0 12s.46 3.8 1.28 5.43l4.05-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.3 2.64 1.28 6.57l4.05 3.15c.94-2.83 3.57-4.97 6.67-4.97z"
              />
            </svg>
            <span>Login with Google</span>
          </button>
          <p className="text-[10px] text-center text-slate-400 mt-1.5 select-none">
            ⚡ Links your Gmail via OAuth2 for direct passwordless sending
          </p>

          {/* Divider */}
          <div className="w-full flex items-center my-5 2xs:my-6 gap-3">
            <Separator className="flex-1 bg-slate-100" />
            <span className="text-[11px] 2xs:text-xs text-slate-400 font-normal whitespace-nowrap select-none">
              or sign in through email
            </span>
            <Separator className="flex-1 bg-slate-100" />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleLogin} className="w-full space-y-3 2xs:space-y-3.5">
            <div>
              <Input
                type="email"
                placeholder="Email ID (e.g. alex@reachinbox.ai)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 2xs:h-11 bg-[#f4f6f8] border-none text-xs 2xs:text-sm text-slate-800 placeholder:text-slate-400 rounded-xl cursor-text"
              />
            </div>

            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 2xs:h-11 bg-[#f4f6f8] border-none text-xs 2xs:text-sm text-slate-800 placeholder:text-slate-400 rounded-xl cursor-text"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 2xs:h-11 bg-[#00a84e] hover:bg-[#009444] text-white font-medium text-xs 2xs:text-sm rounded-xl transition-all shadow-none mt-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Login'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-[#fcfcfc] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00a84e]" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
