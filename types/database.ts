import { OrderStatus, ServiceType } from './order';
import { UserRole } from './user';
import { VerificationStatus, AssignmentStatus, PayoutStatus } from './laundry';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string;
          role: UserRole;
          avatar_url: string | null;
          address: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      laundries: {
        Row: {
          id: string;
          code: string;
          name: string;
          owner_id: string;
          description: string | null;
          phone: string;
          address: string;
          latitude: number | null;
          longitude: number | null;
          logo_url: string | null;
          opening_time: string;
          closing_time: string;
          is_open: boolean;
          is_active: boolean;
          verification_status: VerificationStatus;
          rating: number;
          total_reviews: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['laundries']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['laundries']['Insert']>;
      };
      laundry_photos: {
        Row: {
          id: string;
          laundry_id: string;
          storage_path: string;
          public_url: string;
          photo_slot: number;
          sort_order: number;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['laundry_photos']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['laundry_photos']['Insert']>;
      };
      laundry_users: {
        Row: {
          id: string;
          laundry_id: string;
          profile_id: string;
          role: 'owner' | 'staff';
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['laundry_users']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['laundry_users']['Insert']>;
      };
      services: {
        Row: {
          id: string;
          laundry_id: string;
          code: ServiceType;
          name: string;
          description: string;
          pricing_type: string;
          price_per_unit: number;
          unit: 'kg' | 'pcs';
          min_weight: number | null;
          estimated_hours: number;
          icon_name: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['services']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['services']['Insert']>;
      };
      orders: {
        Row: {
          id: string;
          tracking_number: string;
          customer_id: string;
          laundry_id: string;
          courier_id: string | null;
          service_type: ServiceType;
          status: OrderStatus;
          estimated_weight_kg: number | null;
          final_weight_kg: number | null;
          pickup_address: string;
          delivery_address: string;
          pickup_date: string;
          pickup_time_slot: string;
          delivery_date: string | null;
          notes: string | null;
          subtotal: number;
          delivery_fee: number;
          platform_fee: number;
          discount: number;
          total_price: number;
          payment_status: 'unpaid' | 'paid';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'tracking_number' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          service_id: string | null;
          service_name_snapshot: string;
          price_snapshot: number;
          estimated_weight: number | null;
          actual_weight: number | null;
          quantity: number;
          subtotal: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>;
      };
      order_status_logs: {
        Row: {
          id: string;
          order_id: string;
          status: OrderStatus;
          notes: string | null;
          updated_by: string;
          timestamp: string;
        };
        Insert: Omit<Database['public']['Tables']['order_status_logs']['Row'], 'id' | 'timestamp'>;
        Update: Partial<Database['public']['Tables']['order_status_logs']['Insert']>;
      };
      courier_assignments: {
        Row: {
          id: string;
          order_id: string;
          courier_id: string;
          assignment_type: 'pickup' | 'delivery';
          status: AssignmentStatus;
          offered_at: string;
          responded_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['courier_assignments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['courier_assignments']['Insert']>;
      };
      laundry_payouts: {
        Row: {
          id: string;
          laundry_id: string;
          order_id: string;
          gross_amount: number;
          platform_fee: number;
          other_fee: number | null;
          net_amount: number;
          status: PayoutStatus;
          paid_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['laundry_payouts']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['laundry_payouts']['Insert']>;
      };
      reviews: {
        Row: {
          id: string;
          order_id: string;
          customer_id: string;
          laundry_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['reviews']['Insert']>;
      };
      payment_attempts: {
        Row: {
          id: string;
          order_id: string;
          customer_id: string;
          provider: string;
          provider_reference: string | null;
          payment_method: string;
          amount: number;
          currency: string;
          status: string;
          idempotency_key: string;
          expires_at: string | null;
          paid_at: string | null;
          raw_response: any | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payment_attempts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['payment_attempts']['Insert']>;
      };
    };
  };
}
