'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { partnerApplicationService } from '@/services/partnerApplicationService';
import { isValidUuid } from '@/utils/formatters';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Sparkles, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';

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
    } catch (err: any) {
      setErrorMessage(err.message || 'Login gagal. Periksa kembali email dan kata sandi Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-gradient-to-b from-teal-50/50 via-slate-50 to-white">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-600/30 mb-2">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Selamat Datang Kembali</h1>
          <p className="text-xs text-slate-500">Masuk ke portal FreshWash untuk mengelola pesanan Anda.</p>
        </div>

        <Card variant="white" className="shadow-xl">
          {errorMessage && (
            <div className="p-3.5 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Alamat Email:
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Kata Sandi:
                </label>
                <Link href="/forgot-password" className="text-xs font-bold text-teal-700 hover:underline">
                  Lupa password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading}
              className="w-full mt-2 cursor-pointer disabled:opacity-50"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {isLoading ? 'Memproses Login...' : 'Masuk Sekarang'}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center space-y-2">
            <p className="text-xs text-slate-500">
              Belum punya akun?{' '}
              <Link href="/register" className="font-bold text-teal-700 hover:underline">
                Daftar sebagai Customer
              </Link>
            </p>
            <p className="text-xs text-slate-500">
              Punya usaha laundry?{' '}
              <Link href="/register/partner" className="font-bold text-teal-700 hover:underline">
                Daftar sebagai Mitra Laundry
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
