'use client';

import React, { useState } from 'react';
import { Order } from '@/types/order';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Scale, AlertCircle, CheckCircle2, X, Calculator, ShieldCheck, Check } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface WeightVerificationModalProps {
  order: Order;
  onClose: () => void;
  onSuccess: () => void;
}

export const WeightVerificationModal: React.FC<WeightVerificationModalProps> = ({
  order,
  onClose,
  onSuccess,
}) => {
  const estimatedWeight = order.estimatedWeightKg || 5;
  const courierWeight = order.courierWeightKg;
  const unitPrice = order.items[0]?.unitPrice || 8000;
  const unitName = order.items[0]?.unit || 'kg';

  // Default to courier weight if available, otherwise estimated weight
  const defaultWeight = courierWeight ? String(courierWeight) : String(estimatedWeight);
  const [finalWeight, setFinalWeight] = useState<string>(
    order.finalWeightKg ? String(order.finalWeightKg) : defaultWeight
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const numericWeight = parseFloat(finalWeight);
  const isValidWeight = !isNaN(numericWeight) && numericWeight > 0 && numericWeight <= 50;

  // Calculated Preview
  const deliveryFee = Number(order.deliveryFee || 0);
  const platformFee = Number(order.platformFee || 2000);
  const discount = Number(order.discount || 0);

  const estimatedTotal = Math.round(estimatedWeight * unitPrice + deliveryFee + platformFee - discount);
  const newSubtotal = isValidWeight ? Math.round(numericWeight * unitPrice) : 0;
  const newTotal = isValidWeight ? Math.round(newSubtotal + deliveryFee + platformFee - discount) : 0;
  const priceDelta = newTotal - estimatedTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidWeight) {
      setErrorMsg(numericWeight > 50 ? 'Berat aktual maksimal adalah 50 kg per pesanan.' : 'Masukkan berat yang valid (> 0 kg).');
      return;
    }

    if (order.status !== 'picked_up') {
      setErrorMsg('Penimbangan Ditolak: Berat final laundry hanya dapat diverifikasi setelah pesanan dijemput kurir.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let token = '';
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token || '';
      }

      const res = await fetch(`/api/orders/${order.id}/weigh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          finalWeightKg: numericWeight,
          action: 'finalize',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(
          priceDelta > 0
            ? `Berat final ${numericWeight} kg disetujui! Selisih harga +Rp ${priceDelta.toLocaleString('id-ID')} telah ditagihkan ke customer.`
            : `Berat final ${numericWeight} kg berhasil difinalisasi!`
        );
        setTimeout(() => {
          onSuccess();
        }, 1200);
      } else {
        setErrorMsg(data.message || 'Gagal memfinalisasi berat laundry.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <Card variant="white" className="w-full max-w-md p-5 space-y-4 relative shadow-2xl rounded-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Verifikasi & Finalisasi Berat Laundry</h3>
              <p className="text-xs text-slate-500 font-mono">#{order.trackingNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer & Service Info */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2 text-xs text-slate-600">
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-500">Layanan & Customer:</span>
              <span className="font-bold text-slate-800">{order.customerName} ({order.serviceName})</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-500">Estimasi Awal Customer:</span>
              <Badge variant="gray" className="font-bold">{estimatedWeight} {unitName}</Badge>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
              <span className="font-medium text-slate-500">Timbangan Preliminary Kurir:</span>
              {courierWeight ? (
                <Badge variant="blue" className="font-bold bg-blue-100 text-blue-800">
                  {courierWeight} {unitName}
                </Badge>
              ) : (
                <span className="text-slate-400 italic">Belum diisi kurir</span>
              )}
            </div>
          </div>

          {/* Preset Buttons if Courier Weight Available */}
          {courierWeight && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFinalWeight(String(courierWeight))}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                  numericWeight === courierWeight
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {numericWeight === courierWeight && <Check className="w-3.5 h-3.5" />}
                Gunakan Berat Kurir ({courierWeight} kg)
              </button>
            </div>
          )}

          {/* Weight Input Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Berat Final Hasil Verifikasi Outlet ({unitName}):
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                value={finalWeight}
                onChange={(e) => setFinalWeight(e.target.value)}
                placeholder="Contoh: 6.5"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-black text-lg text-slate-900 bg-white shadow-xs"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                {unitName}
              </span>
            </div>
          </div>

          {/* Pricing Recalculation Preview */}
          {isValidWeight && (
            <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200/80 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-indigo-900 font-bold">
                <Calculator className="w-4 h-4 text-indigo-600" />
                <span>Kalkulasi Tagihan Finansial Final:</span>
              </div>
              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal ({numericWeight} {unitName}):</span>
                  <span className="font-semibold text-slate-800">Rp {newSubtotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-indigo-200/60">
                  <span className="text-slate-800">Total Harga Final Order:</span>
                  <span className="text-indigo-950">Rp {newTotal.toLocaleString('id-ID')}</span>
                </div>
                {priceDelta !== 0 && (
                  <div className={`text-xs font-bold flex items-center justify-between pt-1 ${priceDelta > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    <span>Tagihan Selisih Pembayaran Customer:</span>
                    <span>{priceDelta > 0 ? `+Rp ${priceDelta.toLocaleString('id-ID')} (Membuat Link Bayar)` : `-Rp ${Math.abs(priceDelta).toLocaleString('id-ID')}`}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error / Success Feedback */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 text-xs font-bold"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !isValidWeight}
              className="flex-1 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20"
            >
              {isSubmitting ? 'FINALISASI...' : 'FINALISASI BERAT LAUNDRY'}
            </Button>
          </div>
        </form>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 font-medium pt-1 border-t border-slate-100">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Verifikasi Otoritas Pihak Laundry & Tagihan Otomatis</span>
        </div>
      </Card>
    </div>
  );
};
