'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Laundry } from '@/types/laundry';
import { UserPlus, Mail, Copy, Check, X, AlertCircle } from 'lucide-react';
import { authService } from '@/services/authService';

interface InviteOwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: Laundry | null;
}

export const InviteOwnerModal: React.FC<InviteOwnerModalProps> = ({
  isOpen,
  onClose,
  partner,
}) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !partner) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !email.includes('@')) {
      setErrorMessage('Alamat email tidak valid.');
      return;
    }

    setIsSubmitting(true);

    try {
      const authHeaders = await authService.getAuthHeadersAsync();

      const res = await fetch(`/api/admin/partners/${partner.id}/invite-owner`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal membuat undangan.');
      }

      const fullLink = `${window.location.origin}${data.data.invite_link}`;
      setInviteLink(fullLink);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-brand-primary">
            <UserPlus className="w-6 h-6" />
            <h2 className="text-lg font-bold text-slate-900">Undang Pemilik Business (Partner Owner)</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 rounded-2xl border border-red-200 text-xs text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {inviteLink ? (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-emerald-900">
              <p className="font-bold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Tautan Undangan Pemilik Berhasil Dibuat
              </p>
              <p className="text-[11px] text-emerald-700">
                Kirim tautan ini kepada calon pemilik bisnis laundry untuk melakukan klaim dan pendaftaran akun.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Link Klaim Bisnis:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="w-full px-3 py-2 bg-slate-100 rounded-xl border border-slate-300 font-mono text-[11px] text-slate-700 select-all"
                />
                <Button variant="outline" size="sm" onClick={handleCopy} leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}>
                  {copied ? 'Tersalin' : 'Salin'}
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button variant="primary" onClick={onClose}>
                Selesai
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <p className="text-slate-600">
              Undang calon pemilik bisnis untuk mengklaim partner <strong>{partner.name}</strong>.
            </p>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Email Calon Pemilik Laundry *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="pemilik@laundry.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-[11px] text-amber-900">
              <p className="font-bold">⚠️ Catatan Platform Ops:</p>
              <p>• Mengirimkan undangan TIDAK otomatis mengubah status partner menjadi ACTIVE.</p>
              <p>• Status partner akan berubah menjadi <strong>CLAIMED → ONBOARDING</strong> saat akun pemilik terhubung.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
                Batal
              </Button>
              <Button variant="primary" type="submit" isLoading={isSubmitting}>
                Buat Link Undangan
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
