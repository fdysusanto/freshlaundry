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
import { MarketplaceLocationModal } from '@/components/marketplace/MarketplaceLocationModal';
import { LaundryPartnerCard } from '@/components/marketplace/LaundryPartnerCard';
import { HorizontalCardCarousel } from '@/components/marketplace/HorizontalCardCarousel';
import { MarketplaceSectionSkeleton } from '@/components/ui/MarketplaceSkeleton';
import { LocationRequiredCard } from '@/components/marketplace/LocationRequiredCard';
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
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);


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
      let userLat: number | null = null;
      let userLng: number | null = null;

      if (
        locationState.marketplaceLocation.latitude !== null &&
        locationState.marketplaceLocation.longitude !== null
      ) {
        userLat = Number(locationState.marketplaceLocation.latitude);
        userLng = Number(locationState.marketplaceLocation.longitude);
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
  }, [locationState.marketplaceLocation.latitude, locationState.marketplaceLocation.longitude]);

  useEffect(() => {
    loadMarketplaceData();
  }, [loadMarketplaceData]);

  // Section 1: "Mitra laundry terdekat" - Sorted primarily by distance ascending if available
  const nearestPartners = useMemo(() => {
    return [...marketplaceItems].sort((a, b) => {
      if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
        return a.distanceKm - b.distanceKm;
      }
      return 0;
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

  const hasLocationAvailable = Boolean(
    locationState.marketplaceLocation.latitude !== null &&
    locationState.marketplaceLocation.longitude !== null
  );

  const activeRadiusKm = (marketplaceItems as any).activeRadiusKm ?? 10;

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

        {/* RULE 1: LOCATION REQUIRED BLOCKING */}
        {!hasLocationAvailable && !isLoading && !locationState.isLocating ? (
          <LocationRequiredCard
            onRequestGps={() => locationState.requestGpsLocation()}
            onOpenMapModal={() => setIsLocationModalOpen(true)}
            isLocating={locationState.isLocating}
          />
        ) : (

          <>
            {/* SECTION 1: Mitra laundry terdekat */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      Mitra laundry terdekat
                    </h2>
                    {hasLocationAvailable && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-teal-100 text-teal-800 border border-teal-200">
                        Radius {activeRadiusKm} km
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>
                      {locationState.marketplaceLocation.source === 'current_gps'
                        ? `📍 Berdasarkan Lokasi GPS Perangkat Saat Ini (Radius ${activeRadiusKm} km)`
                        : locationState.marketplaceLocation.source === 'manual_pin'
                        ? `📍 ${locationState.marketplaceLocation.displayAddress || 'Lokasi Pilihan di Peta'} (Radius ${activeRadiusKm} km)`
                        : '📍 Tentukan lokasi Anda untuk melihat laundry terdekat'}
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

              {isLoading || locationState.isLocating ? (
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
                  <p className="text-sm font-bold text-slate-700">Tidak ada mitra laundry dalam radius 10 km dari lokasi ini.</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Coba atur ulang titik lokasi pada peta ke area lain atau gunakan lokasi GPS perangkat Anda.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => locationState.resetToGps()}
                    className="cursor-pointer text-xs"
                  >
                    Gunakan Lokasi GPS Saya
                  </Button>
                </div>
              )}
            </div>

            {/* SECTION 2: Laundry pilihan di sekitar Anda */}
            {topRatedPartners.length > 0 && (
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
                ) : (
                  <HorizontalCardCarousel>
                    {topRatedPartners.map((item) => (
                      <LaundryPartnerCard key={`toprated-${item.laundry.id}`} item={item} />
                    ))}
                  </HorizontalCardCarousel>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Trust & Process Features (Desktop) */}
      <div className="hidden md:block">
        <Features />
        <HowItWorks />
        <CTA />
      </div>
      {/* Unified Marketplace Location Modal */}
      <MarketplaceLocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        initialLat={locationState.marketplaceLocation.latitude}
        initialLng={locationState.marketplaceLocation.longitude}
        isGpsActive={locationState.marketplaceLocation.source === 'current_gps'}
        onSelectManualPin={(lat, lng, displayAddress) => {
          locationState.setManualPinLocation(lat, lng, displayAddress);
        }}
        onResetToGps={() => {
          locationState.resetToGps();
        }}
      />
    </div>
  );
}

