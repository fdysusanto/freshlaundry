export type UserRole =
  | 'customer'
  | 'courier'
  | 'laundry_owner'
  | 'laundry_staff'
  | 'platform_admin'
  | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  laundryId?: string;
  avatarUrl?: string;
  address?: string;
  createdAt: string;
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
