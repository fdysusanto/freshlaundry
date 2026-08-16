'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { DEMO_LAUNDRIES, ExtendedLaundry } from '@/utils/constants';
import { laundryService } from '@/services/laundryService';
import { isSupabaseConfigured } from '@/services/supabase';
import { Laundry } from '@/types/laundry';
import { LocationPickerHeader } from '@/components/marketplace/LocationPickerHeader';
import { LaundryCard } from '@/components/marketplace/LaundryCard';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { CTA } from '@/components/landing/CTA';
import { Button } from '@/components/ui/Button';
import { Sparkles, ArrowRight, Truck, Search, AlertCircle } from 'lucide-react';

export default function LandingMarketplacePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [laundries, setLaundries] = useState<ExtendedLaundry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const checkRoleGuard = async () => {
      let currentRole: string | undefined;
      if (isSupabaseConfigured) {
        const liveProfile = await authService.fetchCurrentProfile();
        currentRole = liveProfile?.role;
      } else {
        const syncUser = authService.getCurrentUserSync();
        currentRole = syncUser?.role;
      }

      if (currentRole && currentRole !== 'customer') {
        if (isMounted) {
          if (currentRole === 'courier') router.push('/courier');
          else if (currentRole === 'laundry_owner' || currentRole === 'laundry_staff') router.push('/owner');
          else if (currentRole === 'admin' || currentRole === 'platform_admin') router.push('/admin');
        }
      }
    };
    checkRoleGuard();
    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    let isMounted = true;
    const loadLaundries = async () => {
      setIsLoading(true);
      try {
        if (isSupabaseConfigured) {
          const liveData: Laundry[] = await laundryService.getLaundriesAsync();
          const extended: ExtendedLaundry[] = liveData.map((l, index) => ({
            ...l,
            startingPrice: 10000,
            distanceKm: 1.2 + index * 0.5,
            estPickupMinutes: 30,
            badges: ['Terverifikasi', 'Supabase Live'],
          }));
          if (isMounted) setLaundries(extended);
        } else {
          if (isMounted) setLaundries(DEMO_LAUNDRIES);
        }
      } catch (err) {
        console.warn('Gagal memuat laundry Supabase di beranda:', err);
        if (isMounted && !isSupabaseConfigured) setLaundries(DEMO_LAUNDRIES);
        else if (isMounted) setLaundries([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadLaundries();
    return () => {
      isMounted = false;
    };
  }, []);

  // Top Laundries sorted by distance & rating
  const nearestLaundries = useMemo(() => laundries.slice(0, 3), [laundries]);
  const popularLaundries = useMemo(
    () => [...laundries].sort((a, b) => b.rating - a.rating).slice(0, 3),
    [laundries]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/customer/laundries?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="space-y-12 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Location & Marketplace Banner */}
        <LocationPickerHeader
          onTagClick={(tag) => router.push(`/customer/laundries?search=${encodeURIComponent(tag)}`)}
        />

        {/* Search & Quick CTA Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="bg-white p-3 sm:p-4 rounded-3xl border border-slate-200 shadow-lg flex flex-col sm:flex-row items-center gap-3"
        >
          <div className="flex-1 flex items-center gap-3 px-3 w-full">
            <Search className="w-5 h-5 text-teal-600 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama laundry mitra, area, atau jenis layanan (mis. Dry Clean, Express)..."
              className="w-full text-xs sm:text-sm font-semibold text-slate-800 focus:outline-hidden placeholder:text-slate-400"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 font-bold shrink-0 cursor-pointer"
          >
            Cari Laundry
          </Button>
        </form>

        {/* Section 1: Mitra Laundry Terdekat */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-teal-100 text-teal-800 text-xs font-bold mb-1">
                <Truck className="w-3.5 h-3.5" />
                <span>Pickup Kilat</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Mitra Laundry Terdekat dari Lokasi Anda
              </h2>
            </div>
            <Link
              href="/customer/laundries"
              className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1 shrink-0"
            >
              Lihat Semua ({laundries.length}) <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {nearestLaundries.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {nearestLaundries.map((laundry) => (
                <LaundryCard key={laundry.id} laundry={laundry} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Belum Ada Mitra Laundry</p>
              <p className="text-xs text-slate-500">Belum ada toko laundry aktif di lokasi ini.</p>
            </div>
          )}
        </div>

        {/* Section 2: Mitra Laundry Rating Tertinggi */}
        {popularLaundries.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-200/60">
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Rating Tertinggi</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Mitra Laundry Favorit Pelanggan
                </h2>
              </div>
              <Link
                href="/customer/laundries?sort=rating"
                className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1 shrink-0"
              >
                Lihat Urutan Rating <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {popularLaundries.map((laundry) => (
                <LaundryCard key={laundry.id} laundry={laundry} />
              ))}
            </div>
          </div>
        )}

        {/* Banner Callout Marketplace */}
        <div className="bg-gradient-to-r from-teal-800 to-cyan-900 rounded-3xl p-6 sm:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight">
              Punya Usaha Laundry? Bergabung Menjadi Mitra FreshWash!
            </h3>
            <p className="text-xs sm:text-sm text-slate-200 max-w-xl">
              Jangkau ribuan pelanggan baru di kota Anda. Dapatkan sistem order management, penugasan kurir otomatis, dan laporan omset real-time.
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push('/customer/laundries')}
            className="bg-white text-teal-950 font-black hover:bg-teal-50 hover:text-teal-900 shrink-0 cursor-pointer shadow-lg"
          >
            Jelajahi Marketplace
          </Button>
        </div>
      </div>

      {/* Trust & Process Features */}
      <Features />
      <HowItWorks />
      <CTA />
    </div>
  );
}
