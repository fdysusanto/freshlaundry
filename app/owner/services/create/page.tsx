'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { laundryService } from '@/services/laundryService';
import { DEMO_LAUNDRIES } from '@/utils/constants';
import { ServiceType } from '@/types/order';
import { UserProfile } from '@/types/user';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  ArrowLeft,
  Plus,
  Sparkles,
  Layers,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Store,
} from 'lucide-react';

export default function CreateOwnerServicePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState<ServiceType>('kiloan');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState<'kg' | 'pcs'>('kg');
  const [price, setPrice] = useState<number>(8000);
  const [minWeight, setMinWeight] = useState<number>(3);
  const [estimatedHours, setEstimatedHours] = useState<number>(48);
  const [estimatedTime, setEstimatedTime] = useState('2-3 Hari');
  const [badge, setBadge] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
  }, []);

  const selectedLaundry = DEMO_LAUNDRIES.find(
    (l) => l.id === (currentUser?.laundryId || 'lnd_001')
  ) || DEMO_LAUNDRIES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!currentUser) {
      setErrorMsg('Sesi login tidak valid. Silakan login kembali.');
      return;
    }

    // Validasi Form Client-side
    if (!name || name.trim().length < 3) {
      setErrorMsg('Nama layanan wajib diisi minimal 3 karakter.');
      return;
    }
    if (!description || description.trim().length < 5) {
      setErrorMsg('Deskripsi layanan wajib diisi minimal 5 karakter.');
      return;
    }
    if (!price || price <= 0) {
      setErrorMsg('Tarif harga layanan harus lebih dari Rp 0.');
      return;
    }
    if (!estimatedHours || estimatedHours <= 0) {
      setErrorMsg('Estimasi pengerjaan harus lebih dari 0 jam.');
      return;
    }

    try {
      setIsSubmitting(true);
      await laundryService.createServiceAsync(
        {
          code,
          name: name.trim(),
          description: description.trim(),
          pricingType: unit === 'pcs' ? 'per_item' : 'per_kg',
          price,
          price_per_unit: price,
          unit,
          minWeight,
          estimatedHours,
          estimatedTime: estimatedTime.trim() || `${estimatedHours} Jam`,
          badge: badge.trim() || undefined,
          iconName: unit === 'pcs' ? 'Sparkles' : 'ShoppingBag',
          isActive,
        },
        currentUser
      );

      router.push('/owner/services');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menambahkan layanan baru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* Top Back Navigation */}
      <button
        onClick={() => router.push('/owner/services')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-700 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Layanan
      </button>

      {/* Header Banner */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
          <Sparkles className="w-4 h-4 text-teal-600" />
          <span>Form Tambah Layanan Baru</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Tambah Layanan Laundry
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Layanan baru akan otomatis terikat pada toko mitra:{' '}
          <strong className="text-slate-800">{selectedLaundry.name}</strong> ({selectedLaundry.id})
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card variant="white" className="space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Store className="w-4 h-4 text-teal-600" /> Informasi Utama Layanan
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Nama Layanan Laundry <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Misal: Cuci Komplit Kiloan Premium, Dry Clean Jas Sutra..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Kode / Kategori Layanan:
              </label>
              <select
                value={code}
                onChange={(e) => setCode(e.target.value as ServiceType)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-bold bg-slate-50 cursor-pointer"
              >
                <option value="kiloan">kiloan — Cuci Kiloan Reguler</option>
                <option value="express">express — Express Kilat</option>
                <option value="dry_clean">dry_clean — Dry Cleaning Premium</option>
                <option value="satuan">satuan — Cuci Satuan (Sepatu/Bedcover)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Satuan Ukuran Hitung:
              </label>
              <select
                value={unit}
                onChange={(e) => {
                  const newUnit = e.target.value as 'kg' | 'pcs';
                  setUnit(newUnit);
                  if (newUnit === 'pcs' && minWeight > 1) setMinWeight(1);
                }}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-bold bg-slate-50 cursor-pointer"
              >
                <option value="kg">Per Kilogram (kg)</option>
                <option value="pcs">Per Pcs / Item (pcs)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Deskripsi Penjelasan Layanan <span className="text-rose-500">*</span>:
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Jelaskan proses pengerjaan, pelembut wangi yang digunakan, atau perlakuan khusus..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </Card>

        <Card variant="white" className="space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-teal-600" /> Tarif & Durasi Pengerjaan
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Tarif Harga per {unit} (Rp) <span className="text-rose-500">*</span>:
              </label>
              <input
                type="number"
                required
                min={500}
                step={500}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-bold text-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Minimal Order ({unit}):
              </label>
              <input
                type="number"
                required
                min={1}
                value={minWeight}
                onChange={(e) => setMinWeight(Number(e.target.value))}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Estimasi Jam Pengerjaan <span className="text-rose-500">*</span>:
              </label>
              <input
                type="number"
                required
                min={1}
                value={estimatedHours}
                onChange={(e) => {
                  const hrs = Number(e.target.value);
                  setEstimatedHours(hrs);
                  if (hrs <= 12) setEstimatedTime(`${hrs} Jam`);
                  else setEstimatedTime(`${Math.round(hrs / 24)} Hari`);
                }}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Label Estimasi Waktu:
              </label>
              <input
                type="text"
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(e.target.value)}
                placeholder="Misal: 2-3 Hari, 6 Jam..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Badge Promo / Highlight (Opsional):
              </label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="Misal: Paling Laris, Super Cepat..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-semibold"
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="isActiveToggle"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded-sm focus:ring-teal-500 cursor-pointer"
              />
              <label htmlFor="isActiveToggle" className="text-xs font-bold text-slate-800 cursor-pointer">
                Tampilkan Layanan Ini (Aktif)
              </label>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => router.push('/owner/services')}
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting}
            leftIcon={<Plus className="w-4 h-4" />}
            className="bg-teal-600 hover:bg-teal-500 text-white font-bold cursor-pointer"
          >
            Simpan Layanan Baru
          </Button>
        </div>
      </form>
    </div>
  );
}
