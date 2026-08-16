import { UserProfile } from '@/types/user';

export const DEFAULT_SEARCH_LOCATION = 'Siliwangi, Kota Cirebon';
export const GUEST_SEARCH_LOCATION_KEY = 'freshwash_search_location';

export type LocationStateType =
  | 'AUTH_LOADING'
  | 'GUEST_DEFAULT'
  | 'GUEST_CUSTOM'
  | 'CUSTOMER_NO_ADDRESS'
  | 'CUSTOMER_HAS_ADDRESS';

export interface LocationStateResult {
  stateType: LocationStateType;
  headerLabel: string;
  displayLocation: string;
  ctaText: string;
  isCustomerPickupAddress: boolean;
  searchLocation: string;
  pickupAddress: string;
}

let inMemoryGuestSearchLocationStore: string | null = null;

export const locationService = {
  getGuestSearchLocation(): string | null {
    if (typeof window === 'undefined') return inMemoryGuestSearchLocationStore;
    return localStorage.getItem(GUEST_SEARCH_LOCATION_KEY) || inMemoryGuestSearchLocationStore;
  },

  setGuestSearchLocation(location: string): void {
    inMemoryGuestSearchLocationStore = location;
    if (typeof window !== 'undefined') {
      localStorage.setItem(GUEST_SEARCH_LOCATION_KEY, location);
    }
  },

  clearGuestSearchLocation(): void {
    inMemoryGuestSearchLocationStore = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(GUEST_SEARCH_LOCATION_KEY);
    }
  },

  computeLocationState(
    authLoading: boolean,
    user: UserProfile | null
  ): LocationStateResult {
    if (authLoading) {
      return {
        stateType: 'AUTH_LOADING',
        headerLabel: 'MEMUAT LOKASI:',
        displayLocation: 'Memuat data lokasi...',
        ctaText: 'Memuat...',
        isCustomerPickupAddress: false,
        searchLocation: DEFAULT_SEARCH_LOCATION,
        pickupAddress: '',
      };
    }

    // Guest / Unauthenticated User
    if (!user || !user.id) {
      const customGuestLoc = this.getGuestSearchLocation();
      if (customGuestLoc && customGuestLoc.trim() !== '') {
        return {
          stateType: 'GUEST_CUSTOM',
          headerLabel: 'LOKASI PENCARIAN:',
          displayLocation: customGuestLoc.trim(),
          ctaText: 'Ubah',
          isCustomerPickupAddress: false,
          searchLocation: customGuestLoc.trim(),
          pickupAddress: '',
        };
      }

      return {
        stateType: 'GUEST_DEFAULT',
        headerLabel: 'LOKASI PENCARIAN:',
        displayLocation: DEFAULT_SEARCH_LOCATION,
        ctaText: 'Pilih Lokasi',
        isCustomerPickupAddress: false,
        searchLocation: DEFAULT_SEARCH_LOCATION,
        pickupAddress: '',
      };
    }

    // Authenticated Customer
    const userAddress = (user.address || '').trim();
    if (userAddress !== '') {
      return {
        stateType: 'CUSTOMER_HAS_ADDRESS',
        headerLabel: 'LOKASI PENJEMPUTAN ANDA:',
        displayLocation: userAddress,
        ctaText: 'Ubah',
        isCustomerPickupAddress: true,
        searchLocation: userAddress,
        pickupAddress: userAddress,
      };
    }

    return {
      stateType: 'CUSTOMER_NO_ADDRESS',
      headerLabel: 'LOKASI PENJEMPUTAN:',
      displayLocation: 'Tambahkan alamat pickup',
      ctaText: 'Tambah Alamat',
      isCustomerPickupAddress: false,
      searchLocation: DEFAULT_SEARCH_LOCATION,
      pickupAddress: '',
    };
  },
};
