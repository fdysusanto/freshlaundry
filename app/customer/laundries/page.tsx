'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { marketplaceService } from '@/services/marketplaceService';
import { useLocationState } from '@/hooks/useLocationState';
import { LaundryMarketplaceItem, ServiceCategory, CANONICAL_SERVICE_CATEGORIES } from '@/types/laundry';
import { LaundryPartnerCard } from '@/components/marketplace/LaundryPartnerCard';
import { LaundryCardSkeleton } from '@/components/ui/MarketplaceSkeleton';
import { Modal } from '@/components/ui/Modal';
import { Store, AlertCircle, RefreshCw, Search, SlidersHorizontal, ArrowUpDown, X, Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export type CategoryFilterType = 'Semua' | ServiceCategory;
export type SortOptionType = 'relevance' | 'distance' | 'cheapest' | 'rating';

const SORT_LABELS: Record<SortOptionType, string> = {
  relevance: 'Relevan',
  distance: 'Terdekat',
  cheapest: 'Termurah',
  rating: 'Rating Tertinggi',
};

function CustomerLaundriesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Internal Location State (Used behind the scenes for lat/lng distance calculation)
  const locationState = useLocationState();

  // Read initial search value from URL query parameters
  const initialSearchParam = searchParams.get('search') || searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(initialSearchParam);
  const [marketplaceItems, setMarketplaceItems] = useState<LaundryMarketplaceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter States
  const [filterCategory, setFilterCategory] = useState<CategoryFilterType>('Semua');
  const [filterDistance, setFilterDistance] = useState<'all' | '1' | '3' | '5' | '10'>('all');
  const [filterRating, setFilterRating] = useState<'all' | '4.0' | '4.5'>('all');
  const [filterOpenNow, setFilterOpenNow] = useState<boolean>(false);

  // Sort State (Default: 'relevance')
  const [sortBy, setSortBy] = useState<SortOptionType>('relevance');

  // Modal Control States
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);

  // Draft filter state inside modal before applying
  const [tempCategory, setTempCategory] = useState<CategoryFilterType>(filterCategory);
  const [tempDistance, setTempDistance] = useState<'all' | '1' | '3' | '5' | '10'>(filterDistance);
  const [tempRating, setTempRating] = useState<'all' | '4.0' | '4.5'>(filterRating);
  const [tempOpenNow, setTempOpenNow] = useState<boolean>(filterOpenNow);

  // Sync search query if URL parameter changes
  useEffect(() => {
    if (initialSearchParam) setSearchQuery(initialSearchParam);
  }, [initialSearchParam]);

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

  // Load Marketplace Partners via marketplaceService (using lat/lng internally if available)
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

  // Count active filters (excluding default 'relevance' sort)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterCategory !== 'Semua') count++;
    if (filterDistance !== 'all') count++;
    if (filterRating !== 'all') count++;
    if (filterOpenNow) count++;
    return count;
  }, [filterCategory, filterDistance, filterRating, filterOpenNow]);

  // Reset all filters & search query
  const resetAllFilters = () => {
    setFilterCategory('Semua');
    setFilterDistance('all');
    setFilterRating('all');
    setFilterOpenNow(false);
    setSearchQuery('');
  };

  // Open Filter Modal & Sync temp values
  const handleOpenFilterModal = () => {
    setTempCategory(filterCategory);
    setTempDistance(filterDistance);
    setTempRating(filterRating);
    setTempOpenNow(filterOpenNow);
    setIsFilterModalOpen(true);
  };

  // Apply Modal Filters
  const handleApplyFilters = () => {
    setFilterCategory(tempCategory);
    setFilterDistance(tempDistance);
    setFilterRating(tempRating);
    setFilterOpenNow(tempOpenNow);
    setIsFilterModalOpen(false);
  };

  // Reset Modal Draft Filters
  const handleResetTempFilters = () => {
    setTempCategory('Semua');
    setTempDistance('all');
    setTempRating('all');
    setTempOpenNow(false);
  };

  // Filter & Search Items Logic
  const filteredItems = useMemo(() => {
    return marketplaceItems
      .filter((item) => {
        const { laundry, badge, rating, distanceKm, serviceCategories } = item;
        const q = searchQuery.toLowerCase().trim();

        // 1. Keyword Search matching name, address, code, description, badge
        const matchesSearch =
          !q ||
          laundry.name.toLowerCase().includes(q) ||
          laundry.address.toLowerCase().includes(q) ||
          laundry.code.toLowerCase().includes(q) ||
          laundry.description?.toLowerCase().includes(q) ||
          badge?.toLowerCase().includes(q);

        // 2. Category Filter
        const matchesCategory =
          filterCategory === 'Semua' ||
          (serviceCategories && serviceCategories.includes(filterCategory as ServiceCategory));

        // 3. Open Now Filter
        const matchesOpenNow = !filterOpenNow || laundry.isOpen;

        // 4. Distance Filter
        let matchesDistance = true;
        if (filterDistance !== 'all' && distanceKm !== undefined) {
          const maxKm = parseFloat(filterDistance);
          matchesDistance = distanceKm <= maxKm;
        }

        // 5. Rating Filter
        let matchesRating = true;
        if (filterRating !== 'all') {
          const minRating = parseFloat(filterRating);
          matchesRating = rating >= minRating;
        }

        return matchesSearch && matchesCategory && matchesOpenNow && matchesDistance && matchesRating;
      })
      .sort((a, b) => {
        // Sorting Logic
        if (sortBy === 'distance') {
          if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
            return a.distanceKm - b.distanceKm;
          }
          if (a.distanceKm !== undefined) return -1;
          if (b.distanceKm !== undefined) return 1;
        } else if (sortBy === 'cheapest') {
          const priceA = a.cheapestPrice ?? Infinity;
          const priceB = b.cheapestPrice ?? Infinity;
          if (priceA !== priceB) return priceA - priceB;
        } else if (sortBy === 'rating') {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return b.reviewCount - a.reviewCount;
        }

        // Default 'relevance': Distance if available, then rating & reviews
        if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
          return a.distanceKm - b.distanceKm;
        }
        if (a.distanceKm !== undefined) return -1;
        if (b.distanceKm !== undefined) return 1;
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.reviewCount - a.reviewCount;
      });
  }, [marketplaceItems, searchQuery, filterCategory, filterOpenNow, filterDistance, filterRating, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 pb-24 md:pb-12">
      
      {/* 1. Header / Page Title */}
      <div className="space-y-0.5 max-w-4xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Cari Laundry
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Temukan mitra laundry terbaik untuk kebutuhan pencucian Anda
        </p>
      </div>

      {/* 2. Main Search Input */}
      <div className="relative w-full max-w-4xl mx-auto">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
          <Search className="w-4 h-4 text-slate-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari laundry atau layanan..."
          className="w-full h-11 sm:h-12 pl-10 pr-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs focus:outline-none focus:ring-2 focus:ring-brand-primary text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs text-slate-400 hover:text-slate-600 font-bold z-10 cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* 3. Filter & Sort Toolbar */}
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2.5">
        {/* Filter Button */}
        <button
          type="button"
          onClick={handleOpenFilterModal}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
            activeFilterCount > 0
              ? 'bg-brand-surface border-brand-primary text-brand-primary ring-1 ring-brand-primary/20'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          <span>Filter</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-brand-primary text-white text-[10px] font-black flex items-center justify-center shrink-0">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Sort Button */}
        <button
          type="button"
          onClick={() => setIsSortModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
        >
          <ArrowUpDown className="w-3.5 h-3.5 shrink-0 text-slate-500" />
          <span>{SORT_LABELS[sortBy]}</span>
          <span className="text-slate-400 text-[10px] ml-0.5">▾</span>
        </button>
      </div>

      {/* 4. Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-1.5 pt-0.5">
          {filterCategory !== 'Semua' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-surface text-brand-primary border border-brand-primary/20 text-xs font-bold">
              <span>{filterCategory}</span>
              <button
                type="button"
                onClick={() => setFilterCategory('Semua')}
                className="hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filterDistance !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold">
              <span>≤ {filterDistance} km</span>
              <button
                type="button"
                onClick={() => setFilterDistance('all')}
                className="hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filterRating !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
              <span>★ {filterRating}+</span>
              <button
                type="button"
                onClick={() => setFilterRating('all')}
                className="hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filterOpenNow && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              <span>Buka sekarang</span>
              <button
                type="button"
                onClick={() => setFilterOpenNow(false)}
                className="hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={resetAllFilters}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 underline ml-1 cursor-pointer"
          >
            Reset Semua
          </button>
        </div>
      )}

      {/* ERROR STATE */}
      {errorMessage && (
        <div className="max-w-4xl mx-auto p-4 bg-rose-50 rounded-2xl border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-rose-800">
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
            className="border-rose-300 text-rose-700 hover:bg-rose-100 text-xs font-semibold"
          >
            Coba Lagi
          </Button>
        </div>
      )}

      {/* 5. Section Title & Laundry Partner Cards */}
      <div className="space-y-3 max-w-4xl mx-auto pt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Store className="w-5 h-5 text-brand-primary shrink-0" />
            <span>Laundry</span>
          </h2>
          {!isLoading && (
            <span className="text-xs font-semibold text-slate-500">
              {filteredItems.length} mitra ditemukan
            </span>
          )}
        </div>

        {/* LOADING SKELETON LIST */}
        {isLoading ? (
          <div className="flex flex-col gap-3.5">
            {[1, 2, 3, 4].map((i) => (
              <LaundryCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          /* RESPONSIVE VERTICAL LIST (LaundryPartnerCard) */
          <div className="flex flex-col gap-3.5">
            {filteredItems.map((item) => (
              <LaundryPartnerCard key={item.laundry.id} item={item} />
            ))}
          </div>
        ) : (
          /* EMPTY SEARCH RESULT STATE */
          <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center space-y-4 shadow-xs">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">
                Laundry tidak ditemukan
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Coba ubah kata kunci pencarian atau sesuaikan filter Anda.
              </p>
            </div>
            {(activeFilterCount > 0 || searchQuery) && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetAllFilters}
                className="cursor-pointer text-xs font-bold"
              >
                Reset Filter
              </Button>
            )}
          </div>
        )}
      </div>

      {/* FILTER MODAL / BOTTOM SHEET */}
      <Modal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Filter Laundry"
        maxWidth="md"
      >
        <div className="space-y-6">
          {/* Section Kategori */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2.5">
              Kategori Layanan
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTempCategory('Semua')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  tempCategory === 'Semua'
                    ? 'bg-brand-primary text-white border-brand-primary shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Semua
              </button>
              {CANONICAL_SERVICE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTempCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    tempCategory === cat
                      ? 'bg-brand-primary text-white border-brand-primary shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Section Jarak */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2.5">
              Jarak Maksimal
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { value: 'all', label: 'Semua Jarak' },
                { value: '1', label: '≤ 1 km' },
                { value: '3', label: '≤ 3 km' },
                { value: '5', label: '≤ 5 km' },
                { value: '10', label: '≤ 10 km' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTempDistance(opt.value as any)}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    tempDistance === opt.value
                      ? 'bg-brand-surface border-brand-primary text-brand-primary ring-1 ring-brand-primary/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section Rating */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2.5">
              Rating Minimal
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'all', label: 'Semua Rating' },
                { value: '4.0', label: '4.0+ ★' },
                { value: '4.5', label: '4.5+ ★' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTempRating(opt.value as any)}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    tempRating === opt.value
                      ? 'bg-amber-50 border-amber-400 text-amber-900 ring-1 ring-amber-400/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section Status Operasional */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2.5">
              Status Operasional
            </label>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={tempOpenNow}
                onChange={(e) => setTempOpenNow(e.target.checked)}
                className="w-4 h-4 rounded-xs border-slate-300 text-brand-primary focus:ring-brand-primary"
              />
              <span className="text-xs font-bold text-slate-800">Buka sekarang saja</span>
            </label>
          </div>

          {/* Modal Action Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetTempFilters}
              className="text-xs font-bold border-slate-300 text-slate-600"
            >
              Reset Filter
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleApplyFilters}
              className="text-xs font-extrabold px-6"
            >
              Terapkan Filter
            </Button>
          </div>
        </div>
      </Modal>

      {/* SORTING MODAL / BOTTOM SHEET */}
      <Modal
        isOpen={isSortModalOpen}
        onClose={() => setIsSortModalOpen(false)}
        title="Urutkan Berdasarkan"
        maxWidth="sm"
      >
        <div className="space-y-2">
          {[
            { id: 'relevance', title: 'Relevan', desc: 'Kombinasi jarak dan ulasan terbaik (Default)' },
            { id: 'distance', title: 'Terdekat', desc: 'Diurutkan dari jarak terdekat ke Anda' },
            { id: 'cheapest', title: 'Termurah', desc: 'Diurutkan dari estimasi harga mulai terendah' },
            { id: 'rating', title: 'Rating Tertinggi', desc: 'Diurutkan dari rating dan ulasan terbanyak' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setSortBy(opt.id as SortOptionType);
                setIsSortModalOpen(false);
              }}
              className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                sortBy === opt.id
                  ? 'border-brand-primary bg-brand-surface ring-1 ring-brand-primary/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="space-y-0.5">
                <p className="text-xs font-extrabold text-slate-900">{opt.title}</p>
                <p className="text-[11px] text-slate-500 font-medium">{opt.desc}</p>
              </div>
              {sortBy === opt.id && (
                <Check className="w-4 h-4 text-brand-primary shrink-0" />
              )}
            </button>
          ))}
        </div>
      </Modal>

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
