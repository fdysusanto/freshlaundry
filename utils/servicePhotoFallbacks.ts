/**
 * FreshLaundry / Cuciyan Service Photo Fallbacks & Resolvers
 * Provides high-quality, relevant canonical photos when a partner hasn't uploaded a custom photo.
 */

export const CANONICAL_SERVICE_FALLBACKS: Record<string, string> = {
  // Category-based fallbacks
  'Pakaian': 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=600&q=80',
  'Sepatu & Sandal': 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=600&q=80',
  'Tas': 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=80',
  'Karpet': 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?auto=format&fit=crop&w=600&q=80',
  'Sofa': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80',

  // Service Type / Code based fallbacks
  'kiloan': 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=600&q=80',
  'express': 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=600&q=80',
  'dry_clean': 'https://images.unsplash.com/photo-1521656693074-0ef32e80a5d5?auto=format&fit=crop&w=600&q=80',
  'satuan': 'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?auto=format&fit=crop&w=600&q=80',

  // Master Catch-All Fallback
  'default': 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=600&q=80',
};

export interface ResolvableService {
  imageUrl?: string | null;
  category?: string | null;
  code?: string | null;
  name?: string | null;
}

/**
 * Resolves the appropriate photo URL for a laundry service.
 * Returns partner custom photo if available, otherwise resolves canonical fallback.
 */
export function resolveServicePhoto(service?: ResolvableService | null): string {
  if (!service) {
    return CANONICAL_SERVICE_FALLBACKS['default'];
  }

  // 1. Return partner custom photo if valid
  if (service.imageUrl && typeof service.imageUrl === 'string' && service.imageUrl.trim() !== '') {
    return service.imageUrl.trim();
  }

  // 2. Fallback based on specific service name clues (e.g. Sepatu, Selimut, Bed Cover)
  const lowerName = (service.name || '').toLowerCase();
  if (lowerName.includes('sepatu') || lowerName.includes('sneaker') || lowerName.includes('sandal')) {
    return CANONICAL_SERVICE_FALLBACKS['Sepatu & Sandal'];
  }
  if (lowerName.includes('tas') || lowerName.includes('bag') || lowerName.includes('backpack')) {
    return CANONICAL_SERVICE_FALLBACKS['Tas'];
  }
  if (lowerName.includes('karpet') || lowerName.includes('rug')) {
    return CANONICAL_SERVICE_FALLBACKS['Karpet'];
  }
  if (lowerName.includes('sofa') || lowerName.includes('kasur') || lowerName.includes('springbed')) {
    return CANONICAL_SERVICE_FALLBACKS['Sofa'];
  }
  if (lowerName.includes('bed cover') || lowerName.includes('selimut') || lowerName.includes('sprei')) {
    return 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80';
  }

  // 3. Fallback based on canonical category
  if (service.category && CANONICAL_SERVICE_FALLBACKS[service.category]) {
    return CANONICAL_SERVICE_FALLBACKS[service.category];
  }

  // 4. Fallback based on service code/type
  if (service.code && CANONICAL_SERVICE_FALLBACKS[service.code]) {
    return CANONICAL_SERVICE_FALLBACKS[service.code];
  }

  return CANONICAL_SERVICE_FALLBACKS['default'];
}
