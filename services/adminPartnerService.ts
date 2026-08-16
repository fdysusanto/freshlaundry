import { supabase, isSupabaseConfigured } from './supabase';
import { isValidUuid } from '@/utils/formatters';
import { PartnerApplicationRecord } from './partnerApplicationService';

export const adminPartnerService = {
  /**
   * Mengambil seluruh pengajuan mitra laundry untuk dikaji oleh Admin Platform.
   */
  async getPartnerApplicationsAsync(): Promise<PartnerApplicationRecord[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    try {
      const { data: applications, error: appError } = await (supabase.from('partner_applications') as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (appError || !applications) {
        console.warn('Fetch partner applications for admin warning:', appError?.message);
        return [];
      }

      // Fetch draft services for all applications
      const { data: allServices } = await (supabase.from('partner_application_services') as any)
        .select('*');

      const servicesMap = new Map<string, any[]>();
      if (allServices) {
        allServices.forEach((s: any) => {
          const list = servicesMap.get(s.application_id) || [];
          list.push(s);
          servicesMap.set(s.application_id, list);
        });
      }

      return applications.map((app: any) => ({
        ...app,
        services: servicesMap.get(app.id) || [],
      })) as PartnerApplicationRecord[];
    } catch (err) {
      console.warn('Error in getPartnerApplicationsAsync:', err);
      return [];
    }
  },

  /**
   * Memanggil RPC Stored Procedure approve_partner_application secara atomik di Supabase.
   * RPC secara otomatis mengambil auth.uid() dari sesi Supabase Auth yang sedang login.
   */
  async approvePartnerApplicationAsync(
    applicationId: string
  ): Promise<{ success: boolean; laundry_id?: string; already_approved?: boolean; message?: string }> {
    if (!isSupabaseConfigured || !supabase || !isValidUuid(applicationId)) {
      throw new Error('Koneksi Supabase atau ID Pengajuan tidak valid.');
    }

    const { data, error } = await (supabase as any).rpc('approve_partner_application', {
      p_application_id: applicationId,
    });

    if (error) {
      throw new Error(`Gagal menyetujui pengajuan mitra: ${error.message}`);
    }

    return data as { success: boolean; laundry_id?: string; already_approved?: boolean; message?: string };
  },

  /**
   * Memanggil RPC Stored Procedure reject_partner_application di Supabase.
   * RPC secara otomatis mengambil auth.uid() dari sesi Supabase Auth yang sedang login.
   */
  async rejectPartnerApplicationAsync(
    applicationId: string,
    reason: string
  ): Promise<{ success: boolean; already_rejected?: boolean; message?: string }> {
    const trimmed = reason ? reason.trim() : '';
    if (!trimmed || trimmed.length < 5) {
      throw new Error('Alasan penolakan wajib diisi (minimal 5 karakter).');
    }

    if (!isSupabaseConfigured || !supabase || !isValidUuid(applicationId)) {
      throw new Error('Koneksi Supabase atau ID Pengajuan tidak valid.');
    }

    const { data, error } = await (supabase as any).rpc('reject_partner_application', {
      p_application_id: applicationId,
      p_reason: trimmed,
    });

    if (error) {
      throw new Error(`Gagal menolak pengajuan mitra: ${error.message}`);
    }

    return data as { success: boolean; already_rejected?: boolean; message?: string };
  },
};
