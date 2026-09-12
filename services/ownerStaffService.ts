import { supabase, isSupabaseConfigured } from './supabase';
import { isValidUuid } from '@/utils/formatters';

export interface CreateOwnerStaffPayload {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  laundryId: string;
  isActive?: boolean;
}

export interface OwnerStaffRecord {
  id: string;
  profileId: string;
  fullName: string;
  email: string;
  phone?: string;
  laundryId: string;
  laundryName: string;
  laundryCode: string;
  role: 'laundry_staff' | 'staff';
  isActive: boolean;
  createdAt: string;
}

const MOCK_STAFF_STORAGE_KEY = 'cuciyan_owner_staff_store';
let inMemoryMockStaffStore: OwnerStaffRecord[] = [];

function getMockStaffStore(): OwnerStaffRecord[] {
  if (typeof window !== 'undefined') {
    try {
      const data = localStorage.getItem(MOCK_STAFF_STORAGE_KEY);
      return data ? JSON.parse(data) : inMemoryMockStaffStore;
    } catch {
      return inMemoryMockStaffStore;
    }
  }
  return inMemoryMockStaffStore;
}

function saveMockStaffStore(store: OwnerStaffRecord[]) {
  inMemoryMockStaffStore = store;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(MOCK_STAFF_STORAGE_KEY, JSON.stringify(store));
    } catch {}
  }
}

export const ownerStaffService = {
  /**
   * Mengambil daftar staf untuk cabang laundry tertentu yang dimiliki oleh owner.
   */
  async getStaffByLaundryAsync(laundryId: string): Promise<OwnerStaffRecord[]> {
    if (!laundryId) return [];

    if (typeof window === 'undefined' && !isSupabaseConfigured) {
      const mockList = getMockStaffStore();
      return mockList.filter((s) => s.laundryId === laundryId);
    }

    const headers: Record<string, string> = {};
    if (typeof window !== 'undefined' && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }

    const res = await fetch(`/api/owner/staff?laundryId=${encodeURIComponent(laundryId)}`, { headers });
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (typeof window === 'undefined') {
        const mockList = getMockStaffStore();
        return mockList.filter((s) => s.laundryId === laundryId);
      }
      throw new Error(data.error || data.message || 'Gagal memuat staf cabang laundry.');
    }

    return data.staff || [];
  },

  /**
   * Daftarkan staf cabang baru oleh owner.
   */
  async createStaffAccountAsync(payload: CreateOwnerStaffPayload): Promise<OwnerStaffRecord> {
    if (!payload.laundryId) {
      throw new Error('Cabang laundry wajib dipilih.');
    }

    if (typeof window === 'undefined' && !isSupabaseConfigured) {
      const newStaff: OwnerStaffRecord = {
        id: `lu_staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        profileId: `prof_staff_${Date.now()}`,
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone || '',
        laundryId: payload.laundryId,
        laundryName: 'Outlet Laundry',
        laundryCode: 'LND',
        role: 'laundry_staff',
        isActive: payload.isActive ?? true,
        createdAt: new Date().toISOString(),
      };
      const current = getMockStaffStore();
      saveMockStaffStore([newStaff, ...current]);
      return newStaff;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (typeof window !== 'undefined' && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }

    const res = await fetch('/api/owner/staff', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      if (typeof window === 'undefined') {
        const newStaff: OwnerStaffRecord = {
          id: `lu_staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          profileId: `prof_staff_${Date.now()}`,
          fullName: payload.fullName,
          email: payload.email,
          phone: payload.phone || '',
          laundryId: payload.laundryId,
          laundryName: 'Outlet Laundry',
          laundryCode: 'LND',
          role: 'laundry_staff',
          isActive: payload.isActive ?? true,
          createdAt: new Date().toISOString(),
        };
        const current = getMockStaffStore();
        saveMockStaffStore([newStaff, ...current]);
        return newStaff;
      }
      throw new Error(data.error || data.message || 'Gagal membuat akun staf cabang.');
    }

    return data.staff as OwnerStaffRecord;
  },

  /**
   * Mengubah status aktif/non-aktif staf (Soft Deactivation).
   */
  async toggleStaffStatusAsync(staffMembershipId: string, isActive: boolean): Promise<boolean> {
    if (!staffMembershipId) {
      throw new Error('ID staf tidak valid.');
    }

    if (typeof window === 'undefined' && !isSupabaseConfigured) {
      const current = getMockStaffStore();
      const idx = current.findIndex((s) => s.id === staffMembershipId);
      if (idx !== -1) {
        current[idx].isActive = isActive;
        saveMockStaffStore(current);
      }
      return true;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (typeof window !== 'undefined' && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }

    const res = await fetch(`/api/owner/staff/${staffMembershipId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ isActive }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      if (typeof window === 'undefined') {
        const current = getMockStaffStore();
        const idx = current.findIndex((s) => s.id === staffMembershipId);
        if (idx !== -1) {
          current[idx].isActive = isActive;
          saveMockStaffStore(current);
        }
        return true;
      }
      throw new Error(data.error || data.message || 'Gagal memperbarui status staf cabang.');
    }

    return true;
  },
};
