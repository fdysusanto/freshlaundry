'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { User, Mail, Lock, Phone, MapPin, ArrowRight, AlertCircle } from 'lucide-react';

import Image from 'next/image';
import { BRAND } from '@/config/brand';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !phone) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      // Self-registration is strictly locked to 'customer' role
      await authService.registerAsync(fullName, email, password, phone, address);
      router.push('/customer');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Pendaftaran akun gagal.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

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
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Daftar Akun Baru</h1>
          <p className="text-xs text-slate-500">Bergabunglah dengan {BRAND.displayName} untuk kemudahan laundry pickup.</p>
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
                Nama Lengkap:
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Budi Santoso"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Alamat Email:
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="budi@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Kata Sandi:
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                No. WhatsApp / HP:
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  required
                  placeholder="081234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Alamat Utama (Opsional):
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <textarea
                  rows={2}
                  placeholder="Jl. Melati No. 45, Kebayoran Baru, Jakarta Selatan..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
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
              {isLoading ? 'Memproses Pendaftaran...' : 'Daftar Akun'}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center space-y-2">
            <p className="text-xs text-slate-500">
              Sudah memiliki akun?{' '}
              <Link href="/login" className="font-bold text-brand-primary hover:underline">
                Masuk di Sini
              </Link>
            </p>
            <p className="text-xs text-slate-500">
              Punya usaha laundry?{' '}
              <Link href="/register/partner" className="font-bold text-brand-primary hover:underline">
                Daftar sebagai Mitra Laundry
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
