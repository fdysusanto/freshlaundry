'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Store, CheckCircle2, ArrowRight } from 'lucide-react';

export const CuciyanPartnerSection: React.FC = () => {
  return (
    <section className="py-8 sm:py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Banner Outer Card */}
        <div className="bg-gradient-to-r from-sky-50/90 via-cyan-50/70 to-white rounded-[2.5rem] border border-cyan-200/80 p-6 sm:p-10 lg:p-12 shadow-xl relative overflow-hidden">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
            
            {/* LEFT COLUMN: Photo Showcase with Floating Badge */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-3xl overflow-hidden shadow-lg border border-slate-200/80 group">
                <Image
                  src="/images/landing/partner_owner.jpg"
                  alt="Mitra Laundry CUCIYAN"
                  width={500}
                  height={380}
                  className="w-full h-64 sm:h-72 lg:h-80 object-cover rounded-3xl transform group-hover:scale-102 transition-transform duration-500"
                />
                
                {/* Floating Partner Badge */}
                <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-slate-200/80 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 leading-tight">Bersama CUCIYAN,</p>
                    <p className="text-[11px] text-slate-600 font-medium leading-tight">lebih banyak pelanggan, lebih banyak peluang.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Headline, Copy, CTA & Benefits List */}
            <div className="lg:col-span-7 space-y-6 text-left">
              
              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  Punya usaha laundry?
                </h3>
                <h2 className="text-2xl sm:text-4xl font-black text-cyan-600 tracking-tight">
                  Jadi bagian dari CUCIYAN.
                </h2>
              </div>

              <p className="text-xs sm:text-sm lg:text-base text-slate-600 font-medium leading-relaxed max-w-xl">
                Usaha laundry Anda tetap mandiri. CUCIYAN membantu menghadirkan channel pesanan baru dan memperluas jangkauan pelanggan Anda.
              </p>

              {/* Action CTA & Benefits Checklist */}
              <div className="space-y-5 pt-2">
                
                <Link
                  href="/register/partner"
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm sm:text-base shadow-lg shadow-orange-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0 uppercase tracking-wide"
                >
                  <span>Ajukan Jadi Mitra</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                {/* Benefits List */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Toko laundry Anda tetap mandiri dengan brand sendiri</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Channel pesanan baru dari aplikasi pelanggan</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Proses kemitraan mudah, praktis, dan transparan</span>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
};

