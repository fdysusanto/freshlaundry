'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PartnerLifecycleStatus, Laundry } from '@/types/laundry';
import { AlertTriangle, ShieldAlert, CheckCircle2, XCircle, X } from 'lucide-react';
import { authService } from '@/services/authService';

interface PartnerStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: Laundry | null;
  targetStatus: PartnerLifecycleStatus | null;
  onSuccess: () => void;
}

export const PartnerStatusModal: React.FC<PartnerStatusModalProps> = ({
  isOpen,
  onClose,
  partner,
  targetStatus,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !partner || !targetStatus) return null;

  const isSuspension = targetStatus === 'suspended';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isSuspension && reason.trim().length < 5) {
      setErrorMessage('Alasan penangguhan/suspend wajib diisi minimal 5 karakter.');
      return;
    }

    setIsSubmitting(true);

    try {
      const authHeaders = await authService.getAuthHeadersAsync();

      const res = await fetch(`/api/admin/partners/${partner.id}/status`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetStatus,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengubah status partner.');
      }

      onSuccess();
      onClose();
      setReason('');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            {isSuspension ? (
              <ShieldAlert className="w-6 h-6 text-red-600" />
            ) : targetStatus === 'active' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            ) : (
              <XCircle className="w-6 h-6 text-amber-600" />
            )}
            <h2 className="text-lg font-bold text-slate-900">
              Konfirmasi Perubahan Status Partner
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 bg-red-50 rounded-2xl border border-red-200 text-xs text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-3 text-xs">
          <p className="text-slate-600">
            Anda akan mengubah status partner <strong>{partner.name}</strong> dari{' '}
            <span className="font-bold uppercase text-slate-800">{partner.status}</span> menjadi{' '}
            <span className="font-bold uppercase text-brand-primary">{targetStatus}</span>.
          </p>

          {isSuspension && (
            <div className="p-3 bg-red-50 rounded-2xl border border-red-200 text-red-800 text-[11px] space-y-1">
              <p className="font-bold">⚠️ Perhatian Penghentian (Suspend):</p>
              <p>• Partner sementara tidak akan muncul di marketplace customer dan tidak dapat menerima pesanan baru.</p>
              <p>• Perubahan ini akan dicatat secara permanen pada log audit platform.</p>
            </div>
          )}

          {targetStatus === 'order_ready' && (
            <div className="p-3 bg-cyan-50 rounded-2xl border border-cyan-200 text-cyan-900 text-[11px] space-y-1">
              <p className="font-bold">📦 Kesiapan Katalog Layanan (Order Ready):</p>
              <p>
                Sistem akan memastikan toko memiliki minimal satu layanan aktif agar pelanggan dapat langsung melakukan pemesanan. Jika belum ada layanan aktif, sistem akan membuat layanan standar CUCIYAN.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">
                Alasan / Catatan Audit {isSuspension && <span className="text-red-500">*</span>}
              </label>
              <textarea
                rows={3}
                required={isSuspension}
                placeholder={
                  isSuspension
                    ? 'Contoh: Pelanggaran SLA operasional berulang kali...'
                    : 'Catatan alasan perubahan status...'
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-primary focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
                Batal
              </Button>
              <Button
                variant={isSuspension ? 'danger' : 'primary'}
                type="submit"
                isLoading={isSubmitting}
              >
                Konfirmasi {targetStatus.toUpperCase()}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
