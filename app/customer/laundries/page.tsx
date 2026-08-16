'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { DEMO_LAUNDRIES, ExtendedLaundry } from '@/utils/constants';
import { laundryService } from '@/services/laundryService';
import { isSupabaseConfigured } from '@/services/supabase';
import { Laundry } from '@/types/laundry';
import { LocationPickerHeader } from '@/components/marketplace/LocationPickerHeader';
import { MarketplaceFilter, SortOption } from '@/components/marketplace/MarketplaceFilter';
import { LaundryCard } from '@/components/marketplace/LaundryCard';
import { Store, AlertCircle } from 'lucide-react';

export default function CustomerLaundriesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [minRating, setMinRating] = useState(0);
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
          else router.push('/');
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
          if (typeof window !== 'undefined') {
            console.log('[LIVE-DATA-DIAGNOSTIC]', {
              source: 'supabase',
              isSupabaseConfigured: true,
              laundryCount: liveData.length,
              laundryNames: liveData.map((l) => l.name),
            });
          }
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
        console.warn('Gagal memuat laundry Supabase:', err);
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

  const filteredLaundries = useMemo(() => {
    return laundries.filter((laundry) => {
      // Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        laundry.name.toLowerCase().includes(q) ||
        laundry.address.toLowerCase().includes(q) ||
        laundry.description?.toLowerCase().includes(q);

      // Open Filter
      const matchesOpen = !onlyOpen || laundry.isOpen;

      // Min Rating Filter
      const matchesRating = !minRating || laundry.rating >= minRating;

      return matchesSearch && matchesOpen && matchesRating;
    }).sort((a, b) => {
      if (sortBy === 'distance') return a.distanceKm - b.distanceKm;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'price_low') return a.startingPrice - b.startingPrice;
      if (sortBy === 'speed') return a.estPickupMinutes - b.estPickupMinutes;
      // Default recommended
      return b.rating * 10 - a.distanceKm;
    });
  }, [laundries, searchQuery, sortBy, onlyOpen, minRating]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* Location & Banner Header */}
      <LocationPickerHeader
        onTagClick={(tag) => setSearchQuery(tag)}
      />

      {/* Search & Multi-Filter Toolbar */}
      <MarketplaceFilter
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onlyOpen={onlyOpen}
        setOnlyOpen={setOnlyOpen}
        minRating={minRating}
        setMinRating={setMinRating}
        totalResults={filteredLaundries.length}
      />

      {/* Grid List of Laundries */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Store className="w-5 h-5 text-teal-600" />
            <span>Mitra Laundry Terpercaya ({filteredLaundries.length})</span>
          </h2>
        </div>

        {filteredLaundries.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLaundries.map((laundry) => (
              <LaundryCard key={laundry.id} laundry={laundry} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-base font-bold text-slate-800">Mitra Laundry Tidak Ditemukan</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Tidak ada mitra laundry yang cocok dengan kriteria kata kunci `{searchQuery}` atau filter yang Anda pilih. Coba sesuaikan kata kunci atau reset filter.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setOnlyOpen(false);
                setMinRating(0);
                setSortBy('recommended');
              }}
              className="mt-2 text-xs font-bold px-4 py-2 bg-teal-50 text-teal-700 rounded-xl hover:bg-teal-100 transition-colors"
            >
              Tampilkan Semua Laundry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
