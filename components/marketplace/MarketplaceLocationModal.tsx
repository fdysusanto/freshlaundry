'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MapLocationPicker, DEFAULT_MAP_CENTER } from '@/components/address/MapLocationPicker';
import { Navigation, MapPin, Search } from 'lucide-react';

interface MarketplaceLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectManualPin: (lat: number, lng: number, displayAddress?: string) => void;
  onResetToGps: () => void;
  initialLat?: number | null;
  initialLng?: number | null;
  isGpsActive?: boolean;
}

export const MarketplaceLocationModal: React.FC<MarketplaceLocationModalProps> = ({
  isOpen,
  onClose,
  onSelectManualPin,
  onResetToGps,
  initialLat,
  initialLng,
  isGpsActive = false,
}) => {
  const [latitude, setLatitude] = useState<number | null>(initialLat ?? DEFAULT_MAP_CENTER[0]);
  const [longitude, setLongitude] = useState<number | null>(initialLng ?? DEFAULT_MAP_CENTER[1]);
  const [manualText, setManualText] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setLatitude(initialLat ?? DEFAULT_MAP_CENTER[0]);
      setLongitude(initialLng ?? DEFAULT_MAP_CENTER[1]);
    }
  }

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      latitude !== null &&
      latitude !== undefined &&
      longitude !== null &&
      longitude !== undefined
    ) {
      const customAddressLabel = manualText.trim() ? manualText.trim() : undefined;
      onSelectManualPin(latitude, longitude, customAddressLabel);
      onClose();
    }
  };

  const handleUseGps = () => {
    onResetToGps();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Atur Lokasi Pencarian Laundry" maxWidth="md">
      <div className="space-y-4 text-xs">
        {/* Option 1: Fast GPS Reset Button */}
        <div className="p-3 bg-brand-surface rounded-2xl border border-brand-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-slate-900">
          <div className="space-y-0.5">
            <p className="font-black text-xs flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-brand-primary shrink-0" />
              <span>Gunakan Lokasi Perangkat (GPS)</span>
            </p>
            <p className="text-[11px] text-slate-600 leading-snug">
              Temukan mitra laundry terdekat berdasarkan posisi GPS perangkat Anda saat ini.
            </p>
          </div>
          <Button
            type="button"
            variant={isGpsActive ? 'primary' : 'outline'}
            size="sm"
            onClick={handleUseGps}
            className={`text-xs font-bold shrink-0 ${
              isGpsActive
                ? 'bg-brand-primary text-white'
                : 'border-brand-primary/40 text-brand-primary hover:bg-brand-surface'
            }`}
          >
            {isGpsActive ? '✓ GPS Aktif' : '📍 Gunakan GPS Saya'}
          </Button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider absolute">
            atau pilih titik di peta
          </span>
        </div>

        {/* Option 2: Interactive Map Location Picker */}
        <form onSubmit={handleSavePin} className="space-y-3">
          <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
            <MapPin className="w-3.5 h-3.5 text-brand-primary shrink-0" />
            <span>Geser Pin atau Ketuk Titik di Peta:</span>
          </div>

          <MapLocationPicker
            latitude={latitude}
            longitude={longitude}
            onLocationChange={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
            compact
          />

          {/* Optional Area Tag / Notes Input */}
          <div>
            {!showManualInput ? (
              <button
                type="button"
                onClick={() => setShowManualInput(true)}
                className="text-[11px] font-bold text-brand-primary hover:text-brand-primary/80 underline flex items-center gap-1 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Tambah nama patokan / area (Opsional)</span>
              </button>
            ) : (
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Nama Area / Patokan (Opsional):
                </label>
                <input
                  type="text"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Misal: Kejaksan / Near Station..."
                  className="w-full p-2.5 bg-slate-50 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary text-slate-900"
                />
              </div>
            )}
          </div>

          {/* Submit Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-xs"
            >
              Gunakan Lokasi Ini
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
