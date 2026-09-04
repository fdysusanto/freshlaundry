import { LaundryService, Laundry } from '@/types/laundry';
import { UserProfile } from '@/types/user';
import { SERVICE_CATALOG, ServiceCatalogItem, DEMO_LAUNDRIES } from '@/utils/constants';
import { isValidUuid } from '@/utils/formatters';
import { supabase, isSupabaseConfigured } from './supabase';

const SERVICES_STORAGE_KEY = 'fresh_laundry_services_db';

export const laundryService = {
  /**
   * Real Supabase Live Laundries Lookup.
   */
  async getLaundriesAsync(): Promise<Laundry[]> {
    if (typeof window !== 'undefined') {
      const { data: sessionData } = await (supabase?.auth?.getSession() || Promise.resolve({ data: { session: null } }));
      console.log('[LAUNDRY-DIAGNOSTIC] Initializing getLaundriesAsync:', {
        isSupabaseConfigured,
        hasSession: Boolean(sessionData?.session),
        targetTable: 'public.laundries',
      });
    }

    if (!isSupabaseConfigured || !supabase) {
      return DEMO_LAUNDRIES;
    }

    const { data, error } = await (supabase.from('laundries') as any)
      .select('*')
      .eq('is_active', true);

    if (typeof window !== 'undefined') {
      console.log('[LAUNDRY-DIAGNOSTIC] Query public.laundries result:', {
        rowCount: data ? data.length : 0,
        errorCode: error ? error.code : null,
        errorMessage: error ? error.message : null,
        laundryNames: data ? data.map((l: any) => l.name) : [],
      });
    }

    if (error) {
      throw new Error(`Gagal memuat laundry dari Supabase: ${error.message}`);
    }

    return (data || []).map((l: any) => ({
      id: l.id,
      code: l.id.slice(0, 8),
      name: l.name,
      ownerId: l.owner_id || '',
      phone: l.phone,
      address: l.address,
      logoUrl: l.logo_url || undefined,
      openingTime: l.opening_time || '08:00',
      closingTime: l.closing_time || '20:00',
      isOpen: l.is_open ?? true,
      isActive: l.is_active ?? true,
      verificationStatus: l.verification_status || 'verified',
      rating: Number(l.rating || 5.0),
      totalReviews: l.total_reviews || 0,
      createdAt: l.created_at || new Date().toISOString(),
    }));
  },

  /**
   * Real Supabase Lookup for Laundries owned by specific Owner UUID.
   */
  async getLaundriesByOwnerAsync(ownerId: string): Promise<Laundry[]> {
    if (!isSupabaseConfigured || !supabase) {
      return DEMO_LAUNDRIES.filter((l) => l.ownerId === ownerId);
    }

    if (!ownerId) return [];

    // 1. Query public.laundries by owner_id
    const { data, error } = await (supabase.from('laundries') as any)
      .select('*')
      .eq('owner_id', ownerId);

    if (error) {
      console.warn('[LAUNDRY-SERVICE] Error fetching laundries by owner_id:', error.message);
    }

    if (data && data.length > 0) {
      return data.map((l: any) => ({
        id: l.id,
        code: l.id.slice(0, 8),
        name: l.name,
        ownerId: l.owner_id || ownerId,
        phone: l.phone,
        address: l.address,
        logoUrl: l.logo_url || undefined,
        openingTime: l.opening_time || '08:00',
        closingTime: l.closing_time || '20:00',
        isOpen: l.is_open ?? true,
        isActive: l.is_active ?? true,
        verificationStatus: l.verification_status || 'verified',
        rating: Number(l.rating || 5.0),
        totalReviews: l.total_reviews || 0,
        createdAt: l.created_at || new Date().toISOString(),
      }));
    }

    // 2. Fallback query via public.laundry_users mapping table
    const { data: luData, error: luError } = await (supabase.from('laundry_users') as any)
      .select('laundry_id, laundries(*)')
      .eq('profile_id', ownerId);

    if (!luError && luData && luData.length > 0) {
      return luData
        .map((item: any) => item.laundries)
        .filter(Boolean)
        .map((l: any) => ({
          id: l.id,
          code: l.id.slice(0, 8),
          name: l.name,
          ownerId: l.owner_id || ownerId,
          phone: l.phone,
          address: l.address,
          logoUrl: l.logo_url || undefined,
          openingTime: l.opening_time || '08:00',
          closingTime: l.closing_time || '20:00',
          isOpen: l.is_open ?? true,
          isActive: l.is_active ?? true,
          verificationStatus: l.verification_status || 'verified',
          rating: Number(l.rating || 5.0),
          totalReviews: l.total_reviews || 0,
          createdAt: l.created_at || new Date().toISOString(),
        }));
    }

    return [];
  },

  /**
   * Real Supabase Single Laundry Lookup by UUID.
   */
  async getLaundryByIdAsync(laundryId: string): Promise<Laundry | null> {
    if (!isSupabaseConfigured || !supabase) {
      return DEMO_LAUNDRIES.find((l) => l.id === laundryId) || null;
    }

    if (!isValidUuid(laundryId)) return null;

    const { data, error } = await (supabase.from('laundries') as any)
      .select('*')
      .eq('id', laundryId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      code: data.id.slice(0, 8),
      name: data.name,
      ownerId: data.owner_id || '',
      phone: data.phone,
      address: data.address,
      logoUrl: data.logo_url || undefined,
      openingTime: data.opening_time || '08:00',
      closingTime: data.closing_time || '20:00',
      isOpen: data.is_open ?? true,
      isActive: data.is_active ?? true,
      verificationStatus: data.verification_status || 'verified',
      rating: Number(data.rating || 5.0),
      totalReviews: data.total_reviews || 0,
      createdAt: data.created_at || new Date().toISOString(),
    };
  },

  /**
   * Real Supabase Single Service Lookup by UUID.
   */
  async getServiceByIdAsync(serviceId: string): Promise<ServiceCatalogItem | null> {
    if (!isSupabaseConfigured || !supabase) {
      return this.getServiceById(serviceId);
    }

    if (!isValidUuid(serviceId)) return null;

    const { data: s, error } = await (supabase.from('services') as any)
      .select('*')
      .eq('id', serviceId)
      .single();

    if (error || !s) return null;

    return {
      id: s.id,
      laundryId: s.laundry_id,
      code: s.code || 'kiloan',
      name: s.name,
      description: s.description || '',
      pricingType: s.unit === 'pcs' ? 'per_item' : 'per_kg',
      price: Number(s.price_per_unit),
      price_per_unit: Number(s.price_per_unit),
      unit: s.unit as 'kg' | 'pcs',
      minWeight: Number(s.min_weight || 1),
      minimumQuantity: Number(s.min_weight || 1),
      estimatedHours: s.estimated_hours || 24,
      estimatedTime: `${s.estimated_hours || 24} Jam`,
      iconName: s.icon_name || 'Sparkles',
      isActive: s.is_active ?? true,
      createdAt: s.created_at || new Date().toISOString(),
    };
  },

  /**
   * Mengambil semua layanan dari localStorage atau fallback SERVICE_CATALOG.
   */
  getAllServices(): ServiceCatalogItem[] {
    if (typeof window === 'undefined') return SERVICE_CATALOG;
    const saved = localStorage.getItem(SERVICES_STORAGE_KEY);
    if (!saved) {
      localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(SERVICE_CATALOG));
      return SERVICE_CATALOG;
    }
    try {
      const parsed: ServiceCatalogItem[] = JSON.parse(saved);
      return parsed;
    } catch {
      return SERVICE_CATALOG;
    }
  },

  /**
   * Menyimpan daftar layanan ke localStorage.
   */
  saveServices(services: ServiceCatalogItem[]): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(services));
    }
  },

  /**
   * Real Supabase Live Services Lookup for specific Laundry ID.
   */
  async getServicesByLaundryAsync(laundryId: string): Promise<ServiceCatalogItem[]> {
    if (!isSupabaseConfigured || !supabase) {
      return this.getServicesByLaundry(laundryId);
    }

    const { data, error } = await (supabase.from('services') as any)
      .select('*')
      .eq('laundry_id', laundryId);

    if (error) {
      throw new Error(`Gagal memuat layanan dari Supabase: ${error.message}`);
    }

    return (data || []).map((s: any) => ({
      id: s.id,
      laundryId: s.laundry_id,
      code: s.code || 'kiloan',
      name: s.name,
      description: s.description || '',
      pricingType: s.unit === 'pcs' ? 'per_item' : 'per_kg',
      price: Number(s.price_per_unit),
      price_per_unit: Number(s.price_per_unit),
      unit: s.unit as 'kg' | 'pcs',
      minWeight: Number(s.min_weight || 1),
      minimumQuantity: Number(s.min_weight || 1),
      estimatedHours: s.estimated_hours || 24,
      estimatedTime: `${s.estimated_hours || 24} Jam`,
      iconName: s.icon_name || 'Sparkles',
      isActive: s.is_active ?? true,
      createdAt: s.created_at || new Date().toISOString(),
    }));
  },



  /**
   * Real Supabase Live Service Creation.
   */
  async createServiceAsync(
    payload: Omit<ServiceCatalogItem, 'id' | 'laundryId' | 'createdAt'>,
    ownerUser: UserProfile
  ): Promise<ServiceCatalogItem> {
    if (!isSupabaseConfigured || !supabase) {
      return this.createService(payload, ownerUser);
    }

    const targetLaundryId = ownerUser.laundryId || 'lnd_001';

    if (!payload.name || payload.name.trim().length < 3) {
      throw new Error('Validasi Gagal: Nama layanan wajib diisi minimal 3 karakter.');
    }
    if (!payload.price || payload.price <= 0) {
      throw new Error('Validasi Gagal: Tarif layanan harus lebih besar dari Rp 0.');
    }

    const minQty = Math.max(1, payload.minimumQuantity ?? payload.minWeight ?? 1);

    const { data: inserted, error } = await (supabase.from('services') as any)
      .insert({
        laundry_id: targetLaundryId,
        name: payload.name.trim(),
        description: payload.description || null,
        code: payload.code || 'kiloan',
        price_per_unit: payload.price,
        unit: payload.unit || 'kg',
        min_weight: minQty,
        estimated_hours: payload.estimatedHours || 24,
        is_active: payload.isActive ?? true,
        icon_name: payload.iconName || 'Sparkles',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Supabase Service Insert Error: ${error.message}`);
    }

    return {
      id: inserted.id,
      laundryId: inserted.laundry_id,
      code: inserted.code || 'kiloan',
      name: inserted.name,
      description: inserted.description || '',
      pricingType: inserted.unit === 'pcs' ? 'per_item' : 'per_kg',
      price: Number(inserted.price_per_unit),
      price_per_unit: Number(inserted.price_per_unit),
      unit: inserted.unit as 'kg' | 'pcs',
      minWeight: Number(inserted.min_weight || minQty),
      minimumQuantity: Number(inserted.min_weight || minQty),
      estimatedHours: inserted.estimated_hours || 24,
      estimatedTime: `${inserted.estimated_hours || 24} Jam`,
      iconName: inserted.icon_name || 'Sparkles',
      isActive: inserted.is_active ?? true,
      createdAt: inserted.created_at || new Date().toISOString(),
    };
  },

  /**
   * Real Supabase Live Service Update.
   */
  async updateServiceAsync(
    serviceId: string,
    updates: Partial<ServiceCatalogItem>,
    ownerUser: UserProfile
  ): Promise<ServiceCatalogItem> {
    if (!isSupabaseConfigured || !supabase) {
      return this.updateService(serviceId, updates, ownerUser);
    }

    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name.trim();
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.price !== undefined) dbUpdates.price_per_unit = updates.price;
    if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
    if (updates.minimumQuantity !== undefined || updates.minWeight !== undefined) {
      dbUpdates.min_weight = Math.max(1, updates.minimumQuantity ?? updates.minWeight ?? 1);
    }
    if (updates.estimatedHours !== undefined) dbUpdates.estimated_hours = updates.estimatedHours;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

    const { data: updatedRow, error } = await (supabase.from('services') as any)
      .update(dbUpdates)
      .eq('id', serviceId)
      .select()
      .single();

    if (error) {
      throw new Error(`Supabase Service Update Error: ${error.message}`);
    }

    return {
      id: updatedRow.id,
      laundryId: updatedRow.laundry_id,
      code: updatedRow.code || 'kiloan',
      name: updatedRow.name,
      description: updatedRow.description || '',
      pricingType: updatedRow.unit === 'pcs' ? 'per_item' : 'per_kg',
      price: Number(updatedRow.price_per_unit),
      price_per_unit: Number(updatedRow.price_per_unit),
      unit: updatedRow.unit as 'kg' | 'pcs',
      minWeight: Number(updatedRow.min_weight || 1),
      minimumQuantity: Number(updatedRow.min_weight || 1),
      estimatedHours: updatedRow.estimated_hours || 24,
      estimatedTime: `${updatedRow.estimated_hours || 24} Jam`,
      iconName: updatedRow.icon_name || 'Sparkles',
      isActive: updatedRow.is_active ?? true,
      createdAt: updatedRow.created_at || new Date().toISOString(),
    };
  },

  /**
   * Real Supabase Live Service Deletion.
   */
  async deleteServiceAsync(serviceId: string, ownerUser: UserProfile): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    const { error } = await (supabase.from('services') as any)
      .delete()
      .eq('id', serviceId);

    if (error) {
      throw new Error(`Supabase Service Delete Error: ${error.message}`);
    }
  },

  getServicesByLaundry(laundryId: string): ServiceCatalogItem[] {
    const all = this.getAllServices();
    return all.filter((s) => s.laundryId === laundryId);
  },

  getServiceById(id: string): ServiceCatalogItem | null {
    const all = this.getAllServices();
    return all.find((s) => s.id === id) || null;
  },

  validateOwnership(user: UserProfile, targetLaundryId: string): void {
    if (user.role === 'platform_admin' || user.role === 'admin') {
      return;
    }

    if (!user.laundryId) {
      throw new Error(
        `Akses Ditolak (UnauthorizedError): Pengguna (${user.fullName}) tidak terdaftar pada toko laundry mana pun.`
      );
    }

    if (user.laundryId !== targetLaundryId) {
      throw new Error(
        `Akses Ditolak (UnauthorizedError): Anda (${user.fullName}) tidak memiliki wewenang untuk mengelola toko laundry ini.`
      );
    }
  },

  createService(
    payload: Omit<ServiceCatalogItem, 'id' | 'laundryId' | 'createdAt'>,
    ownerUser: UserProfile
  ): ServiceCatalogItem {
    if (!ownerUser.laundryId && ownerUser.role !== 'platform_admin' && ownerUser.role !== 'admin') {
      throw new Error(
        `Akses Ditolak (UnauthorizedError): Sesi pengguna (${ownerUser.fullName}) tidak terhubung dengan toko laundry mana pun.`
      );
    }
    const targetLaundryId = ownerUser.laundryId || 'lnd_001';
    this.validateOwnership(ownerUser, targetLaundryId);

    if (!payload.name || payload.name.trim().length < 3) {
      throw new Error('Validasi Gagal: Nama layanan wajib diisi minimal 3 karakter.');
    }
    if (!payload.price || payload.price <= 0) {
      throw new Error('Validasi Gagal: Tarif layanan harus lebih besar dari Rp 0.');
    }
    if (!payload.estimatedHours || payload.estimatedHours <= 0) {
      throw new Error('Validasi Gagal: Estimasi pengerjaan harus lebih dari 0 jam.');
    }

    const newService: ServiceCatalogItem = {
      ...payload,
      id: `srv_${Date.now()}`,
      laundryId: targetLaundryId,
      code: payload.code || 'kiloan',
      price: payload.price,
      price_per_unit: payload.price,
      unit: payload.unit || 'kg',
      pricingType: payload.pricingType || (payload.unit === 'pcs' ? 'per_item' : 'per_kg'),
      minWeight: payload.minWeight || 1,
      estimatedHours: payload.estimatedHours,
      estimatedTime: payload.estimatedTime || `${payload.estimatedHours} Jam`,
      iconName: payload.iconName || (payload.unit === 'pcs' ? 'Sparkles' : 'ShoppingBag'),
      isActive: payload.isActive ?? true,
      createdAt: new Date().toISOString(),
    };

    const currentServices = this.getAllServices();
    const updated = [newService, ...currentServices];
    this.saveServices(updated);

    return newService;
  },

  updateService(
    serviceId: string,
    updates: Partial<ServiceCatalogItem>,
    ownerUser: UserProfile
  ): ServiceCatalogItem {
    const existing = this.getServiceById(serviceId);
    if (!existing) {
      throw new Error(`Validasi Gagal: Layanan dengan ID ${serviceId} tidak ditemukan.`);
    }

    this.validateOwnership(ownerUser, existing.laundryId);

    if (updates.name !== undefined && (!updates.name || updates.name.trim().length < 3)) {
      throw new Error('Validasi Gagal: Nama layanan wajib diisi minimal 3 karakter.');
    }
    if (updates.price !== undefined && updates.price <= 0) {
      throw new Error('Validasi Gagal: Tarif layanan harus lebih besar dari Rp 0.');
    }
    if (updates.estimatedHours !== undefined && updates.estimatedHours <= 0) {
      throw new Error('Validasi Gagal: Estimasi pengerjaan harus lebih dari 0 jam.');
    }

    const updatedService: ServiceCatalogItem = {
      ...existing,
      ...updates,
      price_per_unit: updates.price ?? existing.price,
      price: updates.price ?? existing.price,
    };

    const allServices = this.getAllServices();
    const index = allServices.findIndex((s) => s.id === serviceId);
    if (index !== -1) {
      allServices[index] = updatedService;
      this.saveServices(allServices);
    }

    return updatedService;
  },

  toggleServiceActive(serviceId: string, ownerUser: UserProfile): ServiceCatalogItem {
    const existing = this.getServiceById(serviceId);
    if (!existing) {
      throw new Error(`Layanan dengan ID ${serviceId} tidak ditemukan.`);
    }

    this.validateOwnership(ownerUser, existing.laundryId);

    return this.updateService(
      serviceId,
      { isActive: !existing.isActive },
      ownerUser
    );
  },

  async updateLaundryProfileAsync(
    laundryId: string,
    profileData: {
      name?: string;
      description?: string;
      phone?: string;
      address?: string;
      openingTime?: string;
      closingTime?: string;
      isOpen?: boolean;
    }
  ): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUuid(laundryId)) {
      return;
    }

    const { error } = await (supabase.from('laundries') as any)
      .update({
        name: profileData.name,
        description: profileData.description,
        phone: profileData.phone,
        address: profileData.address,
        opening_time: profileData.openingTime,
        closing_time: profileData.closingTime,
        is_open: profileData.isOpen,
      })
      .eq('id', laundryId);

    if (error) {
      throw new Error(`Gagal meng-update profil mitra: ${error.message}`);
    }
  },
};
