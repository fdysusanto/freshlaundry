import { MarketplaceLocation, MarketplaceLocationSource, MarketplaceLocationStatus } from '@/types/address';

export const MARKETPLACE_MANUAL_LOCATION_KEY = 'freshlaundry_marketplace_manual_location';

export interface ManualPinLocationData {
  latitude: number;
  longitude: number;
  displayAddress?: string;
  updatedAt: string;
}

let inMemoryManualPinStore: ManualPinLocationData | null = null;

export const locationService = {
  // Validate geographic coordinate bounds safely
  isValidCoordinate(lat: any, lng: any): boolean {
    if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
    const numLat = Number(lat);
    const numLng = Number(lng);
    if (isNaN(numLat) || isNaN(numLng) || !isFinite(numLat) || !isFinite(numLng)) return false;
    return numLat >= -90 && numLat <= 90 && numLng >= -180 && numLng <= 180;
  },

  // Read manual location override from sessionStorage
  getManualPinLocation(): ManualPinLocationData | null {
    if (typeof window === 'undefined') return inMemoryManualPinStore;
    try {
      const raw = sessionStorage.getItem(MARKETPLACE_MANUAL_LOCATION_KEY);
      if (!raw) return inMemoryManualPinStore;
      const parsed: ManualPinLocationData = JSON.parse(raw);
      if (this.isValidCoordinate(parsed.latitude, parsed.longitude)) {
        return parsed;
      }
      return inMemoryManualPinStore;
    } catch {
      return inMemoryManualPinStore;
    }
  },

  // Save manual pin location override to sessionStorage
  setManualPinLocation(lat: number, lng: number, displayAddress?: string): ManualPinLocationData {
    const data: ManualPinLocationData = {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
      displayAddress: displayAddress || `Titik Peta (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      updatedAt: new Date().toISOString(),
    };
    inMemoryManualPinStore = data;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(MARKETPLACE_MANUAL_LOCATION_KEY, JSON.stringify(data));
      } catch (err) {
        console.warn('[LOCATION-SERVICE] Failed to save manual pin to sessionStorage:', err);
      }
    }
    return data;
  },

  // Clear manual pin location override from sessionStorage
  clearManualPinLocation(): void {
    inMemoryManualPinStore = null;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(MARKETPLACE_MANUAL_LOCATION_KEY);
      } catch (err) {
        console.warn('[LOCATION-SERVICE] Failed to clear manual pin from sessionStorage:', err);
      }
    }
  },

  // Format compact marketplace header location string
  formatMarketplaceLocationLabel(location: MarketplaceLocation): string {
    if (location.status === 'locating') {
      return '📍 Mencari lokasi Anda...';
    }
    if (location.source === 'manual_pin') {
      return location.displayAddress ? `📍 ${location.displayAddress}` : '📍 Lokasi Pilihan (Peta)';
    }
    if (location.source === 'current_gps' && location.status === 'success') {
      return '📍 Lokasi Saat Ini';
    }
    return '📍 Lokasi belum dipilih';
  },
};
