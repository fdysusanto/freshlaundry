'use client';

import React, { useState, useEffect } from 'react';
import {
  CustomerAddress,
  Province,
  City,
  District,
  Village,
  CreateAddressPayload,
} from '@/types/address';
import { customerAddressService } from '@/services/customerAddressService';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertCircle, MapPin } from 'lucide-react';

interface CustomerAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedAddress: CustomerAddress) => void;
  initialAddress?: CustomerAddress | null;
}

export const CustomerAddressModal: React.FC<CustomerAddressModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialAddress,
}) => {
  // Form State
  const [label, setLabel] = useState('Rumah');
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [rt, setRt] = useState('');
  const [rw, setRw] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Region Cascading Dropdown States
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);

  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');
  const [selectedCityCode, setSelectedCityCode] = useState('');
  const [selectedDistrictCode, setSelectedDistrictCode] = useState('');
  const [selectedVillageCode, setSelectedVillageCode] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Processing & Error States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // 1. Load initial provinces on mount
  useEffect(() => {
    let isMounted = true;
    const loadProvinces = async () => {
      const data = await customerAddressService.getProvincesAsync();
      if (isMounted) {
        setProvinces(data);
        if (data.length > 0 && !selectedProvinceCode) {
          setSelectedProvinceCode(data[0].code);
        }
      }
    };
    if (isOpen) loadProvinces();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // 2. Cascade: Province -> Cities
  useEffect(() => {
    let isMounted = true;
    const loadCities = async () => {
      if (!selectedProvinceCode) {
        setCities([]);
        return;
      }
      const data = await customerAddressService.getCitiesAsync(selectedProvinceCode);
      if (isMounted) {
        setCities(data);
        if (data.length > 0) {
          // Default to Kota Cirebon if available
          const cirebon = data.find((c) => c.code === '3274') || data[0];
          setSelectedCityCode(cirebon.code);
        } else {
          setSelectedCityCode('');
        }
      }
    };
    loadCities();
    return () => {
      isMounted = false;
    };
  }, [selectedProvinceCode]);

  // 3. Cascade: City -> Districts
  useEffect(() => {
    let isMounted = true;
    const loadDistricts = async () => {
      if (!selectedCityCode) {
        setDistricts([]);
        return;
      }
      const data = await customerAddressService.getDistrictsAsync(selectedCityCode);
      if (isMounted) {
        setDistricts(data);
        if (data.length > 0 && !selectedDistrictCode) {
          setSelectedDistrictCode(data[0].code);
        }
      }
    };
    loadDistricts();
    return () => {
      isMounted = false;
    };
  }, [selectedCityCode]);

  // 4. Cascade: District -> Villages
  useEffect(() => {
    let isMounted = true;
    const loadVillages = async () => {
      if (!selectedDistrictCode) {
        setVillages([]);
        return;
      }
      const data = await customerAddressService.getVillagesAsync(selectedDistrictCode);
      if (isMounted) {
        setVillages(data);
        if (data.length > 0) {
          setSelectedVillageCode(data[0].code);
          setPostalCode(data[0].postalCode);
        } else {
          setSelectedVillageCode('');
          setPostalCode('');
        }
      }
    };
    loadVillages();
    return () => {
      isMounted = false;
    };
  }, [selectedDistrictCode]);

  // 5. Update Postal Code when Village changes
  const handleVillageChange = (vCode: string) => {
    setSelectedVillageCode(vCode);
    const found = villages.find((v) => v.code === vCode);
    if (found) {
      setPostalCode(found.postalCode);
    }
  };

  // Populate form if editing initialAddress
  useEffect(() => {
    if (initialAddress && isOpen) {
      setLabel(initialAddress.label || 'Rumah');
      setRecipientName(initialAddress.recipientName || '');
      setPhone(initialAddress.phone || '');
      setAddressDetail(initialAddress.addressDetail || '');
      setRt(initialAddress.rt || '');
      setRw(initialAddress.rw || '');
      setIsDefault(initialAddress.isDefault || false);
      setSelectedProvinceCode(initialAddress.provinceCode || '32');
      setSelectedCityCode(initialAddress.cityCode || '3274');
      setSelectedDistrictCode(initialAddress.districtCode || '327404');
      setSelectedVillageCode(initialAddress.villageCode || '3274041002');
      setPostalCode(initialAddress.postalCode || '45135');
    } else if (isOpen) {
      setFormError('');
    }
  }, [initialAddress, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!recipientName.trim()) return setFormError('Nama penerima wajib diisi.');
    if (!phone.trim()) return setFormError('Nomor telepon penerima wajib diisi.');
    if (!addressDetail.trim()) return setFormError('Alamat lengkap wajib diisi.');
    if (!selectedProvinceCode || !selectedCityCode || !selectedDistrictCode || !selectedVillageCode) {
      return setFormError('Silakan lengkapi wilayah administratif (Provinsi, Kota, Kecamatan, Kelurahan).');
    }

    const provinceObj = provinces.find((p) => p.code === selectedProvinceCode);
    const cityObj = cities.find((c) => c.code === selectedCityCode);
    const districtObj = districts.find((d) => d.code === selectedDistrictCode);
    const villageObj = villages.find((v) => v.code === selectedVillageCode);

    if (!provinceObj || !cityObj || !districtObj || !villageObj) {
      return setFormError('Data wilayah administratif tidak valid.');
    }

    setIsSubmitting(true);

    try {
      const payload: CreateAddressPayload = {
        label: label.trim() || 'Rumah',
        recipientName: recipientName.trim(),
        phone: phone.trim(),
        provinceCode: provinceObj.code,
        provinceName: provinceObj.name,
        cityCode: cityObj.code,
        cityName: cityObj.name,
        districtCode: districtObj.code,
        districtName: districtObj.name,
        villageCode: villageObj.code,
        villageName: villageObj.name,
        postalCode: villageObj.postalCode || postalCode,
        addressDetail: addressDetail.trim(),
        rt: rt.trim() || undefined,
        rw: rw.trim() || undefined,
        isDefault,
      };

      let saved: CustomerAddress;
      if (initialAddress) {
        saved = await customerAddressService.updateAddressAsync(initialAddress.id, payload);
      } else {
        saved = await customerAddressService.createAddressAsync(payload);
      }

      onSuccess(saved);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan alamat customer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialAddress ? 'Edit Alamat Pengiriman' : 'Tambah Alamat Pengiriman Baru'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Label & Recipient */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="font-bold text-slate-700">Label Alamat *</label>
            <select
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold focus:ring-2 focus:ring-teal-500"
            >
              <option value="Rumah">Rumah</option>
              <option value="Kantor">Kantor</option>
              <option value="Apartemen">Apartemen</option>
              <option value="Kos">Kos</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="font-bold text-slate-700">Nama Penerima *</label>
            <input
              type="text"
              required
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="space-y-1">
            <label className="font-bold text-slate-700">No. HP Penerima *</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contoh: 081234567890"
              className="w-full p-2.5 rounded-xl border border-slate-200 font-mono focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Cascading Region Selection */}
        <div className="p-3 rounded-2xl bg-teal-50/60 border border-teal-200/80 space-y-3">
          <div className="flex items-center gap-1.5 text-teal-800 font-bold text-xs">
            <MapPin className="w-4 h-4 text-teal-600" />
            <span>Master Wilayah Administratif (V1 Kota Cirebon)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Province Dropdown */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Provinsi *</label>
              <select
                value={selectedProvinceCode}
                onChange={(e) => setSelectedProvinceCode(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold bg-white cursor-pointer"
              >
                {provinces.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* City Dropdown */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Kota / Kabupaten *</label>
              <select
                value={selectedCityCode}
                onChange={(e) => setSelectedCityCode(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold bg-white cursor-pointer"
              >
                {cities.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* District Dropdown */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Kecamatan *</label>
              <select
                value={selectedDistrictCode}
                onChange={(e) => setSelectedDistrictCode(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold bg-white cursor-pointer"
              >
                {districts.map((d) => (
                  <option key={d.code} value={d.code}>
                    Kec. {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Village & Postal Code Dropdown */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Kelurahan / Desa *</label>
              <select
                value={selectedVillageCode}
                onChange={(e) => handleVillageChange(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold bg-white cursor-pointer"
              >
                {villages.map((v) => (
                  <option key={v.code} value={v.code}>
                    Kel. {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Kode Pos</label>
              <input
                type="text"
                readOnly
                value={postalCode}
                className="w-full p-2 rounded-xl border border-slate-200 bg-slate-100 font-mono font-bold text-slate-700"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700">RT (Opsional)</label>
              <input
                type="text"
                value={rt}
                onChange={(e) => setRt(e.target.value)}
                placeholder="001"
                className="w-full p-2 rounded-xl border border-slate-200 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700">RW (Opsional)</label>
              <input
                type="text"
                value={rw}
                onChange={(e) => setRw(e.target.value)}
                placeholder="005"
                className="w-full p-2 rounded-xl border border-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Address Detail Input */}
        <div className="space-y-1">
          <label className="font-bold text-slate-700">Alamat Lengkap / Patokan *</label>
          <textarea
            required
            rows={3}
            value={addressDetail}
            onChange={(e) => setAddressDetail(e.target.value)}
            placeholder="Masukkan nama jalan, nomor rumah/blok, warna pagar, atau patokan lokasi..."
            className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Default Checkbox */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="isDefaultAddress"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="w-4 h-4 accent-teal-600 rounded-sm cursor-pointer"
          />
          <label htmlFor="isDefaultAddress" className="font-bold text-slate-800 cursor-pointer">
            Jadikan sebagai Alamat Utama (Default)
          </label>
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            className="bg-teal-600 hover:bg-teal-500 text-white font-bold"
          >
            {isSubmitting ? 'Memproses...' : 'Simpan Alamat'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
