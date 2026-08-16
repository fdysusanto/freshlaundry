import { supabase, isSupabaseConfigured } from './supabase';
import { isValidUuid } from '@/utils/formatters';

export interface CreateStaffPayload {
  fullName: string;
  email: string;
  password: string;
  laundryId: string;
  isActive?: boolean;
}

export interface UpdateStaffPayload {
  laundryId?: string;
  isActive?: boolean;
}

export interface LaundryStaffRecord {
  id: string;
  profileId: string;
  fullName: string;
  email: string;
  laundryId: string;
  laundryName: string;
  laundryCode: string;
  role: 'laundry_staff' | 'staff';
  isActive: boolean;
  createdAt: string;
}

export const adminStaffService = {
  /**
   * Mengambil daftar seluruh staf laundry yang terdaftar di platform.
   */
  async getStaffListAsync(): Promise<LaundryStaffRecord[]> {
    try {
      const headers: Record<string, string> = {};
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      }

      const res = await fetch('/api/admin/staff', { headers });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Gagal memuat daftar staf laundry.');
      }

      return data.staff || [];
    } catch (err: any) {
      console.warn('Fetch staff list error:', err);
      return [];
    }
  },

  /**
   * Membuat akun Laundry Staff baru (Platform Admin Only).
   */
  async createStaffAccountAsync(payload: CreateStaffPayload): Promise<LaundryStaffRecord> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }

    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || 'Gagal membuat akun staf laundry.');
    }

    return data.staff as LaundryStaffRecord;
  },

  /**
   * Memperbarui laundry assignment atau status aktif/nonaktif staf laundry.
   */
  async updateStaffAsync(staffMembershipId: string, payload: UpdateStaffPayload): Promise<boolean> {
    if (!isValidUuid(staffMembershipId)) {
      throw new Error('ID keanggotaan staf tidak valid.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }

    const res = await fetch(`/api/admin/staff/${staffMembershipId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || 'Gagal memperbarui data staf laundry.');
    }

    return true;
  },
};
