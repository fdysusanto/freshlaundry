'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { UserProfile, UserRole } from '@/types/user';
import { UserAccountDropdown } from './UserAccountDropdown';
import {
  Sparkles,
  User,
  Users,
  Truck,
  ShieldCheck,
  PackageCheck,
  ChevronDown,
  BarChart3,
  Store,
  Package,
  RotateCcw,
  LogOut,
} from 'lucide-react';
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
    
    // Redirect based on selected role
    if (role === 'customer') router.push('/customer');
    else if (role === 'courier') router.push('/courier');
    else if (role === 'laundry_owner') router.push('/owner');
    else if (role === 'admin') router.push('/admin');
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    if (role === 'admin') return 'purple';
    if (role === 'courier') return 'amber';
    if (role === 'laundry_owner') return 'blue';
    return 'teal';
  };

  const getRoleLabel = (role: UserRole) => {
    if (role === 'admin') return 'Admin Portal';
    if (role === 'courier') return 'Kurir Driver';
    if (role === 'laundry_owner') return 'Laundry Owner';
    return 'Customer';
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Logo Brand */}
          <Link href="/" className="flex items-center gap-2 group">
            <Image
              src="/brand/cuciyan/logo/logo-horizontal.svg"
              alt={BRAND.displayName}
              width={240}
              height={64}
              className="h-12 sm:h-16 w-auto shrink-0 object-contain transition-transform group-hover:scale-105"
              priority
            />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-700">
            <Link
              href="/"
              className={`hover:text-brand-primary transition-colors ${
                pathname === '/' ? 'text-brand-primary font-bold' : ''
              }`}
            >
              Beranda
            </Link>

            {(!currentUser || currentUser?.role === 'customer') && (
              <Link
                href="/customer/laundries"
                className={`hover:text-brand-primary transition-colors flex items-center gap-1.5 ${
                  pathname.startsWith('/customer/laundries') ? 'text-brand-primary font-bold' : ''
                }`}
              >
                <PackageCheck className="w-4 h-4" />
                <span>Cari Laundry</span>
              </Link>
            )}

            {currentUser?.role === 'customer' && (
              <Link
                href="/customer"
                className={`hover:text-brand-primary transition-colors flex items-center gap-1.5 ${
                  pathname === '/customer' ? 'text-brand-primary font-bold' : ''
                }`}
              >
                <User className="w-4 h-4" />
                <span>Dashboard Pelanggan</span>
              </Link>
            )}

            {currentUser?.role === 'courier' && (
              <Link
                href="/courier"
                className={`hover:text-brand-primary transition-colors flex items-center gap-1.5 ${
                  pathname.startsWith('/courier') ? 'text-brand-primary font-bold' : ''
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Kurir Portal</span>
              </Link>
            )}

            {(currentUser?.role === 'laundry_owner' || currentUser?.role === 'laundry_staff') && (
              <Link
                href="/owner"
                className={`hover:text-brand-primary transition-colors flex items-center gap-1.5 ${
                  pathname.startsWith('/owner') ? 'text-brand-primary font-bold' : ''
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Dashboard Mitra</span>
              </Link>
            )}

            {(currentUser?.role === 'admin' || currentUser?.role === 'platform_admin') && (
              <>
                <Link
                  href="/admin"
                  className={`hover:text-purple-600 transition-colors flex items-center gap-1.5 ${
                    pathname === '/admin' ? 'text-purple-700 font-bold' : ''
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span>Monitoring</span>
                </Link>
                <Link
                  href="/admin/partner-applications"
                  className={`hover:text-purple-600 transition-colors flex items-center gap-1.5 ${
                    pathname.startsWith('/admin/partner-applications') ? 'text-purple-700 font-bold' : ''
                  }`}
                >
                  <Store className="w-4 h-4 text-purple-600" />
                  <span>Laundry</span>
                </Link>
                <Link
                  href="/admin/staff"
                  className={`hover:text-purple-600 transition-colors flex items-center gap-1.5 ${
                    pathname.startsWith('/admin/staff') ? 'text-purple-700 font-bold' : ''
                  }`}
                >
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>Staff</span>
                </Link>
                <Link
                  href="/admin/refunds"
                  className={`hover:text-purple-600 transition-colors flex items-center gap-1.5 ${
                    pathname.startsWith('/admin/refunds') ? 'text-purple-700 font-bold' : ''
                  }`}
                >
                  <RotateCcw className="w-4 h-4 text-purple-600" />
                  <span>Refund</span>
                </Link>
                <Link
                  href="/admin"
                  className={`hover:text-purple-600 transition-colors flex items-center gap-1.5 ${
                    pathname === '/admin#orders' ? 'text-purple-700 font-bold' : ''
                  }`}
                >
                  <Package className="w-4 h-4 text-purple-600" />
                  <span>Pesanan</span>
                </Link>
              </>
            )}
          </nav>

          {/* Header Right Actions: CTA + User Profile / Avatar */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
            {currentUser ? (
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {(!currentUser || currentUser?.role === 'customer') && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => router.push('/customer/laundries')}
                    leftIcon={<PackageCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />}
                    className="inline-flex items-center sm:text-sm font-bold shrink-0 px-2.5 sm:px-3.5"
                  >
                    <span className="hidden sm:inline">Pesan Laundry</span>
                    <span className="inline sm:hidden">+ Pesan</span>
                  </Button>
                )}

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
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/customer/laundries')}
                  leftIcon={<PackageCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />}
                  className="inline-flex items-center sm:text-sm font-bold shrink-0 px-2.5 sm:px-3.5"
                >
                  <span className="hidden sm:inline">Pesan Laundry</span>
                  <span className="inline sm:hidden">+ Pesan</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/login')}
                  className="text-xs sm:text-sm px-2.5 sm:px-3 shrink-0"
                >
                  Masuk
                </Button>
              </div>
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
                  Melihat daftar tugas pickup & delivery, update status lokasi.
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
                  Monitoring seluruh order, penugasan kurir, omset & statistik.
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
