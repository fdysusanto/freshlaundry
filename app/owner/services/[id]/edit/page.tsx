'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { laundryService } from '@/services/laundryService';
import { DEMO_LAUNDRIES, ServiceCatalogItem } from '@/utils/constants';
import { ServiceType } from '@/types/order';
import { UserProfile } from '@/types/user';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  OwnerBranchProvider,
  useOwnerBranch,
} from '@/components/owner/OwnerBranchContext';
import { OwnerBranchSwitcher } from '@/components/owner/OwnerBranchSwitcher';
import {
  ArrowLeft,
  Edit,
  Layers,
  DollarSign,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';

function EditOwnerServiceContent() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params?.id as string;

  const { ownedLaundries, buildBranchUrl } = useOwnerBranch();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [targetService, setTargetService] = useState<ServiceCatalogItem | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState<ServiceType>('kiloan');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState<'kg' | 'pcs'>('kg');
  const [price, setPrice] = useState<number>(0);
  const [minWeightInput, setMinWeightInput] = useState<string>('');
  const [estimatedHours, setEstimatedHours] = useState<number>(24);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [badge, setBadge] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const user = authService.getCurrentUser();
    setCurrentUser(user);

    if (!serviceId) return;

    const loadService = async () => {
      let srv = await laundryService.getServiceByIdAsync(serviceId);
      if (!srv) {
        srv = laundryService.getServiceById(serviceId);
      }

      if (!srv && isMounted) {
        setAuthError(`Layanan dengan ID \`${serviceId}\` tidak ditemukan.`);
        return;
      }

      if (srv && isMounted) {
        const isAdmin = user?.role === 'platform_admin' || user?.role === 'admin';
        const isOwnedByOwner = ownedLaundries.some((l) => l.id === srv.laundryId) || srv.laundryId === user?.laundryId;

        if (!isAdmin && !isOwnedByOwner) {
          setAuthError(
            `Akses Ditolak: Layanan ini milik toko laundry lain (${srv.laundryId}). Anda tidak memiliki wewenang untuk mengubahnya.`
          );
          return;
        }

        setTargetService(srv);
        setName(srv.name);
        setCode((srv.code as ServiceType) || 'kiloan');
        setDescription(srv.description);
        setUnit(srv.unit || 'kg');
        setPrice(srv.price);
        setMinWeightInput(srv.minWeight && srv.unit === 'kg' ? String(srv.minWeight) : '');
        setEstimatedHours(srv.estimatedHours || 24);
        setEstimatedTime(srv.estimatedTime || `${srv.estimatedHours || 24} Jam`);
        setBadge(srv.badge || '');
        setIsActive(srv.isActive ?? true);
      }
    };

    loadService();
    return () => {
      isMounted = false;
    };
  }, [serviceId, ownedLaundries]);

  if (authError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <ShieldAlert className="w-14 h-14 text-rose-500 mx-auto" />
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Otorisasi Ditolak</h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">{authError}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(buildBranchUrl('/owner/services'))}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Kembali ke Katalog Layanan Anda
        </Button>
      </div>
    );
  }

  if (!targetService) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-slate-500">
        Memuat data layanan...
      </div>
    );
  }

  const selectedLaundry =
    ownedLaundries.find((l) => l.id === targetService.laundryId) ||
    DEMO_LAUNDRIES.find((l) => l.id === targetService.laundryId) ||
    DEMO_LAUNDRIES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!currentUser) {
      setErrorMsg('Sesi login tidak valid.');
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
    const parsedMinWeight =
      unit === 'kg' && minWeightInput.trim() !== '' && !isNaN(Number(minWeightInput)) && Number(minWeightInput) > 0
        ? Number(minWeightInput)
        : null;

    if (unit === 'kg' && minWeightInput.trim() !== '' && (isNaN(Number(minWeightInput)) || Number(minWeightInput) <= 0)) {
      setErrorMsg('Minimum order (kg) harus berupa angka lebih besar dari 0.');
      return;
    }
    if (!estimatedHours || estimatedHours <= 0) {
      setErrorMsg('Estimasi pengerjaan harus lebih dari 0 jam.');
      return;
    }

    try {
      setIsSubmitting(true);
      await laundryService.updateServiceAsync(
        serviceId,
        {
          name: name.trim(),
          description: description.trim(),
          pricingType: unit === 'pcs' ? 'per_item' : 'per_kg',
          price,
          unit,
          minWeight: parsedMinWeight,
          minimumQuantity: parsedMinWeight,
          estimatedHours,
          estimatedTime: estimatedTime.trim() || `${estimatedHours} Jam`,
          badge: badge.trim() || undefined,
          isActive,
        },
        currentUser
      );

      router.push(buildBranchUrl('/owner/services', targetService.laundryId));
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui layanan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* Branch Switcher Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
        <div>
          <span className="text-[10px] font-black text-brand-primary uppercase tracking-wider block">Context Cabang</span>
          <span className="text-xs text-slate-500 font-medium">Layanan ini terdaftar di cabang berikut.</span>
        </div>
        <OwnerBranchSwitcher />
      </div>

      {/* Top Back Navigation */}
      <button
        onClick={() => router.push(buildBranchUrl('/owner/services', targetService.laundryId))}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-brand-primary transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Kembali ke Katalog Layanan</span>
      </button>

      {/* Header Info Banner */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Edit className="w-6 h-6 text-brand-primary" /> Edit Layanan #{targetService.code || serviceId.slice(0, 8)}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Perbarui nama, tarif harga, deskripsi, atau status keaktifan layanan toko.
          </p>
        </div>
        <div className="hidden sm:block text-right">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Mitra Laundry</span>
          <span className="text-xs font-bold text-slate-800">{selectedLaundry.name}</span>
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card variant="white" className="space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-primary" /> Informasi Layanan Utama
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Nama Paket Layanan <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="mis. Cuci Komplit Kiloan, Cuci Sepatu Sneaker"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Kode / Kategori Layanan:
              </label>
              <select
                value={code}
                onChange={(e) => setCode(e.target.value as ServiceType)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-semibold bg-slate-50 cursor-pointer"
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
                  if (newUnit === 'pcs') setMinWeightInput('');
                }}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-bold bg-slate-50 cursor-pointer"
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
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
              />
            </div>
          </div>
        </Card>

        <Card variant="white" className="space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-brand-primary" /> Tarif & Durasi Pengerjaan
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
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-bold text-brand-primary"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Catatan: Perubahan tarif ini tidak akan merusak pesanan terdahulu yang sudah dibuat.
              </p>
            </div>

            {unit === 'kg' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Minimum Order (KG) — Opsional:
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="Kosongkan jika tidak ada min. order"
                  value={minWeightInput}
                  onChange={(e) => setMinWeightInput(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-semibold"
                />
                <p className="text-[10px] text-slate-500 mt-1 font-medium leading-tight">
                  Kosongkan jika layanan tidak memiliki minimum order.
                </p>
              </div>
            )}

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
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-semibold"
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
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Badge Promo / Highlight:
              </label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-semibold"
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="isActiveToggle"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-brand-primary rounded-sm focus:ring-brand-primary cursor-pointer"
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
            onClick={() => router.push(buildBranchUrl('/owner/services', targetService.laundryId))}
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting}
            leftIcon={<Edit className="w-4 h-4" />}
            className="bg-brand-primary hover:bg-brand-primary/90 text-white font-bold cursor-pointer"
          >
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function EditOwnerServicePage() {
  return <EditOwnerServiceContent />;
}

