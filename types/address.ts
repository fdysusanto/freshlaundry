export interface Province {
  code: string;
  name: string;
}

export interface City {
  code: string;
  name: string;
  type: string;
  provinceCode: string;
}

export interface District {
  code: string;
  name: string;
  cityCode: string;
}

export interface Village {
  code: string;
  name: string;
  districtCode: string;
  postalCode: string;
}

export interface AdministrativeRegion {
  id: string;
  provinceCode: string;
  provinceName: string;
  cityCode: string;
  cityName: string;
  cityType: string;
  districtCode: string;
  districtName: string;
  villageCode: string;
  villageName: string;
  postalCode: string;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  label: string;
  recipientName: string;
  phone: string;
  provinceCode: string;
  provinceName: string;
  cityCode: string;
  cityName: string;
  districtCode: string;
  districtName: string;
  villageCode: string;
  villageName: string;
  postalCode: string;
  addressDetail: string;
  rt?: string;
  rw?: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AddressSnapshot {
  address_id?: string;
  recipient_name: string;
  phone: string;
  province_code: string;
  province_name: string;
  city_code: string;
  city_name: string;
  district_code: string;
  district_name: string;
  village_code: string;
  village_name: string;
  postal_code: string;
  address_detail: string;
  rt?: string;
  rw?: string;
  label?: string;
  latitude?: number;
  longitude?: number;
  formatted_address?: string;
}

export interface CreateAddressPayload {
  label: string;
  recipientName: string;
  phone: string;
  provinceCode: string;
  provinceName: string;
  cityCode: string;
  cityName: string;
  districtCode: string;
  districtName: string;
  villageCode: string;
  villageName: string;
  postalCode: string;
  addressDetail: string;
  rt?: string;
  rw?: string;
  isDefault?: boolean;
}

export interface UpdateAddressPayload extends Partial<CreateAddressPayload> {
  isActive?: boolean;
}
