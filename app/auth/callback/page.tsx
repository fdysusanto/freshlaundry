'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { authService } from '@/services/authService';
import { partnerApplicationService } from '@/services/partnerApplicationService';
import { Button } from '@/components/ui/Button';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { BRAND } from '@/config/brand';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('Menyiapkan akun CUCIYAN Anda...');
  const isExchangingRef = useRef<boolean>(false);

  useEffect(() => {
    // Guard against React 18/19 StrictMode duplicate effect execution
    if (isExchangingRef.current) return;
    isExchangingRef.current = true;

    const processOAuthCallback = async () => {
      // 1. Check for OAuth Provider Error in URL query parameters
      const oauthError = searchParams.get('error');
      const oauthErrorDesc = searchParams.get('error_description');

      if (oauthError || oauthErrorDesc) {
        const fullErr = oauthErrorDesc || oauthError || 'Otorisasi OAuth dibatalkan atau tidak disetujui.';
        console.warn('[AUTH-CALLBACK-ERROR] OAuth provider returned error:', fullErr);
        setErrorMessage(`Login Gagal: ${fullErr}`);
        return;
      }

      if (!isSupabaseConfigured || !supabase) {
        setErrorMessage('Koneksi Supabase belum terkonfigurasi.');
        return;
      }

      try {
        setStatusText('Memverifikasi sesi autentikasi...');

        // 2. Check if active session already exists (e.g., auto-exchanged by Supabase detectSessionInUrl)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        let activeUserId = existingSession?.user?.id;

        if (!activeUserId) {
          // 3. Fallback: If no active session yet, check for PKCE Code and exchange manually
          const code = searchParams.get('code');
          if (!code) {
            console.warn('[AUTH-CALLBACK-ERROR] Authorization code parameter missing and no active session found.');
            setErrorMessage('Kode otorisasi OAuth tidak ditemukan dalam URL callback.');
            return;
          }

          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error('[AUTH-CALLBACK-ERROR] Code exchange failed:', exchangeError.message);
            setErrorMessage(`Verifikasi Login Gagal: ${exchangeError.message}`);
            return;
          }

          if (!data.session) {
            setErrorMessage('Sesi autentikasi tidak berhasil dibuat.');
            return;
          }

          activeUserId = data.session.user.id;
        }

        // Clean up authorization code from browser history bar safely after session verification
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        setStatusText('Memuat profil pengguna...');
        // 4. Load User Profile (Provisioned by DB Trigger 050)
        const profile = await authService.fetchCurrentProfile();

        if (!profile) {
          console.error('[AUTH-CALLBACK-ERROR] Profile loading failed for user ID:', activeUserId);
          setErrorMessage('Gagal memuat profil pengguna dari database. Silakan coba login kembali.');
          return;
        }

        setStatusText('Mengalihkan ke dashboard...');
        // 5. Evaluate Role & Redirect strictly from public.profiles.role
        if (profile.role === 'customer') {
          try {
            const partnerApp = await partnerApplicationService.getMyPartnerApplicationAsync();
            if (partnerApp?.status === 'pending' || partnerApp?.status === 'rejected') {
              router.push('/register/partner/status');
              return;
            }
          } catch (partnerErr) {
            console.warn('[AUTH-CALLBACK] Partner application check warning:', partnerErr);
          }
          router.push('/customer');
        } else if (profile.role === 'courier') {
          router.push('/courier');
        } else if (profile.role === 'laundry_owner' || profile.role === 'laundry_staff') {
          router.push('/owner');
        } else if (profile.role === 'platform_admin' || profile.role === 'admin') {
          router.push('/admin');
        } else {
          console.error('[AUTH-CALLBACK-ERROR] Unknown user role:', profile.role);
          setErrorMessage('Peran pengguna tidak dikenal atau tidak memiliki izin akses.');
          return;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga saat verifikasi login.';
        console.error('[AUTH-CALLBACK-EXCEPTION]', err);
        setErrorMessage(message);
      }
    };

    processOAuthCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-gradient-to-b from-brand-surface via-slate-50 to-white">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <Image
            src="/brand/cuciyan/logo/logo-horizontal.svg"
            alt={BRAND.displayName}
            width={300}
            height={96}
            className="h-20 sm:h-24 w-auto mx-auto object-contain mb-3"
            priority
          />
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xl text-center space-y-5">
          {errorMessage ? (
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-extrabold text-slate-900">Autentikasi Gagal</h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                  {errorMessage}
                </p>
              </div>
              <div className="pt-3">
                <Link href="/login">
                  <Button variant="primary" size="lg" className="w-full" rightIcon={<ArrowLeft className="w-4 h-4" />}>
                    Kembali ke Halaman Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center mx-auto">
                <RefreshCw className="w-6 h-6 animate-spin text-brand-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">Proses Autentikasi</h2>
                <p className="text-xs sm:text-sm font-medium text-slate-500">{statusText}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
          <div className="text-center space-y-3">
            <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-xs font-semibold text-slate-600">Memuat callback autentikasi...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
