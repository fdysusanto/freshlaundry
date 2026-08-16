import { supabase, isSupabaseConfigured } from './supabase';
import { isValidUuid } from '@/utils/formatters';

export interface CreatePartnerApplicationPayload {
  ownerFullName: string;
  ownerPhone: string;
  laundryName: string;
  laundryAddress: string;
  city: string;
  district: string;
  provinceCode?: string;
  provinceName?: string;
  cityCode?: string;
  cityName?: string;
  districtCode?: string;
  districtName?: string;
  villageCode?: string;
  villageName?: string;
  postalCode?: string;
  rt?: string;
  rw?: string;
  addressDetail?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  openingTime?: string;
  closingTime?: string;
  payoutAccountHolder: string;
  payoutBank: string;
  payoutAccountNumber: string;
  services: Array<{
    name: string;
    code?: string;
    price: number;
    unit: 'kg' | 'pcs';
  }>;
}

export interface PartnerApplicationRecord {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  owner_full_name: string;
  owner_phone: string;
  laundry_name: string;
  laundry_address: string;
  city: string;
  district: string;
  province_code?: string | null;
  province_name?: string | null;
  city_code?: string | null;
  city_name?: string | null;
  district_code?: string | null;
  district_name?: string | null;
  village_code?: string | null;
  village_name?: string | null;
  postal_code?: string | null;
  rt?: string | null;
  rw?: string | null;
  address_detail?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  opening_time?: string | null;
  closing_time?: string | null;
  payout_account_holder: string;
  payout_bank: string;
  payout_account_number: string;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  services?: Array<{
    id: string;
    name: string;
    code: string;
    price_per_unit: number;
    unit: string;
  }>;
}

export const partnerApplicationService = {
  /**
   * Submit new partner application & draft services to live Supabase DB.
   */
  async createPartnerApplicationAsync(
    payload: CreatePartnerApplicationPayload
  ): Promise<PartnerApplicationRecord> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Koneksi Supabase belum terkonfigurasi.');
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      throw new Error('Sesi autentikasi tidak ditemukan. Silakan mendaftar atau login terlebih dahulu.');
    }

    const userId = session.user.id;
    if (!isValidUuid(userId)) {
      throw new Error('Identitas user tidak valid (bukan UUID).');
    }

    // Check if user already has a pending application
    const { data: existingPending } = await (supabase.from('partner_applications') as any)
      .select('id, status')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingPending) {
      throw new Error('Anda sudah memiliki pengajuan mitra yang sedang menunggu verifikasi.');
    }

    // Prepare numerical lat/lng
    const numLat = payload.latitude ? parseFloat(payload.latitude.toString()) : null;
    const numLng = payload.longitude ? parseFloat(payload.longitude.toString()) : null;

    // Prepare time string (HH:MM:SS)
    const formattedOpening = payload.openingTime
      ? payload.openingTime.includes(':') && payload.openingTime.split(':').length === 2
        ? `${payload.openingTime}:00`
        : payload.openingTime
      : '08:00:00';

    const formattedClosing = payload.closingTime
      ? payload.closingTime.includes(':') && payload.closingTime.split(':').length === 2
        ? `${payload.closingTime}:00`
        : payload.closingTime
      : '20:00:00';

    // 1. Insert into public.partner_applications
    const { data: application, error: appError } = await (supabase.from('partner_applications') as any)
      .insert({
        user_id: userId,
        status: 'pending',
        owner_full_name: payload.ownerFullName.trim(),
        owner_phone: payload.ownerPhone.trim(),
        laundry_name: payload.laundryName.trim(),
        laundry_address: payload.laundryAddress.trim(),
        city: payload.city.trim(),
        district: payload.district.trim(),
        province_code: payload.provinceCode || '32',
        province_name: payload.provinceName || 'Jawa Barat',
        city_code: payload.cityCode || '3274',
        city_name: payload.cityName || payload.city.trim(),
        district_code: payload.districtCode || null,
        district_name: payload.districtName || payload.district.trim(),
        village_code: payload.villageCode || null,
        village_name: payload.villageName || null,
        postal_code: payload.postalCode || null,
        rt: payload.rt || null,
        rw: payload.rw || null,
        address_detail: payload.addressDetail || payload.laundryAddress.trim(),
        latitude: isNaN(numLat as number) ? null : numLat,
        longitude: isNaN(numLng as number) ? null : numLng,
        opening_time: formattedOpening,
        closing_time: formattedClosing,
        payout_account_holder: payload.payoutAccountHolder.trim(),
        payout_bank: payload.payoutBank.trim(),
        payout_account_number: payload.payoutAccountNumber.trim(),
      })
      .select()
      .single();

    if (appError) {
      if (appError.code === '23505' || appError.message?.includes('idx_one_pending_app_per_user')) {
        throw new Error('Anda sudah memiliki pengajuan mitra yang sedang menunggu verifikasi.');
      }
      throw new Error(`Gagal menyimpan pengajuan mitra: ${appError.message}`);
    }

    if (!application) {
      throw new Error('Gagal membuat data pengajuan mitra.');
    }

    // 2. Insert draft services into public.partner_application_services
    if (payload.services && payload.services.length > 0) {
      const servicesToInsert = payload.services.map((s) => {
        let validCode = 'kiloan';
        if (s.code === 'express' || s.code === 'dry_clean' || s.code === 'satuan') {
          validCode = s.code;
        } else if (s.unit === 'pcs') {
          validCode = 'satuan';
        }

        return {
          application_id: application.id,
          name: s.name.trim(),
          code: validCode,
          price_per_unit: s.price,
          unit: s.unit || 'kg',
        };
      });

      const { error: servicesError } = await (supabase.from('partner_application_services') as any)
        .insert(servicesToInsert);

      if (servicesError) {
        console.warn('Warning inserting draft services:', servicesError.message);
      }
    }

    if (typeof window !== 'undefined') {
      console.log('[PARTNER-REGISTRATION-DIAGNOSTIC]', {
        authSource: 'supabase_auth',
        userIdIsUuid: isValidUuid(userId),
        applicationCreated: true,
        applicationStatus: 'pending',
        serviceCount: payload.services.length,
      });
    }

    return application as PartnerApplicationRecord;
  },

  /**
   * Retrieve live partner application for logged in user by user_id UUID.
   */
  async getPartnerApplicationByUserIdAsync(
    userId: string
  ): Promise<PartnerApplicationRecord | null> {
    if (!isSupabaseConfigured || !supabase || !isValidUuid(userId)) {
      return null;
    }

    try {
      const { data: application, error: appError } = await (supabase.from('partner_applications') as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (appError || !application) {
        return null;
      }

      // Fetch draft services
      const { data: draftServices } = await (supabase.from('partner_application_services') as any)
        .select('*')
        .eq('application_id', application.id);

      return {
        ...application,
        services: draftServices || [],
      } as PartnerApplicationRecord;
    } catch (err) {
      console.warn('Error fetching partner application:', err);
      return null;
    }
  },

  /**
   * Helper terpusat untuk mengambil pengajuan mitra milik user terautentikasi saat ini.
   */
  async getMyPartnerApplicationAsync(): Promise<PartnerApplicationRecord | null> {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        return null;
      }
      return this.getPartnerApplicationByUserIdAsync(session.user.id);
    } catch (err) {
      console.warn('Error fetching my partner application:', err);
      return null;
    }
  },

  /**
   * Revisi pengajuan mitra yang berstatus rejected secara in-place (mengubah status menjadi pending kembali).
   */
  async updatePartnerApplicationRevisionAsync(
    applicationId: string,
    payload: CreatePartnerApplicationPayload
  ): Promise<PartnerApplicationRecord> {
    if (!isSupabaseConfigured || !supabase || !isValidUuid(applicationId)) {
      throw new Error('Koneksi Supabase atau ID Pengajuan tidak valid.');
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      throw new Error('Sesi autentikasi tidak ditemukan. Silakan login terlebih dahulu.');
    }

    const userId = session.user.id;

    const { data: existingApp, error: fetchErr } = await (supabase.from('partner_applications') as any)
      .select('*')
      .eq('id', applicationId)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !existingApp) {
      throw new Error('Pengajuan mitra tidak ditemukan.');
    }

    if (existingApp.status !== 'rejected') {
      throw new Error('Hanya pengajuan berstatus ditolak yang dapat direvisi.');
    }

    const numLat = payload.latitude ? parseFloat(payload.latitude.toString()) : null;
    const numLng = payload.longitude ? parseFloat(payload.longitude.toString()) : null;

    const formattedOpening = payload.openingTime
      ? payload.openingTime.includes(':') && payload.openingTime.split(':').length === 2
        ? `${payload.openingTime}:00`
        : payload.openingTime
      : '08:00:00';

    const formattedClosing = payload.closingTime
      ? payload.closingTime.includes(':') && payload.closingTime.split(':').length === 2
        ? `${payload.closingTime}:00`
        : payload.closingTime
      : '20:00:00';

    const { data: updatedApp, error: updateErr } = await (supabase.from('partner_applications') as any)
      .update({
        status: 'pending',
        rejection_reason: null,
        reviewed_at: null,
        owner_full_name: payload.ownerFullName.trim(),
        owner_phone: payload.ownerPhone.trim(),
        laundry_name: payload.laundryName.trim(),
        laundry_address: payload.laundryAddress.trim(),
        city: payload.city.trim(),
        district: payload.district.trim(),
        province_code: payload.provinceCode || '32',
        province_name: payload.provinceName || 'Jawa Barat',
        city_code: payload.cityCode || '3274',
        city_name: payload.cityName || payload.city.trim(),
        district_code: payload.districtCode || null,
        district_name: payload.districtName || payload.district.trim(),
        village_code: payload.villageCode || null,
        village_name: payload.villageName || null,
        postal_code: payload.postalCode || null,
        rt: payload.rt || null,
        rw: payload.rw || null,
        address_detail: payload.addressDetail || payload.laundryAddress.trim(),
        latitude: isNaN(numLat as number) ? null : numLat,
        longitude: isNaN(numLng as number) ? null : numLng,
        opening_time: formattedOpening,
        closing_time: formattedClosing,
        payout_account_holder: payload.payoutAccountHolder.trim(),
        payout_bank: payload.payoutBank.trim(),
        payout_account_number: payload.payoutAccountNumber.trim(),
      })
      .eq('id', applicationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateErr || !updatedApp) {
      throw new Error(`Gagal memperbarui pengajuan revisi: ${updateErr?.message || 'Error tidak diketahui'}`);
    }

    await (supabase.from('partner_application_services') as any)
      .delete()
      .eq('application_id', applicationId);

    if (payload.services && payload.services.length > 0) {
      const servicesToInsert = payload.services.map((s) => {
        let validCode = 'kiloan';
        if (s.code === 'express' || s.code === 'dry_clean' || s.code === 'satuan') {
          validCode = s.code;
        } else if (s.unit === 'pcs') {
          validCode = 'satuan';
        }

        return {
          application_id: applicationId,
          name: s.name.trim(),
          code: validCode,
          price_per_unit: s.price,
          unit: s.unit || 'kg',
        };
      });

      await (supabase.from('partner_application_services') as any).insert(servicesToInsert);
    }

    if (typeof window !== 'undefined') {
      console.log('[PARTNER-REGISTRATION-FLOW]', {
        mode: 'revision_update',
        applicationId,
        statusChangedTo: 'pending',
      });
    }

    return updatedApp as PartnerApplicationRecord;
  },
};
