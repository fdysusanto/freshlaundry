'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { partnerApplicationService, CreateAddBranchApplicationPayload } from '@/services/partnerApplicationService';
import { MapLocationPicker, DEFAULT_MAP_CENTER } from '@/components/address/MapLocationPicker';
import { Button } from '@/components/ui/Button';
import { Store, MapPin, Clock, Plus, Trash2, ArrowLeft, Sparkles, AlertCircle, ShieldCheck } from 'lucide-react';

interface ServiceFormState {
  id: string;
  name: string;
  code: string;
  price: string;
  unit: 'kg' | 'pcs';
  minWeight: string;
  estimatedHours: string;
}

export default function CreateBranchPage() {
  const router = useRouter();

  // Form State
  const [laundryName, setLaundryName] = useState('');
  const [laundryAddress, setLaundryAddress] = useState('');
  const [cityName, setCityName] = useState('Kota Cirebon');
  const [districtName, setDistrictName] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [latitude, setLatitude] = useState<number>(DEFAULT_MAP_CENTER[0]);
  const [longitude, setLongitude] = useState<number>(DEFAULT_MAP_CENTER[1]);
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('20:00');

  // Draft Services State
  const [services, setServices] = useState<ServiceFormState[]>([
    {
      id: '1',
      name: 'Cuci Komplit Kiloan',
      code: 'kiloan',
      price: '7000',
      unit: 'kg',
      minWeight: '3',
      estimatedHours: '24',
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddService = () => {
    setServices([
      ...services,
      {
        id: Date.now().toString(),
        name: '',
        code: 'kiloan',
        price: '',
        unit: 'kg',
        minWeight: '3',
        estimatedHours: '24',
      },
    ]);
  };

  const handleRemoveService = (id: string) => {
    if (services.length <= 1) {
      setErrorMsg('Cabang baru wajib memiliki minimal 1 jenis layanan.');
      return;
    }
    setServices(services.filter((s) => s.id !== id));
  };

  const handleServiceChange = (id: string, field: keyof ServiceFormState, value: string) => {
    setServices(
      services.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation
    if (!laundryName.trim()) {
      setErrorMsg('Nama cabang laundry wajib diisi.');
      return;
    }
    if (!laundryAddress.trim()) {
      setErrorMsg('Alamat lengkap cabang wajib diisi.');
      return;
    }
    if (!cityName.trim() || !districtName.trim()) {
      setErrorMsg('Kota dan Kecamatan wajib diisi.');
      return;
    }
    if (!latitude || !longitude) {
      setErrorMsg('Tentukan titik lokasi cabang pada peta.');
      return;
    }

    if (!services.length) {
      setErrorMsg('Minimal 1 jenis layanan wajib ditambahkan.');
      return;
    }

    for (let i = 0; i < services.length; i++) {
      const s = services[i];
      if (!s.name.trim()) {
        setErrorMsg(`Nama layanan ke-${i + 1} tidak boleh kosong.`);
        return;
      }
      const priceNum = Number(s.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        setErrorMsg(`Harga layanan ke-${i + 1} harus angka positif yang valid.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: CreateAddBranchApplicationPayload = {
        laundryName: laundryName.trim(),
        laundryAddress: laundryAddress.trim(),
        city: cityName.trim(),
        district: districtName.trim(),
        cityName: cityName.trim(),
        districtName: districtName.trim(),
        addressDetail: addressDetail.trim() || undefined,
        latitude,
        longitude,
        openingTime,
        closingTime,
        services: services.map((s) => ({
          name: s.name.trim(),
          code: s.code,
          price: Number(s.price),
          unit: s.unit,
          minWeight: s.unit === 'kg' && s.minWeight ? Number(s.minWeight) : null,
          estimatedHours: s.estimatedHours ? Number(s.estimatedHours) : 24,
        })),
      };

      await partnerApplicationService.createAddBranchApplicationAsync(payload);
      router.push('/owner/branches?success=submitted');
    } catch (err: any) {
      console.error('Error submitting add branch:', err);
      setErrorMsg(err.message || 'Gagal mengajukan penambahan cabang.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-6 sm:pt-8 pb-32 sm:pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-primary bg-brand-surface px-3 py-1.5 rounded-full border border-brand-primary/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Form Pengajuan Cabang Baru</span>
          </div>
        </div>

        {/* Title Section */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-100 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold shrink-0">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">Tambah Cabang Laundry Baru</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Daftarkan outlet cabang usaha Anda untuk menjangkau lebih banyak pelanggan di CUCIYAN.
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-amber-50 border border-amber-200/70 rounded-2xl text-xs text-amber-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-amber-800">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Proses Otorisasi & Verifikasi Admin
            </p>
            <p className="text-amber-800/90 leading-relaxed">
              Pengajuan cabang baru memerlukan verifikasi dan persetujuan Admin CUCIYAN. Setelah disetujui, cabang baru akan otomatis aktif dan dapat dikelola langsung dari dashboard Owner.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm font-bold flex items-start gap-3 animate-in fade-in duration-150">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Informasi Cabang */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-100 space-y-5">
            <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Store className="w-5 h-5 text-brand-primary" />
              <span>1. Detail Identitas Cabang</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Nama Cabang Laundry <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: FreshLaundry - Cabang Pemuda"
                  value={laundryName}
                  onChange={(e) => setLaundryName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-primary text-sm font-medium text-slate-900 outline-hidden bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Kota / Kabupaten <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Kota Cirebon"
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-primary text-sm font-medium text-slate-900 outline-hidden bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Kecamatan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Kesambi"
                  value={districtName}
                  onChange={(e) => setDistrictName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-primary text-sm font-medium text-slate-900 outline-hidden bg-white"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Alamat Lengkap Outlet <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Jl. Pemuda No. 45, Kesambi, Kota Cirebon"
                  value={laundryAddress}
                  onChange={(e) => setLaundryAddress(e.target.value)}
                  className="w-full p-3 text-sm font-medium text-slate-900 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary outline-hidden bg-white"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Patokan / Detail Alamat (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Samping minimarket Alfa, seberang ruko hijau"
                  value={addressDetail}
                  onChange={(e) => setAddressDetail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-primary text-sm font-medium text-slate-900 outline-hidden bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Jam Operasional & Lokasi Peta */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-100 space-y-5">
            <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-primary" />
              <span>2. Jam Operasional & Titik Peta</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Jam Buka <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-primary text-sm font-medium text-slate-900 outline-hidden bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Jam Tutup <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-primary text-sm font-medium text-slate-900 outline-hidden bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Pilih Titik Lokasi Peta <span className="text-rose-500">*</span>
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Geser pin peta untuk menentukan koordinat presisi cabang outlet Anda.
              </p>
              <div className="rounded-2xl overflow-hidden border border-slate-200">
                <MapLocationPicker
                  latitude={latitude}
                  longitude={longitude}
                  onLocationChange={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                  }}
                  showCurrentLocation
                />
              </div>
              <div className="mt-2 text-xs font-mono text-slate-500 flex items-center gap-4">
                <span>Latitude: {latitude.toFixed(6)}</span>
                <span>Longitude: {longitude.toFixed(6)}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Layanan & Tarif Cabang */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-brand-primary" />
                <span>3. Layanan & Tarif Cabang Baru</span>
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddService}
                className="text-xs font-bold text-brand-primary border-brand-primary/30 hover:bg-brand-surface cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Tambah Layanan
              </Button>
            </div>

            <div className="space-y-4">
              {services.map((srv, index) => (
                <div
                  key={srv.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                      Layanan #{index + 1}
                    </span>
                    {services.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveService(srv.id)}
                        className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Nama Layanan <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Cuci Komplit Reguler"
                        value={srv.name}
                        onChange={(e) => handleServiceChange(srv.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium text-slate-900 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-primary outline-hidden"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Satuan Unit <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={srv.unit}
                        onChange={(e) => handleServiceChange(srv.id, 'unit', e.target.value as 'kg' | 'pcs')}
                        className="w-full p-2.5 text-xs font-medium text-slate-900 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-primary outline-hidden"
                      >
                        <option value="kg">Per Kg (Kiloan)</option>
                        <option value="pcs">Per Item (Satuan)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Harga (Rp) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        placeholder="7000"
                        value={srv.price}
                        onChange={(e) => handleServiceChange(srv.id, 'price', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium text-slate-900 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-primary outline-hidden"
                        required
                        min="500"
                      />
                    </div>

                    {srv.unit === 'kg' && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Min. Berat (Kg)
                        </label>
                        <input
                          type="number"
                          placeholder="3"
                          value={srv.minWeight}
                          onChange={(e) => handleServiceChange(srv.id, 'minWeight', e.target.value)}
                          className="w-full px-3 py-2 text-xs font-medium text-slate-900 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-primary outline-hidden"
                          min="1"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Estimasi (Jam)
                      </label>
                      <input
                        type="number"
                        placeholder="24"
                        value={srv.estimatedHours}
                        onChange={(e) => handleServiceChange(srv.id, 'estimatedHours', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium text-slate-900 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-primary outline-hidden"
                        min="1"
                        max="168"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Action Bar */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="font-bold text-slate-700 cursor-pointer"
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white font-bold px-8 py-3 rounded-xl shadow-md cursor-pointer"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Mengirim Pengajuan...</span>
                </div>
              ) : (
                <span>Kirim Pengajuan Cabang Baru</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
