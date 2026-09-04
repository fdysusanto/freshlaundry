'use client';

import React, { useState } from 'react';
import { Search, ArrowUpDown, Check, X, Navigation, Sparkles, SlidersHorizontal } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';

export type SortOption = 'recommended' | 'distance' | 'rating' | 'price_low';

interface MarketplaceFilterProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  onlyOpen: boolean;
  setOnlyOpen: (open: boolean) => void;
  minRating: number;
  setMinRating: (rating: number) => void;
  onlyNearby: boolean;
  setOnlyNearby: (nearby: boolean) => void;
  totalResults: number;
}

export const MarketplaceFilter: React.FC<MarketplaceFilterProps> = ({
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  onlyOpen,
  setOnlyOpen,
  minRating,
  setMinRating,
  onlyNearby,
  setOnlyNearby,
  totalResults,
}) => {
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  const activeFilterCount =
    (onlyOpen ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (onlyNearby ? 1 : 0) +
    (sortBy !== 'recommended' ? 1 : 0);

  const handleReset = () => {
    setSearchQuery('');
    setSortBy('recommended');
    setOnlyOpen(false);
    setMinRating(0);
    setOnlyNearby(false);
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-3 sm:p-5 shadow-xs space-y-3 sm:space-y-4">
      {/* Search Input Bar & Mobile Filter Trigger */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 flex items-center">
          <Search className="w-4 h-4 absolute left-3.5 text-teal-600 shrink-0 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama laundry, area, atau layanan..."
            className="w-full pl-10 pr-9 py-2.5 sm:py-3 bg-slate-50 text-xs sm:text-sm font-semibold rounded-xl sm:rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all placeholder:text-slate-400"
            aria-label="Cari nama laundry atau lokasi"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
              aria-label="Hapus kata kunci pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mobile Filter & Sort Button (Opens Bottom Sheet) */}
        <button
          type="button"
          onClick={() => setIsBottomSheetOpen(true)}
          className="sm:hidden px-3.5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer active:scale-95 transition-transform"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-teal-400" />
          <span>Filter</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-teal-500 text-slate-950 font-black text-[10px] flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Quick Filter Horizontal Chips (Mobile & Desktop) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {/* Terdekat Filter Chip */}
        <button
          type="button"
          onClick={() => {
            const next = !onlyNearby;
            setOnlyNearby(next);
            if (next) setSortBy('distance');
          }}
          className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
            onlyNearby || sortBy === 'distance'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Navigation className="w-3 h-3" />
          <span>Terdekat</span>
        </button>

        {/* Buka Sekarang Chip */}
        <button
          type="button"
          onClick={() => setOnlyOpen(!onlyOpen)}
          className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
            onlyOpen
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {onlyOpen && <Check className="w-3 h-3" />}
          <span>Buka Sekarang</span>
        </button>

        {/* Rating 4.8+ Chip */}
        <button
          type="button"
          onClick={() => setMinRating(minRating === 4.8 ? 0 : 4.8)}
          className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
            minRating > 0
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>★ Rating 4.8+</span>
        </button>
      </div>

      {/* DESKTOP FULL FILTER TOOLBAR (Hidden on Mobile) */}
      <div className="hidden sm:flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="text-xs font-semibold text-slate-500">
          Menampilkan <strong>{totalResults}</strong> Mitra Laundry
        </div>

        <div className="flex items-center gap-3">
          {/* Sort Select */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-xs font-bold bg-slate-50 text-slate-800 py-2 px-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="recommended">Rekomendasi Utama</option>
              <option value="distance">Jarak Terdekat</option>
              <option value="rating">Rating Tertinggi</option>
              <option value="price_low">Harga Termurah</option>
            </select>
          </div>

          {(searchQuery || onlyOpen || minRating > 0 || onlyNearby || sortBy !== 'recommended') && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-bold text-teal-700 hover:underline cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* MOBILE BOTTOM SHEET FOR FULL FILTER & SORT */}
      <BottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        title="Filter & Urutkan Laundry"
      >
        <div className="space-y-6">
          {/* Sort Options */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
              Urutkan Berdasarkan:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'recommended', label: 'Rekomendasi' },
                { id: 'distance', label: 'Jarak Terdekat' },
                { id: 'rating', label: 'Rating Tertinggi' },
                { id: 'price_low', label: 'Harga Termurah' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSortBy(opt.id as SortOption)}
                  className={`p-3 rounded-xl text-xs font-bold text-left border transition-all cursor-pointer ${
                    sortBy === opt.id
                      ? 'border-teal-600 bg-teal-50 text-teal-900 ring-2 ring-teal-500/20'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Operational Status */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
              Status Jam Buka:
            </label>
            <button
              type="button"
              onClick={() => setOnlyOpen(!onlyOpen)}
              className={`w-full p-3 rounded-xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
                onlyOpen
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <span>Hanya Tampilkan Laundry Buka</span>
              {onlyOpen && <Check className="w-4 h-4 text-emerald-600" />}
            </button>
          </div>

          {/* Minimum Rating */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
              Minimum Rating:
            </label>
            <div className="flex gap-2">
              {[0, 4.0, 4.5, 4.8].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setMinRating(r)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    minRating === r
                      ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {r === 0 ? 'Semua' : `★ ${r}+`}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleReset}
              className="flex-1 text-xs font-bold"
            >
              Reset Filter
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setIsBottomSheetOpen(false)}
              className="flex-1 bg-teal-600 hover:bg-teal-500 text-xs font-bold"
            >
              Terapkan ({totalResults} Mitra)
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
