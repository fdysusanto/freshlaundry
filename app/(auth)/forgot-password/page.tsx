'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { authService } from '@/services/authService';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Sparkles, Mail, ArrowLeft, Send, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const validateEmail = (val: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail || !validateEmail(cleanEmail)) {
      setErrorMessage('Masukkan alamat email yang valid.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      await authService.resetPasswordForEmailAsync(cleanEmail);
      setIsSuccess(true);
    } catch (err: any) {
      console.warn('Reset password request error:', err?.message);
      // To prevent email enumeration, always show generic success view for user
      setIsSuccess(true);
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
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Lupa Password?</h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Masukkan email yang terdaftar. Kami akan mengirimkan link untuk membuat password baru.
          </p>
        </div>

        <Card variant="white" className="shadow-xl">
          {isSuccess ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-slate-900">Email reset password telah dikirim</h2>
                <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                  Jika email tersebut terdaftar, kami telah mengirimkan link untuk membuat password baru.
                </p>
                <p className="text-xs text-slate-500 italic">
                  Silakan periksa inbox atau folder spam email Anda.
                </p>
              </div>
              <div className="pt-2">
                <Link href="/login">
                  <Button variant="primary" size="lg" className="w-full">
                    Kembali ke Login
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

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={isLoading}
                  className="w-full mt-2 cursor-pointer disabled:opacity-50"
                  rightIcon={<Send className="w-4 h-4" />}
                >
                  {isLoading ? 'Mengirim Request...' : 'Kirim Link Reset Password'}
                </Button>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Kembali ke Login
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
