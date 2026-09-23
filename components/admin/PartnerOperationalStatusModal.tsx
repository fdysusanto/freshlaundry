'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Laundry } from '@/types/laundry';
import { AlertTriangle, CheckCircle2, Store, X } from 'lucide-react';
import { authService } from '@/services/authService';

interface PartnerOperationalStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: Laundry | null;
  targetIsOpen: boolean;
  onSuccess: (newIsOpen: boolean) => void;
}

export const PartnerOperationalStatusModal: React.FC<PartnerOperationalStatusModalProps> = ({
  isOpen,
  onClose,
  partner,
  targetIsOpen,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !partner) return null;

  const isClosing = !targetIsOpen;

  const handleConfirm = async () => {
    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const authHeaders = await authService.getAuthHeadersAsync();

      const res = await fetch(`/api/admin/partners/${partner.id}/operational-status`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isOpen: targetIsOpen,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengubah status operasional toko.');
      }

      onSuccess(targetIsOpen);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan saat memperbarui status operasional.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={() => !isSubmitting && onClose()}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-slate-200 z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            {isClosing ? (
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isClosing ? 'Konfirmasi Tutup Toko' : 'Konfirmasi Buka Toko'}
              </h3>
              <p className="text-[11px] font-semibold text-slate-500">
                {partner.name} ({partner.code})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="space-y-3 text-xs">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <h4 className="font-bold text-slate-900 text-sm">
              {isClosing ? 'Tutup toko ini?' : 'Buka toko?'}
            </h4>
            <p className="text-slate-700 leading-relaxed">
              {isClosing
                ? 'Customer tidak dapat membuat pesanan baru selama toko dalam status tutup.'
                : 'Customer akan dapat membuat pesanan baru jika lifecycle partner dan layanan aktif memenuhi syarat.'}
            </p>
          </div>

          <div className="flex items-center gap-2 p-3 bg-blue-50/70 border border-blue-100 rounded-2xl text-[11px] text-blue-800">
            <Store className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              {isClosing
                ? 'Status lifecycle dan katalog layanan partner tetap dipertahankan.'
                : 'Membuka toko tidak mengubah status lifecycle ataupun verifikasi kepemilikan.'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs font-bold"
          >
            Batal
          </Button>
          <Button
            type="button"
            variant={isClosing ? 'danger' : 'primary'}
            size="sm"
            onClick={handleConfirm}
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className={`text-xs font-bold ${
              !isClosing ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : ''
            }`}
          >
            {isClosing ? 'Ya, Tutup Toko' : 'Ya, Buka Toko'}
          </Button>
        </div>
      </div>
    </div>
  );
};
