'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/services/authService';
import { partnerApplicationService, PartnerApplicationRecord } from '@/services/partnerApplicationService';
import { customerAddressService } from '@/services/customerAddressService';
import { isSupabaseConfigured } from '@/services/supabase';
import { UserProfile } from '@/types/user';
import { Province, City, District, Village } from '@/types/address';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Store,
  User,
  Phone,
  MapPin,
  Clock,
  CreditCard,
  Tag,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

function OwnerLaundryRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRevisionModeParam = searchParams.get('revision') === 'true';

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [existingApp, setExistingApp] = useState<PartnerApplicationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [ownerFullName, setOwnerFullName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [laundryName, setLaundryName] = useState('');

  // Master Wilayah Cascading Dropdown States
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);

  const [selectedProvinceCode, setSelectedProvinceCode] = useState('32');
  const [selectedCityCode, setSelectedCityCode] = useState('3274');
  const [selectedDistrictCode, setSelectedDistrictCode] = useState('327404');
  const [selectedVillageCode, setSelectedVillageCode] = useState('3274041002');
  const [postalCode, setPostalCode] = useState('45135');

  const [addressDetail, setAddressDetail] = useState('');
  const [rt, setRt] = useState('');
  const [rw, setRw] = useState('');

  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('20:00');
  const [payoutAccountHolder, setPayoutAccountHolder] = useState('');
  const [payoutBank, setPayoutBank] = useState('BCA');
  const [payoutAccountNumber, setPayoutAccountNumber] = useState('');

  // Services Draft
  const [services, setServices] = useState<
    Array<{ name: string; code: string; price: number; unit: 'kg' | 'pcs' }>
  >([
    { name: 'Cuci Komplit Kiloan (Cuci + Setrika)', code: 'kiloan', price: 7000, unit: 'kg' },
    { name: 'Cuci Express 6 Jam', code: 'express', price: 12000, unit: 'kg' },
    { name: 'Cuci Satuan Bedcover', code: 'satuan', price: 35000, unit: 'pcs' },
  ]);

  // Load Provinces
  useEffect(() => {
    let isMounted = true;
    const loadProvinces = async () => {
      const data = await customerAddressService.getProvincesAsync();
      if (isMounted && data.length > 0) {
        setProvinces(data);
      }
    };
    loadProvinces();
    return () => {
      isMounted = false;
    };
  }, []);

  // Cascade Province -> Cities
  useEffect(() => {
    let isMounted = true;
    const loadCities = async () => {
      if (!selectedProvinceCode) return;
      const data = await customerAddressService.getCitiesAsync(selectedProvinceCode);
      if (isMounted) {
        setCities(data);
        if (data.length > 0) {
          const cirebon = data.find((c) => c.code === '3274') || data[0];
          setSelectedCityCode(cirebon.code);
        }
      }
    };
    loadCities();
    return () => {
      isMounted = false;
    };
  }, [selectedProvinceCode]);

  // Cascade City -> Districts
  useEffect(() => {
    let isMounted = true;
    const loadDistricts = async () => {
      if (!selectedCityCode) return;
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

  // Cascade District -> Villages
  useEffect(() => {
    let isMounted = true;
    const loadVillages = async () => {
      if (!selectedDistrictCode) return;
      const data = await customerAddressService.getVillagesAsync(selectedDistrictCode);
      if (isMounted) {
        setVillages(data);
        if (data.length > 0) {
          setSelectedVillageCode(data[0].code);
          setPostalCode(data[0].postalCode);
        }
      }
    };
    loadVillages();
    return () => {
      isMounted = false;
    };
  }, [selectedDistrictCode]);

  const handleVillageChange = (vCode: string) => {
    setSelectedVillageCode(vCode);
    const found = villages.find((v) => v.code === vCode);
    if (found) {
      setPostalCode(found.postalCode);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        let profile: UserProfile | null = null;
        if (isSupabaseConfigured) {
          profile = await authService.fetchCurrentProfile();
        } else {
          profile = authService.getCurrentUser();
        }

        if (!profile) {
          if (isMounted) router.push('/login');
          return;
        }

        if (profile.role !== 'laundry_owner') {
          if (isMounted) router.push('/owner');
          return;
        }

        if (isMounted) {
          setCurrentUser(profile);
          setOwnerFullName(profile.fullName || '');
          setOwnerPhone(profile.phone || '');
          setPayoutAccountHolder(profile.fullName || '');
        }

        // Fetch existing application if available
        if (isSupabaseConfigured) {
          const app = await partnerApplicationService.getMyPartnerApplicationAsync();
          if (app && isMounted) {
            setExistingApp(app);
            if (app.status === 'pending') {
              router.push('/owner');
              return;
            }
            if (app.status === 'approved') {
              router.push('/owner');
              return;
            }
            if (app.status === 'rejected' || isRevisionModeParam) {
              setOwnerFullName(app.owner_full_name || profile.fullName || '');
              setOwnerPhone(app.owner_phone || profile.phone || '');
              setLaundryName(app.laundry_name || '');
              setAddressDetail(app.address_detail || app.laundry_address || '');
              setSelectedProvinceCode(app.province_code || '32');
              setSelectedCityCode(app.city_code || '3274');
              setSelectedDistrictCode(app.district_code || '327404');
              setSelectedVillageCode(app.village_code || '3274041002');
              setPostalCode(app.postal_code || '45135');
              setRt(app.rt || '');
              setRw(app.rw || '');
              setOpeningTime(app.opening_time ? app.opening_time.slice(0, 5) : '08:00');
              setClosingTime(app.closing_time ? app.closing_time.slice(0, 5) : '20:00');
              setPayoutAccountHolder(app.payout_account_holder || '');
              setPayoutBank(app.payout_bank || 'BCA');
              setPayoutAccountNumber(app.payout_account_number || '');

              if (app.services && app.services.length > 0) {
                setServices(
                  app.services.map((s) => ({
                    name: s.name,
                    code: s.code || 'kiloan',
                    price: s.price_per_unit,
                    unit: (s.unit as 'kg' | 'pcs') || 'kg',
                  }))
                );
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('Error loading onboarding form:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [router, isRevisionModeParam]);

  const handleAddService = () => {
    setServices((prev) => [
      ...prev,
      { name: 'Layanan Baru', code: 'kiloan', price: 10000, unit: 'kg' },
    ]);
  };

  const handleRemoveService = (index: number) => {
    if (services.length <= 1) {
      alert('Minimal 1 draf layanan wajib diisi.');
      return;
    }
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateService = (
    index: number,
    field: keyof (typeof services)[0],
    value: any
  ) => {
    setServices((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation
    if (!ownerFullName.trim()) return setErrorMessage('Nama pemilik wajib diisi.');
    if (!ownerPhone.trim() || ownerPhone.trim().length < 8)
      return setErrorMessage('Nomor WhatsApp pemilik wajib diisi dengan benar.');
    if (!laundryName.trim()) return setErrorMessage('Nama outlet laundry wajib diisi.');
    if (!addressDetail.trim()) return setErrorMessage('Alamat lengkap outlet wajib diisi.');
    if (!payoutAccountHolder.trim() || !payoutAccountNumber.trim())
      return setErrorMessage('Informasi rekening bank pencairan dana wajib diisi lengkap.');
    if (services.length === 0) return setErrorMessage('Wajib menambahkan minimal 1 layanan.');

    const provinceObj = provinces.find((p) => p.code === selectedProvinceCode) || { code: '32', name: 'Jawa Barat' };
    const cityObj = cities.find((c) => c.code === selectedCityCode) || { code: '3274', name: 'Kota Cirebon' };
    const districtObj = districts.find((d) => d.code === selectedDistrictCode) || { code: '327404', name: 'Kesambi' };
    const villageObj = villages.find((v) => v.code === selectedVillageCode) || { code: '3274041002', name: 'Karyamulya', postalCode: '45135' };

    const formattedFullAddress = `${addressDetail.trim()}, Kel. ${villageObj.name}, Kec. ${districtObj.name}, ${cityObj.name}, ${provinceObj.name} ${villageObj.postalCode || postalCode}`;

    setIsSubmitting(true);

    const payload = {
      ownerFullName: ownerFullName.trim(),
      ownerPhone: ownerPhone.trim(),
      laundryName: laundryName.trim(),
      laundryAddress: formattedFullAddress,
      city: cityObj.name,
      district: districtObj.name,
      provinceCode: provinceObj.code,
      provinceName: provinceObj.name,
      cityCode: cityObj.code,
      cityName: cityObj.name,
      districtCode: districtObj.code,
      districtName: districtObj.name,
      villageCode: villageObj.code,
      villageName: villageObj.name,
      postalCode: villageObj.postalCode || postalCode,
      rt: rt.trim() || undefined,
      rw: rw.trim() || undefined,
      addressDetail: addressDetail.trim(),
      openingTime,
      closingTime,
      payoutAccountHolder: payoutAccountHolder.trim(),
      payoutBank: payoutBank.trim(),
      payoutAccountNumber: payoutAccountNumber.trim(),
      services,
    };

    try {
      if (isSupabaseConfigured) {
        if (existingApp && existingApp.status === 'rejected') {
          await partnerApplicationService.updatePartnerApplicationRevisionAsync(
            existingApp.id,
            payload
          );
          setSuccessMessage(
            'Revisi pengajuan mitra berhasil dikirim! Menunggu verifikasi ulang Admin Platform.'
          );
        } else {
          await partnerApplicationService.createPartnerApplicationAsync(payload);
          setSuccessMessage(
            'Pendaftaran laundry berhasil dikirim! Pengajuan Anda sedang dalam antrean verifikasi Admin Platform.'
          );
        }
      } else {
        setSuccessMessage('Pendaftaran laundry berhasil disimpan (Demo Local Mode).');
      }

      setTimeout(() => {
        router.push('/owner');
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengirim pendaftaran laundry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Memuat formulir pendaftaran laundry...</p>
        </div>
      </div>
    );
  }

  const isRevising = existingApp?.status === 'rejected';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      {/* Top Back Navigation */}
      <Link
        href="/owner"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard Owner
      </Link>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-2 relative overflow-hidden">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-bold mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isRevising ? 'Revisi Pengajuan Outlet' : 'Form Pendaftaran Outlet Laundry Baru'}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
          {isRevising ? 'Revisi Pengajuan Laundry' : 'Daftarkan Usaha Laundry Anda'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
          Lengkapi data outlet, wilayah operasional, katalog layanan, dan rekening bank untuk dikaji oleh Admin Platform FreshWash.
        </p>
      </div>

      {/* Rejection Alert Header if Revising */}
      {isRevising && existingApp?.rejection_reason && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
          <span className="font-bold flex items-center gap-1.5 text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            Alasan Penolakan Sebelumnya dari Admin Platform:
          </span>
          <p className="pl-5 text-slate-800 italic">{existingApp.rejection_reason}</p>
        </div>
      )}

      {/* Error & Success Messages */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Identitas Pemilik & Outlet Laundry */}
        <Card variant="white" className="p-6 space-y-4 shadow-lg">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Store className="w-4 h-4 text-teal-600" />
            <span>1. Identitas Outlet &amp; Pemilik Usaha</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Nama Lengkap Pemilik *</label>
              <input
                type="text"
                required
                value={ownerFullName}
                onChange={(e) => setOwnerFullName(e.target.value)}
                placeholder="Contoh: Hendra Wijaya"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Nomor WhatsApp Aktif *</label>
              <input
                type="text"
                required
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="font-bold text-slate-700">Nama Outlet Laundry *</label>
              <input
                type="text"
                required
                value={laundryName}
                onChange={(e) => setLaundryName(e.target.value)}
                placeholder="Contoh: FreshWash Express Kebayoran"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-semibold"
              />
            </div>

            {/* Master Wilayah Cascading Dropdowns */}
            <div className="sm:col-span-2 p-4 rounded-2xl bg-teal-50/60 border border-teal-200/80 space-y-3">
              <div className="flex items-center gap-1.5 text-teal-800 font-bold text-xs">
                <MapPin className="w-4 h-4 text-teal-600" />
                <span>Wilayah Lokasi Outlet Laundry (Master Wilayah V1 Kota Cirebon)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div className="sm:col-span-2 space-y-1.5">
              <label className="font-bold text-slate-700">Alamat Lengkap / Ruko / Patokan *</label>
              <textarea
                rows={2}
                required
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                placeholder="Nama jalan, nomor ruko/gedung, patokan lokasi..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </Card>

        {/* Section 2: Operasional */}
        <Card variant="white" className="p-6 space-y-4 shadow-lg">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="w-4 h-4 text-teal-600" />
            <span>2. Jam Operasional Outlet</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Jam Buka Outlet *</label>
              <input
                type="time"
                required
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Jam Tutup Outlet *</label>
              <input
                type="time"
                required
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </Card>

        {/* Section 3: Katalog Layanan Draf */}
        <Card variant="white" className="p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Tag className="w-4 h-4 text-teal-600" />
              <span>3. Draf Katalog Layanan Laundry ({services.length})</span>
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddService}
              leftIcon={<Plus className="w-3.5 h-3.5 text-teal-600" />}
              className="text-xs font-bold"
            >
              Tambah Layanan
            </Button>
          </div>

          <div className="space-y-3">
            {services.map((srv, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs"
              >
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nama Layanan</label>
                  <input
                    type="text"
                    required
                    value={srv.name}
                    onChange={(e) => handleUpdateService(idx, 'name', e.target.value)}
                    placeholder="Nama layanan..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Harga per Unit (Rp)</label>
                  <input
                    type="number"
                    required
                    min={500}
                    step={500}
                    value={srv.price}
                    onChange={(e) => handleUpdateService(idx, 'price', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-teal-800 focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Satuan Unit</label>
                  <select
                    value={srv.unit}
                    onChange={(e) => {
                      const newUnit = e.target.value as 'kg' | 'pcs';
                      const newCode = newUnit === 'pcs' ? 'satuan' : 'kiloan';
                      handleUpdateService(idx, 'unit', newUnit);
                      handleUpdateService(idx, 'code', newCode);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold focus:outline-hidden"
                  >
                    <option value="kg">per kg</option>
                    <option value="pcs">per pcs (satuan)</option>
                  </select>
                </div>

                <div className="sm:col-span-1 text-right pt-2 sm:pt-4">
                  <button
                    type="button"
                    onClick={() => handleRemoveService(idx)}
                    className="text-slate-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition-colors"
                    title="Hapus Layanan"
                  >
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Section 4: Rekening Pencairan Dana (Payout) */}
        <Card variant="white" className="p-6 space-y-4 shadow-lg">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <CreditCard className="w-4 h-4 text-teal-600" />
            <span>4. Rekening Pencairan Hasil Transaksi (Payout)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Bank Tujuan *</label>
              <select
                value={payoutBank}
                onChange={(e) => setPayoutBank(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-semibold"
              >
                <option value="BCA">BCA (Bank Central Asia)</option>
                <option value="Mandiri">Bank Mandiri</option>
                <option value="BRI">BRI (Bank Rakyat Indonesia)</option>
                <option value="BNI">BNI (Bank Negara Indonesia)</option>
                <option value="BSI">BSI (Bank Syariah Indonesia)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Atas Nama Pemilik *</label>
              <input
                type="text"
                required
                value={payoutAccountHolder}
                onChange={(e) => setPayoutAccountHolder(e.target.value)}
                placeholder="Nama sesuai buku tabungan"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Nomor Rekening *</label>
              <input
                type="text"
                required
                value={payoutAccountNumber}
                onChange={(e) => setPayoutAccountNumber(e.target.value)}
                placeholder="Contoh: 1234567890"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono font-bold"
              />
            </div>
          </div>
        </Card>

        {/* Submit Actions */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/owner" className="w-full sm:w-auto">
            <Button type="button" variant="outline" size="lg" className="w-full">
              Batal
            </Button>
          </Link>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 font-bold px-8 shadow-xl cursor-pointer"
          >
            {isSubmitting
              ? 'Mengirim Pendaftaran...'
              : isRevising
              ? 'Kirim Ulang Revisi Pengajuan'
              : 'Kirim Pendaftaran Laundry'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function OwnerLaundryRegisterPage() {
  return (
    <React.Suspense fallback={<div className="container mx-auto px-4 py-8 text-center">Memuat form pendaftaran...</div>}>
      <OwnerLaundryRegisterContent />
    </React.Suspense>
  );
}
