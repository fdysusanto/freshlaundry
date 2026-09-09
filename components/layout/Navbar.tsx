'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { BRAND } from '@/config/brand';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const isPublicLandingPage = pathname === '/';

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        {/* Logo Brand Only */}
        <Link href="/" className="flex items-center gap-2 group">
          <Image
            src="/brand/cuciyan/logo/logo-horizontal.svg"
            alt={BRAND.displayName}
            width={240}
            height={64}
            className="h-10 sm:h-14 w-auto shrink-0 object-contain transition-transform group-hover:scale-105"
            priority
          />
        </Link>

        {/* Partner Registration CTA - Strictly ONLY VISIBLE ON PUBLIC LANDING PAGE ("/") */}
        {isPublicLandingPage && (
          <Link
            href="/register/partner"
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs sm:text-sm shadow-xs hover:shadow-md transition-all active:scale-[0.98] shrink-0 uppercase tracking-wide min-h-[40px] sm:min-h-[44px] justify-center"
          >
            <span className="hidden sm:inline">Ajukan Jadi Mitra</span>
            <span className="inline sm:hidden">Jadi Mitra</span>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          </Link>
        )}
      </div>
    </header>
  );
};



