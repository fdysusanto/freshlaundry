'use client';

import React, { useState } from 'react';
import { MapPin, Navigation, RefreshCw } from 'lucide-react';
import { useLocationState } from '@/hooks/useLocationState';
import { MarketplaceLocationModal } from './MarketplaceLocationModal';

interface LocationPickerHeaderProps {
  locationText?: string;
  onSearchClick?: () => void;
  onTagClick?: (tag: string) => void;
  title?: string;
  subtitle?: string;
}

export const LocationPickerHeader: React.FC<LocationPickerHeaderProps> = ({
  locationText,
  onTagClick,
  title = 'Cari Laundry',
  subtitle = 'Temukan laundry terbaik di sekitar Anda',
}) => {
  const {
    marketplaceLocation,
    isLocating,
    setManualPinLocation,
    resetToGps,
    formattedLocationLabel,
  } = useLocationState();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const quickTags = ['Kiloan', 'Express', 'Dry Clean', 'Sepatu'];

  const activeDisplay = locationText || formattedLocationLabel;

  return (
    <>
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-3 sm:space-y-4">
        {/* Top Header Row: Title & Subtitle + Compact Location Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="space-y-0.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {title}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {subtitle}
            </p>
          </div>

          {/* Location Badge & Switcher */}
          <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl text-xs">
            <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            {isLocating ? (
              <span className="text-slate-400 font-semibold text-[11px] animate-pulse flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin text-teal-600" />
                <span>Mencari lokasi...</span>
              </span>
            ) : (
              <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
                <span className="truncate max-w-[160px] sm:max-w-[220px]">{activeDisplay}</span>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="text-[10px] text-teal-700 hover:text-teal-800 font-bold underline cursor-pointer shrink-0"
                >
                  Ubah
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Filter Tags (Compact horizontal pill bar) */}
        {onTagClick && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1">Cari cepat:</span>
            {quickTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick(tag)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-800 border border-slate-200/80 text-[11px] text-slate-600 font-medium transition-all shrink-0 cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Unified Marketplace Location Modal */}
      <MarketplaceLocationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialLat={marketplaceLocation.latitude}
        initialLng={marketplaceLocation.longitude}
        isGpsActive={marketplaceLocation.source === 'current_gps'}
        onSelectManualPin={(lat, lng, displayAddress) => {
          setManualPinLocation(lat, lng, displayAddress);
        }}
        onResetToGps={() => {
          resetToGps();
        }}
      />
    </>
  );
};
