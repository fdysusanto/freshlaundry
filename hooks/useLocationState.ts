import { useState, useEffect, useCallback, useRef } from 'react';
import { MarketplaceLocation, MarketplaceLocationSource, MarketplaceLocationStatus } from '@/types/address';
import { locationService } from '@/services/locationService';

export function useLocationState() {
  const [marketplaceLocation, setMarketplaceLocation] = useState<MarketplaceLocation>({
    latitude: null,
    longitude: null,
    source: null,
    status: 'idle',
  });

  const isMountedRef = useRef(true);

  // Request fresh GPS position from device
  const requestGpsLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      if (isMountedRef.current) {
        setMarketplaceLocation({
          latitude: null,
          longitude: null,
          source: null,
          status: 'error',
          errorMessage: 'Perangkat Anda tidak mendukung fitur pemindaian GPS.',
        });
      }
      return;
    }

    if (isMountedRef.current) {
      setMarketplaceLocation((prev) => ({
        ...prev,
        status: 'locating',
      }));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isMountedRef.current) return;
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));

        setMarketplaceLocation({
          latitude: lat,
          longitude: lng,
          source: 'current_gps',
          status: 'success',
          displayAddress: 'Lokasi Saat Ini',
        });
      },
      (error) => {
        if (!isMountedRef.current) return;
        let msg = 'Gagal mengakses GPS lokasi Anda.';
        let status: MarketplaceLocationStatus = 'error';

        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Izin lokasi GPS ditolak oleh browser/perangkat Anda.';
          status = 'denied';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Permintaan lokasi GPS waktu habis.';
          status = 'error';
        }

        setMarketplaceLocation({
          latitude: null,
          longitude: null,
          source: null,
          status,
          errorMessage: msg,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, []);

  // Initialize location state on mount
  useEffect(() => {
    isMountedRef.current = true;

    // Priority 1: Manual Pin Override in Session Storage
    const manualPin = locationService.getManualPinLocation();
    if (manualPin) {
      setMarketplaceLocation({
        latitude: manualPin.latitude,
        longitude: manualPin.longitude,
        source: 'manual_pin',
        status: 'success',
        displayAddress: manualPin.displayAddress,
      });
      return () => {
        isMountedRef.current = false;
      };
    }

    // Priority 2: Current Device GPS Location
    requestGpsLocation();

    return () => {
      isMountedRef.current = false;
    };
  }, [requestGpsLocation]);

  // Set manual pin location override
  const setManualPinLocation = useCallback((lat: number, lng: number, displayAddress?: string) => {
    const saved = locationService.setManualPinLocation(lat, lng, displayAddress);
    setMarketplaceLocation({
      latitude: saved.latitude,
      longitude: saved.longitude,
      source: 'manual_pin',
      status: 'success',
      displayAddress: saved.displayAddress,
    });
  }, []);

  // Reset manual override and request fresh GPS
  const resetToGps = useCallback(() => {
    locationService.clearManualPinLocation();
    requestGpsLocation();
  }, [requestGpsLocation]);

  return {
    marketplaceLocation,
    isLocating: marketplaceLocation.status === 'locating',
    requestGpsLocation,
    setManualPinLocation,
    resetToGps,
    formattedLocationLabel: locationService.formatMarketplaceLocationLabel(marketplaceLocation),
  };
}
