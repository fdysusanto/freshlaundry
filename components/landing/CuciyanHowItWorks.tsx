'use client';

import React from 'react';
import { ArrowRight, Truck, Sparkles, PackageCheck, Home, Shirt } from 'lucide-react';

export const CuciyanHowItWorks: React.FC = () => {
  return (
    <section className="py-12 sm:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
        
        {/* Section Title & Subtitle */}
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Cara Kerja CUCIYAN
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-500">
            Layanan pickup &amp; delivery praktis di Cirebon
          </p>
        </div>

        {/* 3 Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-center relative">
          
          {/* STEP 01: PICKUP */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-cyan-300 transition-all space-y-5 text-center relative group">
            
            {/* Step Number Badge */}
            <div className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-black mx-auto">
              01
            </div>

            {/* Step Visual Graphic Illustration */}
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-cyan-50 to-sky-100 border border-cyan-200/60 flex items-center justify-center mx-auto shadow-inner group-hover:scale-105 transition-transform relative">
              <div className="flex items-center justify-center gap-1">
                <Home className="w-8 h-8 text-cyan-600" />
                <Truck className="w-8 h-8 text-sky-600 animate-pulse" />
              </div>
            </div>

            {/* Step Title & Subtext */}
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900">PICKUP</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                Kurir menjemput cucian Anda.
              </p>
            </div>
          </div>

          {/* Desktop Arrow Connector 1 */}
          <div className="hidden md:flex absolute left-[31%] top-1/2 -translate-y-1/2 z-10">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shadow-2xs">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* STEP 02: LAUNDRY */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-cyan-300 transition-all space-y-5 text-center relative group">
            
            {/* Step Number Badge */}
            <div className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-black mx-auto">
              02
            </div>

            {/* Step Visual Graphic Illustration */}
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-teal-50 to-cyan-100 border border-teal-200/60 flex items-center justify-center mx-auto shadow-inner group-hover:scale-105 transition-transform relative">
              <div className="flex items-center justify-center gap-1">
                <Sparkles className="w-8 h-8 text-teal-600" />
                <Shirt className="w-8 h-8 text-cyan-600" />
              </div>
            </div>

            {/* Step Title & Subtext */}
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900">LAUNDRY</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                Cucian diproses oleh mitra laundry.
              </p>
            </div>
          </div>

          {/* Desktop Arrow Connector 2 */}
          <div className="hidden md:flex absolute right-[31%] top-1/2 -translate-y-1/2 z-10">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shadow-2xs">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* STEP 03: DELIVERY */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-cyan-300 transition-all space-y-5 text-center relative group">
            
            {/* Step Number Badge */}
            <div className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-black mx-auto">
              03
            </div>

            {/* Step Visual Graphic Illustration */}
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-sky-50 to-blue-100 border border-sky-200/60 flex items-center justify-center mx-auto shadow-inner group-hover:scale-105 transition-transform relative">
              <PackageCheck className="w-10 h-10 text-sky-600" />
            </div>

            {/* Step Title & Subtext */}
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900">DELIVERY</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                Cucian bersih diantar kembali.
              </p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};

