'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { Sparkles, Search, Truck, Clock, ShieldCheck, ArrowRight } from 'lucide-react';

export const Hero: React.FC = () => {
  const router = useRouter();
  const [trackingCode, setTrackingCode] = useState('');

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingCode.trim()) return;
    router.push(`/orders/track/${trackingCode.trim()}`);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-teal-50/80 via-white to-white pt-12 pb-20 lg:pt-20 lg:pb-28">
      {/* Decorative Blur Background Orbs */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-teal-300/20 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute top-40 right-10 w-72 h-72 bg-cyan-300/20 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Headline & CTA */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-100/80 border border-teal-200 text-teal-800 text-xs font-bold shadow-xs">
              <Sparkles className="w-4 h-4 text-teal-600 animate-spin" />
              <span>Layanan Laundry Pickup & Delivery No. 1</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]">
              Laundry Bersih & Wangi,{' '}
              <span className="bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 bg-clip-text text-transparent">
                Jemput Antar Gratis
              </span>{' '}
              Sampai Depan Rumah!
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Pesan pickup laundry hanya dalam 1 menit. Kurir kami siap jemput pakaian kotor Anda dan mengembalikannya rapi, bersih, dan higienis.
            </p>

            {/* Tracking Search Input Box */}
            <form
              onSubmit={handleTrackSubmit}
              className="p-2 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-teal-900/5 max-w-md mx-auto lg:mx-0 flex items-center gap-2"
            >
              <div className="pl-3 text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="Masukkan Nomor Resi/Tracking (mis. LND-K89A2B)..."
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                className="w-full text-sm font-medium text-slate-800 focus:outline-hidden placeholder:text-slate-400"
              />
              <Button type="submit" size="sm" variant="primary" className="shrink-0">
                Lacak Status
              </Button>
            </form>

            {/* Quick Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Button
                variant="primary"
                size="lg"
                onClick={() => router.push('/customer/laundries')}
                rightIcon={<ArrowRight className="w-5 h-5" />}
                className="w-full sm:w-auto cursor-pointer"
              >
                Pesan Laundry Sekarang
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push('/customer/laundries')}
                className="w-full sm:w-auto cursor-pointer"
              >
                Jelajahi Mitra Laundry
              </Button>
            </div>

            {/* Key Value Badges */}
            <div className="pt-6 grid grid-cols-3 gap-4 border-t border-slate-200/60 max-w-lg mx-auto lg:mx-0">
              <div className="flex items-center gap-2 text-left">
                <Truck className="w-5 h-5 text-teal-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Gratis Pickup</p>
                  <p className="text-[10px] text-slate-500">Min. order 3 kg</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-left">
                <Clock className="w-5 h-5 text-teal-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Express 6 Jam</p>
                  <p className="text-[10px] text-slate-500">Selesai hari ini</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-left">
                <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Garansi Cuci</p>
                  <p className="text-[10px] text-slate-500">Cuci ulang 100%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual Showcase */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-sm lg:max-w-none">
              {/* Main Card Showcase */}
              <div className="bg-gradient-to-tr from-slate-900 to-teal-950 p-6 rounded-3xl text-white shadow-2xl shadow-teal-900/30 border border-slate-800">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 font-bold">
                      FW
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-400">Pesanan Aktif Hari Ini</p>
                      <p className="text-sm font-bold text-white">#LND-K89A2B</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 text-xs font-bold">
                    Dalam Proses Cuci
                  </span>
                </div>

                <div className="space-y-3 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60 mb-6">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Layanan:</span>
                    <span className="font-semibold text-white">Cuci Komplit Kiloan</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Berat Pakaian:</span>
                    <span className="font-semibold text-white">5.2 kg</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Estimasi Selesai:</span>
                    <span className="font-semibold text-teal-300">Besok, 14:00 WIB</span>
                  </div>
                </div>

                {/* Tracking Progress Mini Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-teal-400">Proses Laundering</span>
                    <span className="text-slate-400">Step 4 dari 7</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 w-3/5 rounded-full animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Floating Floating Badge 1 */}
              <div className="absolute -top-6 -left-6 bg-white p-3.5 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3 animate-bounce duration-1000">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Kurir Tiba di Lokasi</p>
                  <p className="text-[10px] text-slate-500">Agung Pratama • 2 min lalu</p>
                </div>
              </div>

              {/* Floating Badge 2 */}
              <div className="absolute -bottom-6 -right-6 bg-white p-3.5 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                  ★
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Rating 4.9/5.0</p>
                  <p className="text-[10px] text-slate-500">Dari 2.500+ Pelanggan</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
