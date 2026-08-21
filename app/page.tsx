'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { marketplaceService } from '@/services/marketplaceService';
import { useLocationState } from '@/hooks/useLocationState';
import { LaundryMarketplaceItem } from '@/types/laundry';
import { LocationPickerHeader } from '@/components/marketplace/LocationPickerHeader';
import { LaundryPartnerCard } from '@/components/marketplace/LaundryPartnerCard';
import { HorizontalCardCarousel } from '@/components/marketplace/HorizontalCardCarousel';
import { MarketplaceSectionSkeleton } from '@/components/ui/MarketplaceSkeleton';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { CTA } from '@/components/landing/CTA';
import { Button } from '@/components/ui/Button';
import { Sparkles, ArrowRight, MapPin, Search, AlertCircle, RefreshCw, Store } from 'lucide-react';

export default function LandingMarketplacePage() {
  const router = useRouter();
  const locationState = useLocationState();
  const [searchQuery, setSearchQuery] = useState('');
  const [marketplaceItems, setMarketplaceItems] = useState<LaundryMarketplaceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Role Guard
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

  // Load Marketplace Partners
  const loadMarketplaceData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Determine if lat/lng are available from user address/location
      let userLat: number | null = null;
      let userLng: number | null = null;

      if (locationState.user && (locationState.user as any).latitude) {
        userLat = Number((locationState.user as any).latitude);
        userLng = Number((locationState.user as any).longitude);
      }

      const items = await marketplaceService.getNearbyLaundryPartnersAsync(userLat, userLng);
      setMarketplaceItems(items);
    } catch (err: any) {
      console.error('[MARKETPLACE-PAGE] Error loading marketplace data:', err);
      setErrorMessage(err.message || 'Gagal memuat daftar mitra laundry.');
      setMarketplaceItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [locationState.user]);

  useEffect(() => {
    loadMarketplaceData();
  }, [loadMarketplaceData]);

  // Section 1: "Mitra laundry terdekat" - Sorted primarily by distance ascending if available
  const nearestPartners = useMemo(() => {
    return [...marketplaceItems].sort((a, b) => {
      if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
        return a.distanceKm - b.distanceKm;
      }
      return 0; // retain default order if distance is not present
    });
  }, [marketplaceItems]);

  // Section 2: "Laundry pilihan di sekitar Anda" - Sorted by rating & review count & status
  const topRatedPartners = useMemo(() => {
    return [...marketplaceItems].sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.reviewCount - a.reviewCount;
    });
  }, [marketplaceItems]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/customer/laundries?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const hasLocationAvailable = Boolean(locationState.displayLocation && locationState.searchLocation);

  return (
    <div className="space-y-12 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Header Location & Marketplace Picker */}
        <LocationPickerHeader
          onTagClick={(tag) => router.push(`/customer/laundries?search=${encodeURIComponent(tag)}`)}
        />

        {/* Search Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="bg-white p-3 sm:p-4 rounded-3xl border border-slate-200 shadow-md hover:shadow-lg transition-shadow flex flex-col sm:flex-row items-center gap-3"
        >
          <div className="flex-1 flex items-center gap-3 px-3 w-full">
            <Search className="w-5 h-5 text-teal-600 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama mitra laundry, area, atau layanan (Kiloan, Express, Dry Clean)..."
              className="w-full text-xs sm:text-sm font-semibold text-slate-800 focus:outline-hidden placeholder:text-slate-400"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 font-bold shrink-0 cursor-pointer shadow-md"
          >
            Cari Laundry
          </Button>
        </form>

        {/* ERROR STATE */}
        {errorMessage && (
          <div className="p-6 bg-rose-50 rounded-3xl border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-rose-800">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
              <div>
                <h3 className="font-bold text-sm">Gagal Memuat Daftar Mitra Laundry</h3>
                <p className="text-xs text-rose-600">{errorMessage}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadMarketplaceData}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              className="border-rose-300 text-rose-700 hover:bg-rose-100"
            >
              Coba Lagi
            </Button>
          </div>
        )}

        {/* SECTION 1: Mitra laundry terdekat */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Mitra laundry terdekat</span>
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>
                  {hasLocationAvailable
                    ? `📍 Sekitar ${locationState.displayLocation}`
                    : 'Mitra pilihan di area sekitar Anda'}
                </span>
              </div>
            </div>

            <Link
              href="/customer/laundries"
              className="text-xs font-bold text-teal-700 hover:text-teal-600 hover:underline flex items-center gap-1 shrink-0"
            >
              Lihat Semua ({marketplaceItems.length}) <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {isLoading ? (
            <MarketplaceSectionSkeleton />
          ) : nearestPartners.length > 0 ? (
            <HorizontalCardCarousel>
              {nearestPartners.map((item) => (
                <LaundryPartnerCard key={`nearest-${item.laundry.id}`} item={item} />
              ))}
            </HorizontalCardCarousel>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
              <Store className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Tidak ada mitra laundry di sekitar Anda.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Coba ubah lokasi pencarian atau periksa kembali filter area Anda.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => locationState.updateSearchLocation('Kota Cirebon')}
                className="cursor-pointer"
              >
                Ubah Lokasi Pencarian
              </Button>
            </div>
          )}
        </div>

        {/* SECTION 2: Laundry pilihan di sekitar Anda */}
        <div className="space-y-4 pt-4 border-t border-slate-200/80">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Rating &amp; Favorit Pelanggan</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Laundry pilihan di sekitar Anda
              </h2>
            </div>

            <Link
              href="/customer/laundries?sort=rating"
              className="text-xs font-bold text-teal-700 hover:text-teal-600 hover:underline flex items-center gap-1 shrink-0"
            >
              Lihat Urutan Rating <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {isLoading ? (
            <MarketplaceSectionSkeleton />
          ) : topRatedPartners.length > 0 ? (
            <HorizontalCardCarousel>
              {topRatedPartners.map((item) => (
                <LaundryPartnerCard key={`toprated-${item.laundry.id}`} item={item} />
              ))}
            </HorizontalCardCarousel>
          ) : null}
        </div>

        {/* Callout Banner */}
        <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-cyan-950 rounded-3xl p-6 sm:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight">
              Punya Usaha Laundry? Bergabung Menjadi Mitra FreshWash!
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Jangkau pelanggan baru di kota Anda dengan sistem order management modern, kurir otomatis, dan manajemen katalog layanan.
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push('/auth/register/partner')}
            className="bg-white text-slate-950 font-black hover:bg-slate-100 shrink-0 cursor-pointer shadow-lg"
          >
            Daftar Mitra Laundry
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
