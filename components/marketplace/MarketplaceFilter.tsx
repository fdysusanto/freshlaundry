'use client';

import React from 'react';
import { Search, Filter, ArrowUpDown, Check } from 'lucide-react';

export type SortOption = 'recommended' | 'distance' | 'rating' | 'price_low' | 'speed';

interface MarketplaceFilterProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  onlyOpen: boolean;
  setOnlyOpen: (open: boolean) => void;
  minRating: number;
  setMinRating: (rating: number) => void;
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
  totalResults,
}) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
      {/* Top Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama laundry atau jenis layanan (misal: Dry Clean, Express)..."
          className="w-full pl-11 pr-4 py-3 bg-slate-50 text-xs font-semibold rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all placeholder:text-slate-400"
        />
      </div>

      {/* Filter Options Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Buka Sahaja */}
          <button
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

          {/* Toggle Rating 4.5+ */}
          <button
            onClick={() => setMinRating(minRating === 4.8 ? 0 : 4.8)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              minRating > 0
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>★ Rating 4.8+</span>
          </button>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2 ml-auto">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-xs font-bold bg-slate-50 text-slate-700 py-1.5 px-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="recommended">Rekomendasi Utama</option>
            <option value="distance">Jarak Terdekat</option>
            <option value="rating">Rating Tertinggi</option>
            <option value="price_low">Harga Termurah</option>
            <option value="speed">Pickup Tercepat</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 pt-1">
        <span>Menampilkan {totalResults} Mitra Laundry Tersedia</span>
        {(searchQuery || onlyOpen || minRating > 0 || sortBy !== 'recommended') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSortBy('recommended');
              setOnlyOpen(false);
              setMinRating(0);
            }}
            className="text-teal-600 font-bold hover:underline cursor-pointer"
          >
            Reset Filter
          </button>
        )}
      </div>
    </div>
  );
};
