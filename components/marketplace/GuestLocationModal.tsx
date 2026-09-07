'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MapLocationPicker, DEFAULT_MAP_CENTER } from '@/components/address/MapLocationPicker';
import { MapPin, Search } from 'lucide-react';

interface GuestLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveLocation: (lat: number, lng: number, displayAddress?: string) => void;
  onSaveLegacyTextLocation?: (text: string) => void;
  initialLat?: number | null;
  initialLng?: number | null;
  initialText?: string;
}

export const GuestLocationModal: React.FC<GuestLocationModalProps> = ({
  isOpen,
  onClose,
  onSaveLocation,
  onSaveLegacyTextLocation,
  initialLat,
  initialLng,
  initialText = '',
}) => {
  const [latitude, setLatitude] = useState<number | null>(initialLat ?? DEFAULT_MAP_CENTER[0]);
  const [longitude, setLongitude] = useState<number | null>(initialLng ?? DEFAULT_MAP_CENTER[1]);
  const [manualText, setManualText] = useState<string>(initialText);
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      latitude !== null &&
      latitude !== undefined &&
      longitude !== null &&
      longitude !== undefined
    ) {
      const customAddressLabel = manualText.trim() ? manualText.trim() : undefined;
      onSaveLocation(latitude, longitude, customAddressLabel);
      onClose();
      return;
    }

    if (manualText.trim() && onSaveLegacyTextLocation) {
      onSaveLegacyTextLocation(manualText.trim());
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Atur Lokasi Pencarian Laundry" maxWidth="md">
      <form onSubmit={handleSave} className="space-y-4 text-xs">
        {/* Info Banner */}
        <div className="p-3 bg-brand-surface rounded-xl border border-brand-primary/20 text-slate-900 flex items-start gap-2.5">
          <MapPin className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-xs">Pilih Titik Lokasi Anda pada Peta</p>
            <p className="text-[11px] text-slate-600 leading-snug">
              Ketuk titik lokasi pada peta atau gunakan tombol GPS untuk menemukan mitra laundry di sekitar Anda.
            </p>
          </div>
        </div>

        {/* Map Location Picker */}
        <MapLocationPicker
          latitude={latitude}
          longitude={longitude}
          onLocationChange={(lat, lng) => {
            setLatitude(lat);
            setLongitude(lng);
          }}
          compact
        />

        {/* Optional Manual Text Search Input Toggle */}
        <div className="pt-1">
          {!showManualInput ? (
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className="text-[11px] font-bold text-brand-primary hover:text-brand-primary/80 underline flex items-center gap-1 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Punya patokan area tertentu? Tulis nama jalan/kecamatan</span>
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
                placeholder="Misal: Kejaksan / Jl. Siliwangi..."
                className="w-full p-2.5 bg-slate-50 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary text-slate-900"
              />
            </div>
          )}
        </div>

        {/* Modal Action Buttons */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            Batal
          </Button>
          <Button type="submit" variant="primary" size="sm" className="bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-xs">
            Simpan Lokasi
          </Button>
        </div>
      </form>
    </Modal>
  );
};
