'use client';

import React, { useState } from 'react';
import { ServiceCatalogItem } from '@/utils/constants';
import { formatIDR } from '@/utils/formatters';
import { resolveServicePhoto } from '@/utils/servicePhotoFallbacks';
import { Sparkles, CheckCircle2, Plus, Minus } from 'lucide-react';

interface CustomerServiceCardProps {
  service: ServiceCatalogItem;
  isSelected: boolean;
  quantity?: number;
  onSelect: () => void;
  onQuantityChange: (newQty: number) => void;
}

export const CustomerServiceCard: React.FC<CustomerServiceCardProps> = ({
  service,
  isSelected,
  quantity,
  onSelect,
  onQuantityChange,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const photoUrl = imageError
    ? 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=600&q=80'
    : resolveServicePhoto(service);

  const qty = quantity !== undefined ? quantity : 0;
  const hasQuantity = quantity !== undefined && quantity > 0;
  const estHours = service.estimatedHours || 24;
  const estDays = Math.max(1, Math.round(estHours / 24));
  const estTime = estHours <= 12 ? `±${estHours} jam` : `±${estDays} hari`;

  const hasSrvMin = service.unit === 'kg' && typeof service.minWeight === 'number' && service.minWeight > 0;
  const srvMinQty = hasSrvMin ? (service.minWeight as number) : null;
  const belowMinCharge = isSelected && hasQuantity && srvMinQty !== null && qty < srvMinQty;

  const metadataText = [service.category, estTime].filter(Boolean).join(' • ');

  return (
    <div
      onClick={onSelect}
      className={`group rounded-2xl border transition-all duration-200 cursor-pointer bg-white relative p-3 sm:p-3.5 flex gap-3 sm:gap-3.5 items-stretch ${
        isSelected && hasQuantity
          ? 'border-brand-primary ring-2 ring-brand-primary/20 shadow-xs bg-brand-surface/10'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-2xs'
      }`}
    >
      {/* 1. PHOTO THUMBNAIL (Fixed compact thumbnail 80px mobile / 88px desktop) */}
      <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shrink-0 self-start">
        {!imageLoaded && (
          <div className="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-slate-300" />
          </div>
        )}
        <img
          src={photoUrl}
          alt={service.name}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Badge overlay on photo */}
        {service.badge && (
          <div className="absolute top-1 left-1 bg-amber-500/95 text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow-2xs flex items-center gap-0.5">
            <span>{service.badge}</span>
          </div>
        )}
      </div>

      {/* 2. RIGHT-SIDE CONTENT CONTAINER (Fills space, pushes price/action to bottom) */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        {/* Top Info */}
        <div className="space-y-0.5">
          {/* Priority 1: Service Name */}
          <div className="flex items-start justify-between gap-1">
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug line-clamp-2">
              {service.name}
            </h3>
            {isSelected && hasQuantity && (
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-primary shrink-0 mt-0.5" />
            )}
          </div>

          {/* Priority 2: Compact Metadata (Category • Estimated Time) */}
          {metadataText && (
            <p className="text-[11px] text-slate-500 font-medium truncate">
              {metadataText}
            </p>
          )}

          {/* Priority 3: Minimum Order / Charge */}
          {srvMinQty !== null && (
            <div className="pt-0.5">
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50/90 px-1.5 py-0.2 rounded border border-amber-200/80 inline-block leading-tight">
                Min. {srvMinQty} {service.unit}
              </span>
            </div>
          )}

          {/* Warning note if quantity is below minimum charge */}
          {belowMinCharge && (
            <p className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80 mt-1 leading-tight">
              Min. charge {srvMinQty} {service.unit} ({formatIDR(service.price * srvMinQty)})
            </p>
          )}
        </div>

        {/* Bottom Row: Priority 4 (Price) & Priority 5 (Action) */}
        <div className="flex items-end justify-between gap-2 mt-2 pt-1 border-t border-slate-100/80">
          {/* Price */}
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-bold text-slate-900">
              {formatIDR(service.price)}
            </span>
            <span className="text-[10px] text-slate-500 font-normal">/{service.unit}</span>
          </div>

          {/* Action: [Pilih] Button or Quantity Stepper */}
          <div className="shrink-0">
            {!hasQuantity ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect();
                }}
                className="px-2.5 py-1 sm:px-3 sm:py-1 rounded-lg bg-brand-surface hover:bg-brand-surface/80 text-brand-primary border border-brand-primary/30 font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-2xs"
                aria-label={`Pilih ${service.name}`}
              >
                Pilih
              </button>
            ) : (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => onQuantityChange(qty - 1)}
                  className="w-6 h-6 rounded bg-slate-100 text-slate-700 font-bold flex items-center justify-center hover:bg-slate-200 cursor-pointer active:scale-90 transition-colors"
                  aria-label="Kurangi kuantitas"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-xs font-black text-brand-primary">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => onQuantityChange(qty + 1)}
                  className="w-6 h-6 rounded bg-brand-primary text-white font-bold flex items-center justify-center hover:bg-brand-primary/90 cursor-pointer active:scale-90 transition-colors"
                  aria-label="Tambah kuantitas"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
