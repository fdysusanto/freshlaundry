import { supabase, isSupabaseConfigured } from './supabase';
import { laundryService } from './laundryService';
import { Laundry, LaundryMarketplaceItem, LaundryPhoto } from '@/types/laundry';
import { DEMO_LAUNDRIES, SERVICE_CATALOG } from '@/utils/constants';

// High-quality storefront fallback images for laundry partners
const DEFAULT_STOREFRONT_PHOTOS = [
  'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1521656693074-0ef32e80a5d5?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=800&q=80',
];

/**
 * Calculate Haversine distance in kilometers between two geographic coordinates.
 * Returns undefined if any coordinate is missing or invalid.
 */
export function calculateHaversineDistance(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): number | undefined {
  if (
    lat1 === undefined ||
    lat1 === null ||
    lon1 === undefined ||
    lon1 === null ||
    lat2 === undefined ||
    lat2 === null ||
    lon2 === undefined ||
    lon2 === null
  ) {
    return undefined;
  }

  const numLat1 = Number(lat1);
  const numLon1 = Number(lon1);
  const numLat2 = Number(lat2);
  const numLon2 = Number(lon2);

  if (isNaN(numLat1) || isNaN(numLon1) || isNaN(numLat2) || isNaN(numLon2)) {
    return undefined;
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = ((numLat2 - numLat1) * Math.PI) / 180;
  const dLon = ((numLon2 - numLon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((numLat1 * Math.PI) / 180) *
      Math.cos((numLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place (e.g. 1.2)
}

export const marketplaceService = {
  /**
   * Fetch laundry partner listings mapped to `LaundryMarketplaceItem`.
   * Computes cheapest active service per partner in 1 batch query (NO N+1).
   * Fetches laundry photos in 1 batch query to resolve primaryPhoto & photos[].
   * Calculates Haversine distance ONLY when both user & laundry coordinates are present.
   */
  async getNearbyLaundryPartnersAsync(
    userLat?: number | null,
    userLng?: number | null
  ): Promise<LaundryMarketplaceItem[]> {
    let laundries: Laundry[] = [];

    if (isSupabaseConfigured && supabase) {
      try {
        laundries = await laundryService.getLaundriesAsync();
      } catch (err) {
        console.warn('[MARKETPLACE-SERVICE] Supabase laundries fetch fallback to DEMO:', err);
        laundries = DEMO_LAUNDRIES;
      }
    } else {
      laundries = DEMO_LAUNDRIES;
    }

    if (laundries.length === 0) return [];

    const laundryIds = laundries.map((l) => l.id);
    let activeServicesMap: Record<string, { price: number; unit: 'kg' | 'pcs' }[]> = {};
    let photosMap: Record<string, LaundryPhoto[]> = {};

    if (isSupabaseConfigured && supabase) {
      try {
        // Efficient BATCH query for all active services across all target laundries
        const { data: servicesData, error: servicesErr } = await (supabase.from('services') as any)
          .select('laundry_id, price_per_unit, unit, is_active')
          .in('laundry_id', laundryIds)
          .eq('is_active', true);

        if (!servicesErr && servicesData) {
          servicesData.forEach((s: any) => {
            if (!activeServicesMap[s.laundry_id]) {
              activeServicesMap[s.laundry_id] = [];
            }
            activeServicesMap[s.laundry_id].push({
              price: Number(s.price_per_unit),
              unit: s.unit as 'kg' | 'pcs',
            });
          });
        }

        // Efficient BATCH query for laundry photos across all target laundries (NO N+1)
        const { data: photosData, error: photosErr } = await (supabase.from('laundry_photos') as any)
          .select('*')
          .in('laundry_id', laundryIds)
          .order('photo_slot', { ascending: true });

        if (!photosErr && photosData) {
          photosData.forEach((p: LaundryPhoto) => {
            if (!photosMap[p.laundry_id]) {
              photosMap[p.laundry_id] = [];
            }
            photosMap[p.laundry_id].push(p);
          });
        }
      } catch (err) {
        console.warn('[MARKETPLACE-SERVICE] Batch queries warning:', err);
      }
    }

    // Fallback if activeServicesMap is empty or in mock mode
    if (Object.keys(activeServicesMap).length === 0) {
      SERVICE_CATALOG.filter((s) => s.isActive).forEach((s) => {
        if (!activeServicesMap[s.laundryId]) {
          activeServicesMap[s.laundryId] = [];
        }
        activeServicesMap[s.laundryId].push({
          price: Number(s.price_per_unit || s.price),
          unit: (s.unit || 'kg') as 'kg' | 'pcs',
        });
      });
    }

    const allMappedItems: LaundryMarketplaceItem[] = laundries.map((laundry, index) => {
      const partnerServices = activeServicesMap[laundry.id] || [];
      const partnerPhotos = photosMap[laundry.id] || [];
      const primaryPhoto = partnerPhotos.find((p) => p.is_primary) || partnerPhotos[0];

      // Find cheapest active service price
      let cheapestPrice: number | undefined;
      let cheapestUnit: 'kg' | 'pcs' | undefined = 'kg';

      if (partnerServices.length > 0) {
        const sorted = [...partnerServices].sort((a, b) => a.price - b.price);
        cheapestPrice = sorted[0].price;
        cheapestUnit = sorted[0].unit;
      } else if ((laundry as any).startingPrice) {
        cheapestPrice = (laundry as any).startingPrice;
        cheapestUnit = 'kg';
      }

      // Calculate distance ONLY if user & laundry lat/lng exist
      const distanceKm = calculateHaversineDistance(
        userLat,
        userLng,
        laundry.latitude,
        laundry.longitude
      );

      // Map primaryPhoto -> logo_url -> storefrontImageUrl with reliable fallback
      const storefrontImageUrl =
        primaryPhoto?.public_url ||
        (laundry.logoUrl && laundry.logoUrl.trim() !== ''
          ? laundry.logoUrl
          : DEFAULT_STOREFRONT_PHOTOS[index % DEFAULT_STOREFRONT_PHOTOS.length]);

      const item = {
        laundry,
        storefrontImageUrl,
        primaryPhoto,
        photos: partnerPhotos,
        cheapestPrice,
        cheapestUnit,
        rating: Number(laundry.rating || 5.0),
        reviewCount: laundry.totalReviews || 0,
        distanceKm,
        isFavorite: false,
        badge: (laundry as any).badge || (index === 0 ? 'Pilihan terbaik' : undefined),
      };
      return item;
    });

    // RULE 1: Location Required Blocking - If coordinates are missing, return empty array
    if (userLat === null || userLat === undefined || userLng === null || userLng === undefined) {
      const emptyResult: LaundryMarketplaceItem[] = [];
      (emptyResult as any).activeRadiusKm = 0;
      (emptyResult as any).totalWithinRadius = 0;
      (emptyResult as any).hasLocation = false;
      return emptyResult;
    }

    // RULE 5: Hard Cutoff > 10km & Exclude missing distance
    const validItemsWithin10Km = allMappedItems.filter(
      (item) => item.distanceKm !== undefined && item.distanceKm <= 10
    );

    // Progressive Radius Algorithm (3km -> 5km -> 7km -> 10km)
    const MIN_RESULTS = 3;
    const stages = [3, 5, 7, 10];
    let selectedRadius = 10;

    for (const radius of stages) {
      const count = validItemsWithin10Km.filter((item) => item.distanceKm! <= radius).length;
      if (count >= MIN_RESULTS) {
        selectedRadius = radius;
        break;
      }
    }

    const finalItems = validItemsWithin10Km.filter(
      (item) => item.distanceKm! <= selectedRadius
    );

    (finalItems as any).activeRadiusKm = selectedRadius;
    (finalItems as any).totalWithinRadius = finalItems.length;
    (finalItems as any).hasLocation = true;

    return finalItems;
  },

  /**
   * Helper method to get detailed Progressive Radius discovery result metadata.
   */
  async getProgressiveDiscoveryResultAsync(
    userLat?: number | null,
    userLng?: number | null
  ) {
    const items = await this.getNearbyLaundryPartnersAsync(userLat, userLng);
    return {
      items,
      activeRadiusKm: (items as any).activeRadiusKm ?? 0,
      totalWithinRadius: items.length,
      hasLocation: Boolean(userLat !== null && userLat !== undefined && userLng !== null && userLng !== undefined),
    };
  },
};

