'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { UserProfile, UserRole } from '@/types/user';
import { UserAccountDropdown } from './UserAccountDropdown';
import { ArrowRight, User, Truck, ShieldCheck, LogOut } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import Image from 'next/image';
import { BRAND } from '@/config/brand';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      if (isSupabaseConfigured) {
        const liveProfile = await authService.fetchCurrentProfile();
        if (isMounted) setCurrentUser(liveProfile);
      } else {
        if (isMounted) setCurrentUser(authService.getCurrentUser());
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const handleRoleSwitch = (role: UserRole) => {
    if (isSupabaseConfigured) {
      setIsRoleModalOpen(false);
      if (role === 'customer') router.push('/customer');
      else if (role === 'courier') router.push('/courier');
      else if (role === 'laundry_owner') router.push('/owner');
      else if (role === 'admin') router.push('/admin');
      return;
    }

    const updated = authService.switchRole(role);
    setCurrentUser(updated);
    setIsRoleModalOpen(false);
    
    if (role === 'customer') router.push('/customer');
    else if (role === 'courier') router.push('/courier');
    else if (role === 'laundry_owner') router.push('/owner');
    else if (role === 'admin') router.push('/admin');
  };

  const isPublicLandingPage = pathname === '/';

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Logo Brand Link */}
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

          {/* Header Right Actions: Existing Account CTA / Dropdown + Partner Registration CTA (Only on "/") */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
            {/* Account Action (Hidden on Public Landing Page "/") */}
            {!isPublicLandingPage && (
              currentUser ? (
                <div className="shrink-0">
                  <UserAccountDropdown
                    currentUser={currentUser}
                    onOpenRoleModal={() => setIsRoleModalOpen(true)}
                    onLogoutSuccess={() => {
                      setCurrentUser(null);
                      setIsRoleModalOpen(false);
                      router.push('/login');
                    }}
                  />
                </div>
              ) : (
                <div className="shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/login')}
                    className="text-xs sm:text-sm px-2.5 sm:px-3 font-bold border-slate-300 text-slate-700 shrink-0"
                  >
                    Masuk
                  </Button>
                </div>
              )
            )}

            {/* Partner Registration CTA - Strictly ONLY VISIBLE ON PUBLIC LANDING PAGE ("/") */}
            {isPublicLandingPage && (
              <Link
                href="/register/partner"
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs sm:text-sm shadow-xs hover:shadow-md transition-all active:scale-[0.98] shrink-0 uppercase tracking-wide min-h-[40px] sm:min-h-[44px] justify-center"
              >
                <span className="hidden sm:inline">Ajukan Jadi Mitra</span>
                <span className="inline sm:hidden">Jadi Mitra</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Demo Role Switcher Modal (Only active in Offline/Unconfigured mode) */}
      {!isSupabaseConfigured && (
        <Modal
          isOpen={isRoleModalOpen}
          onClose={() => setIsRoleModalOpen(false)}
          title="Ganti Peran Pengguna (Demo Switcher)"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Pilih akun demo untuk menguji antarmuka dan hak akses tiap peran:
            </p>

            <div className="space-y-2.5">
              {/* Option Customer */}
              <button
                onClick={() => handleRoleSwitch('customer')}
                className={`w-full p-4 rounded-xl border text-left flex items-center gap-3 transition-all ${
                  currentUser?.role === 'customer'
                    ? 'border-brand-primary bg-brand-surface ring-2 ring-brand-primary/20'
                    : 'border-slate-200 hover:border-brand-secondary bg-white'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-brand-surface text-brand-primary flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-sm">Customer (Pelanggan)</span>
                    <Badge variant="teal">Budi Santoso</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Memesan pickup/delivery, melacak status real-time laundry.
                  </p>
                </div>
              </button>

              {/* Option Courier */}
              <button
                onClick={() => handleRoleSwitch('courier')}
                className={`w-full p-4 rounded-xl border text-left flex items-center gap-3 transition-all ${
                  currentUser?.role === 'courier'
                    ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20'
                    : 'border-slate-200 hover:border-amber-300 bg-white'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-sm">Kurir (Driver)</span>
                    <Badge variant="amber">Agung Pratama</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Melihat daftar tugas pickup &amp; delivery, update status lokasi.
                  </p>
                </div>
              </button>

              {/* Option Admin */}
              <button
                onClick={() => handleRoleSwitch('admin')}
                className={`w-full p-4 rounded-xl border text-left flex items-center gap-3 transition-all ${
                  currentUser?.role === 'admin'
                    ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                    : 'border-slate-200 hover:border-purple-300 bg-white'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-sm">Administrator</span>
                    <Badge variant="purple">Siti Admin</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Monitoring seluruh order, penugasan kurir, omset &amp; statistik.
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  authService.logout();
                  setCurrentUser(null);
                  setIsRoleModalOpen(false);
                  router.push('/login');
                }}
                leftIcon={<LogOut className="w-4 h-4 text-rose-500" />}
                className="text-rose-600 hover:bg-rose-50"
              >
                Keluar Akun
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsRoleModalOpen(false)}>
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};




