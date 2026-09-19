'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { partnerApplicationService } from '@/services/partnerApplicationService';
import { isValidUuid } from '@/utils/formatters';
import { Button } from '@/components/ui/Button';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';

import Image from 'next/image';
import { BRAND } from '@/config/brand';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setErrorMessage('');

    try {
      const user = await authService.loginAsync(email, password);

      if (typeof window !== 'undefined') {
        console.log('[AUTH-LIVE-DIAGNOSTIC]', {
          source: 'supabase_auth',
          authenticated: true,
          userIdIsUuid: isValidUuid(user.id),
          profileLoaded: true,
          role: user.role,
        });
      }

      if (user.role === 'customer') {
        try {
          const partnerApp = await partnerApplicationService.getMyPartnerApplicationAsync();
          if (partnerApp?.status === 'pending' || partnerApp?.status === 'rejected') {
            router.push('/register/partner/status');
            return;
          }
        } catch (partnerErr) {
          console.warn('Partner application check fallback during login:', partnerErr);
        }
        router.push('/customer');
      } else if (user.role === 'courier') {
        router.push('/courier');
      } else if (user.role === 'laundry_owner') {
        router.push('/owner');
      } else {
        router.push('/admin');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login gagal. Periksa kembali email dan kata sandi Anda.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] sm:min-h-[85vh] flex flex-col justify-between sm:justify-center px-5 sm:px-6 py-6 sm:py-12 bg-slate-50/70 pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-[360px] sm:max-w-md mx-auto my-auto space-y-6 sm:space-y-7">
        
        {/* Header Section: Logo, Heading, Subtitle */}
        <div className="text-center space-y-2 sm:space-y-2.5">
          <Image
            src="/brand/cuciyan/logo/logo-horizontal.svg"
            alt={BRAND.displayName}
            width={240}
            height={64}
            className="h-12 sm:h-14 w-auto mx-auto object-contain mb-3 sm:mb-4"
            priority
          />
          <h1 className="text-2xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
            Selamat Datang Kembali
          </h1>
          <p className="text-sm sm:text-sm text-slate-500 font-medium max-w-[300px] sm:max-w-sm mx-auto leading-relaxed">
            Masuk ke portal {BRAND.displayName} untuk mengelola pesanan Anda.
          </p>
        </div>

        {/* Clean Minimal Mobile-Native Form */}
        <div className="space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4.5">
            <div>
              <label className="block text-xs sm:text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                ALAMAT EMAIL:
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 h-12 sm:h-12 py-3 text-sm sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 shadow-2xs focus:outline-hidden focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <label className="block text-xs sm:text-xs font-extrabold text-slate-700 uppercase tracking-wider shrink-0">
                  KATA SANDI:
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs sm:text-xs font-bold text-brand-primary hover:underline transition-colors shrink-0"
                >
                  Lupa password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 h-12 sm:h-12 py-3 text-sm sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 shadow-2xs focus:outline-hidden focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading}
              className="w-full mt-3.5 h-12 sm:h-12 py-3.5 text-sm sm:text-base font-extrabold rounded-xl shadow-xs hover:shadow-md transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {isLoading ? 'Memproses Login...' : 'Masuk Sekarang'}
            </Button>
          </form>

          {/* Registration Links */}
          <div className="pt-6 mt-3 border-t border-slate-200/60 text-center space-y-3">
            <p className="text-sm sm:text-sm text-slate-600 font-medium leading-normal">
              Belum punya akun?{' '}
              <Link href="/register" className="font-extrabold text-brand-primary hover:underline transition-colors block sm:inline mt-1 sm:mt-0">
                Daftar sebagai Customer
              </Link>
            </p>
            <p className="text-sm sm:text-sm text-slate-600 font-medium leading-normal">
              Punya usaha laundry?{' '}
              <Link href="/register/partner" className="font-extrabold text-brand-primary hover:underline transition-colors block sm:inline mt-1 sm:mt-0">
                Daftar sebagai Mitra Laundry
              </Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
