'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { UserProfile } from '@/types/user';
import { Home, PlusCircle, User, Truck, ShieldCheck, Store, BarChart3, Users, RotateCcw, Search } from 'lucide-react';

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
      { id: 'home', label: 'Beranda', href: '/', icon: Home },
      { id: 'courier-portal', label: 'Kurir Portal', href: '/courier', icon: Truck, isCta: true },
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
    // Guest or Customer
    navItems = [
      { id: 'home', label: 'Beranda', href: '/', icon: Home },
      { id: 'search-laundries', label: 'Cari', href: '/customer/laundries', icon: Search },
      { id: 'order-laundry', label: 'Pesan', href: '/customer/laundries', icon: PlusCircle, isCta: true },
      { id: 'customer-dashboard', label: 'Akun Saya', href: '/customer', icon: User },
    ];
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center justify-around shadow-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

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
