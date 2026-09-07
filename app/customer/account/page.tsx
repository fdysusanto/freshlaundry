'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { UserProfile } from '@/types/user';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { partnerApplicationService, PartnerApplicationRecord } from '@/services/partnerApplicationService';
import {
  User,
  MapPin,
  History,
  Heart,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Phone,
  Mail,
  Store,
} from 'lucide-react';

export default function CustomerAccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [partnerApp, setPartnerApp] = useState<PartnerApplicationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        if (isSupabaseConfigured) {
          const profile = await authService.fetchCurrentProfile();
          if (!profile) {
            if (isMounted) router.push('/login');
            return;
          }
          if (profile.role !== 'customer') {
            if (isMounted) router.push('/');
            return;
          }
          if (isMounted) setUser(profile);
          const app = await partnerApplicationService.getMyPartnerApplicationAsync();
          if (isMounted) setPartnerApp(app);
        } else {
          const currentUser = authService.getCurrentUserSync();
          if (currentUser) {
            if (isMounted) setUser(currentUser);
            const app = await partnerApplicationService.getMyPartnerApplicationAsync();
            if (isMounted) setPartnerApp(app);
          } else {
            if (isMounted) router.push('/login');
          }
        }
      } catch (err) {
        console.warn('Failed loading account profile:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogout = async () => {
    if (!confirm('Apakah Anda yakin ingin keluar dari akun FreshLaundry?')) return;
    try {
      await authService.logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      router.push('/login');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-xs font-semibold text-slate-600">Memuat profil akun Anda...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6 pb-24 md:pb-12">
      {/* Title */}
      <div className="border-b border-slate-200 pb-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold mb-2">
          <User className="w-3.5 h-3.5 text-brand-primary" />
          <span>Personal Customer Center</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Akun Saya</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Kelola profil, alamat tersimpan, riwayat pesanan, dan laundry favorit Anda.
        </p>
      </div>

      {/* User Profile Card */}
      <Card variant="white" className="p-6 border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-brand-primary to-brand-secondary text-white font-black text-2xl flex items-center justify-center shrink-0 shadow-lg">
            {user?.fullName?.charAt(0)?.toUpperCase() || 'P'}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{user?.fullName || 'Pelanggan Setia'}</h2>
              <Badge variant="teal" size="sm" className="font-bold">
                CUSTOMER
              </Badge>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> {user?.email || 'email@example.com'}
            </p>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" /> {user?.phone || 'Nomor HP belum diisi'}
            </p>
          </div>
        </div>
      </Card>

      {/* Navigation Options List */}
      <div className="space-y-3">
        {/* Section 1: Customer Personal Details */}
        <Card variant="white" className="p-0 border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          <Link
            href="/customer/addresses"
            className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-surface text-brand-primary flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-primary transition-colors">
                  📍 Alamat Saya
                </h3>
                <p className="text-[11px] text-slate-500">Kelola lokasi penjemputan &amp; pengantaran</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-primary transition-colors" />
          </Link>
        </Card>

        {/* Section 2: Transaction & Favorites */}
        <Card variant="white" className="p-0 border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          <Link
            href="/customer/orders/history"
            className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-surface text-brand-primary flex items-center justify-center shrink-0">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-primary transition-colors">
                  📜 Riwayat Pesanan
                </h3>
                <p className="text-[11px] text-slate-500">Arsip pesanan laundry selesai dan dibatalkan</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-primary transition-colors" />
          </Link>

          <Link
            href="/customer/favorites"
            className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-rose-600 transition-colors">
                  ❤️ Laundry Favorit
                </h3>
                <p className="text-[11px] text-slate-500">Daftar outlet laundry langganan favorit Anda</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition-colors" />
          </Link>
        </Card>

        {/* Section 3: App Settings & Support */}
        <Card variant="white" className="p-0 border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">⚙️ Pengaturan</h3>
                <p className="text-[11px] text-slate-500">Keamanan akun dan notifikasi</p>
              </div>
            </div>
            <Badge variant="teal" size="sm" className="text-[10px]">Aktif</Badge>
          </div>

          <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">❓ Pusat Bantuan</h3>
                <p className="text-[11px] text-slate-500">Pertanyaan umum dan dukungan pelanggan</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </div>
        </Card>

        {/* Section 4: Low-Priority Partner Conversion Card (Customer / Guest Only) */}
        {(!user || user.role === 'customer') && (
          <Card variant="white" className="p-4 border-slate-200 bg-slate-50/80 shadow-none space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-surface text-brand-primary flex items-center justify-center shrink-0 mt-0.5 border border-brand-primary/20">
                <Store className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-800">🏪 Punya Usaha Laundry?</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Daftarkan laundry Anda dan mulai menerima pesanan dari pelanggan FreshLaundry.
                </p>
              </div>
            </div>
            <div className="pt-1 flex justify-end">
              {partnerApp?.status === 'pending' || partnerApp?.status === 'rejected' ? (
                <Link href="/register/partner/status">
                  <Button variant="outline" size="sm" className="text-xs font-semibold text-brand-primary border-brand-primary/30 hover:bg-brand-surface">
                    Lihat Status Pengajuan
                  </Button>
                </Link>
              ) : (
                <Link href="/register/partner">
                  <Button variant="outline" size="sm" className="text-xs font-semibold text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-slate-900">
                    Daftar sebagai Mitra
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        )}

        {/* Section 5: Logout CTA */}
        <Card variant="white" className="p-2 border-slate-200 shadow-sm">
          <button
            onClick={handleLogout}
            className="w-full p-3.5 rounded-xl hover:bg-rose-50 text-rose-600 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>🚪 Keluar dari Akun</span>
          </button>
        </Card>
      </div>
    </div>
  );
}
