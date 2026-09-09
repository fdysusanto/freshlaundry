'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Bell, CheckCircle2, MapPin, Sparkles } from 'lucide-react';

interface CuciyanNotifyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CuciyanNotifyModal: React.FC<CuciyanNotifyModalProps> = ({ isOpen, onClose }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 600);
  };

  const handleResetAndClose = () => {
    setIsSubmitted(false);
    setFullName('');
    setPhone('');
    setEmail('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleResetAndClose} title="🔔 Info Pembukaan CUCIYAN Cirebon">
      <div className="space-y-5 py-2">
        {isSubmitted ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-sm mx-auto">
              <h3 className="text-lg font-black text-slate-900">Terima Kasih, {fullName}!</h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Kami telah menyimpan kontak Anda. Anda akan menjadi yang pertama mendapatkan notifikasi &amp; voucher launching spesial saat CUCIYAN resmi beroperasi di Cirebon!
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={handleResetAndClose}
              className="bg-cyan-600 hover:bg-cyan-700 font-bold mx-auto text-xs"
            >
              Mengerti &amp; Tutup
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 rounded-2xl bg-cyan-50/80 border border-cyan-200/80 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-cyan-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-cyan-950">CUCIYAN Segera Hadir di Cirebon</p>
                <p className="text-[11px] text-cyan-800 font-medium mt-0.5">
                  Dapatkan notifikasi langsung di WhatsApp saat layanan pickup &amp; delivery mulai beroperasi.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="mis. Budi Santoso"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor WhatsApp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="mis. 081234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <input
                  type="email"
                  placeholder="mis. budi@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 font-bold text-xs shadow-md"
              >
                {isSubmitting ? 'Menyimpan...' : '🔔 Kirim Saya Info'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
