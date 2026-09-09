'use client';

import React from 'react';
import Image from 'next/image';
import { BRAND } from '@/config/brand';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-10 pb-10 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Main Footer Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800 text-center sm:text-left">
          
          {/* Left Brand Logo */}
          <div className="space-y-2">
            <Image
              src="/brand/cuciyan/logo/logo-white.svg"
              alt={BRAND.displayName}
              width={160}
              height={40}
              className="h-9 w-auto object-contain mx-auto sm:mx-0"
            />
            <p className="text-xs text-slate-400 font-medium italic">
              {BRAND.tagline}
            </p>
          </div>

          {/* Center / Right Coming Soon Information */}
          <div className="text-center sm:text-right space-y-1">
            <p className="text-sm font-black text-white tracking-wider uppercase">
              {BRAND.displayName}
            </p>
            <p className="text-xs text-slate-400 font-medium">
              Segera hadir di Cirebon.
            </p>
            <p className="text-xs text-slate-500 font-medium">
              Semua bersih, semua beres.
            </p>
          </div>

        </div>

        {/* Bottom Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center sm:text-left">
          <p>© 2026 {BRAND.name}. Hak Cipta Dilindungi.</p>
          <div className="flex items-center gap-4">
            <span className="text-cyan-400 font-medium">Cirebon Operasional</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
