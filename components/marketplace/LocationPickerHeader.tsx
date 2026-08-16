'use client';

import React, { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { useLocationState } from '@/hooks/useLocationState';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface LocationPickerHeaderProps {
  locationText?: string;
  onSearchClick?: () => void;
  onTagClick?: (tag: string) => void;
}

export const LocationPickerHeader: React.FC<LocationPickerHeaderProps> = ({
  locationText,
  onTagClick,
}) => {
  const {
    authLoading,
    headerLabel,
    displayLocation,
    ctaText,
    updateSearchLocation,
    user,
  } = useLocationState();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputLocation, setInputLocation] = useState('');

  const activeDisplayLocation = locationText || displayLocation;
  const quickTags = ['Cuci Kiloan', 'Express 6 Jam', 'Dry Clean', 'Cuci Sepatu', 'Buka 24 Jam'];

  const handleSaveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputLocation.trim()) return;
    updateSearchLocation(inputLocation.trim());
    setIsModalOpen(false);
    setInputLocation('');
  };

  return (
    <>
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-cyan-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden space-y-6">
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Location Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              {authLoading ? (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block animate-pulse">
                    MEMUAT LOKASI...
                  </span>
                  <div className="h-4 w-36 bg-white/20 rounded-md animate-pulse" />
                </div>
              ) : (
                <>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">
                    {headerLabel}
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-white">
                    <span>{activeDisplayLocation}</span>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="text-[10px] bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 px-2 py-0.5 rounded-md font-semibold border border-teal-400/30 transition-colors cursor-pointer"
                    >
                      {ctaText}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-bold">
            <Navigation className="w-3.5 h-3.5" />
            <span>Marketplace Multi-Laundry</span>
          </div>
        </div>

        {/* Main Title Banner */}
        <div className="space-y-2 relative z-10 max-w-2xl">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            Cari Laundry Terdekat di Cirebon, Pesan Pickup Kilat
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Temukan mitra laundry pilihan di sekitar Anda. Pesan pickup, kami bantu antar cucian Anda ke mitra laundry.
          </p>
        </div>

        {/* Quick Filter Tags */}
        {onTagClick && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 relative z-10 no-scrollbar">
            <span className="text-xs font-bold text-slate-400 shrink-0">Cari Cepat:</span>
            {quickTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick(tag)}
                className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white font-medium transition-all shrink-0 cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Location Picker Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(null as any)}
        title={user?.id ? 'Atur Lokasi Anda' : 'Atur Lokasi Pencarian Laundry'}
      >
        <form onSubmit={handleSaveLocation} className="space-y-4">
          <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-xs text-teal-900 space-y-1">
            <p className="font-bold">
              {user?.id ? 'Lokasi Penjemputan Pesanan' : 'Lokasi Pencarian Marketplace'}
            </p>
            <p className="text-[11px] text-teal-700">
              {user?.id
                ? 'Atur lokasi penjemputan utama untuk pesanan laundry Anda.'
                : 'Masukkan kecamatan/kota Anda untuk memfilter laundry mitra terdekat.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              {user?.id ? 'Alamat / Area Penjemputan:' : 'Area / Kota Pencarian:'}
            </label>
            <input
              type="text"
              required
              value={inputLocation}
              onChange={(e) => setInputLocation(e.target.value)}
              placeholder="Misal: Siliwangi, Kota Cirebon / Kejaksan..."
              className="w-full p-3 bg-slate-50 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Simpan Lokasi
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
