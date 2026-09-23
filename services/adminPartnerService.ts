import { supabase, isSupabaseConfigured, createAuthenticatedClient } from './supabase';
import { isValidUuid } from '@/utils/formatters';
import { Laundry, PartnerLifecycleStatus, AuditLogRecord, LaundryUser } from '@/types/laundry';
import { PartnerApplicationRecord } from './partnerApplicationService';
import { DEMO_LAUNDRIES, ServiceCatalogItem } from '@/utils/constants';
import { laundryService } from './laundryService';

const getClient = (accessToken?: string) =>
  accessToken && isSupabaseConfigured
    ? createAuthenticatedClient(accessToken) || supabase
    : supabase;

export interface CreatePartnerListingPayload {
  name: string;
  category?: string;
  address: string;
  cityName?: string;
  districtName?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  businessEmail?: string;
  legalName?: string;
  notes?: string;
}

export interface PartnerFilterParams {
  status?: string;
  verificationStatus?: string;
  claimStatus?: string;
  onboardingStatus?: string;
  cityName?: string;
  districtName?: string;
  searchQuery?: string;
}

export interface CreatePartnerServicePayload {
  name: string;
  code: string;
  description?: string;
  category?: string;
  pricingType?: 'per_kg' | 'per_item' | 'fixed';
  price: number;
  unit?: 'kg' | 'pcs';
  minWeight?: number | null;
  estimatedHours?: number;
  iconName?: string;
  isActive?: boolean;
}

export interface UpdatePartnerServicePayload {
  name?: string;
  code?: string;
  description?: string;
  category?: string;
  pricingType?: 'per_kg' | 'per_item' | 'fixed';
  price?: number;
  unit?: 'kg' | 'pcs';
  minWeight?: number | null;
  estimatedHours?: number;
  iconName?: string;
  isActive?: boolean;
}

export const adminPartnerService = {
  /**
   * Fetch all partner applications for Admin review.
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
        console.warn('Fetch partner applications warning:', appError?.message);
        return [];
      }

      const { data: allServices } = await (supabase.from('partner_application_services') as any).select('*');

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
   * Approve partner application via RPC.
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
   * Reject partner application via RPC.
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

  /**
   * Fetch all partners from public.laundries with filters.
   */
  async getAllPartnersAsync(filters: PartnerFilterParams = {}, accessToken?: string): Promise<Laundry[]> {
    if (!isSupabaseConfigured || !supabase) {
      // Return mapped demo laundries as fallback
      let list: Laundry[] = DEMO_LAUNDRIES.map((l) => ({
        ...l,
        status: (l.isActive ? 'active' : 'inactive') as PartnerLifecycleStatus,
        claimStatus: 'claimed',
        onboardingStatus: 'completed',
        cityName: 'Cirebon',
        districtName: 'Kesambi',
      }));

      if (filters.status && filters.status !== 'all') {
        list = list.filter((l) => l.status === filters.status);
      }
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        list = list.filter((l) => l.name.toLowerCase().includes(q) || l.address.toLowerCase().includes(q) || l.id.includes(q));
      }
      return list;
    }

    try {
      const client = getClient(accessToken)!;
      let query = (client.from('laundries') as any)
        .select(`
          *,
          profiles:owner_id (full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.verificationStatus && filters.verificationStatus !== 'all') {
        query = query.eq('verification_status', filters.verificationStatus);
      }
      if (filters.claimStatus && filters.claimStatus !== 'all') {
        query = query.eq('claim_status', filters.claimStatus);
      }
      if (filters.onboardingStatus && filters.onboardingStatus !== 'all') {
        query = query.eq('onboarding_status', filters.onboardingStatus);
      }
      if (filters.cityName && filters.cityName !== 'all') {
        query = query.ilike('city_name', `%${filters.cityName}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Gagal mengambil data partner: ${error.message}`);
      }

      let partners: Laundry[] = (data || []).map((l: any) => ({
        id: l.id,
        code: l.code || l.id.slice(0, 8),
        name: l.name,
        ownerId: l.owner_id || null,
        ownerName: l.profiles?.full_name || (l.owner_id ? 'Terklaim' : 'Belum Diklaim'),
        ownerEmail: l.profiles?.email || l.business_email,
        legalName: l.legal_name || undefined,
        businessEmail: l.business_email || undefined,
        description: l.description || undefined,
        phone: l.phone,
        address: l.address,
        cityName: l.city_name || l.city || undefined,
        districtName: l.district_name || l.district || undefined,
        latitude: l.latitude ? Number(l.latitude) : undefined,
        longitude: l.longitude ? Number(l.longitude) : undefined,
        logoUrl: l.logo_url || undefined,
        openingTime: l.opening_time || '08:00',
        closingTime: l.closing_time || '20:00',
        isOpen: typeof l.is_open === 'boolean' ? l.is_open : Boolean(l.is_open),
        isActive: l.is_active ?? true,
        verificationStatus: l.verification_status || 'pending',
        status: (l.status || (l.is_active ? 'active' : 'inactive')) as PartnerLifecycleStatus,
        claimStatus: l.claim_status || (l.owner_id ? 'claimed' : 'unclaimed'),
        onboardingStatus: l.onboarding_status || (l.verification_status === 'verified' ? 'completed' : 'in_progress'),
        suspendedAt: l.suspended_at || undefined,
        suspensionReason: l.suspension_reason || undefined,
        createdBy: l.created_by || undefined,
        updatedBy: l.updated_by || undefined,
        rating: Number(l.rating || 5.0),
        totalReviews: l.total_reviews || 0,
        createdAt: l.created_at || new Date().toISOString(),
      }));

      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase().trim();
        partners = partners.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.address.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q) ||
            (p.cityName && p.cityName.toLowerCase().includes(q))
        );
      }

      return partners;
    } catch (err: any) {
      console.error('Error in getAllPartnersAsync:', err);
      throw new Error(err.message || 'Gagal memuat daftar partner');
    }
  },

  /**
   * Get single partner detail.
   */
  async getPartnerDetailAsync(partnerId: string, accessToken?: string): Promise<Laundry | null> {
    if (!isSupabaseConfigured || !supabase || !isValidUuid(partnerId)) {
      const demo = DEMO_LAUNDRIES.find((l) => l.id === partnerId);
      if (demo) {
        return {
          ...demo,
          status: 'active',
          claimStatus: 'claimed',
          onboardingStatus: 'completed',
          cityName: 'Cirebon',
        };
      }
      return null;
    }

    const client = getClient(accessToken)!;
    const { data: l, error } = await (client.from('laundries') as any)
      .select(`
        *,
        profiles:owner_id (full_name, email, phone)
      `)
      .eq('id', partnerId)
      .single();

    if (error || !l) return null;

    return {
      id: l.id,
      code: l.code || l.id.slice(0, 8),
      name: l.name,
      ownerId: l.owner_id || null,
      ownerName: l.profiles?.full_name || (l.owner_id ? 'Terklaim' : 'Belum Diklaim'),
      ownerEmail: l.profiles?.email || l.business_email,
      legalName: l.legal_name || undefined,
      businessEmail: l.business_email || undefined,
      description: l.description || undefined,
      phone: l.phone,
      address: l.address,
      cityName: l.city_name || undefined,
      districtName: l.district_name || undefined,
      latitude: l.latitude ? Number(l.latitude) : undefined,
      longitude: l.longitude ? Number(l.longitude) : undefined,
      logoUrl: l.logo_url || undefined,
      openingTime: l.opening_time || '08:00',
      closingTime: l.closing_time || '20:00',
      isOpen: typeof l.is_open === 'boolean' ? l.is_open : Boolean(l.is_open),
      isActive: l.is_active ?? true,
      verificationStatus: l.verification_status || 'pending',
      status: (l.status || (l.is_active ? 'active' : 'inactive')) as PartnerLifecycleStatus,
      claimStatus: l.claim_status || (l.owner_id ? 'claimed' : 'unclaimed'),
      onboardingStatus: l.onboarding_status || (l.verification_status === 'verified' ? 'completed' : 'in_progress'),
      suspendedAt: l.suspended_at || undefined,
      suspensionReason: l.suspension_reason || undefined,
      createdBy: l.created_by || undefined,
      updatedBy: l.updated_by || undefined,
      rating: Number(l.rating || 5.0),
      totalReviews: l.total_reviews || 0,
      createdAt: l.created_at || new Date().toISOString(),
    };
  },

  /**
   * Create new partner listing (UNCLAIMED / LISTED status, no auto owner account).
   */
  async createPartnerListingAsync(payload: CreatePartnerListingPayload, accessToken?: string): Promise<{ success: boolean; laundry_id: string; code: string }> {
    if (!payload.name || payload.name.trim().length < 3) {
      throw new Error('Nama bisnis laundry wajib diisi minimal 3 karakter.');
    }

    if (!isSupabaseConfigured || !supabase) {
      return {
        success: true,
        laundry_id: `lnd_new_${Date.now()}`,
        code: `LND-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      };
    }

    const client = getClient(accessToken)!;
    const { data, error } = await (client as any).rpc('create_partner_listing_atomic', {
      p_name: payload.name.trim(),
      p_phone: payload.phone || '-',
      p_address: payload.address || '-',
      p_city_name: payload.cityName || null,
      p_district_name: payload.districtName || null,
      p_latitude: payload.latitude || null,
      p_longitude: payload.longitude || null,
      p_legal_name: payload.legalName || null,
      p_business_email: payload.businessEmail || null,
      p_notes: payload.notes || null,
    });

    if (error) {
      throw new Error(`Gagal membuat partner listing: ${error.message}`);
    }

    return data as { success: boolean; laundry_id: string; code: string };
  },

  /**
   * Update partner status with validated transitions and mandatory suspension reason.
   */
  async updatePartnerStatusAsync(
    partnerId: string,
    targetStatus: PartnerLifecycleStatus,
    reason?: string,
    accessToken?: string
  ): Promise<{ success: boolean; previous_status?: string; new_status?: string }> {
    if (!isValidUuid(partnerId)) {
      return { success: true, new_status: targetStatus };
    }

    if (targetStatus === 'suspended') {
      const trimmed = reason ? reason.trim() : '';
      if (!trimmed || trimmed.length < 5) {
        throw new Error('Alasan penghentian sementara (suspend) wajib diisi minimal 5 karakter.');
      }
    }

    if (!isSupabaseConfigured || !supabase) {
      return { success: true, new_status: targetStatus };
    }

    const client = getClient(accessToken)!;
    const { data, error } = await (client as any).rpc('update_partner_status_atomic', {
      p_laundry_id: partnerId,
      p_target_status: targetStatus,
      p_reason: reason || null,
    });

    if (error) {
      throw new Error(`Gagal memperbarui status partner: ${error.message}`);
    }

    return data;
  },

  /**
   * Set partner operational availability (BUKA / TUTUP) via atomic RPC.
   * Gated strictly to Platform Ops Admin.
   * Modifies ONLY laundries.is_open, preserving partner lifecycle status and is_active.
   */
  async setPartnerOperationalStatusAsync(
    partnerId: string,
    isOpen: boolean,
    accessToken?: string
  ): Promise<{ success: boolean; is_open: boolean; is_idempotent?: boolean; message: string }> {
    if (!isValidUuid(partnerId)) {
      throw new Error('ID partner tidak valid.');
    }

    if (!isSupabaseConfigured || !supabase) {
      return {
        success: true,
        is_open: isOpen,
        is_idempotent: false,
        message: `Status operasional partner berhasil diubah menjadi ${isOpen ? 'BUKA' : 'TUTUP'} (Mock Mode).`,
      };
    }

    const client = getClient(accessToken)!;
    const { data, error } = await (client as any).rpc('admin_set_partner_operational_status_atomic', {
      p_laundry_id: partnerId,
      p_is_open: isOpen,
    });

    if (error) {
      throw new Error(error.message || `Gagal mengubah status operasional toko menjadi ${isOpen ? 'BUKA' : 'TUTUP'}.`);
    }

    return data;
  },

  /**
   * Update platform-level partner fields.
   */
  async updatePartnerPlatformFieldsAsync(
    partnerId: string,
    updates: Partial<Laundry>
  ): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUuid(partnerId)) return;

    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) dbUpdates.name = updates.name.trim();
    if (updates.legalName !== undefined) dbUpdates.legal_name = updates.legalName;
    if (updates.businessEmail !== undefined) dbUpdates.business_email = updates.businessEmail;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.cityName !== undefined) dbUpdates.city_name = updates.cityName;
    if (updates.districtName !== undefined) dbUpdates.district_name = updates.districtName;

    const { error } = await (supabase.from('laundries') as any)
      .update(dbUpdates)
      .eq('id', partnerId);

    if (error) {
      throw new Error(`Gagal memperbarui data partner: ${error.message}`);
    }
  },

  /**
   * Verify partner listing.
   */
  async verifyPartnerAsync(partnerId: string, verificationStatus: 'verified' | 'rejected', _notes?: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUuid(partnerId)) return;

    const { error } = await (supabase.from('laundries') as any)
      .update({
        verification_status: verificationStatus,
        onboarding_status: verificationStatus === 'verified' ? 'completed' : 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', partnerId);

    if (error) {
      throw new Error(`Gagal memverifikasi partner: ${error.message}`);
    }
  },

  /**
   * Generate owner invitation link/token via database RPC.
   */
  async inviteOwnerAsync(partnerId: string, ownerEmail: string, accessToken?: string): Promise<{ success: boolean; invite_link: string; invite_token?: string }> {
    if (!ownerEmail || !ownerEmail.includes('@')) {
      throw new Error('Alamat email pemilik tidak valid.');
    }

    if (!isSupabaseConfigured || !supabase || !isValidUuid(partnerId)) {
      const mockToken = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return {
        success: true,
        invite_link: `/register/partner?claim_token=${mockToken}&laundry_id=${partnerId}`,
        invite_token: mockToken,
      };
    }

    const client = getClient(accessToken)!;
    const { data, error } = await (client as any).rpc('invite_partner_owner_atomic', {
      p_laundry_id: partnerId,
      p_owner_email: ownerEmail.trim(),
    });

    if (error) {
      throw new Error(`Gagal mengundang pemilik partner: ${error.message}`);
    }

    const inviteToken = data.invite_token;
    return {
      success: true,
      invite_link: `/register/partner?claim_token=${inviteToken}&laundry_id=${partnerId}`,
      invite_token: inviteToken,
    };
  },

  /**
   * Claim partner listing using a secure invitation token via database RPC.
   */
  async claimPartnerListingAsync(inviteToken: string): Promise<{ success: boolean; laundry_id: string; message: string }> {
    if (!inviteToken || !inviteToken.trim()) {
      throw new Error('Token klaim bisnis wajib diisi.');
    }

    if (!isSupabaseConfigured || !supabase) {
      return {
        success: true,
        laundry_id: `lnd_claimed_${Date.now()}`,
        message: 'Partner laundry berhasil diklaim!',
      };
    }

    const { data, error } = await (supabase as any).rpc('claim_partner_listing_atomic', {
      p_invite_token: inviteToken.trim(),
    });

    if (error) {
      throw new Error(`Gagal mengklaim bisnis partner: ${error.message}`);
    }

    return data;
  },

  /**
   * Fetch immutable audit logs for a partner.
   */
  async getPartnerAuditLogsAsync(partnerId: string): Promise<AuditLogRecord[]> {
    if (!isSupabaseConfigured || !supabase || !isValidUuid(partnerId)) return [];

    try {
      const { data, error } = await (supabase.from('audit_logs') as any)
        .select(`
          *,
          profiles:actor_user_id (full_name)
        `)
        .eq('entity_id', partnerId)
        .order('timestamp', { ascending: false });

      if (error || !data) return [];

      return data.map((log: any) => ({
        id: log.id,
        actor_user_id: log.actor_user_id,
        actor_role: log.actor_role,
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        before_value: log.before_value,
        after_value: log.after_value,
        reason: log.reason,
        metadata: log.metadata,
        timestamp: log.timestamp,
        actorName: log.profiles?.full_name || 'Platform Ops Admin',
      }));
    } catch {
      return [];
    }
  },

  /**
   * Fetch partner users (Owners & Staff).
   */
  async getPartnerUsersAsync(partnerId: string): Promise<LaundryUser[]> {
    if (!isSupabaseConfigured || !supabase || !isValidUuid(partnerId)) return [];

    const { data, error } = await (supabase.from('laundry_users') as any)
      .select(`
        *,
        profiles:profile_id (full_name, email, phone)
      `)
      .eq('laundry_id', partnerId);

    if (error || !data) return [];

    return data.map((u: any) => ({
      id: u.id,
      laundryId: u.laundry_id,
      profileId: u.profile_id,
      role: u.role as 'owner' | 'staff',
      fullName: u.profiles?.full_name || 'Staff User',
      email: u.profiles?.email || undefined,
      phone: u.profiles?.phone || undefined,
      isActive: u.is_active ?? true,
      createdAt: u.created_at || new Date().toISOString(),
    }));
  },

  /**
   * Fetch all services for a partner laundry (including active and inactive).
   */
  async getPartnerServicesAsync(partnerId: string, accessToken?: string): Promise<ServiceCatalogItem[]> {
    if (!isValidUuid(partnerId)) {
      return laundryService.getServicesByLaundry(partnerId);
    }

    if (!isSupabaseConfigured || !supabase) {
      return laundryService.getServicesByLaundry(partnerId);
    }

    try {
      const client = getClient(accessToken)!;
      const { data, error } = await (client.from('services') as any)
        .select('*')
        .eq('laundry_id', partnerId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Gagal memuat katalog layanan partner: ${error.message}`);
      }

      return (data || []).map((s: any) => {
        const unit = s.unit as 'kg' | 'pcs';
        const minW = unit === 'kg' && s.min_weight !== null && s.min_weight !== undefined && Number(s.min_weight) > 0 ? Number(s.min_weight) : null;
        return {
          id: s.id,
          laundryId: s.laundry_id,
          code: s.code || 'kiloan',
          name: s.name,
          description: s.description || '',
          category: s.category || 'Pakaian',
          pricingType: s.pricing_type || (unit === 'pcs' ? 'per_item' : 'per_kg'),
          price: Number(s.price_per_unit),
          price_per_unit: Number(s.price_per_unit),
          unit: unit,
          minWeight: minW,
          minimumQuantity: minW,
          estimatedHours: s.estimated_hours || 24,
          estimatedTime: `${s.estimated_hours || 24} Jam`,
          iconName: s.icon_name || (unit === 'pcs' ? 'Sparkles' : 'ShoppingBag'),
          isActive: s.is_active ?? true,
          createdAt: s.created_at || new Date().toISOString(),
        };
      });
    } catch (err: unknown) {
      console.error('[ADMIN-PARTNER-SERVICE] Error in getPartnerServicesAsync:', err);
      throw new Error(err instanceof Error ? err.message : 'Gagal mengambil katalog layanan partner.');
    }
  },

  /**
   * Create a new partner service via atomic RPC.
   */
  async createPartnerServiceAsync(
    partnerId: string,
    payload: CreatePartnerServicePayload,
    accessToken?: string
  ): Promise<{ success: boolean; service: Record<string, unknown> | null; message: string }> {
    if (!isValidUuid(partnerId)) {
      throw new Error('ID partner tidak valid.');
    }
    if (!payload.name || payload.name.trim().length < 3) {
      throw new Error('Nama layanan wajib diisi minimal 3 karakter.');
    }
    if (!payload.price || payload.price <= 0) {
      throw new Error('Tarif layanan harus lebih besar dari Rp 0.');
    }

    if (!isSupabaseConfigured || !supabase) {
      return {
        success: true,
        service: {
          id: `srv_mock_${Date.now()}`,
          laundry_id: partnerId,
          name: payload.name.trim(),
          price_per_unit: payload.price,
          unit: payload.unit || 'kg',
          is_active: payload.isActive ?? true,
        },
        message: 'Layanan berhasil ditambahkan (Mock Mode).',
      };
    }

    const client = getClient(accessToken)!;
    const { data, error } = await (client as any).rpc('admin_mutate_partner_service_atomic', {
      p_action: 'CREATE',
      p_laundry_id: partnerId,
      p_service_id: null,
      p_name: payload.name.trim(),
      p_description: payload.description || null,
      p_code: payload.code || 'kiloan',
      p_category: payload.category || null,
      p_pricing_type: payload.pricingType || (payload.unit === 'pcs' ? 'per_item' : 'per_kg'),
      p_price_per_unit: payload.price,
      p_unit: payload.unit || 'kg',
      p_min_weight: payload.unit === 'pcs' ? null : (payload.minWeight ?? null),
      p_estimated_hours: payload.estimatedHours || 24,
      p_icon_name: payload.iconName || null,
      p_is_active: payload.isActive ?? true,
    });

    if (error) {
      throw new Error(error.message || 'Gagal menambahkan layanan partner.');
    }

    return data as { success: boolean; service: Record<string, unknown> | null; message: string };
  },

  /**
   * Update an existing partner service via atomic RPC.
   */
  async updatePartnerServiceAsync(
    partnerId: string,
    serviceId: string,
    updates: UpdatePartnerServicePayload,
    accessToken?: string
  ): Promise<{ success: boolean; service: Record<string, unknown> | null; message: string }> {
    if (!isValidUuid(partnerId) || !isValidUuid(serviceId)) {
      throw new Error('ID partner atau service tidak valid.');
    }

    if (!isSupabaseConfigured || !supabase) {
      return {
        success: true,
        service: { id: serviceId, ...updates },
        message: 'Layanan berhasil diperbarui (Mock Mode).',
      };
    }

    const client = getClient(accessToken)!;
    const { data, error } = await (client as any).rpc('admin_mutate_partner_service_atomic', {
      p_action: 'UPDATE',
      p_laundry_id: partnerId,
      p_service_id: serviceId,
      p_name: updates.name ? updates.name.trim() : null,
      p_description: updates.description ?? null,
      p_code: updates.code ?? null,
      p_category: updates.category ?? null,
      p_pricing_type: updates.pricingType ?? null,
      p_price_per_unit: updates.price ?? null,
      p_unit: updates.unit ?? null,
      p_min_weight: updates.unit === 'pcs' ? null : (updates.minWeight ?? null),
      p_estimated_hours: updates.estimatedHours ?? null,
      p_icon_name: updates.iconName ?? null,
      p_is_active: updates.isActive ?? null,
    });

    if (error) {
      throw new Error(error.message || 'Gagal memperbarui layanan partner.');
    }

    return data as { success: boolean; service: Record<string, unknown> | null; message: string };
  },

  /**
   * Toggle partner service active/inactive status via atomic RPC.
   */
  async togglePartnerServiceStatusAsync(
    partnerId: string,
    serviceId: string,
    isActive: boolean,
    accessToken?: string
  ): Promise<{ success: boolean; service: Record<string, unknown> | null; message: string }> {
    if (!isValidUuid(partnerId) || !isValidUuid(serviceId)) {
      throw new Error('ID partner atau service tidak valid.');
    }

    if (!isSupabaseConfigured || !supabase) {
      return {
        success: true,
        service: { id: serviceId, is_active: isActive },
        message: `Layanan berhasil ${isActive ? 'diaktifkan' : 'dinonaktifkan'} (Mock Mode).`,
      };
    }

    const client = getClient(accessToken)!;
    const action = isActive ? 'ACTIVATE' : 'DEACTIVATE';
    const { data, error } = await (client as any).rpc('admin_mutate_partner_service_atomic', {
      p_action: action,
      p_laundry_id: partnerId,
      p_service_id: serviceId,
    });

    if (error) {
      throw new Error(error.message || `Gagal ${isActive ? 'mengaktifkan' : 'menonaktifkan'} layanan.`);
    }

    return data as { success: boolean; service: Record<string, unknown> | null; message: string };
  },
};
