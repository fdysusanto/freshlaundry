'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { marketplaceService } from '@/services/marketplaceService';
import { useLocationState } from '@/hooks/useLocationState';
import { LaundryMarketplaceItem } from '@/types/laundry';
import { LocationPickerHeader } from '@/components/marketplace/LocationPickerHeader';
import { MarketplaceLocationModal } from '@/components/marketplace/MarketplaceLocationModal';
import { MarketplaceFilter, SortOption } from '@/components/marketplace/MarketplaceFilter';
import { LaundryPartnerCard } from '@/components/marketplace/LaundryPartnerCard';
import { LaundryCardSkeleton } from '@/components/ui/MarketplaceSkeleton';
import { LocationRequiredCard } from '@/components/marketplace/LocationRequiredCard';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Store, AlertCircle, RefreshCw, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';

function CustomerLaundriesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationState = useLocationState();

  // Read initial values from URL query parameters
  const initialSearchParam = searchParams.get('search') || searchParams.get('q') || '';
  const initialSortParam = (searchParams.get('sort') as SortOption) || 'recommended';

  const [searchQuery, setSearchQuery] = useState(initialSearchParam);
  const [sortBy, setSortBy] = useState<SortOption>(initialSortParam);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [onlyNearby, setOnlyNearby] = useState(false);

  const [marketplaceItems, setMarketplaceItems] = useState<LaundryMarketplaceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);


  // Sync state if URL query param changes
  useEffect(() => {
    if (initialSearchParam) setSearchQuery(initialSearchParam);
    if (initialSortParam) setSortBy(initialSortParam);
  }, [initialSearchParam, initialSortParam]);

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
          else router.push('/');
        }
      }
    };
    checkRoleGuard();
    return () => {
      isMounted = false;
    };
  }, [router]);

  // Load Marketplace Partners via marketplaceService
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
      console.error('[CUSTOMER-LAUNDRIES-PAGE] Error loading marketplace data:', err);
      setErrorMessage(err.message || 'Gagal memuat daftar mitra laundry.');
      setMarketplaceItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [locationState.marketplaceLocation.latitude, locationState.marketplaceLocation.longitude]);

  useEffect(() => {
    loadMarketplaceData();
  }, [loadMarketplaceData]);

  // Filter & Sort Items
  const filteredItems = useMemo(() => {
    return marketplaceItems
      .filter((item) => {
        const { laundry, cheapestPrice, badge } = item;
        const q = searchQuery.toLowerCase().trim();

        // Keyword Search matching name, address, badge, code
        const matchesSearch =
          !q ||
          laundry.name.toLowerCase().includes(q) ||
          laundry.address.toLowerCase().includes(q) ||
          laundry.code.toLowerCase().includes(q) ||
          laundry.description?.toLowerCase().includes(q) ||
          badge?.toLowerCase().includes(q);

        // Open Filter
        const matchesOpen = !onlyOpen || laundry.isOpen;

        // Min Rating Filter
        const matchesRating = !minRating || item.rating >= minRating;

        // Nearby Filter (must have distanceKm defined)
        const matchesNearby = !onlyNearby || item.distanceKm !== undefined;

        return matchesSearch && matchesOpen && matchesRating && matchesNearby;
      })
      .sort((a, b) => {
        if (sortBy === 'distance') {
          if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
            return a.distanceKm - b.distanceKm;
          }
          if (a.distanceKm !== undefined) return -1;
          if (b.distanceKm !== undefined) return 1;
        }

        if (sortBy === 'rating') {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return b.reviewCount - a.reviewCount;
        }

        if (sortBy === 'price_low') {
          const priceA = a.cheapestPrice ?? Infinity;
          const priceB = b.cheapestPrice ?? Infinity;
          return priceA - priceB;
        }

        // Default recommended sort (Rating & reviews)
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.reviewCount - a.reviewCount;
      });
  }, [marketplaceItems, searchQuery, sortBy, onlyOpen, minRating, onlyNearby]);

  const hasLocationAvailable = Boolean(
    locationState.marketplaceLocation.latitude !== null &&
    locationState.marketplaceLocation.longitude !== null
  );

  const activeRadiusKm = (marketplaceItems as any).activeRadiusKm ?? 10;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 pb-24 md:pb-12">
      {/* Location & Compact Header */}
      <LocationPickerHeader
        onTagClick={(tag) => setSearchQuery(tag)}
      />

      {/* Search & Filter Toolbar */}
      <MarketplaceFilter
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onlyOpen={onlyOpen}
        setOnlyOpen={setOnlyOpen}
        minRating={minRating}
        setMinRating={setMinRating}
        onlyNearby={onlyNearby}
        setOnlyNearby={setOnlyNearby}
        totalResults={filteredItems.length}
      />

      {/* ERROR STATE */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-rose-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <h3 className="font-bold text-xs">Gagal Memuat Mitra Laundry</h3>
              <p className="text-xs text-rose-600">{errorMessage}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadMarketplaceData}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            className="border-rose-300 text-rose-700 hover:bg-rose-100 text-xs"
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
        /* Results Section Header & Grid */
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Store className="w-5 h-5 text-brand-primary shrink-0" />
                  <span>
                    {searchQuery ? `Hasil Pencarian "${searchQuery}"` : 'Laundry Terdekat'}
                  </span>
                </h2>
                {hasLocationAvailable && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-brand-surface text-brand-primary border border-brand-primary/30">
                    Radius {activeRadiusKm} km
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {filteredItems.length} laundry tersedia dalam radius {activeRadiusKm} km
              </p>
            </div>
          </div>

          {/* LOADING SKELETON GRID */}
          {isLoading || locationState.isLocating ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <LaundryCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredItems.length > 0 ? (
            /* RESPONSIVE VERTICAL GRID (2 col mobile, 2 tablet, 3 lg, 4 xl) */
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {filteredItems.map((item) => (
                <LaundryPartnerCard key={item.laundry.id} item={item} />
              ))}
            </div>
          ) : (
            /* EMPTY SEARCH RESULT STATE */
            <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center space-y-4 shadow-xs">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">Tidak menemukan mitra laundry</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Coba atur ulang titik lokasi pada peta atau gunakan kata kunci pencarian yang berbeda.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSortBy('recommended');
                  setOnlyOpen(false);
                  setMinRating(0);
                  setOnlyNearby(false);
                }}
                className="cursor-pointer text-xs"
              >
                Hapus Filter &amp; Tampilkan Semua
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Low-Priority Partner Conversion Card (Absolute Bottom of Page) */}
      <div className="pt-8 border-t border-slate-200/80">
        <Card variant="white" className="p-4 border-slate-200 bg-slate-50/80 shadow-none space-y-3 max-w-3xl mx-auto">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-surface text-brand-primary flex items-center justify-center shrink-0 mt-0.5">
              <Store className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-slate-800">🏪 Punya Usaha Laundry?</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Daftarkan laundry Anda dan mulai menerima pesanan dari pelanggan FreshLaundry.
              </p>
            </div>
          </div>
          <div className="pt-1 flex justify-end">
            <Link href="/register/partner">
              <Button variant="outline" size="sm" className="text-xs font-semibold text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-slate-900">
                Daftar sebagai Mitra
              </Button>
            </Link>
          </div>
        </Card>
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


export default function CustomerLaundriesPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-4">
          <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Memuat halaman pencarian laundry...</p>
        </div>
      }
    >
      <CustomerLaundriesContent />
    </Suspense>
  );
}
