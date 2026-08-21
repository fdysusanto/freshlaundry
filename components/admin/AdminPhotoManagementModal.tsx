'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Laundry } from '@/types/laundry';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { Star, Upload, Trash2, Eye, ShieldCheck, Check, AlertCircle, Store } from 'lucide-react';

interface AdminPhotoManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  laundry: Laundry | null;
  onPhotoUpdated: () => void;
}

const DEFAULT_STOREFRONT_OPTIONS = [
  'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1521656693074-0ef32e80a5d5?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=800&q=80',
];

export const AdminPhotoManagementModal: React.FC<AdminPhotoManagementModalProps> = ({
  isOpen,
  onClose,
  laundry,
  onPhotoUpdated,
}) => {
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!laundry) return null;

  const currentPhoto = laundry.logoUrl || DEFAULT_STOREFRONT_OPTIONS[0];

  const handleUpdatePrimaryPhoto = async (newUrl: string) => {
    setIsUpdating(true);
    setSuccessMsg(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await (supabase.from('laundries') as any)
          .update({ logo_url: newUrl })
          .eq('id', laundry.id);

        if (error) throw error;
      }

      setSuccessMsg('Foto Utama Storefront mitra berhasil diperbarui oleh Admin Platform!');
      onPhotoUpdated();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Gagal memperbarui foto mitra: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCustomUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl.trim()) return;
    handleUpdatePrimaryPhoto(photoUrl.trim());
    setPhotoUrl('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Kelola Foto Storefront: ${laundry.name}`}>
      <div className="space-y-6 text-xs">
        
        {/* Platform Admin Role Banner */}
        <div className="p-3 bg-purple-900 text-purple-100 rounded-2xl flex items-center gap-2 border border-purple-700">
          <ShieldCheck className="w-5 h-5 text-purple-300 shrink-0" />
          <div>
            <p className="font-bold text-white">Kontrol Eksklusif Platform Admin</p>
            <p className="text-[11px] text-purple-200">
              Foto utama storefront ini adalah gambar publik yang tampil pada marketplace calon customer.
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Current Primary Photo Preview */}
        <div className="space-y-2">
          <label className="font-bold text-slate-700 uppercase tracking-wider block">
            ★ Foto Utama Saat Ini (Tampil di Marketplace Card):
          </label>

          <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-slate-100 border-2 border-teal-500 shadow-md">
            <img
              src={currentPhoto}
              alt={`Storefront ${laundry.name}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-md text-amber-300 text-[11px] font-black px-3 py-1 rounded-full border border-amber-400/40 flex items-center gap-1 shadow-sm">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>★ Foto Utama Verified</span>
            </div>
          </div>
        </div>

        {/* Option A: Input Custom Image URL */}
        <form onSubmit={handleCustomUrlSubmit} className="space-y-2 pt-2 border-t border-slate-100">
          <label className="font-bold text-slate-700 block">Input URL Foto Baru (Supabase Storage / Unsplash):</label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://example.com/storefront.jpg"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="flex-1 p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isUpdating || !photoUrl.trim()}
              leftIcon={<Upload className="w-4 h-4" />}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold"
            >
              Update Foto
            </Button>
          </div>
        </form>

        {/* Option B: Select Preset Verified Storefront Photos */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="font-bold text-slate-700 block">Atau Pilih Dari Katalog Foto Storefront Terverifikasi:</label>
          <div className="grid grid-cols-3 gap-3">
            {DEFAULT_STOREFRONT_OPTIONS.map((url, idx) => (
              <div
                key={idx}
                className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 cursor-pointer transition-all group ${
                  currentPhoto === url ? 'border-teal-500 ring-2 ring-teal-500/30' : 'border-slate-200 hover:border-purple-400'
                }`}
                onClick={() => handleUpdatePrimaryPhoto(url)}
              >
                <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                {currentPhoto === url && (
                  <div className="absolute inset-0 bg-teal-900/40 flex items-center justify-center">
                    <span className="bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Utama
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Tutup Modal
          </Button>
        </div>
      </div>
    </Modal>
  );
};
