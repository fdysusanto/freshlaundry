'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { partnerApplicationService } from '@/services/partnerApplicationService';
import { isSupabaseConfigured } from '@/services/supabase';
import { UserProfile, UserRole } from '@/types/user';
import {
  Sparkles,
  User,
  Users,
  Truck,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  PackageCheck,
  ChevronDown,
  BarChart3,
  Store,
  Package,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [partnerAppStatus, setPartnerAppStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      if (isSupabaseConfigured) {
        const liveProfile = await authService.fetchCurrentProfile();
        if (isMounted) setCurrentUser(liveProfile);

        if (liveProfile) {
          try {
            const partnerApp = await partnerApplicationService.getMyPartnerApplicationAsync();
            if (isMounted && partnerApp) {
              setPartnerAppStatus(partnerApp.status);
            }
          } catch (err) {
            console.warn('Navbar partner app check warning:', err);
          }
        }
      } else {
        if (isMounted) setCurrentUser(authService.getCurrentUser());
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await authService.signOut();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal melakukan logout.';
      alert(message);
      return;
    }
    setCurrentUser(null);
    setIsMobileMenuOpen(false);
    setIsRoleModalOpen(false);
    router.push('/login');
  };

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
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-teal-600/30 group-hover:scale-105 transition-transform">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-lg sm:text-xl font-black bg-gradient-to-r from-teal-700 via-cyan-600 to-slate-900 bg-clip-text text-transparent tracking-tight">
                FreshWash
              </span>
              <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-widest text-teal-600 block -mt-1">
                Pickup & Delivery
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link
              href="/"
              className={`hover:text-teal-600 transition-colors ${
                pathname === '/' ? 'text-teal-700 font-bold' : ''
              }`}
            >
              Beranda
            </Link>

            {(!currentUser || currentUser?.role === 'customer') && (
              <Link
                href="/customer/laundries"
                className={`hover:text-teal-600 transition-colors flex items-center gap-1.5 ${
                  pathname.startsWith('/customer/laundries') ? 'text-teal-700 font-bold' : ''
                }`}
              >
                <PackageCheck className="w-4 h-4" />
                <span>Cari Laundry</span>
              </Link>
            )}

            {currentUser?.role === 'customer' && (
              <Link
                href="/customer"
                className={`hover:text-teal-600 transition-colors flex items-center gap-1.5 ${
                  pathname === '/customer' ? 'text-teal-700 font-bold' : ''
                }`}
              >
                <User className="w-4 h-4" />
                <span>Dashboard Pelanggan</span>
              </Link>
            )}

            {currentUser?.role === 'courier' && (
              <Link
                href="/courier"
                className={`hover:text-teal-600 transition-colors flex items-center gap-1.5 ${
                  pathname.startsWith('/courier') ? 'text-teal-700 font-bold' : ''
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Kurir Portal</span>
              </Link>
            )}

            {(currentUser?.role === 'laundry_owner' || currentUser?.role === 'laundry_staff') && (
              <Link
                href="/owner"
                className={`hover:text-teal-600 transition-colors flex items-center gap-1.5 ${
                  pathname.startsWith('/owner') ? 'text-teal-700 font-bold' : ''
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Dashboard Mitra</span>
              </Link>
            )}

            {currentUser?.role === 'customer' && (
              partnerAppStatus === 'pending' || partnerAppStatus === 'rejected' ? (
                <Link
                  href="/register/partner/status"
                  className={`hover:text-teal-600 transition-colors flex items-center gap-1.5 ${
                    pathname.startsWith('/register/partner/status') ? 'text-teal-700 font-bold' : ''
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>Pengajuan Mitra</span>
                </Link>
              ) : (
                <Link
                  href="/register/partner"
                  className={`hover:text-teal-600 transition-colors flex items-center gap-1.5 ${
                    pathname.startsWith('/register/partner') ? 'text-teal-700 font-bold' : ''
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>Jadi Mitra</span>
                </Link>
              )
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

            {!currentUser && (
              <Link
                href="/register/partner"
                className={`hover:text-teal-600 transition-colors flex items-center gap-1.5 ${
                  pathname.startsWith('/register/partner') ? 'text-teal-700 font-bold' : ''
                }`}
              >
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Jadi Mitra</span>
              </Link>
            )}
          </nav>

          {/* User Profile & Demo Role Switcher */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!isSupabaseConfigured) {
                      setIsRoleModalOpen(true);
                    }
                  }}
                  className={`flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-xl border border-slate-200 bg-slate-50/80 transition-all text-left ${
                    !isSupabaseConfigured ? 'hover:border-teal-400 hover:bg-teal-50/50 group cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                    {currentUser.fullName ? currentUser.fullName.charAt(0) : 'U'}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-bold text-slate-800 leading-tight">
                      {currentUser.fullName || 'Pengguna'}
                    </p>
                    <div className="flex items-center gap-1">
                      <Badge variant={getRoleBadgeVariant(currentUser.role)} size="sm">
                        {getRoleLabel(currentUser.role)}
                      </Badge>
                      {!isSupabaseConfigured && <ChevronDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </div>
                </button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  leftIcon={<LogOut className="w-4 h-4 text-rose-500" />}
                  className="border-slate-200 text-rose-600 hover:bg-rose-50 font-medium"
                >
                  Keluar
                </Button>

                {(!currentUser || currentUser?.role === 'customer') && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => router.push('/customer/laundries')}
                    leftIcon={<PackageCheck className="w-4 h-4" />}
                    className="hidden lg:inline-flex"
                  >
                    Pesan Laundry
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/login')}
                >
                  Masuk
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/register')}
                >
                  Daftar
                </Button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-teal-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-b border-slate-100 bg-white/95 backdrop-blur-md px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top duration-200">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-slate-700 font-medium hover:bg-teal-50 hover:text-teal-700"
            >
              Beranda
            </Link>
            {(!currentUser || currentUser?.role === 'customer') && (
              <Link
                href="/customer/laundries"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-slate-700 font-medium hover:bg-teal-50 hover:text-teal-700"
              >
                Cari Laundry
              </Link>
            )}
            {currentUser?.role === 'customer' && (
              <Link
                href="/customer"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-slate-700 font-medium hover:bg-teal-50 hover:text-teal-700"
              >
                Dashboard Pelanggan
              </Link>
            )}
            {(!currentUser || currentUser?.role === 'customer') && (
              <Link
                href="/customer/laundries"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-teal-700 font-bold bg-teal-50"
              >
                + Pesan Laundry Pickup
              </Link>
            )}

            {currentUser?.role === 'courier' && (
              <Link
                href="/courier"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-slate-700 font-medium hover:bg-teal-50 hover:text-teal-700"
              >
                Courier Portal
              </Link>
            )}

            {(currentUser?.role === 'laundry_owner' || currentUser?.role === 'laundry_staff') && (
              <Link
                href="/owner"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-slate-700 font-medium hover:bg-teal-50 hover:text-teal-700"
              >
                Owner Laundry
              </Link>
            )}

            {(currentUser?.role === 'admin' || currentUser?.role === 'platform_admin') && (
              <Link
                href="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-slate-700 font-medium hover:bg-teal-50 hover:text-teal-700"
              >
                Admin Portal
              </Link>
            )}

            {currentUser && (
              <div className="pt-3 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg flex items-center justify-between hover:bg-rose-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <LogOut className="w-4 h-4" />
                    <span>Keluar Akun ({currentUser.email || currentUser.fullName})</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
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
                  ? 'border-teal-600 bg-teal-50/60 ring-2 ring-teal-500/20'
                  : 'border-slate-200 hover:border-teal-300 bg-white'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
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
