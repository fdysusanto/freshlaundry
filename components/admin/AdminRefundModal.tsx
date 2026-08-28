'use client';

import React, { useState } from 'react';
import { formatIDR } from '@/utils/formatters';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Building2,
  CreditCard,
  UserCheck,
  Receipt,
  FileText,
  Info,
} from 'lucide-react';

export interface PendingRefundItem {
  orderId: string;
  trackingNumber: string;
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
  pickupDate?: string;
  pickupTimeSlot?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  laundryName?: string;
  paymentAttemptId: string;
  paymentAmount: number;
  paymentProvider?: string;
}

interface AdminRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  refundItem: PendingRefundItem | null;
  onSuccess: () => void;
}

export function AdminRefundModal({
  isOpen,
  onClose,
  refundItem,
  onSuccess,
}: AdminRefundModalProps) {
  const [destinationBank, setDestinationBank] = useState('BCA');
  const [destinationAccount, setDestinationAccount] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!refundItem) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!destinationBank.trim()) {
      setErrorMessage('Bank tujuan wajib diisi.');
      return;
    }
    if (!destinationAccount.trim()) {
      setErrorMessage('Nomor rekening tujuan wajib diisi.');
      return;
    }
    if (!destinationName.trim()) {
      setErrorMessage('Nama pemilik rekening wajib diisi.');
      return;
    }
    if (!reference.trim()) {
      setErrorMessage('Nomor referensi bukti transfer wajib diisi.');
      return;
    }

    const confirmText = `Konfirmasi pengembalian dana?\n\nPastikan Anda telah menyelesaikan transfer manual sebesar ${formatIDR(
      refundItem.paymentAmount
    )} ke rekening ${destinationBank.toUpperCase()} ${destinationAccount} a.n ${destinationName}.\n\nSetelah dikonfirmasi, status pembayaran akan berubah menjadi 'Refunded'.`;

    if (!window.confirm(confirmText)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      }

      const sessionRes = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderId: refundItem.orderId,
          paymentAttemptId: refundItem.paymentAttemptId,
          destinationBank: destinationBank.trim(),
          destinationAccount: destinationAccount.trim(),
          destinationName: destinationName.trim(),
          reference: reference.trim(),
          notes: notes.trim(),
        }),
      });

      const data = await sessionRes.json();
      if (!sessionRes.ok || !data.success) {
        throw new Error(data.message || 'Gagal memproses konfirmasi refund.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[ADMIN-REFUND-MODAL] Error:', err);
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat konfirmasi refund.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Konfirmasi Pengembalian Dana Manual">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Operational Guidance Steps */}
        <div className="p-4 bg-purple-50/80 rounded-2xl border border-purple-200 text-xs space-y-2 text-purple-900">
          <div className="flex items-center gap-2 font-bold text-purple-950">
            <Info className="w-4 h-4 text-purple-600 shrink-0" />
            <span>Petunjuk Operasional Transfer Manual</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-purple-800 text-[11px] font-medium">
            <li>Transfer dana secara manual melalui rekening/platform platform FreshLaundry.</li>
            <li>Pastikan nominal dan rekening tujuan customer telah diverifikasi dengan tepat.</li>
            <li>Masukkan nomor referensi transfer bank sebagai bukti audit finansial.</li>
            <li>Tekan <strong>"Konfirmasi Refund"</strong> untuk memperbarui status pesanan menjadi Refunded.</li>
          </ol>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 flex items-center gap-3 text-xs text-rose-800 font-semibold">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Read-Only Order & Payment Context */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Informasi Pesanan
            </span>
            <div className="font-bold text-slate-900 text-sm">#{refundItem.trackingNumber}</div>
            <div className="text-xs text-slate-600 font-medium">Customer: {refundItem.customerName}</div>
            <div className="text-[11px] text-slate-500">Mitra: {refundItem.laundryName}</div>
          </div>

          <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-1.5">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block flex items-center justify-between">
              <span>Nominal Refund (Read Only)</span>
              <Lock className="w-3 h-3 text-amber-600" />
            </span>
            <div className="text-lg font-black text-amber-900">
              {formatIDR(refundItem.paymentAmount)}
            </div>
            <div className="text-[11px] text-amber-800 font-mono line-clamp-1">
              Attempt ID: {refundItem.paymentAttemptId.slice(0, 12)}...
            </div>
          </div>
        </div>

        {/* Form Inputs: Destination Account */}
        <div className="space-y-4 border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-purple-600" />
            <span>Informasi Rekening Tujuan Customer</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bank / E-Wallet</label>
              <select
                value={destinationBank}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDestinationBank(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              >
                <option value="BCA">BCA</option>
                <option value="Mandiri">Bank Mandiri</option>
                <option value="BRI">BRI</option>
                <option value="BNI">BNI</option>
                <option value="BSI">BSI</option>
                <option value="CIMB">CIMB Niaga</option>
                <option value="GoPay">GoPay</option>
                <option value="OVO">OVO</option>
                <option value="Dana">DANA</option>
                <option value="ShopeePay">ShopeePay</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Rekening / HP</label>
              <input
                type="text"
                placeholder="Contoh: 1234567890"
                value={destinationAccount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDestinationAccount(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pemilik Rekening</label>
              <input
                type="text"
                placeholder="Nama sesuai buku tabungan"
                value={destinationName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDestinationName(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Transfer Proof & Reference */}
        <div className="space-y-4 border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-purple-600" />
            <span>Bukti Audit &amp; Catatan Manual Transfer</span>
          </h4>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nomor Referensi Transfer <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: REF-BCA-20260828-99482"
                value={reference}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReference(e.target.value)}
                required
                className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Nomor transaksi unik dari m-Banking/internet banking setelah transfer selesai.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Admin (Opsional)</label>
              <textarea
                placeholder="Catatan tambahan untuk audit internal..."
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                rows={2}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:outline-hidden resize-none"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Konfirmasi Refund
          </Button>
        </div>
      </form>
    </Modal>
  );
}
