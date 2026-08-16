'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { Sparkles, ArrowRight } from 'lucide-react';

export const CTA: React.FC = () => {
  const router = useRouter();

  return (
    <section className="py-16 sm:py-20 bg-gradient-to-tr from-teal-900 via-teal-800 to-slate-900 text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-bold">
          <Sparkles className="w-4 h-4" />
          <span>Solusi Terbaik Menghemat Waktu Anda</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight max-w-3xl mx-auto">
          Siap Punya Pakaian Clean & Fresh Tanpa Ribet?
        </h2>

        <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
          Pesan layanan penjemputan sekarang. Kurir kami akan segera meluncur ke lokasi Anda.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push('/customer/create-order')}
            rightIcon={<ArrowRight className="w-5 h-5" />}
            className="w-full sm:w-auto bg-teal-400 hover:bg-teal-300 text-slate-950 font-black shadow-lg shadow-teal-500/20"
          >
            Pesan Laundry Pickup Now
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push('/login')}
            className="w-full sm:w-auto bg-slate-900/60 text-white border border-teal-400/40 hover:bg-teal-900/80 hover:text-white font-bold backdrop-blur-xs"
          >
            Masuk Portal Akun
          </Button>
        </div>
      </div>
    </section>
  );
};
