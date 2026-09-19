'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { LaundryMarketplaceItem } from '@/types/laundry';
import { formatIDR } from '@/utils/formatters';
import { useFavorites } from '@/hooks/useFavorites';
import { Star, MapPin, Heart, ShieldCheck, ChevronLeft, ChevronRight, Clock, Shirt, Footprints, ShoppingBag, Layers, Sofa } from 'lucide-react';

interface LaundryPartnerCardProps {
  item: LaundryMarketplaceItem;
}

const FALLBACK_STOREFRONT =
  'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80';

const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'Pakaian': Shirt,
  'Sepatu & Sandal': Footprints,
  'Tas': ShoppingBag,
  'Karpet': Layers,
  'Sofa': Sofa,
};

export const LaundryPartnerCard: React.FC<LaundryPartnerCardProps> = ({ item }) => {
  const {
    laundry,
    storefrontImageUrl,
    cheapestPrice,
    cheapestUnit,
    rating,
    reviewCount,
    distanceKm,
    badge,
    photos,
    serviceCategories,
  } = item;
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

  const activePhotoUrl = photoUrls[currentPhotoIndex] || FALLBACK_STOREFRONT;

  // Format opening hours display (e.g. "08:00–21:00")
  const formattedHours = (() => {
    const open = laundry.openingTime ? laundry.openingTime.slice(0, 5) : '08:00';
    const close = laundry.closingTime ? laundry.closingTime.slice(0, 5) : '20:00';
    return `${open}–${close}`;
  })();

  return (
    <Link href={`/customer/laundries/${laundry.id}`} className="block group w-full">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-2.5 sm:p-3.5 shadow-xs hover:shadow-xl hover:border-brand-secondary/80 transition-all duration-300 flex flex-row gap-3 sm:gap-4 overflow-hidden relative">
        
        {/* Left Area: Photo Laundry (~40% Width) */}
        <div
          className="relative w-[38%] sm:w-[40%] shrink-0 h-36 sm:h-40 rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 select-none touch-pan-y"
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
          <div className="absolute top-1.5 left-1.5 flex flex-wrap items-center gap-1 z-10 pointer-events-none">
            {badge && (
              <span className="px-1.5 py-0.5 rounded-full bg-slate-900/85 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-wider shadow-xs">
                {badge}
              </span>
            )}
            {laundry.verificationStatus === 'verified' && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-brand-primary/90 backdrop-blur-md text-white text-[9px] font-bold shadow-xs">
                <ShieldCheck className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">Terverifikasi</span>
              </span>
            )}
          </div>

          {/* Top Right Favorite Button */}
          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-label={isFav ? 'Hapus dari Favorit' : 'Tambah ke Favorit'}
            className="absolute top-1.5 right-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/90 backdrop-blur-md hover:bg-white text-slate-700 hover:text-rose-500 flex items-center justify-center transition-all shadow-md active:scale-90 z-20 cursor-pointer"
          >
            <Heart
              className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-colors ${
                isFav ? 'fill-rose-500 text-rose-500 scale-110' : 'text-slate-600 hover:text-rose-500'
              }`}
            />
          </button>

          {/* Prev/Next Photo Arrows on Hover */}
          {photoUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevPhoto}
                className="hidden group-hover:flex absolute left-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-900/60 text-white items-center justify-center z-20 hover:bg-slate-900"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={handleNextPhoto}
                className="hidden group-hover:flex absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-900/60 text-white items-center justify-center z-20 hover:bg-slate-900"
              >
                <ChevronRight className="w-3 h-3" />
              </button>

              {/* Photo Indicator Dots */}
              <div className="absolute bottom-1.5 inset-x-0 flex justify-center gap-1 z-20 pointer-events-auto">
                {photoUrls.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => handleDotClick(e, idx)}
                    className={`h-1 rounded-full transition-all cursor-pointer ${
                      idx === currentPhotoIndex ? 'w-3 bg-white' : 'w-1 bg-white/50 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Status Dot Badge */}
          <div className="absolute bottom-1.5 left-1.5 z-10">
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
        </div>

        {/* Right Area: Information (~60% Width, Balanced Top & Bottom Groups) */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          {/* TOP GROUP: Identity & Services */}
          <div className="space-y-1 min-w-0">
            {/* 1. Nama Laundry (Paling Menonjol) */}
            <h3 className="font-black text-slate-900 text-sm sm:text-base group-hover:text-brand-primary transition-colors line-clamp-1 leading-snug">
              {laundry.name}
            </h3>

            {/* 2. Rating + Jarak (Satu Baris) */}
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/80 text-[11px] sm:text-xs font-extrabold text-amber-900 shrink-0">
                <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                <span>{rating.toFixed(1)}</span>
                {reviewCount > 0 && (
                  <span className="text-[10px] font-normal text-slate-500">({reviewCount})</span>
                )}
              </div>

              <span className="text-slate-300">·</span>

              {distanceKm !== undefined && (
                <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-brand-primary shrink-0">
                  <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 text-brand-primary" />
                  <span>{distanceKm} km</span>
                </div>
              )}
            </div>

            {/* 3. Kategori Laundry (With Category Icons & Enhanced Prominence) */}
            {serviceCategories && serviceCategories.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                {serviceCategories.map((cat) => {
                  const CatIcon = CATEGORY_ICON_MAP[cat];
                  return (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/70"
                    >
                      {CatIcon && <CatIcon className="w-3 h-3 text-slate-500 shrink-0" />}
                      <span>{cat}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* BOTTOM GROUP: Commercial & Operational Alignment */}
          <div className="pt-1.5 border-t border-slate-100/80 space-y-0.5 mt-auto">
            {/* Price Row: Left "Mulai dari", Right "Rp X.XXX/kg" */}
            <div className="flex items-center justify-between gap-1 text-xs">
              <span className="text-[10px] sm:text-[11px] font-medium text-slate-400">
                Mulai dari
              </span>
              {cheapestPrice !== undefined ? (
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm sm:text-base font-black text-brand-primary">
                    {formatIDR(cheapestPrice)}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-medium text-slate-500">
                    /{cheapestUnit || 'kg'}
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400 italic font-medium">Hubungi Mitra</span>
              )}
            </div>

            {/* Operating Row: Left "🟢 Buka", Right "08:00–20:00" */}
            <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[11px] text-slate-500 font-medium">
              <span className={laundry.isOpen ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                {laundry.isOpen ? '🟢 Buka' : '🔴 Tutup'}
              </span>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{formattedHours}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
