export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type PricingType = 'per_kg' | 'per_item' | 'fixed';
export type AssignmentStatus = 'offered' | 'accepted' | 'rejected' | 'expired' | 'completed';
export type PayoutStatus = 'pending' | 'paid';

export interface LaundryPhoto {
  id: string;
  laundry_id: string;
  storage_path: string;
  public_url: string;
  photo_slot: number;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface Laundry {
  id: string;
  code: string;
  name: string;
  ownerId: string;
  ownerName?: string;
  description?: string;
  phone: string;
  address: string;
  latitude?: number;
  longitude?: number;
  logoUrl?: string;
  openingTime: string;
  closingTime: string;
  isOpen: boolean;
  isActive: boolean;
  verificationStatus: VerificationStatus;
  rating: number;
  totalReviews: number;
  createdAt: string;
  updatedAt?: string;
}

export interface LaundryMarketplaceItem {
  laundry: Laundry;
  storefrontImageUrl?: string;
  primaryPhoto?: LaundryPhoto;
  photos?: LaundryPhoto[];
  cheapestPrice?: number;
  cheapestUnit?: 'kg' | 'pcs';
  rating: number;
  reviewCount: number;
  distanceKm?: number;
  isFavorite?: boolean;
  badge?: string;
}

export interface LaundryUser {
  id: string;
  laundryId: string;
  profileId: string;
  role: 'owner' | 'staff';
  isActive: boolean;
  createdAt: string;
}

export interface LaundryService {
  id: string;
  laundryId: string;
  code: string;
  name: string;
  description: string;
  pricingType: PricingType;
  price: number;
  price_per_unit?: number;
  unit: 'kg' | 'pcs';
  minWeight?: number;
  estimatedHours: number;
  iconName: string;
  isActive: boolean;
  createdAt?: string;
}

export interface CourierAssignment {
  id: string;
  orderId: string;
  courierId: string;
  courierName?: string;
  assignmentType: 'pickup' | 'delivery';
  status: AssignmentStatus;
  offeredAt: string;
  respondedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface LaundryPayout {
  id: string;
  laundryId: string;
  orderId: string;
  grossAmount: number;
  platformFee: number;
  otherFee?: number;
  netAmount: number;
  status: PayoutStatus;
  paidAt?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  orderId: string;
  customerId: string;
  customerName?: string;
  laundryId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}
