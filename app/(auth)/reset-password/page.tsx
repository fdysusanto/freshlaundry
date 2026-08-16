'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Sparkles, Lock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const resolveRecoverySession = async () => {
      if (!isSupabaseConfigured || !supabase) {
        if (isMounted) {
          setHasValidSession(false);
          setIsCheckingSession(false);
        }
        return;
      }

      try {
        // 1. Check for PKCE 'code' in query parameter
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const authCode = urlParams.get('code');

          if (authCode) {
            console.log('[AUTH-RECOVERY] Exchanging PKCE auth code for session...');
            const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

            if (error) {
              console.warn('[AUTH-RECOVERY] PKCE code exchange failed:', error.message);
              if (isMounted) {
                setErrorMessage('Link reset password tidak valid atau sudah kedaluwarsa.');
                setHasValidSession(false);
                setIsCheckingSession(false);
              }
              return;
            }

            if (data?.session && isMounted) {
              console.log('[AUTH-RECOVERY] PKCE exchange successful. Session active.');
              setHasValidSession(true);
              setIsCheckingSession(false);
              return;
            }
          }
        }

        // 2. Subscribe to PASSWORD_RECOVERY & SIGNED_IN auth state events
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          console.log('[AUTH-RECOVERY] Auth state changed:', event);
          if (event === 'PASSWORD_RECOVERY' || (session && session.user)) {
            if (isMounted) {
              setHasValidSession(true);
              setIsCheckingSession(false);
            }
          }
        });

        // 3. Fallback: Verify active session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          setHasValidSession(true);
        }

        if (isMounted) {
          setIsCheckingSession(false);
        }

        return () => {
          subscription.unsubscribe();
        };
      } catch (err: any) {
        console.error('[AUTH-RECOVERY] Unexpected session verification error:', err);
        if (isMounted) {
          setErrorMessage('Gagal memverifikasi sesi recovery.');
          setHasValidSession(false);
          setIsCheckingSession(false);
        }
      }
    };

    resolveRecoverySession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 8) {
      setErrorMessage('Password minimal 8 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi password tidak cocok.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await authService.updatePasswordAsync(newPassword);

      if (typeof window !== 'undefined') {
        console.log('[AUTH-PASSWORD-UPDATE-DIAGNOSTIC]', {
          source: 'supabase_auth',
          authenticated: true,
          action: 'password_update',
        });
      }

      setSuccessMessage('Password berhasil diperbarui. Silakan login kembali.');

      // Invalidate recovery session so it cannot be re-used
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut().catch(() => {});
      }

      setTimeout(() => {
        router.push('/login');
      }, 2500);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Gagal memperbarui password. Link mungkin sudah kedaluwarsa.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
        <div className="text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Memverifikasi sesi reset password...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-gradient-to-b from-teal-50/50 via-slate-50 to-white">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-600/30 mb-2">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Buat Password Baru</h1>
          <p className="text-xs text-slate-500">Masukkan password baru Anda untuk akun FreshWash.</p>
        </div>

        <Card variant="white" className="shadow-xl">
          {!hasValidSession ? (
            <div className="text-center py-4 space-y-4">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-800">Sesi Reset Password Tidak Valid</h2>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {errorMessage || 'Link reset password tidak valid atau sudah kedaluwarsa. Silakan meminta link reset password baru.'}
                </p>
              </div>
              <div className="pt-2">
                <Link href="/forgot-password">
                  <Button variant="primary" size="md" className="w-full">
                    Minta Link Reset Password Baru
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="p-3.5 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3.5 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{successMessage} Mengalihkan ke halaman login...</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Password Baru:
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="Minimal 8 karakter..."
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Konfirmasi Password Baru:
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="Ketik ulang password baru..."
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={isLoading || Boolean(successMessage)}
                  className="w-full mt-2 cursor-pointer disabled:opacity-50"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {isLoading ? 'Menyimpan Password...' : 'Simpan Password Baru'}
                </Button>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                <Link
                  href="/login"
                  className="text-xs font-bold text-slate-500 hover:text-teal-700 transition-colors"
                >
                  Kembali ke Login
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
