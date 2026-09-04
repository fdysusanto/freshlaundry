'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { LaundryMarketplaceItem } from '@/types/laundry';
import { formatIDR } from '@/utils/formatters';
import { useFavorites } from '@/hooks/useFavorites';
import { Star, MapPin, Heart, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';

interface LaundryPartnerCardProps {
  item: LaundryMarketplaceItem;
}

const FALLBACK_STOREFRONT =
  'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80';

export const LaundryPartnerCard: React.FC<LaundryPartnerCardProps> = ({ item }) => {
  const { laundry, storefrontImageUrl, cheapestPrice, cheapestUnit, rating, reviewCount, distanceKm, badge, photos } = item;
  const { isFavorite, toggleFavorite } = useFavorites();

  const isFav = isFavorite(laundry.id);

  // Derive all available photo URLs for swiping
  const photoUrls = useMemo(() => {
    if (photos && photos.length > 0) {
      return photos.map((p) => p.public_url);
    }
    return [storefrontImageUrl || FALLBACK_STOREFRONT];
  }, [photos, storefrontImageUrl]);

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(laundry.id);
  };

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev - 1 + photoUrls.length) % photoUrls.length);
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev + 1) % photoUrls.length);
  };

  const handleDotClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentPhotoIndex(index);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 30) {
      if (diff > 0) {
        // Swiped left -> next photo
        setCurrentPhotoIndex((prev) => (prev + 1) % photoUrls.length);
      } else {
        // Swiped right -> prev photo
        setCurrentPhotoIndex((prev) => (prev - 1 + photoUrls.length) % photoUrls.length);
      }
    }
    setTouchStartX(null);
  };

  // Format short location
  const shortLocation = useMemo(() => {
    if (!laundry.address) return 'Kota Cirebon';
    const parts = laundry.address.split(',');
    if (parts.length >= 2) {
      return `${parts[parts.length - 2].trim()}, ${parts[parts.length - 1].trim()}`;
    }
    return laundry.address.trim();
  }, [laundry.address]);

  const activePhotoUrl = photoUrls[currentPhotoIndex] || FALLBACK_STOREFRONT;

  return (
    <Link href={`/customer/laundries/${laundry.id}`} className="block group h-full">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-2.5 sm:p-4 shadow-xs hover:shadow-xl hover:border-teal-400/80 transition-all duration-300 flex flex-col justify-between h-full overflow-hidden relative">
        
        {/* Top Image Container with Swipeable Photo Gallery */}
        <div
          className="relative w-full aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 mb-2 sm:mb-3 select-none touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={activePhotoUrl}
            alt={`Foto storefront ${laundry.name}`}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = FALLBACK_STOREFRONT;
            }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-slate-950/20 pointer-events-none" />

          {/* Top Left Badges */}
          <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1 z-10 pointer-events-none">
            {badge && (
              <span className="px-2 py-0.5 rounded-full bg-slate-900/85 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-xs">
                {badge}
              </span>
            )}
            {laundry.verificationStatus === 'verified' && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-teal-600/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold shadow-xs">
                <ShieldCheck className="w-3 h-3" />
                <span className="hidden sm:inline">Terverifikasi</span>
              </span>
            )}
          </div>

          {/* Top Right Heart Favorite Button */}
          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-label={isFav ? 'Hapus dari Favorit' : 'Tambah ke Favorit'}
            className="absolute top-2 right-2 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/90 backdrop-blur-md hover:bg-white text-slate-700 hover:text-rose-500 flex items-center justify-center transition-all shadow-md active:scale-90 z-20 cursor-pointer"
          >
            <Heart
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${
                isFav ? 'fill-rose-500 text-rose-500 scale-110' : 'text-slate-600 hover:text-rose-500'
              }`}
            />
          </button>

          {/* Optional Prev/Next Photo Arrows on Hover / Desktop */}
          {photoUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevPhoto}
                className="hidden group-hover:flex absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-900/60 text-white items-center justify-center z-20 hover:bg-slate-900"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextPhoto}
                className="hidden group-hover:flex absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-900/60 text-white items-center justify-center z-20 hover:bg-slate-900"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Photo Indicator Dots */}
              <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1 z-20 pointer-events-auto">
                {photoUrls.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => handleDotClick(e, idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === currentPhotoIndex ? 'w-3.5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Bottom Left Status Dot */}
          {photoUrls.length <= 1 && (
            <div className="absolute bottom-2 left-2 z-10">
              <span
                className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold backdrop-blur-md shadow-xs ${
                  laundry.isOpen
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                }`}
              >
                {laundry.isOpen ? '• Buka' : '• Tutup'}
              </span>
            </div>
          )}
        </div>

        {/* Card Content Area */}
        <div className="flex-1 flex flex-col justify-between space-y-1.5 sm:space-y-2">
          <div className="space-y-0.5 sm:space-y-1">
            {/* Laundry Title */}
            <h3 className="font-black text-slate-900 text-xs sm:text-base group-hover:text-teal-700 transition-colors line-clamp-1">
              {laundry.name}
            </h3>

            {/* Location & Distance */}
            <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-500 font-medium">
              <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
              <span className="line-clamp-1">{shortLocation}</span>
            </div>

            {distanceKm !== undefined && (
              <p className="text-[10px] sm:text-[11px] font-bold text-teal-700">
                📍 {distanceKm} km dari Anda
              </p>
            )}
          </div>

          {/* Price & Rating Footer Row */}
          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1 mt-auto">
            {/* Starting Price */}
            <div>
              {cheapestPrice !== undefined ? (
                <div className="flex items-baseline gap-0.5 sm:gap-1">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tight">Mulai</span>
                  <span className="text-xs sm:text-sm font-black text-teal-800">
                    {formatIDR(cheapestPrice)}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-500">/{cheapestUnit || 'kg'}</span>
                </div>
              ) : (
                <span className="text-[10px] sm:text-xs text-slate-400 italic">Tarif Hubungi</span>
              )}
            </div>

            {/* Rating */}
            <div className="flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded-lg border border-amber-200/80 text-[10px] sm:text-xs font-bold text-amber-800 shrink-0">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
              <span>{rating.toFixed(1)}</span>
              {reviewCount > 0 && (
                <span className="text-[9px] font-normal text-slate-500 hidden sm:inline">({reviewCount})</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
