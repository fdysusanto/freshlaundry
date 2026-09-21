'use client';

import React, { useState } from 'react';
import { authService, OAuthProvider } from '@/services/authService';
import { AlertCircle } from 'lucide-react';

interface OAuthButtonsProps {
  onOAuthStart?: (provider: OAuthProvider) => void;
  disabled?: boolean;
}

export function OAuthButtons({ onOAuthStart, disabled = false }: OAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const handleOAuthClick = async (provider: OAuthProvider) => {
    if (disabled || loadingProvider) return;
    setLoadingProvider(provider);
    setOauthError(null);

    if (onOAuthStart) {
      onOAuthStart(provider);
    }

    try {
      await authService.signInWithOAuthAsync(provider);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Gagal memulai login dengan ${provider}.`;
      setOauthError(message);
      setLoadingProvider(null);
    }
  };

  const isPending = Boolean(loadingProvider) || disabled;

  return (
    <div className="space-y-3 w-full">
      {oauthError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{oauthError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Google OAuth Button */}
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleOAuthClick('google')}
          className="w-full h-11 px-4 text-xs font-extrabold text-slate-700 bg-white border border-slate-200 rounded-xl shadow-2xs hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingProvider === 'google' ? (
            <div className="animate-spin w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full" />
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{loadingProvider === 'google' ? 'Menghubungkan...' : 'Google'}</span>
        </button>

        {/* Apple OAuth Button */}
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleOAuthClick('apple')}
          className="w-full h-11 px-4 text-xs font-extrabold text-white bg-slate-900 border border-slate-900 rounded-xl shadow-2xs hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingProvider === 'apple' ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <svg className="w-4 h-4 shrink-0 fill-current text-white" viewBox="0 0 170 170">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.34.13-9.16-1.9-14.49-6.09-3.26-2.64-7.14-7.24-11.66-13.82-7.29-10.63-13.1-22.37-17.43-35.22-4.33-12.86-6.5-25.26-6.5-37.22 0-14.86 3.84-27.1 11.51-36.72 7.68-9.63 17.27-14.54 28.78-14.73 4.58 0 9.69 1.15 15.34 3.44 5.66 2.3 9.49 3.44 11.49 3.44 1.7 0 5.69-1.2 11.97-3.6 6.28-2.4 11.46-3.52 15.54-3.35 12.07.6 22.04 5.16 29.91 13.68-10.74 6.5-16.01 15.57-15.82 27.21.19 9.17 3.73 16.92 10.62 23.25 6.89 6.33 15.11 9.94 24.66 10.83-2.4 7.15-5.6 14.56-9.6 22.23zm-27.21-105.15c0 6.64-2.47 13.06-7.41 19.26-4.94 6.2-11.02 10.02-18.24 11.47-.28-1.04-.42-2.1-.42-3.17 0-6.5 2.58-13.01 7.74-19.53 5.16-6.52 11.27-10.37 18.33-11.55.07 1.17.1 2.34.1 3.52z" />
            </svg>
          )}
          <span>{loadingProvider === 'apple' ? 'Menghubungkan...' : 'Apple ID'}</span>
        </button>
      </div>

      <div className="relative flex items-center justify-center my-4">
        <div className="border-t border-slate-200/80 w-full" />
        <span className="bg-white sm:bg-slate-50/70 px-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0">
          atau dengan email
        </span>
        <div className="border-t border-slate-200/80 w-full" />
      </div>
    </div>
  );
}
