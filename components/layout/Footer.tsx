'use client';

import React from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { MessageCircle, Mail } from 'lucide-react';
import { BRAND } from '@/config/brand';

const InstagramIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

export function shouldShowFooterOnMobile(pathname: string): boolean {
  if (
    pathname === '/' ||
    pathname === '/register' ||
    pathname.startsWith('/register/') ||
    pathname.startsWith('/owner/laundry/register')
  ) {
    return true;
  }
  return false;
}

export const Footer: React.FC = () => {
  const pathname = usePathname();
  const isMobileVisible = shouldShowFooterOnMobile(pathname);

  return (
    <footer className={`${isMobileVisible ? 'block' : 'hidden md:block'} bg-slate-950 text-slate-300 pt-16 pb-10 border-t border-slate-800/80`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Main Footer Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          
          {/* Brand Section (Column 1-4 on Desktop) */}
          <div className="lg:col-span-4 space-y-4 pr-0 lg:pr-6">
            <Image
              src="/brand/cuciyan/logo/logo-white.svg"
              alt={BRAND.displayName}
              width={160}
              height={40}
              className="h-9 w-auto object-contain"
            />
            <p className="text-sm text-slate-300 font-medium leading-relaxed">
              Laundry lebih mudah, cepat, dan terpercaya.
            </p>
            <p className="text-xs text-slate-400 italic">
              {BRAND.tagline}
            </p>
          </div>

          {/* Navigation Column 1 — TENTANG */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Tentang
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <span className="text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                  Tentang CUCIYAN
                </span>
              </li>
              <li>
                <span className="text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                  Cara Kerja
                </span>
              </li>
              <li>
                <span className="text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                  Mitra Laundry
                </span>
              </li>
              <li>
                <span className="text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                  Karier
                </span>
              </li>
            </ul>
          </div>

          {/* Navigation Column 2 — LAYANAN */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Layanan
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <span className="text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                  Laundry
                </span>
              </li>
              <li>
                <span className="text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                  Pickup &amp; Delivery
                </span>
              </li>
              <li>
                <span className="text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                  Cari Laundry
                </span>
              </li>
              <li>
                <span className="text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                  Daftar sebagai Mitra
                </span>
              </li>
            </ul>
          </div>

          {/* Navigation Column 3 — BANTUAN */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Bantuan
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <span className="text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                  Pusat Bantuan
                </span>
              </li>
              <li>
                <span className="text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                  FAQ
                </span>
              </li>
              <li>
                <span className="text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                  Syarat &amp; Ketentuan
                </span>
              </li>
              <li>
                <span className="text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                  Kebijakan Privasi
                </span>
              </li>
            </ul>
          </div>

          {/* Navigation Column 4 — HUBUNGI KAMI */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Hubungi Kami
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <span className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                  <MessageCircle className="w-4 h-4 text-cyan-400" />
                  <span>WhatsApp</span>
                </span>
              </li>
              <li>
                <span className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                  <InstagramIcon className="w-4 h-4 text-cyan-400" />
                  <span>Instagram</span>
                </span>
              </li>
              <li>
                <span className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  <span>Email</span>
                </span>
              </li>
            </ul>
          </div>

        </div>

        {/* Visual Separation Divider */}
        <div className="border-t border-slate-800/80 pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 text-center sm:text-left">
            <p>© 2026 CUCIYAN. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">
                Platform Marketplace Laundry Pickup &amp; Delivery • Cirebon
              </span>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
};

