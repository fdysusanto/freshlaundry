'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { marketplaceService } from '@/services/marketplaceService';
import { useLocationState } from '@/hooks/useLocationState';
import { LaundryMarketplaceItem } from '@/types/laundry';
import { LocationPickerHeader } from '@/components/marketplace/LocationPickerHeader';
import { MarketplaceFilter, SortOption } from '@/components/marketplace/MarketplaceFilter';
import { LaundryPartnerCard } from '@/components/marketplace/LaundryPartnerCard';
import { LaundryCardSkeleton } from '@/components/ui/MarketplaceSkeleton';
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

      if (locationState.user && (locationState.user as any).latitude) {
        userLat = Number((locationState.user as any).latitude);
        userLng = Number((locationState.user as any).longitude);
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
  }, [locationState.user]);

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

  const hasLocationAvailable = Boolean(locationState.displayLocation && locationState.searchLocation);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 pb-24 md:pb-10">
      {/* Location Picker Header */}
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
        <div className="p-6 bg-rose-50 rounded-3xl border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-rose-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
            <div>
              <h3 className="font-bold text-sm">Gagal Memuat Mitra Laundry</h3>
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

      {/* Results Header & Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Store className="w-6 h-6 text-teal-600 shrink-0" />
              <span>
                {searchQuery
                  ? `Hasil Pencarian untuk "${searchQuery}"`
                  : 'Temukan mitra laundry di sekitar Anda'}
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>
                {hasLocationAvailable
                  ? `📍 Area: ${locationState.displayLocation}`
                  : 'Menampilkan seluruh mitra laundry aktif di platform FreshWash'}
              </span>
            </p>
          </div>
        </div>

        {/* LOADING SKELETON GRID */}
        {isLoading ? (
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
          <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center space-y-4 shadow-sm">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">Tidak menemukan mitra laundry</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Coba gunakan nama laundry, area, atau kata kunci layanan yang berbeda.
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
              className="cursor-pointer"
            >
              Hapus Filter &amp; Tampilkan Semua
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerLaundriesPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-4">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Memuat halaman pencarian laundry...</p>
        </div>
      }
    >
      <CustomerLaundriesContent />
    </Suspense>
  );
}
