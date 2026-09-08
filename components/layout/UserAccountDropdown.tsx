'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { UserProfile, UserRole } from '@/types/user';
import { Badge } from '@/components/ui/Badge';
import {
  User,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  Package,
  Truck,
  Store,
  Layers,
  BarChart3,
  Users,
  RotateCcw,
  RefreshCw,
  Mail,
} from 'lucide-react';

interface UserAccountDropdownProps {
  currentUser: UserProfile;
  onOpenRoleModal?: () => void;
  onLogoutSuccess?: () => void;
}

export const UserAccountDropdown: React.FC<UserAccountDropdownProps> = ({
  currentUser,
  onOpenRoleModal,
  onLogoutSuccess,
}) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await authService.signOut();
      setIsOpen(false);
      if (onLogoutSuccess) {
        onLogoutSuccess();
      } else {
        router.push('/login');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal melakukan logout.';
      alert(message);
      setIsLoggingOut(false);
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    if (role === 'admin' || role === 'platform_admin') return 'purple';
    if (role === 'courier') return 'amber';
    if (role === 'laundry_owner' || role === 'laundry_staff') return 'blue';
    return 'teal';
  };

  const getRoleLabel = (role: UserRole) => {
    if (role === 'admin' || role === 'platform_admin') return 'Admin Portal';
    if (role === 'courier') return 'Kurir Driver';
    if (role === 'laundry_owner') return 'Laundry Owner';
    if (role === 'laundry_staff') return 'Laundry Staff';
    return 'Customer';
  };

  const role = currentUser.role;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Profile Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="User account menu"
        className={`flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-2 rounded-xl border transition-all text-left group cursor-pointer ${
          isOpen
            ? 'border-brand-primary bg-brand-surface/80 ring-2 ring-brand-primary/20'
            : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-slate-100/80'
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-brand-primary text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
          {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">
            {currentUser.fullName || 'Pengguna'}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <Badge variant={getRoleBadgeVariant(role)} size="sm">
              {getRoleLabel(role)}
            </Badge>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-brand-primary' : 'group-hover:text-slate-600'
              }`}
            />
          </div>
        </div>
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 divide-y divide-slate-100"
        >
          {/* Header Section: User Details */}
          <div className="p-3 bg-slate-50/80 rounded-xl mb-1 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {currentUser.fullName || 'Pengguna FreshLaundry'}
                </p>
                {currentUser.email && (
                  <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{currentUser.email}</span>
                  </p>
                )}
                <div className="mt-1">
                  <Badge variant={getRoleBadgeVariant(role)} size="sm">
                    {getRoleLabel(role)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Shortcuts Section */}
          <div className="py-1 space-y-0.5">
            {role === 'customer' && (
              <>
                <Link
                  href="/customer"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-brand-surface hover:text-brand-primary rounded-xl transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4 text-brand-primary" />
                  <span>Dashboard Pelanggan</span>
                </Link>
                <Link
                  href="/customer/account"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-brand-surface hover:text-brand-primary rounded-xl transition-colors"
                >
                  <User className="w-4 h-4 text-slate-500" />
                  <span>Akun &amp; Alamat Saya</span>
                </Link>
                <Link
                  href="/customer/orders"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-brand-surface hover:text-brand-primary rounded-xl transition-colors"
                >
                  <Package className="w-4 h-4 text-slate-500" />
                  <span>Pesanan Saya</span>
                </Link>
              </>
            )}

            {role === 'courier' && (
              <>
                <Link
                  href="/courier"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 rounded-xl transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4 text-amber-600" />
                  <span>Portal Kurir</span>
                </Link>
                <Link
                  href="/courier/active-tasks"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 rounded-xl transition-colors"
                >
                  <Truck className="w-4 h-4 text-amber-600" />
                  <span>Tugas Aktif</span>
                </Link>
                <Link
                  href="/courier/account"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 rounded-xl transition-colors"
                >
                  <User className="w-4 h-4 text-slate-500" />
                  <span>Akun Kurir</span>
                </Link>
              </>
            )}

            {(role === 'laundry_owner' || role === 'laundry_staff') && (
              <>
                <Link
                  href="/owner"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4 text-blue-600" />
                  <span>Dashboard Mitra</span>
                </Link>
                <Link
                  href="/owner?tab=profile"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors"
                >
                  <Store className="w-4 h-4 text-blue-600" />
                  <span>Profil &amp; Operasional Outlet</span>
                </Link>
                <Link
                  href="/owner/services"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors"
                >
                  <Layers className="w-4 h-4 text-slate-500" />
                  <span>Katalog Layanan</span>
                </Link>
              </>
            )}

            {(role === 'admin' || role === 'platform_admin') && (
              <>
                <Link
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-xl transition-colors"
                >
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span>Monitoring Admin</span>
                </Link>
                <Link
                  href="/admin/partner-applications"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-xl transition-colors"
                >
                  <Store className="w-4 h-4 text-purple-600" />
                  <span>Aplikasi Laundry</span>
                </Link>
                <Link
                  href="/admin/staff"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-xl transition-colors"
                >
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>Manajemen Staff</span>
                </Link>
                <Link
                  href="/admin/refunds"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-xl transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-purple-600" />
                  <span>Manajemen Refund</span>
                </Link>
              </>
            )}

            {/* Demo Role Switcher option in mock mode */}
            {!isSupabaseConfigured && onOpenRoleModal && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenRoleModal();
                }}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-amber-600" />
                <span>Ganti Peran (Demo Switcher)</span>
              </button>
            )}
          </div>

          {/* Footer Action: Logout */}
          <div className="pt-1 mt-1">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50/80 hover:bg-rose-100/80 rounded-xl flex items-center justify-between transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>{isLoggingOut ? 'Memproses Logout...' : 'Keluar dari Akun'}</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
