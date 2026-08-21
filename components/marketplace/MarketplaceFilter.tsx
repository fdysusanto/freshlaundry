'use client';

import React from 'react';
import { Search, ArrowUpDown, Check, X, MapPin, Sparkles, Navigation } from 'lucide-react';

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
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 absolute left-4 text-teal-600 shrink-0 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama mitra laundry, area, atau layanan (Cuci Kiloan, Express, Dry Clean)..."
          className="w-full pl-11 pr-10 py-3 bg-slate-50 text-xs sm:text-sm font-semibold rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all placeholder:text-slate-400"
          aria-label="Cari nama laundry atau lokasi"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label="Hapus kata kunci pencarian"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Options Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Terdekat Filter */}
          <button
            type="button"
            onClick={() => {
              const next = !onlyNearby;
              setOnlyNearby(next);
              if (next) setSortBy('distance');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              onlyNearby || sortBy === 'distance'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Terdekat</span>
          </button>

          {/* Buka Sekarang Filter */}
          <button
            type="button"
            onClick={() => setOnlyOpen(!onlyOpen)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              onlyOpen
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {onlyOpen && <Check className="w-3.5 h-3.5" />}
            <span>Buka Sekarang</span>
          </button>

          {/* Rating 4.8+ Filter */}
          <button
            type="button"
            onClick={() => setMinRating(minRating === 4.8 ? 0 : 4.8)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              minRating > 0
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>★ Rating 4.8+</span>
          </button>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
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
      </div>

      {/* Result Count & Reset Filter */}
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 pt-1">
        <span>Menampilkan <strong>{totalResults}</strong> Mitra Laundry</span>
        {(searchQuery || onlyOpen || minRating > 0 || onlyNearby || sortBy !== 'recommended') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSortBy('recommended');
              setOnlyOpen(false);
              setMinRating(0);
              setOnlyNearby(false);
            }}
            className="text-teal-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Reset Filter
          </button>
        )}
      </div>
    </div>
  );
};
