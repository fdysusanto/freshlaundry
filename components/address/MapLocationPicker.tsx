'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, Navigation, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Default Fallback Center: Kota Cirebon, Jawa Barat
export const DEFAULT_MAP_CENTER: [number, number] = [-6.7320, 108.5523];
export const DEFAULT_MAP_ZOOM = 15;

export interface MapLocationPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onLocationChange: (latitude: number, longitude: number) => void;
  disabled?: boolean;
  compact?: boolean;
  showCurrentLocation?: boolean;
}


/**
 * Inner Client-Only Component that directly renders Leaflet DOM elements.
 * Prevents Next.js App Router SSR hydration crashes (window / document is not defined).
 */
function LeafletMapInner({
  latitude,
  longitude,
  onLocationChange,
  disabled,
}: MapLocationPickerProps) {
  const [L, setL] = useState<typeof import('leaflet') | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);

  const initialLat = latitude ?? DEFAULT_MAP_CENTER[0];
  const initialLng = longitude ?? DEFAULT_MAP_CENTER[1];

  // Dynamically load Leaflet module on client mount
  useEffect(() => {
    let isMounted = true;
    import('leaflet').then((leafletModule) => {
      if (isMounted) {
        setL(leafletModule.default || leafletModule);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize Leaflet Map Instance
  useEffect(() => {
    if (!L || !mapContainerRef.current || mapInstanceRef.current) return;

    // Fix Leaflet default icon asset paths for Next.js bundler
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: DEFAULT_MAP_ZOOM,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    // Add OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Create Draggable Marker
    const marker = L.marker([initialLat, initialLng], {
      draggable: !disabled,
    }).addTo(map);

    markerRef.current = marker;
    mapInstanceRef.current = map;

    // Marker Drag End Listener
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      onLocationChange(Number(position.lat.toFixed(6)), Number(position.lng.toFixed(6)));
    });

    // Map Click Listener (tap to move marker)
    map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
      if (disabled) return;
      const { lat, lng } = e.latlng;
      const fixedLat = Number(lat.toFixed(6));
      const fixedLng = Number(lng.toFixed(6));
      marker.setLatLng([fixedLat, fixedLng]);
      onLocationChange(fixedLat, fixedLng);
    });

    // Handle modal animation sizing adjustment
    const resizeTimer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [L]);

  // Sync Marker & Map Center when props change externally
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    if (latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null) {
      const currentPos = markerRef.current.getLatLng();
      if (Math.abs(currentPos.lat - latitude) > 0.00001 || Math.abs(currentPos.lng - longitude) > 0.00001) {
        markerRef.current.setLatLng([latitude, longitude]);
        mapInstanceRef.current.panTo([latitude, longitude]);
      }
    }
  }, [latitude, longitude]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full rounded-2xl z-0 overflow-hidden shadow-inner border border-slate-200"
    />
  );
}

export function MapLocationPicker(props: MapLocationPickerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleGetCurrentLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setFeedback({
        type: 'warning',
        message: 'Perangkat Anda tidak mendukung pemindaian GPS. Silakan tentukan lokasi dengan mengetuk titik di peta.',
      });
      return;
    }

    setIsLocating(true);
    setFeedback(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        props.onLocationChange(lat, lng);
        setIsLocating(false);
        setFeedback({
          type: 'success',
          message: '✓ Lokasi Anda berhasil ditemukan & diperbarui pada peta.',
        });
      },
      (error) => {
        setIsLocating(false);
        let msg = 'Lokasi belum dapat ditemukan. Silakan pilih titik lokasi secara manual di peta.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Izin lokasi ditolak. Anda tetap dapat menentukan lokasi dengan menggeser pin di peta.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Permintaan lokasi waktu habis. Silakan pilih titik lokasi secara manual di peta.';
        }
        setFeedback({ type: 'warning', message: msg });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  const hasCoords = props.latitude !== null && props.latitude !== undefined && props.longitude !== null && props.longitude !== undefined;

  return (
    <div className="space-y-2.5">
      {/* Header Info Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <MapPin className="w-4 h-4 text-brand-primary shrink-0" />
          <span>📍 Titik Lokasi Penjemputan (Pin Peta)</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLocating || props.disabled}
          onClick={handleGetCurrentLocation}
          className="text-xs font-bold text-brand-primary border-brand-primary/30 hover:bg-brand-surface shrink-0 h-8 px-2.5 py-0"
        >
          {isLocating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 text-brand-primary animate-spin mr-1" />
              <span>Mencari Lokasi...</span>
            </>
          ) : (
            <>
              <Navigation className="w-3.5 h-3.5 text-brand-primary mr-1" />
              <span>Gunakan Lokasi Saya</span>
            </>
          )}
        </Button>
      </div>

      {/* Interactive Map Container */}
      <div className={`relative w-full ${props.compact ? 'h-[180px] sm:h-[210px]' : 'h-[220px] sm:h-[260px]'} rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-xs`}>
        {!isMounted ? (
          <div className="w-full h-full flex flex-col items-center justify-center space-y-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
            <span className="text-xs font-semibold">Memuat peta...</span>
          </div>
        ) : (
          <LeafletMapInner {...props} />
        )}

        {/* Pin Helper Overlay Badge */}
        <div className="absolute top-2 left-2 z-10 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs text-[10px] font-bold text-slate-700 pointer-events-none flex items-center gap-1">
          <MapPin className="w-3 h-3 text-brand-primary" />
          <span>Ketuk peta atau geser pin untuk menentukan titik pickup</span>
        </div>
      </div>

      {/* Coordinate Status Badge & Feedback Notification */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span>
            {hasCoords
              ? `Status: Titik lokasi terpilih (${props.latitude}, ${props.longitude})`
              : 'Status: Belum memilih titik lokasi (opsional)'}
          </span>
          {hasCoords && (
            <span className="text-brand-primary font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand-primary" /> Tersimpan
            </span>
          )}
        </div>

        {feedback && (
          <div
            className={`p-2.5 rounded-xl text-xs font-medium flex items-start gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-amber-50 text-amber-900 border border-amber-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <span className="leading-snug">{feedback.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
