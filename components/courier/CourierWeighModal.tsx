'use client';

import React, { useState } from 'react';
import { Order } from '@/types/order';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Scale, AlertCircle, CheckCircle2, X, Calculator, ShieldCheck } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface CourierWeighModalProps {
  order: Order;
  onClose: () => void;
  onSuccess: () => void;
}

export const CourierWeighModal: React.FC<CourierWeighModalProps> = ({
  order,
  onClose,
  onSuccess,
}) => {
  const estimatedWeight = order.estimatedWeightKg || 5;
  const unitPrice = order.items[0]?.unitPrice || 8000;
  const unitName = order.items[0]?.unit || 'kg';

  const [actualWeight, setActualWeight] = useState<string>(
    order.finalWeightKg ? String(order.finalWeightKg) : String(estimatedWeight)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const numericWeight = parseFloat(actualWeight);
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
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(
          priceDelta > 0
            ? `Penimbangan berhasil! Selisih harga +Rp ${priceDelta.toLocaleString('id-ID')} telah dibuatkan link pembayaran adjustment.`
            : `Penimbangan berhasil! Berat aktual ${numericWeight} kg disimpan.`
        );
        setTimeout(() => {
          onSuccess();
        }, 1200);
      } else {
        setErrorMsg(data.message || 'Gagal menyimpan penimbangan berat aktual.');
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
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Input Timbangan Digital</h3>
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
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="font-medium text-slate-500">Layanan:</span>
              <span className="font-bold text-slate-800">{order.serviceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-slate-500">Tarif per {unitName}:</span>
              <span className="font-bold text-slate-800">Rp {unitPrice.toLocaleString('id-ID')} / {unitName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-slate-500">Estimasi Awal Customer:</span>
              <Badge variant="gray" className="font-bold">{estimatedWeight} {unitName}</Badge>
            </div>
          </div>

          {/* Weight Input Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Berat Hasil Timbangan Digital ({unitName}):
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                value={actualWeight}
                onChange={(e) => setActualWeight(e.target.value)}
                placeholder="Contoh: 6.5"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-black text-lg text-slate-900 bg-white shadow-xs"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                {unitName}
              </span>
            </div>
          </div>

          {/* Pricing Recalculation Preview */}
          {isValidWeight && (
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                <Calculator className="w-4 h-4 text-amber-600" />
                <span>Kalkulasi Harga Otomatis Server:</span>
              </div>
              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal Timbangan ({numericWeight} {unitName}):</span>
                  <span className="font-semibold text-slate-800">Rp {newSubtotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-amber-200/60">
                  <span className="text-slate-800">Total Baru Order:</span>
                  <span className="text-amber-900">Rp {newTotal.toLocaleString('id-ID')}</span>
                </div>
                {priceDelta !== 0 && (
                  <div className={`text-xs font-bold flex items-center justify-between pt-1 ${priceDelta > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    <span>Selisih Harga Dari Estimasi:</span>
                    <span>{priceDelta > 0 ? `+Rp ${priceDelta.toLocaleString('id-ID')}` : `-Rp ${Math.abs(priceDelta).toLocaleString('id-ID')}`}</span>
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
              className="flex-1 py-2.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20"
            >
              {isSubmitting ? 'MENYIMPAN...' : 'KONFIRMASI BERAT'}
            </Button>
          </div>
        </form>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 font-medium pt-1 border-t border-slate-100">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Verifikasi Timbangan Digital Kurir Internal</span>
        </div>
      </Card>
    </div>
  );
};
