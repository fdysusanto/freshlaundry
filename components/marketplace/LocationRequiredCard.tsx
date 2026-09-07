'use client';

import React from 'react';
import { MapPin, Navigation, Map, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface LocationRequiredCardProps {
  onRequestGps: () => void;
  onOpenMapModal: () => void;
  isLocating?: boolean;
}

export function LocationRequiredCard({
  onRequestGps,
  onOpenMapModal,
  isLocating = false,
}: LocationRequiredCardProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-sm text-center space-y-6 max-w-2xl mx-auto my-6">
      <div className="w-16 h-16 rounded-3xl bg-brand-surface border border-brand-primary/20 text-brand-primary flex items-center justify-center mx-auto shadow-inner">
        <MapPin className="w-8 h-8 animate-bounce" />
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Lokasi Diperlukan</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Tentukan Lokasi Anda
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed font-medium">
          FreshLaundry memerlukan lokasi Anda untuk menampilkan mitra laundry terdekat beserta jarak &amp; perkiraan ongkos kirim.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Button
          variant="primary"
          size="md"
          onClick={onRequestGps}
          isLoading={isLocating}
          leftIcon={<Navigation className="w-4 h-4" />}
          className="w-full sm:w-auto bg-brand-primary hover:bg-brand-primary/90 font-bold px-6 cursor-pointer shadow-md"
        >
          Aktifkan GPS Perangkat
        </Button>

        <Button
          variant="outline"
          size="md"
          onClick={onOpenMapModal}
          leftIcon={<Map className="w-4 h-4" />}
          className="w-full sm:w-auto border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          Pilih Lokasi di Peta
        </Button>
      </div>
    </div>
  );
}
