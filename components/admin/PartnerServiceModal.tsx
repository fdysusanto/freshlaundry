'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ServiceCatalogItem } from '@/utils/constants';
import { ServiceCategory } from '@/types/laundry';
import { ServiceType } from '@/types/order';
import { authService } from '@/services/authService';
import {
  Sparkles,
  AlertTriangle,
  X,
} from 'lucide-react';

interface PartnerServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerId: string;
  partnerName: string;
  mode: 'CREATE' | 'EDIT';
  serviceToEdit?: ServiceCatalogItem | null;
  onSuccess: () => void;
}

interface FormContentProps {
  onClose: () => void;
  partnerId: string;
  partnerName: string;
  mode: 'CREATE' | 'EDIT';
  serviceToEdit?: ServiceCatalogItem | null;
  onSuccess: () => void;
}

const PartnerServiceModalContent: React.FC<FormContentProps> = ({
  onClose,
  partnerId,
  partnerName,
  mode,
  serviceToEdit,
  onSuccess,
}) => {
  const isEdit = mode === 'EDIT' && Boolean(serviceToEdit);
  const initialUnit = ((isEdit && serviceToEdit?.unit) as 'kg' | 'pcs') || 'kg';

  const [name, setName] = useState(isEdit ? serviceToEdit?.name || '' : '');
  const [code, setCode] = useState<ServiceType>(
    (isEdit && (serviceToEdit?.code as ServiceType)) || 'kiloan'
  );
  const [category, setCategory] = useState<ServiceCategory>(
    (isEdit && (serviceToEdit?.category as ServiceCategory)) || 'Pakaian'
  );
  const [unit, setUnit] = useState<'kg' | 'pcs'>(initialUnit);
  const [pricingType, setPricingType] = useState<'per_kg' | 'per_item' | 'fixed'>(
    (isEdit && (serviceToEdit?.pricingType as 'per_kg' | 'per_item' | 'fixed')) ||
      (initialUnit === 'pcs' ? 'per_item' : 'per_kg')
  );
  const [price, setPrice] = useState<number>(
    isEdit ? Number(serviceToEdit?.price || serviceToEdit?.price_per_unit || 8000) : 8000
  );
  const [minWeightInput, setMinWeightInput] = useState<string>(
    isEdit && initialUnit === 'kg' && serviceToEdit?.minWeight !== null && serviceToEdit?.minWeight !== undefined
      ? String(serviceToEdit.minWeight)
      : (isEdit ? '' : '1')
  );
  const [estimatedHours, setEstimatedHours] = useState<number>(
    isEdit ? serviceToEdit?.estimatedHours || 24 : 24
  );
  const [description, setDescription] = useState(isEdit ? serviceToEdit?.description || '' : '');
  const [iconName, setIconName] = useState(
    isEdit ? serviceToEdit?.iconName || (initialUnit === 'pcs' ? 'Sparkles' : 'ShoppingBag') : 'ShoppingBag'
  );
  const [isActive, setIsActive] = useState(isEdit ? (serviceToEdit?.isActive ?? true) : true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      setErrorMessage('Nama layanan wajib diisi minimal 3 karakter.');
      return;
    }

    if (!price || price <= 0) {
      setErrorMessage('Tarif harga layanan harus lebih besar dari Rp 0.');
      return;
    }

    if (!estimatedHours || estimatedHours < 1) {
      setErrorMessage('Estimasi pengerjaan minimal 1 jam.');
      return;
    }

    let parsedMinWeight: number | null = null;
    if (unit === 'kg') {
      if (minWeightInput.trim() !== '') {
        const val = Number(minWeightInput);
        if (isNaN(val) || val <= 0) {
          setErrorMessage('Minimum order (kg) harus berupa angka lebih besar dari 0.');
          return;
        }
        parsedMinWeight = val;
      }
    }

    setIsSubmitting(true);

    try {
      const authHeaders = await authService.getAuthHeadersAsync();

      let res: Response;
      if (mode === 'CREATE') {
        res = await fetch(`/api/admin/partners/${partnerId}/services`, {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: trimmedName,
            code,
            category,
            unit,
            pricingType,
            price,
            minWeight: parsedMinWeight,
            estimatedHours,
            description: description.trim() || undefined,
            iconName,
            isActive,
          }),
        });
      } else {
        const serviceId = serviceToEdit?.id;
        if (!serviceId) throw new Error('ID layanan tidak ditemukan untuk mode edit.');

        res = await fetch(`/api/admin/partners/${partnerId}/services/${serviceId}`, {
          method: 'PATCH',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: trimmedName,
            code,
            category,
            unit,
            pricingType,
            price,
            minWeight: parsedMinWeight,
            estimatedHours,
            description: description.trim() || undefined,
            iconName,
            isActive,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menyimpan perubahan layanan.');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 my-8">
      {/* Modal Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-brand-surface rounded-xl text-brand-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {mode === 'CREATE' ? 'Tambah Layanan Baru' : 'Edit Layanan Partner'}
            </h2>
            <p className="text-[11px] text-slate-500 font-semibold">{partnerName}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 rounded-2xl border border-red-200 text-xs text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Service Name */}
        <div>
          <label className="block font-bold text-slate-700 uppercase mb-1">
            Nama Layanan <span className="text-rose-500">*</span>:
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Cuci Komplit Kiloan, Dry Clean Jas..."
            className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-semibold"
          />
        </div>

        {/* Category & Service Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Kategori Item <span className="text-rose-500">*</span>:
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ServiceCategory)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-bold bg-slate-50"
            >
              <option value="Pakaian">👕 Pakaian</option>
              <option value="Sepatu & Sandal">👟 Sepatu &amp; Sandal</option>
              <option value="Tas">👜 Tas</option>
              <option value="Karpet">🧺 Karpet</option>
              <option value="Sofa">🛋️ Sofa</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Tipe Layanan (Code):
            </label>
            <select
              value={code}
              onChange={(e) => setCode(e.target.value as ServiceType)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-bold bg-slate-50"
            >
              <option value="kiloan">kiloan — Reguler</option>
              <option value="express">express — Express Kilat</option>
              <option value="dry_clean">dry_clean — Dry Cleaning</option>
              <option value="satuan">satuan — Cuci Satuan</option>
            </select>
          </div>
        </div>

        {/* Unit & Pricing Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Satuan Hitung:
            </label>
            <select
              value={unit}
              onChange={(e) => {
                const newUnit = e.target.value as 'kg' | 'pcs';
                setUnit(newUnit);
                if (newUnit === 'pcs') {
                  setMinWeightInput('');
                  setPricingType('per_item');
                  setIconName('Sparkles');
                } else {
                  setPricingType('per_kg');
                  setIconName('ShoppingBag');
                }
              }}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-bold bg-slate-50"
            >
              <option value="kg">Kilogram (kg)</option>
              <option value="pcs">Pcs / Lembar (pcs)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Tipe Penagihan:
            </label>
            <select
              value={pricingType}
              onChange={(e) => setPricingType(e.target.value as 'per_kg' | 'per_item' | 'fixed')}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-bold bg-slate-50"
            >
              <option value="per_kg">per_kg (Per Kilogram)</option>
              <option value="per_item">per_item (Per Pcs/Satuan)</option>
              <option value="fixed">fixed (Tarif Tetap)</option>
            </select>
          </div>
        </div>

        {/* Price & Minimum Weight */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Tarif Harga per {unit} (Rp) <span className="text-rose-500">*</span>:
            </label>
            <input
              type="number"
              required
              min={500}
              step={500}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-black text-brand-primary"
            />
          </div>

          {unit === 'kg' ? (
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Min. Order (kg):
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                placeholder="Kosongkan jika bebas"
                value={minWeightInput}
                onChange={(e) => setMinWeightInput(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-semibold"
              />
            </div>
          ) : (
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Icon Visual:
              </label>
              <select
                value={iconName}
                onChange={(e) => setIconName(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-semibold bg-slate-50"
              >
                <option value="Sparkles">✨ Sparkles</option>
                <option value="Shirt">👕 Shirt</option>
                <option value="ShoppingBag">🛍️ ShoppingBag</option>
                <option value="Box">📦 Box</option>
              </select>
            </div>
          )}
        </div>

        {/* Estimated Hours */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Estimasi Pengerjaan (Jam) <span className="text-rose-500">*</span>:
            </label>
            <input
              type="number"
              required
              min={1}
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(Number(e.target.value))}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-semibold"
            />
          </div>

          {unit === 'kg' && (
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Icon Visual:
              </label>
              <select
                value={iconName}
                onChange={(e) => setIconName(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-semibold bg-slate-50"
              >
                <option value="ShoppingBag">🛍️ ShoppingBag</option>
                <option value="Shirt">👕 Shirt</option>
                <option value="Sparkles">✨ Sparkles</option>
                <option value="Box">📦 Box</option>
              </select>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block font-bold text-slate-700 uppercase mb-1">
            Deskripsi Layanan:
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Deskripsi proses pengerjaan atau catatan khusus untuk pelanggan..."
            className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-medium"
          />
        </div>

        {/* Is Active Toggle */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div>
            <span className="font-bold text-slate-800">Status Ketersediaan Layanan</span>
            <p className="text-[11px] text-slate-500">
              Jika dinonaktifkan, layanan tidak dapat dipesan pada pesanan baru.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
          </label>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
          >
            {mode === 'CREATE' ? 'Simpan Layanan' : 'Perbarui Layanan'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export const PartnerServiceModal: React.FC<PartnerServiceModalProps> = (props) => {
  if (!props.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <PartnerServiceModalContent
        key={props.serviceToEdit ? props.serviceToEdit.id : 'create_new_service'}
        {...props}
      />
    </div>
  );
};
