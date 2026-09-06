'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, ShoppingBag, Layers, User } from 'lucide-react';

export const OwnerMobileNavigation: React.FC = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTabFromUrl = searchParams.get('tab') || 'dashboard';

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      href: '/owner?tab=dashboard',
      icon: Home,
      isActive: pathname === '/owner' && (activeTabFromUrl === 'dashboard' || !activeTabFromUrl),
    },
    {
      id: 'orders',
      label: 'Pesanan',
      href: '/owner?tab=orders',
      icon: ShoppingBag,
      isActive: pathname === '/owner' && activeTabFromUrl === 'orders',
    },
    {
      id: 'services',
      label: 'Layanan',
      href: '/owner/services',
      icon: Layers,
      isActive: pathname.startsWith('/owner/services') || (pathname === '/owner' && activeTabFromUrl === 'services'),
    },
    {
      id: 'account',
      label: 'Akun',
      href: '/owner?tab=profile',
      icon: User,
      isActive: pathname === '/owner' && activeTabFromUrl === 'profile',
    },
  ];

  return (
    <nav
      aria-label="Owner Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center justify-around shadow-2xl"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-label={item.label}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-3 py-1 rounded-2xl transition-all ${
              item.isActive
                ? 'text-teal-700 font-black bg-teal-50/80 shadow-xs'
                : 'text-slate-500 font-medium hover:text-slate-800 active:scale-95'
            }`}
          >
            <Icon className={`w-5 h-5 transition-transform ${item.isActive ? 'scale-110' : ''}`} />
            <span className={`text-[10px] mt-0.5 tracking-tight ${item.isActive ? 'font-black' : 'font-semibold'}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};
