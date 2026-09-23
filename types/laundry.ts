export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type PricingType = 'per_kg' | 'per_item' | 'fixed';
export type AssignmentStatus = 'offered' | 'accepted' | 'rejected' | 'expired' | 'completed';
export type PayoutStatus = 'pending' | 'paid';

export type PartnerLifecycleStatus =
  | 'unclaimed'
  | 'listed'
  | 'order_ready'
  | 'supplier'
  | 'claimed'
  | 'onboarding'
  | 'active'
  | 'partner'
  | 'suspended'
  | 'inactive';

export type PartnerClaimStatus = 'unclaimed' | 'claimed';
export type PartnerOnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'rejected';

export type PartnerPermission =
  | 'PARTNER_VIEW'
  | 'PARTNER_CREATE'
  | 'PARTNER_UPDATE'
  | 'PARTNER_STATUS_UPDATE'
  | 'PARTNER_VERIFY'
  | 'PARTNER_SUSPEND'
  | 'PARTNER_INVITE_OWNER'
  | 'PARTNER_VIEW_USERS'
  | 'PARTNER_VIEW_BRANCHES'
  | 'PARTNER_VIEW_ORDERS'
  | 'PARTNER_VIEW_PERFORMANCE'
  | 'PARTNER_VIEW_AUDIT';

export type ServiceCategory = 'Pakaian' | 'Sepatu & Sandal' | 'Tas' | 'Karpet' | 'Sofa';
export const CANONICAL_SERVICE_CATEGORIES: ServiceCategory[] = [
  'Pakaian',
  'Sepatu & Sandal',
  'Tas',
  'Karpet',
  'Sofa',
];

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
  ownerId: string | null;
  ownerName?: string;
  ownerEmail?: string;
  legalName?: string;
  businessEmail?: string;
  description?: string;
  phone: string;
  address: string;
  cityName?: string;
  districtName?: string;
  latitude?: number;
  longitude?: number;
  logoUrl?: string;
  openingTime: string;
  closingTime: string;
  isOpen: boolean;
  isActive: boolean;
  verificationStatus: VerificationStatus;
  status?: PartnerLifecycleStatus;
  claimStatus?: PartnerClaimStatus;
  onboardingStatus?: PartnerOnboardingStatus;
  suspendedAt?: string;
  suspensionReason?: string;
  createdBy?: string;
  updatedBy?: string;
  rating: number;
  totalReviews: number;
  createdAt: string;
  updatedAt?: string;
  branchesCount?: number;
  activeOrdersCount?: number;
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
  serviceCategories?: ServiceCategory[];
}

export interface LaundryUser {
  id: string;
  laundryId: string;
  profileId: string;
  role: 'owner' | 'staff';
  fullName?: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

export interface LaundryService {
  id: string;
  laundryId: string;
  code: string;
  name: string;
  description: string;
  category?: ServiceCategory | null;
  pricingType: PricingType;
  price: number;
  price_per_unit?: number;
  unit: 'kg' | 'pcs';
  minWeight?: number | null;
  minimumQuantity?: number | null;
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

export interface AuditLogRecord {
  id: string;
  actor_user_id: string | null;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_value: any;
  after_value: any;
  reason: string | null;
  metadata: any;
  timestamp: string;
  actorName?: string;
}
