import { supabase, isSupabaseConfigured } from './supabase';
import { authService } from './authService';
import {
  Province,
  City,
  District,
  Village,
  CustomerAddress,
  CreateAddressPayload,
  UpdateAddressPayload,
  AddressSnapshot,
} from '@/types/address';

// Fallback Master Data for Kota Cirebon (3274) if DB offline
export const FALLBACK_PROVINCES: Province[] = [
  { code: '32', name: 'Jawa Barat' },
];

export const FALLBACK_CITIES: City[] = [
  { code: '3274', provinceCode: '32', name: 'Kota Cirebon', type: 'Kota' },
];

export const FALLBACK_DISTRICTS: District[] = [
  { code: '327401', cityCode: '3274', name: 'Harjamukti' },
  { code: '327402', cityCode: '3274', name: 'Lemahwungkuk' },
  { code: '327403', cityCode: '3274', name: 'Kejaksan' },
  { code: '327404', cityCode: '3274', name: 'Kesambi' },
  { code: '327405', cityCode: '3274', name: 'Pekalipan' },
];

export const FALLBACK_VILLAGES: Village[] = [
  // Harjamukti (327401)
  { code: '3274011001', districtCode: '327401', name: 'Harjamukti', postalCode: '45143' },
  { code: '3274011002', districtCode: '327401', name: 'Kalijaga', postalCode: '45144' },
  { code: '3274011003', districtCode: '327401', name: 'Argasunya', postalCode: '45145' },
  { code: '3274011004', districtCode: '327401', name: 'Kecapi', postalCode: '45142' },
  { code: '3274011005', districtCode: '327401', name: 'Larangan', postalCode: '45141' },

  // Lemahwungkuk (327402)
  { code: '3274021001', districtCode: '327402', name: 'Lemahwungkuk', postalCode: '45111' },
  { code: '3274021002', districtCode: '327402', name: 'Panjunan', postalCode: '45112' },
  { code: '3274021003', districtCode: '327402', name: 'Pegambiran', postalCode: '45113' },
  { code: '3274021004', districtCode: '327402', name: 'Kasepuhan', postalCode: '45114' },

  // Kejaksan (327403)
  { code: '3274031001', districtCode: '327403', name: 'Kejaksan', postalCode: '45123' },
  { code: '3274031002', districtCode: '327403', name: 'Sukapura', postalCode: '45122' },
  { code: '3274031003', districtCode: '327403', name: 'Kesenden', postalCode: '45121' },
  { code: '3274031004', districtCode: '327403', name: 'Kebonbaru', postalCode: '45124' },

  // Kesambi (327404)
  { code: '3274041001', districtCode: '327404', name: 'Kesambi', postalCode: '45134' },
  { code: '3274041002', districtCode: '327404', name: 'Karyamulya', postalCode: '45135' },
  { code: '3274041003', districtCode: '327404', name: 'Sunyaragi', postalCode: '45132' },
  { code: '3274041004', districtCode: '327404', name: 'Drajat', postalCode: '45133' },
  { code: '3274041005', districtCode: '327404', name: 'Pekiringan', postalCode: '45131' },

  // Pekalipan (327405)
  { code: '3274051001', districtCode: '327405', name: 'Pekalipan', postalCode: '45117' },
  { code: '3274051002', districtCode: '327405', name: 'Pekalangan', postalCode: '45118' },
  { code: '3274051003', districtCode: '327405', name: 'Jagasatru', postalCode: '45116' },
  { code: '3274051004', districtCode: '327405', name: 'Pulasaren', postalCode: '45115' },
];

export const customerAddressService = {
  // Master Wilayah Cascading Queries
  async getProvincesAsync(): Promise<Province[]> {
    if (!isSupabaseConfigured || !supabase) return FALLBACK_PROVINCES;

    try {
      const { data, error } = await (supabase.from('administrative_regions') as any)
        .select('province_code, province_name')
        .order('province_name');

      if (error || !data || data.length === 0) return FALLBACK_PROVINCES;

      const uniqueMap = new Map<string, string>();
      data.forEach((row: any) => {
        if (!uniqueMap.has(row.province_code)) {
          uniqueMap.set(row.province_code, row.province_name);
        }
      });

      return Array.from(uniqueMap.entries()).map(([code, name]) => ({ code, name }));
    } catch {
      return FALLBACK_PROVINCES;
    }
  },

  async getCitiesAsync(provinceCode: string): Promise<City[]> {
    if (!isSupabaseConfigured || !supabase) {
      return FALLBACK_CITIES.filter((c) => c.provinceCode === provinceCode);
    }

    try {
      const { data, error } = await (supabase.from('administrative_regions') as any)
        .select('city_code, province_code, city_name, city_type')
        .eq('province_code', provinceCode)
        .order('city_name');

      if (error || !data || data.length === 0) {
        return FALLBACK_CITIES.filter((c) => c.provinceCode === provinceCode);
      }

      const uniqueMap = new Map<string, { provinceCode: string; name: string; type: 'Kota' | 'Kabupaten' }>();
      data.forEach((row: any) => {
        if (!uniqueMap.has(row.city_code)) {
          uniqueMap.set(row.city_code, {
            provinceCode: row.province_code,
            name: row.city_name,
            type: row.city_type as any,
          });
        }
      });

      return Array.from(uniqueMap.entries()).map(([code, val]) => ({
        code,
        provinceCode: val.provinceCode,
        name: val.name,
        type: val.type,
      }));
    } catch {
      return FALLBACK_CITIES.filter((c) => c.provinceCode === provinceCode);
    }
  },

  async getDistrictsAsync(cityCode: string): Promise<District[]> {
    if (!isSupabaseConfigured || !supabase) {
      return FALLBACK_DISTRICTS.filter((d) => d.cityCode === cityCode);
    }

    try {
      const { data, error } = await (supabase.from('administrative_regions') as any)
        .select('district_code, city_code, district_name')
        .eq('city_code', cityCode)
        .order('district_name');

      if (error || !data || data.length === 0) {
        return FALLBACK_DISTRICTS.filter((d) => d.cityCode === cityCode);
      }

      const uniqueMap = new Map<string, { cityCode: string; name: string }>();
      data.forEach((row: any) => {
        if (!uniqueMap.has(row.district_code)) {
          uniqueMap.set(row.district_code, {
            cityCode: row.city_code,
            name: row.district_name,
          });
        }
      });

      return Array.from(uniqueMap.entries()).map(([code, val]) => ({
        code,
        cityCode: val.cityCode,
        name: val.name,
      }));
    } catch {
      return FALLBACK_DISTRICTS.filter((d) => d.cityCode === cityCode);
    }
  },

  async getVillagesAsync(districtCode: string): Promise<Village[]> {
    if (!isSupabaseConfigured || !supabase) {
      return FALLBACK_VILLAGES.filter((v) => v.districtCode === districtCode);
    }

    try {
      const { data, error } = await (supabase.from('administrative_regions') as any)
        .select('village_code, district_code, village_name, postal_code')
        .eq('district_code', districtCode)
        .order('village_name');

      if (error || !data || data.length === 0) {
        return FALLBACK_VILLAGES.filter((v) => v.districtCode === districtCode);
      }

      return data.map((row: any) => ({
        code: row.village_code,
        districtCode: row.district_code,
        name: row.village_name,
        postalCode: row.postal_code,
      }));
    } catch {
      return FALLBACK_VILLAGES.filter((v) => v.districtCode === districtCode);
    }
  },

  // Customer Address Book CRUD
  async getCustomerAddressesAsync(): Promise<CustomerAddress[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    const profile = await authService.fetchCurrentProfile();
    if (!profile) return [];

    const { data, error } = await (supabase.from('customer_addresses') as any)
      .select('*')
      .eq('customer_id', profile.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Gagal mengambil customer addresses:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      customerId: row.customer_id,
      label: row.label,
      recipientName: row.recipient_name,
      phone: row.phone,
      provinceCode: row.province_code,
      provinceName: row.province_name,
      cityCode: row.city_code,
      cityName: row.city_name,
      districtCode: row.district_code,
      districtName: row.district_name,
      villageCode: row.village_code,
      villageName: row.village_name,
      postalCode: row.postal_code,
      addressDetail: row.address_detail,
      rt: row.rt,
      rw: row.rw,
      latitude: row.latitude,
      longitude: row.longitude,
      isDefault: row.is_default,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  async getDefaultAddressAsync(): Promise<CustomerAddress | null> {
    const addresses = await this.getCustomerAddressesAsync();
    return addresses.find((a) => a.isDefault) || addresses[0] || null;
  },

  async createAddressAsync(payload: CreateAddressPayload): Promise<CustomerAddress> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase belum terkonfigurasi.');
    }

    const profile = await authService.fetchCurrentProfile();
    if (!profile || profile.role !== 'customer') {
      throw new Error('Akses Ditolak: Hanya akun Customer yang dapat menambahkan alamat.');
    }

    const { data, error } = await (supabase.from('customer_addresses') as any)
      .insert({
        customer_id: profile.id,
        label: payload.label.trim(),
        recipient_name: payload.recipientName.trim(),
        phone: payload.phone.trim(),
        province_code: payload.provinceCode,
        province_name: payload.provinceName,
        city_code: payload.cityCode,
        city_name: payload.cityName,
        district_code: payload.districtCode,
        district_name: payload.districtName,
        village_code: payload.villageCode,
        village_name: payload.villageName,
        postal_code: payload.postalCode,
        address_detail: payload.addressDetail.trim(),
        rt: payload.rt?.trim() || null,
        rw: payload.rw?.trim() || null,
        is_default: payload.isDefault ?? false,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Gagal menyimpan alamat: ${error.message}`);
    }

    return {
      id: data.id,
      customerId: data.customer_id,
      label: data.label,
      recipientName: data.recipient_name,
      phone: data.phone,
      provinceCode: data.province_code,
      provinceName: data.province_name,
      cityCode: data.city_code,
      cityName: data.city_name,
      districtCode: data.district_code,
      districtName: data.district_name,
      villageCode: data.village_code,
      villageName: data.village_name,
      postalCode: data.postal_code,
      addressDetail: data.address_detail,
      rt: data.rt,
      rw: data.rw,
      latitude: data.latitude,
      longitude: data.longitude,
      isDefault: data.is_default,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async updateAddressAsync(addressId: string, payload: UpdateAddressPayload): Promise<CustomerAddress> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase belum terkonfigurasi.');
    }

    const updateBody: any = { updated_at: new Date().toISOString() };
    if (payload.label !== undefined) updateBody.label = payload.label.trim();
    if (payload.recipientName !== undefined) updateBody.recipient_name = payload.recipientName.trim();
    if (payload.phone !== undefined) updateBody.phone = payload.phone.trim();
    if (payload.provinceCode !== undefined) updateBody.province_code = payload.provinceCode;
    if (payload.provinceName !== undefined) updateBody.province_name = payload.provinceName;
    if (payload.cityCode !== undefined) updateBody.city_code = payload.cityCode;
    if (payload.cityName !== undefined) updateBody.city_name = payload.cityName;
    if (payload.districtCode !== undefined) updateBody.district_code = payload.districtCode;
    if (payload.districtName !== undefined) updateBody.district_name = payload.districtName;
    if (payload.villageCode !== undefined) updateBody.village_code = payload.villageCode;
    if (payload.villageName !== undefined) updateBody.village_name = payload.villageName;
    if (payload.postalCode !== undefined) updateBody.postal_code = payload.postalCode;
    if (payload.addressDetail !== undefined) updateBody.address_detail = payload.addressDetail.trim();
    if (payload.rt !== undefined) updateBody.rt = payload.rt?.trim() || null;
    if (payload.rw !== undefined) updateBody.rw = payload.rw?.trim() || null;
    if (payload.isDefault !== undefined) updateBody.is_default = payload.isDefault;
    if (payload.isActive !== undefined) updateBody.is_active = payload.isActive;

    const { data, error } = await (supabase.from('customer_addresses') as any)
      .update(updateBody)
      .eq('id', addressId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Gagal memperbarui alamat: ${error.message}`);
    }

    return {
      id: data.id,
      customerId: data.customer_id,
      label: data.label,
      recipientName: data.recipient_name,
      phone: data.phone,
      provinceCode: data.province_code,
      provinceName: data.province_name,
      cityCode: data.city_code,
      cityName: data.city_name,
      districtCode: data.district_code,
      districtName: data.district_name,
      villageCode: data.village_code,
      villageName: data.village_name,
      postalCode: data.postal_code,
      addressDetail: data.address_detail,
      rt: data.rt,
      rw: data.rw,
      latitude: data.latitude,
      longitude: data.longitude,
      isDefault: data.is_default,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async deleteAddressAsync(addressId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await (supabase.from('customer_addresses') as any)
      .update({ is_active: false, is_default: false, updated_at: new Date().toISOString() })
      .eq('id', addressId);

    if (error) {
      throw new Error(`Gagal menghapus alamat: ${error.message}`);
    }
  },

  async setDefaultAddressAsync(addressId: string): Promise<void> {
    await this.updateAddressAsync(addressId, { isDefault: true });
  },

  // Helper to create order address snapshot JSONB
  createSnapshotFromAddress(address: CustomerAddress): AddressSnapshot {
    const rtrw = address.rt || address.rw ? ` RT ${address.rt || '-'}/RW ${address.rw || '-'}` : '';
    const formatted = `${address.addressDetail}${rtrw}, Kel. ${address.villageName}, Kec. ${address.districtName}, ${address.cityName}, ${address.provinceName} ${address.postalCode}`;

    return {
      address_id: address.id,
      recipient_name: address.recipientName,
      phone: address.phone,
      province_code: address.provinceCode,
      province_name: address.provinceName,
      city_code: address.cityCode,
      city_name: address.cityName,
      district_code: address.districtCode,
      district_name: address.districtName,
      village_code: address.villageCode,
      village_name: address.villageName,
      postal_code: address.postalCode,
      address_detail: address.addressDetail,
      rt: address.rt,
      rw: address.rw,
      latitude: address.latitude,
      longitude: address.longitude,
      formatted_address: formatted,
    };
  },
};
