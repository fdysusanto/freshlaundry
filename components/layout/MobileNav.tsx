'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { UserProfile } from '@/types/user';
import { Home, PlusCircle, User, Truck, ShieldCheck, Store, BarChart3, Users } from 'lucide-react';

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
      { id: 'admin-staff', label: 'Staff', href: '/admin/staff', icon: Users, isCta: true },
      { id: 'admin-portal', label: 'Admin', href: '/admin', icon: ShieldCheck },
    ];
  } else {
    // Guest or Customer
    navItems = [
      { id: 'home', label: 'Beranda', href: '/', icon: Home },
      { id: 'search-laundries', label: 'Cari', href: '/customer/laundries', icon: Store },
      { id: 'order-laundry', label: 'Pesan', href: '/customer/laundries', icon: PlusCircle, isCta: true },
      { id: 'customer-dashboard', label: 'Customer', href: '/customer', icon: User },
    ];
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

        if (item.isCta) {
          return (
            <Link
              key={item.id}
              href={item.href}
              className="flex flex-col items-center justify-center text-teal-600 font-bold -mt-5"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-teal-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-teal-600/40 ring-4 ring-white">
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] mt-0.5 text-teal-700 font-bold">{item.label}</span>
            </Link>
          );
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              isActive ? 'text-teal-600 font-bold' : 'text-slate-500 font-medium hover:text-slate-800'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
};
