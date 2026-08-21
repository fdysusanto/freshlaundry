'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LaundryMarketplaceItem } from '@/types/laundry';
import { formatIDR } from '@/utils/formatters';
import { useFavorites } from '@/hooks/useFavorites';
import { Star, MapPin, Heart, ShieldCheck } from 'lucide-react';

interface LaundryPartnerCardProps {
  item: LaundryMarketplaceItem;
}

const FALLBACK_STOREFRONT =
  'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80';

export const LaundryPartnerCard: React.FC<LaundryPartnerCardProps> = ({ item }) => {
  const { laundry, storefrontImageUrl, cheapestPrice, cheapestUnit, rating, reviewCount, distanceKm, badge } = item;
  const { isFavorite, toggleFavorite } = useFavorites();

  const [imgSrc, setImgSrc] = useState<string>(storefrontImageUrl || FALLBACK_STOREFRONT);
  const isFav = isFavorite(laundry.id);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(laundry.id);
  };

  // Format short location (e.g., extract district/city from address)
  const shortLocation = React.useMemo(() => {
    if (!laundry.address) return 'Kota Cirebon';
    const parts = laundry.address.split(',');
    if (parts.length >= 2) {
      return `${parts[parts.length - 2].trim()}, ${parts[parts.length - 1].trim()}`;
    }
    return laundry.address.trim();
  }, [laundry.address]);

  return (
    <Link href={`/customer/laundries/${laundry.id}`} className="block group h-full">
      <div className="bg-white rounded-3xl border border-slate-200/90 p-3.5 sm:p-4 shadow-xs hover:shadow-xl hover:border-teal-400/80 transition-all duration-300 flex flex-col justify-between h-full overflow-hidden relative">
        
        {/* Top Image Container with Favorite & Badges */}
        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 mb-3">
          <img
            src={imgSrc}
            alt={`Foto storefront ${laundry.name}`}
            loading="lazy"
            onError={() => setImgSrc(FALLBACK_STOREFRONT)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />

          {/* Gradient Overlay for Top Badges */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-slate-950/20 pointer-events-none" />

          {/* Top Left Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 z-10 pointer-events-none">
            {badge && (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900/85 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
                {badge}
              </span>
            )}
            {laundry.verificationStatus === 'verified' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-600/90 backdrop-blur-md text-white text-[10px] font-bold shadow-xs">
                <ShieldCheck className="w-3 h-3" />
                Terverifikasi
              </span>
            )}
          </div>

          {/* Top Right Heart Favorite Button */}
          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-label={isFav ? 'Hapus dari Favorit' : 'Tambah ke Favorit'}
            className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md hover:bg-white text-slate-700 hover:text-rose-500 flex items-center justify-center transition-all shadow-md active:scale-90 z-20 cursor-pointer"
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                isFav ? 'fill-rose-500 text-rose-500 scale-110' : 'text-slate-600 hover:text-rose-500'
              }`}
            />
          </button>

          {/* Bottom Left Status Badge */}
          <div className="absolute bottom-2.5 left-2.5 z-10">
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold backdrop-blur-md shadow-xs ${
                laundry.isOpen
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
              }`}
            >
              {laundry.isOpen ? '• Buka' : '• Tutup'}
            </span>
          </div>
        </div>

        {/* Card Content Area */}
        <div className="flex-1 flex flex-col justify-between space-y-2">
          <div className="space-y-1">
            {/* Laundry Title */}
            <h3 className="font-black text-slate-900 text-sm sm:text-base group-hover:text-teal-700 transition-colors line-clamp-1">
              {laundry.name}
            </h3>

            {/* Location & Optional Distance */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="line-clamp-1">{shortLocation}</span>
            </div>

            {/* Distance Info (ONLY rendered if distanceKm is present) */}
            {distanceKm !== undefined && (
              <p className="text-[11px] font-bold text-teal-700 pt-0.5">
                📍 {distanceKm} km dari Anda
              </p>
            )}
          </div>

          {/* Price & Rating Footer Row */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
            {/* Starting Price */}
            <div>
              {cheapestPrice !== undefined ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Mulai</span>
                  <span className="text-xs sm:text-sm font-black text-teal-800">
                    {formatIDR(cheapestPrice)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">/{cheapestUnit || 'kg'}</span>
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">Tarif Hubungi Mitra</span>
              )}
            </div>

            {/* Rating inline with price */}
            <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-xl border border-amber-200/80 text-xs font-bold text-amber-800 shrink-0">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
              <span>{rating.toFixed(1)}</span>
              {reviewCount > 0 && (
                <span className="text-[10px] font-normal text-slate-500">({reviewCount})</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
