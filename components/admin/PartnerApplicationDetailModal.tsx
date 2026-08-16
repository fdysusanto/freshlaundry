import React, { useState } from 'react';
import Link from 'next/link';
import { PartnerApplicationRecord } from '@/services/partnerApplicationService';
import { formatDateIndo } from '@/utils/formatters';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Store,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  CreditCard,
  Tag,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface PartnerApplicationDetailModalProps {
  application: PartnerApplicationRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (appId: string) => Promise<void>;
  onReject: (appId: string, reason: string) => Promise<void>;
}

export const PartnerApplicationDetailModal: React.FC<PartnerApplicationDetailModalProps> = ({
  application,
  isOpen,
  onClose,
  onApprove,
  onReject,
}) => {
  const [showFullAccount, setShowFullAccount] = useState(false);
  const [isConfirmingApprove, setIsConfirmingApprove] = useState(false);
  const [isRejectingModal, setIsRejectingModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState('');

  if (!application) return null;

  const maskAccountNumber = (num: string) => {
    if (!num || num.length <= 4) return '****';
    return `********${num.slice(-4)}`;
  };

  const formattedWaPhone = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }
    return cleaned;
  };

  const handleExecuteApprove = async () => {
    setIsProcessing(true);
    setActionError('');
    try {
      await onApprove(application.id);
      setIsConfirmingApprove(false);
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Gagal menyetujui pengajuan mitra.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteReject = async () => {
    const trimmed = rejectReason.trim();
    if (!trimmed || trimmed.length < 5) {
      setActionError('Alasan penolakan wajib diisi (minimal 5 karakter).');
      return;
    }

    setIsProcessing(true);
    setActionError('');
    try {
      await onReject(application.id, trimmed);
      setIsRejectingModal(false);
      setRejectReason('');
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Gagal menolak pengajuan mitra.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detail Pengajuan Mitra Laundry" maxWidth="lg">
      <div className="space-y-5">
        {/* Error Alert inside modal */}
        {actionError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Header Status Summary */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Pengajuan</span>
            <div className="flex items-center gap-2">
              {application.status === 'pending' && (
                <Badge variant="amber" className="font-bold text-xs px-2.5 py-1">
                  PENDING VERIFICATION
                </Badge>
              )}
              {application.status === 'approved' && (
                <Badge variant="emerald" className="font-bold text-xs px-2.5 py-1">
                  DISETUJUI (APPROVED)
                </Badge>
              )}
              {application.status === 'rejected' && (
                <Badge variant="rose" className="font-bold text-xs px-2.5 py-1">
                  DITOLAK (REJECTED)
                </Badge>
              )}
              <span className="text-xs font-semibold text-slate-500">
                Diajukan pada {formatDateIndo(application.created_at)}
              </span>
            </div>
          </div>
          {application.status === 'approved' && (
            <Link href="/owner">
              <Button variant="outline" size="sm" className="font-bold text-xs">
                Lihat di Owner Dashboard
              </Button>
            </Link>
          )}
        </div>

        {/* Rejection Reason Alert if rejected */}
        {application.status === 'rejected' && application.rejection_reason && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
            <span className="font-bold flex items-center gap-1 text-rose-700">
              <XCircle className="w-4 h-4 text-rose-600" /> Alasan Penolakan Sebelumnya:
            </span>
            <p className="pl-5 text-slate-800 italic">{application.rejection_reason}</p>
          </div>
        )}

        {/* Section 1: Data Pemilik Usaha */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <User className="w-3.5 h-3.5 text-teal-600" /> Data Pemilik Usaha
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div>
              <span className="text-slate-500 block">Nama Lengkap:</span>
              <strong className="text-slate-800 font-bold">{application.owner_full_name}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Nomor WhatsApp:</span>
              <div className="flex items-center gap-1.5 pt-0.5">
                <strong className="text-slate-800 font-semibold">{application.owner_phone}</strong>
                <a
                  href={`https://wa.me/${formattedWaPhone(application.owner_phone)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-0.5 text-[11px] underline"
                >
                  <Phone className="w-3 h-3" /> Chat WA <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Data Outlet Laundry */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <Store className="w-3.5 h-3.5 text-teal-600" /> Data Outlet Laundry
          </h3>
          <div className="space-y-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
              <span className="text-slate-500">Nama Toko:</span>
              <strong className="text-slate-900 font-bold">{application.laundry_name}</strong>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
              <span className="text-slate-500">Alamat Outlet:</span>
              <span className="text-slate-800 font-medium text-right max-w-xs">
                {application.laundry_address}, {application.district}, {application.city}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
              <span className="text-slate-500">Jam Operasional:</span>
              <span className="text-slate-800 font-semibold">
                {application.opening_time || '08:00'} - {application.closing_time || '20:00'} WIB
              </span>
            </div>
            {(application.latitude || application.longitude) && (
              <div className="flex justify-between">
                <span className="text-slate-500">Koordinat Outlet:</span>
                <span className="text-slate-700 font-mono text-[11px]">
                  {application.latitude}, {application.longitude}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Katalog Layanan */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <Tag className="w-3.5 h-3.5 text-teal-600" /> Katalog Draf Layanan ({application.services?.length || 0})
          </h3>
          {application.services && application.services.length > 0 ? (
            <div className="bg-slate-50 rounded-xl border border-slate-200/80 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Nama Layanan</th>
                    <th className="py-2 px-3">Kode</th>
                    <th className="py-2 px-3 text-right">Harga per Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60">
                  {application.services.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2 px-3 font-semibold text-slate-800">{s.name}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{s.code}</td>
                      <td className="py-2 px-3 text-right font-bold text-teal-800">
                        Rp {s.price_per_unit.toLocaleString('id-ID')} / {s.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Tidak ada draf layanan tercatat.</p>
          )}
        </div>

        {/* Section 4: Rekening Payout (Masked UI with Toggle) */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <CreditCard className="w-3.5 h-3.5 text-teal-600" /> Rekening Pencairan Dana (Payout)
          </h3>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Bank:</span>
              <strong className="text-slate-800">{application.payout_bank}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Atas Nama:</span>
              <strong className="text-slate-800">{application.payout_account_holder}</strong>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
              <span className="text-slate-500">Nomor Rekening:</span>
              <div className="flex items-center gap-2">
                <strong className="text-slate-900 font-mono text-xs">
                  {showFullAccount
                    ? application.payout_account_number
                    : maskAccountNumber(application.payout_account_number)}
                </strong>
                <button
                  type="button"
                  onClick={() => setShowFullAccount(!showFullAccount)}
                  className="text-slate-400 hover:text-teal-700 p-1 rounded-md hover:bg-white cursor-pointer"
                  title={showFullAccount ? 'Sembunyikan Rekening' : 'Tampilkan Rekening'}
                >
                  {showFullAccount ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Controls for PENDING status */}
        {application.status === 'pending' && (
          <div className="pt-4 border-t border-slate-200 space-y-3">
            {isConfirmingApprove ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                <p className="font-bold text-emerald-900">Konfirmasi Approval Mitra Laundry</p>
                <p className="text-emerald-800 text-[11px] leading-relaxed">
                  Apakah Anda yakin ingin menyetujui pengajuan ini? Setelah disetujui, akun pemilik akan menjadi <strong>Laundry Owner</strong>, toko akan diprovisioning di database, dan katalog layanan resmi akan diaktifkan secara atomik.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isProcessing}
                    onClick={handleExecuteApprove}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    {isProcessing ? 'Memproses Approval...' : 'Ya, Setujui Sekarang'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => setIsConfirmingApprove(false)}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            ) : isRejectingModal ? (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-2">
                <p className="font-bold text-rose-900">Alasan Penolakan Pengajuan Mitra</p>
                <textarea
                  rows={3}
                  required
                  placeholder="Masukkan alasan penolakan (minimal 5 karakter), misal: Alamat outlet kurang jelas atau dokumen usaha belum lengkap..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-rose-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isProcessing}
                    onClick={handleExecuteReject}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                  >
                    {isProcessing ? 'Memproses Penolakan...' : 'Konfirmasi Tolak Pengajuan'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => {
                      setIsRejectingModal(false);
                      setRejectReason('');
                    }}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <Button variant="outline" size="md" onClick={onClose}>
                  Tutup
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setIsRejectingModal(true)}
                    className="border-rose-200 text-rose-700 hover:bg-rose-50 font-bold"
                    leftIcon={<XCircle className="w-4 h-4 text-rose-500" />}
                  >
                    Tolak Pengajuan
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setIsConfirmingApprove(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Setujui Mitra (Approve)
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
