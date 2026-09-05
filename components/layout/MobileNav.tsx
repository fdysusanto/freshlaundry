'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { UserProfile } from '@/types/user';
import { Home, Search, Package, User, Truck, Store, BarChart3, Users, RotateCcw, Layers } from 'lucide-react';

export const MobileNav: React.FC = () => {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      if (isSupabaseConfigured) {
        const profile = await authService.fetchCurrentProfile();
        if (isMounted) setCurrentUser(profile);
      } else {
        if (isMounted) setCurrentUser(authService.getCurrentUserSync());
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const role = currentUser?.role;

  let navItems: { id: string; label: string; href: string; icon: React.ElementType; isCta?: boolean }[] = [];

  if (role === 'courier') {
    navItems = [
      { id: 'courier-home', label: 'Home', href: '/courier', icon: Home },
      { id: 'courier-job-pool', label: 'Job Pool', href: '/courier/job-pool', icon: Layers },
      { id: 'courier-active-tasks', label: 'Tugas', href: '/courier/active-tasks', icon: Truck },
      { id: 'courier-account', label: 'Akun', href: '/courier/account', icon: User },
    ];
  } else if (role === 'laundry_owner' || role === 'laundry_staff') {
    navItems = [
      { id: 'home', label: 'Beranda', href: '/', icon: Home },
      { id: 'owner-portal', label: 'Owner Portal', href: '/owner', icon: Store, isCta: true },
    ];
  } else if (role === 'admin' || role === 'platform_admin') {
    navItems = [
      { id: 'admin-home', label: 'Beranda', href: '/', icon: Home },
      { id: 'admin-monitoring', label: 'Monitoring', href: '/admin', icon: BarChart3 },
      { id: 'admin-laundry', label: 'Laundry', href: '/admin/partner-applications', icon: Store },
      { id: 'admin-refunds', label: 'Refund', href: '/admin/refunds', icon: RotateCcw },
      { id: 'admin-staff', label: 'Staff', href: '/admin/staff', icon: Users, isCta: true },
    ];
  } else {
    // Customer (or Guest) Target Bottom Navigation: Home | Cari | Pesanan | Akun
    navItems = [
      { id: 'home', label: 'Home', href: '/customer', icon: Home },
      { id: 'search', label: 'Cari', href: '/customer/laundries', icon: Search },
      { id: 'orders', label: 'Pesanan', href: '/customer/orders', icon: Package },
      { id: 'account', label: 'Akun', href: '/customer/account', icon: User },
    ];
  }

  const checkIsActive = (itemId: string, href: string) => {
    if (itemId === 'courier-home') {
      return pathname === '/courier';
    }
    if (itemId === 'courier-job-pool') {
      return pathname.startsWith('/courier/job-pool');
    }
    if (itemId === 'courier-active-tasks') {
      return pathname.startsWith('/courier/active-tasks');
    }
    if (itemId === 'courier-account') {
      return pathname.startsWith('/courier/account');
    }
    if (itemId === 'home') {
      return pathname === '/customer' || pathname === '/';
    }
    if (itemId === 'search') {
      return pathname.startsWith('/customer/laundries');
    }
    if (itemId === 'orders') {
      return pathname === '/customer/orders';
    }
    if (itemId === 'account') {
      return (
        pathname.startsWith('/customer/account') ||
        pathname.startsWith('/customer/addresses') ||
        pathname.startsWith('/customer/favorites') ||
        pathname.startsWith('/customer/orders/history')
      );
    }
    return pathname === href || (href !== '/' && pathname.startsWith(href));
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center justify-around shadow-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = checkIsActive(item.id, item.href);

        if (item.isCta) {
          return (
            <Link
              key={item.id}
              href={item.href}
              className="flex flex-col items-center justify-center text-teal-600 font-extrabold -mt-6 group focus:outline-hidden"
            >
              <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-teal-700 via-teal-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-teal-600/40 ring-4 ring-white active:scale-95 transition-transform">
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] mt-1 text-teal-800 font-extrabold tracking-tight">{item.label}</span>
            </Link>
          );
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2.5 py-1 rounded-2xl transition-all ${
              isActive
                ? 'text-teal-700 font-black bg-teal-50/80'
                : 'text-slate-500 font-medium hover:text-slate-800 active:scale-95'
            }`}
          >
            <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
            <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-black' : 'font-semibold'}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
};
