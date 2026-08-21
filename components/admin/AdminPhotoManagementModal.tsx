'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Laundry, LaundryPhoto } from '@/types/laundry';
import { laundryPhotoService, MAX_LAUNDRY_PHOTOS } from '@/services/laundryPhotoService';
import { Star, Upload, Trash2, ShieldCheck, Check, AlertCircle, ArrowUp, ArrowDown, Image as ImageIcon } from 'lucide-react';

interface AdminPhotoManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  laundry: Laundry | null;
  onPhotoUpdated: () => void;
}

export const AdminPhotoManagementModal: React.FC<AdminPhotoManagementModalProps> = ({
  isOpen,
  onClose,
  laundry,
  onPhotoUpdated,
}) => {
  const [photos, setPhotos] = useState<LaundryPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    if (!laundry) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { photos: fetched } = await laundryPhotoService.getPhotosByLaundryAsync(laundry.id);
      setPhotos(fetched);
    } catch (err: any) {
      console.error('[ADMIN-PHOTO-MODAL] Fetch error:', err);
      setErrorMsg('Gagal memuat foto mitra laundry.');
    } finally {
      setIsLoading(false);
    }
  }, [laundry]);

  useEffect(() => {
    if (isOpen && laundry) {
      fetchPhotos();
    }
  }, [isOpen, laundry, fetchPhotos]);

  if (!laundry) return null;

  const photoCount = photos.length;
  const isFull = photoCount >= MAX_LAUNDRY_PHOTOS;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !laundry) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await laundryPhotoService.uploadLaundryPhotoAsync(laundry.id, file);
      setSuccessMsg('Foto profil mitra berhasil diunggah ke Supabase Storage!');
      await fetchPhotos();
      onPhotoUpdated();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengunggah foto.');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleSetPrimary = async (photoId: string) => {
    if (!laundry) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await laundryPhotoService.setPrimaryPhotoAsync(laundry.id, photoId);
      setSuccessMsg('Foto utama mitra berhasil diperbarui!');
      await fetchPhotos();
      onPhotoUpdated();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menetapkan foto utama.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!laundry) return;
    if (!confirm('Apakah Anda yakin ingin menghapus foto ini?')) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await laundryPhotoService.deleteLaundryPhotoAsync(photoId, laundry.id);
      setSuccessMsg('Foto mitra berhasil dihapus.');
      await fetchPhotos();
      onPhotoUpdated();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus foto.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMovePhoto = async (index: number, direction: 'up' | 'down') => {
    if (!laundry) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= photos.length) return;

    const newOrder = [...photos];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const ids = newOrder.map((p) => p.id);
      await laundryPhotoService.reorderLaundryPhotosAsync(laundry.id, ids);
      await fetchPhotos();
      onPhotoUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal merubah urutan foto.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Map slots 0..4
  const slots = [0, 1, 2, 3, 4];
  const photoBySlotMap: Record<number, LaundryPhoto> = {};
  photos.forEach((p, idx) => {
    const slotKey = p.photo_slot !== undefined && p.photo_slot >= 0 && p.photo_slot < 5 ? p.photo_slot : idx;
    photoBySlotMap[slotKey] = p;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Kelola Foto Profil (5 Foto): ${laundry.name}`}>
      <div className="space-y-5 text-xs max-h-[80vh] overflow-y-auto pr-1">
        {/* Header Admin Exclusive Banner & Progress Badge */}
        <div className="p-3.5 bg-purple-900 text-purple-100 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-purple-700 shadow-xs">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-purple-300 shrink-0" />
            <div>
              <p className="font-bold text-white">Kelola Profil 5 Foto Mitra</p>
              <p className="text-[11px] text-purple-200">
                Kontrol eksklusif Platform Admin. Foto slot 0 / utama akan tampil di kartu marketplace.
              </p>
            </div>
          </div>

          <div
            className={`px-3 py-1.5 rounded-full text-xs font-black shrink-0 flex items-center gap-1 border ${
              isFull
                ? 'bg-emerald-500 text-white border-emerald-300'
                : 'bg-amber-400 text-amber-950 border-amber-300'
            }`}
          >
            <span>{photoCount} / 5 Foto</span>
            <span>{isFull ? '• Lengkap' : '• Belum Lengkap'}</span>
          </div>
        </div>

        {/* Success & Error Banners */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 5 PHOTO SLOTS GRID */}
        <div className="space-y-3">
          <label className="font-bold text-slate-800 uppercase tracking-wider block">
            Daftar Slot Foto Storefront Mitra (Maksimal 5 Foto):
          </label>

          {isLoading ? (
            <div className="p-8 text-center text-slate-400 font-medium">Memuat foto profil mitra...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {slots.map((slotNum) => {
                const photo = photoBySlotMap[slotNum] || photos[slotNum];
                const isOccupied = Boolean(photo);

                return (
                  <div
                    key={slotNum}
                    className={`relative rounded-2xl border-2 p-2.5 transition-all bg-white flex flex-col justify-between ${
                      isOccupied
                        ? photo.is_primary
                          ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
                          : 'border-slate-200'
                        : 'border-dashed border-slate-300 bg-slate-50'
                    }`}
                  >
                    {/* Slot Header Label */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="font-bold text-[11px] text-slate-600">
                        Slot {slotNum + 1} {slotNum === 0 && '(Foto Utama)'}
                      </span>
                      {isOccupied && photo.is_primary && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                          <Star className="w-3 h-3 fill-teal-600 text-teal-600" /> Utama
                        </span>
                      )}
                    </div>

                    {/* Slot Image Preview or Empty State */}
                    {isOccupied ? (
                      <div className="space-y-2 py-2">
                        <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                          <img
                            src={photo.public_url}
                            alt={`Mitra Slot ${slotNum + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between gap-1.5 pt-1">
                          <div className="flex items-center gap-1">
                            {!photo.is_primary && (
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleSetPrimary(photo.id)}
                                className="px-2 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg text-[10px] font-bold border border-teal-200 transition-colors cursor-pointer"
                                title="Jadikan foto utama"
                              >
                                ★ Utama
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Reorder Buttons */}
                            {slotNum > 0 && (
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleMovePhoto(slotNum, 'up')}
                                className="p-1 text-slate-500 hover:bg-slate-100 rounded-md cursor-pointer"
                                title="Geser Naik"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {slotNum < photos.length - 1 && (
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleMovePhoto(slotNum, 'down')}
                                className="p-1 text-slate-500 hover:bg-slate-100 rounded-md cursor-pointer"
                                title="Geser Turun"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete Button */}
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleDeletePhoto(photo.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Foto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Empty Upload Slot */
                      <div className="py-6 text-center space-y-2">
                        <ImageIcon className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-[11px] font-medium text-slate-500">Slot Foto Kosong</p>
                        <label
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isProcessing || isFull
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-purple-600 text-white hover:bg-purple-500 shadow-xs cursor-pointer'
                          }`}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>+ Upload Foto</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={isProcessing || isFull}
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info & Close */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            Format: JPG, PNG, WebP (Max 5MB). Otomatis tersimpan di Storage bucket <code>laundry-photos</code>.
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
};
