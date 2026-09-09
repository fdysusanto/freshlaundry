'use client';

import React from 'react';
import Image from 'next/image';
import { MapPin, ShieldCheck, Leaf } from 'lucide-react';

export const CuciyanHero: React.FC = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-cyan-50/50 via-white to-white pt-8 pb-16 lg:pt-14 lg:pb-24">
      {/* Background Decorative Gradient Orbs */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute top-40 right-10 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Decorative Floating Leaves */}
      <div className="absolute top-16 left-4 lg:left-12 opacity-80 pointer-events-none animate-pulse">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-emerald-400/60">
          <path
            d="M12 2C6.5 2 2 6.5 2 12C7.5 12 12 7.5 12 2Z"
            fill="currentColor"
          />
          <path
            d="M12 22C17.5 22 22 17.5 22 12C16.5 12 12 16.5 12 22Z"
            fill="currentColor"
          />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* LEFT COLUMN: Headline, Subtext & Value Badges */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            
            {/* COMING SOON Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 text-xs font-black tracking-wider uppercase shadow-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>COMING SOON</span>
            </div>

            {/* Main Headline (STRICT NO-TYPO: "LAUNDRY LEBIH MUDAH. HIDUP LEBIH RINGAN.") */}
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              <span className="text-slate-900 block uppercase">LAUNDRY LEBIH MUDAH.</span>
              <span className="bg-gradient-to-r from-cyan-500 via-teal-500 to-sky-600 bg-clip-text text-transparent block mt-1 uppercase">
                HIDUP LEBIH RINGAN.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed max-w-xl mx-auto lg:mx-0 font-medium">
              CUCIYAN segera hadir di Cirebon dengan layanan laundry pickup &amp; delivery yang praktis. Segera hadir di Cirebon.
            </p>

            {/* 3 Value Proposition Chips */}
            <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-200/70 max-w-xl mx-auto lg:mx-0 text-left">
              
              <div className="flex items-start gap-2.5 bg-white/70 p-3 rounded-2xl border border-slate-200/60 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-cyan-100/80 text-cyan-700 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">Pertama di Cirebon</p>
                  <p className="text-[11px] text-slate-500 font-medium">Fokus melayani kota Cirebon</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-white/70 p-3 rounded-2xl border border-slate-200/60 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-teal-100/80 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">Aman &amp; Terpercaya</p>
                  <p className="text-[11px] text-slate-500 font-medium">Cucian ditangani profesional</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-white/70 p-3 rounded-2xl border border-slate-200/60 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Leaf className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">Lebih Praktis</p>
                  <p className="text-[11px] text-slate-500 font-medium">Hemat waktu tanpa repot</p>
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT COLUMN: Visual Story Showcase (Courier, Customer, Delivery Van) */}
          <div className="lg:col-span-6 relative">
            <div className="relative mx-auto max-w-lg lg:max-w-none">
              
              {/* Outer Container Frame */}
              <div className="relative bg-gradient-to-tr from-cyan-100/80 via-white to-sky-50/90 rounded-[2.5rem] p-3 sm:p-5 border border-cyan-200/80 shadow-2xl shadow-cyan-900/10 overflow-hidden">
                
                {/* Main Photography Showcase */}
                <div className="relative rounded-3xl overflow-hidden shadow-md group">
                  <Image
                    src="/images/landing/hero_courier.jpg"
                    alt="CUCIYAN Courier Pickup Service"
                    width={640}
                    height={480}
                    className="w-full h-auto object-cover rounded-3xl transform group-hover:scale-102 transition-transform duration-500"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-transparent pointer-events-none" />
                </div>

                {/* Hand-Drawn Annotation Badge 1 */}
                <div className="absolute top-6 left-6 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl border border-slate-200/80 flex items-center gap-2 max-w-[200px] sm:max-w-[220px]">
                  <div className="text-[11px] font-bold text-slate-800 leading-tight">
                    Cucian dijemput dari rumah Anda
                  </div>
                  <svg className="w-5 h-5 text-cyan-600 shrink-0 transform -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>

                {/* Hand-Drawn Annotation Badge 2 */}
                <div className="absolute top-6 right-6 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl border border-slate-200/80 flex items-center gap-2 max-w-[200px] sm:max-w-[220px]">
                  <div className="text-[11px] font-bold text-slate-800 leading-tight text-right">
                    Bersihnya diantar kembali ke tempat Anda
                  </div>
                  <svg className="w-5 h-5 text-cyan-600 shrink-0 transform rotate-135" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>

                {/* City Badge */}
                <div className="absolute bottom-6 right-6 bg-slate-800/90 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md border border-slate-700">
                  📍 Segera hadir di Cirebon
                </div>

              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

