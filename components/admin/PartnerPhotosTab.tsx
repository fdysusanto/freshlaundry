'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Laundry, LaundryPhoto } from '@/types/laundry';
import { laundryPhotoService, MAX_LAUNDRY_PHOTOS } from '@/services/laundryPhotoService';
import { supabase } from '@/services/supabase';
import { Button } from '@/components/ui/Button';
import {
  Star,
  Upload,
  Trash2,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  Camera,
} from 'lucide-react';

interface PartnerPhotosTabProps {
  partner: Laundry;
  onPhotoUpdated?: () => void;
}

export const PartnerPhotosTab: React.FC<PartnerPhotosTabProps> = ({
  partner,
  onPhotoUpdated,
}) => {
  const [photos, setPhotos] = useState<LaundryPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [photoActionId, setPhotoActionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { photos: fetched } = await laundryPhotoService.getPhotosByLaundryAsync(partner.id);
      setPhotos(fetched);
    } catch (err: any) {
      console.error('[PARTNER-PHOTOS-TAB] Fetch error:', err);
      setErrorMsg('Gagal memuat galeri foto storefront outlet.');
    } finally {
      setIsLoading(false);
    }
  }, [partner.id]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const photoCount = photos.length;
  const isFull = photoCount >= MAX_LAUNDRY_PHOTOS;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (photoCount >= MAX_LAUNDRY_PHOTOS) {
      setErrorMsg(`Maksimum ${MAX_LAUNDRY_PHOTOS} foto telah tercapai. Hapus salah satu foto terlebih dahulu untuk mengunggah yang baru.`);
      e.target.value = '';
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const sessionRes = await (supabase?.auth?.getSession() || Promise.resolve({ data: { session: null } }));
      const token = sessionRes?.data?.session?.access_token;

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/owner/laundries/${partner.id}/photos`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || result.error || 'Gagal mengunggah foto.');
      }

      setSuccessMsg('Foto storefront berhasil diunggah ke katalog.');
      await fetchPhotos();
      onPhotoUpdated?.();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengunggah foto.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSetPrimary = async (photoId: string) => {
    setIsProcessing(true);
    setPhotoActionId(photoId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const sessionRes = await (supabase?.auth?.getSession() || Promise.resolve({ data: { session: null } }));
      const token = sessionRes?.data?.session?.access_token;

      const res = await fetch(`/api/owner/laundries/${partner.id}/photos/${photoId}/primary`, {
        method: 'PATCH',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || result.error || 'Gagal menetapkan foto utama.');
      }

      setSuccessMsg('Foto utama storefront berhasil diperbarui!');
      await fetchPhotos();
      onPhotoUpdated?.();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menetapkan foto utama.');
    } finally {
      setIsProcessing(false);
      setPhotoActionId(null);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus foto storefront ini?')) return;

    setIsProcessing(true);
    setPhotoActionId(photoId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const sessionRes = await (supabase?.auth?.getSession() || Promise.resolve({ data: { session: null } }));
      const token = sessionRes?.data?.session?.access_token;

      const res = await fetch(`/api/owner/laundries/${partner.id}/photos/${photoId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || result.error || 'Gagal menghapus foto.');
      }

      setSuccessMsg('Foto storefront berhasil dihapus.');
      await fetchPhotos();
      onPhotoUpdated?.();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus foto.');
    } finally {
      setIsProcessing(false);
      setPhotoActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Kapasitas Kuota */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-purple-600" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Foto Profil &amp; Storefront Outlet
              </h2>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Kelola hingga 5 foto resmi outlet laundry ini. Foto yang ditandai sebagai{' '}
              <strong className="text-slate-800">Foto Utama</strong> akan tampil sebagai cover pada
              hasil pencarian marketplace dan kartu mitra pelanggan.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div
              className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 flex items-center gap-1.5 border ${
                isFull
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-purple-50 text-purple-700 border-purple-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isFull ? 'bg-emerald-500' : 'bg-purple-500'}`} />
              <span>{photoCount} / {MAX_LAUNDRY_PHOTOS} Foto</span>
              <span className="text-[10px] font-semibold text-slate-500">
                {isFull ? '(Kapasitas Penuh)' : ''}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchPhotos}
              disabled={isLoading || isProcessing}
              className="text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Feedback Banners */}
        {successMsg && (
          <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 text-rose-800 rounded-2xl border border-rose-200 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Content Area */}
      {isLoading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-600" />
          <p className="text-xs font-semibold">Memuat foto storefront outlet...</p>
        </div>
      ) : photos.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto border border-purple-100">
            <ImageIcon className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">Belum Ada Foto Storefront</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Outlet ini belum memiliki foto storefront. Unggah foto tampak depan toko atau area mesin
              laundry untuk ditampilkan kepada pelanggan di marketplace FreshLaundry.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            leftIcon={<Upload className="w-4 h-4" />}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-xs border-none"
          >
            Unggah Foto Pertama
          </Button>
        </div>
      ) : (
        /* Photo Grid */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {photos.map((photo, index) => {
              const isPrimary = Boolean(photo.is_primary);
              const isActionTarget = photoActionId === photo.id;

              return (
                <div
                  key={photo.id}
                  className={`bg-white rounded-3xl border overflow-hidden flex flex-col transition-all shadow-xs ${
                    isPrimary
                      ? 'border-amber-400 ring-2 ring-amber-400/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Photo Preview Container */}
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                    <img
                      src={photo.public_url}
                      alt={`Storefront ${partner.name} - ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

                    {/* Primary Badge */}
                    {isPrimary ? (
                      <div className="absolute top-2.5 left-2.5 bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                        <Star className="w-3 h-3 fill-slate-950" />
                        <span>FOTO UTAMA</span>
                      </div>
                    ) : (
                      <div className="absolute top-2.5 left-2.5 bg-slate-900/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs">
                        Foto {index + 1}
                      </div>
                    )}

                    {/* Action loading overlay */}
                    {isActionTarget && (
                      <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="p-3.5 flex flex-col justify-between gap-2.5 flex-1 bg-slate-50/50 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Slot #{index + 1}</span>
                      {isPrimary && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                          Tampil di Cover
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                      {!isPrimary ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetPrimary(photo.id)}
                          disabled={isProcessing}
                          className="flex-1 text-[11px] font-bold border-amber-300 text-amber-800 hover:bg-amber-50 py-1"
                          leftIcon={<Star className="w-3 h-3 text-amber-600" />}
                        >
                          Jadikan Utama
                        </Button>
                      ) : (
                        <span className="flex-1 text-center text-[11px] font-bold text-emerald-700 bg-emerald-50 py-1 rounded-lg border border-emerald-200">
                          ✓ Foto Utama
                        </span>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePhoto(photo.id)}
                        disabled={isProcessing}
                        className="p-1.5 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 shrink-0 cursor-pointer"
                        title="Hapus foto ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Upload Placeholder Slot (if < 5 photos) */}
            {!isFull && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="bg-slate-50/60 border-2 border-dashed border-slate-300 hover:border-purple-400 hover:bg-purple-50/40 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 text-center transition-all cursor-pointer min-h-[180px] group"
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 group-hover:border-purple-300 group-hover:scale-105 flex items-center justify-center text-slate-500 group-hover:text-purple-600 transition-all shadow-xs">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800 group-hover:text-purple-700 block">
                    + Tambah Foto
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Slot {photoCount + 1} dari {MAX_LAUNDRY_PHOTOS}
                  </span>
                </div>
              </button>
            )}
          </div>

          {/* Action Row & Guidelines */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Sparkles className="w-4 h-4 text-brand-primary shrink-0" />
              <span>
                Format yang didukung: <strong>JPG, PNG, WebP</strong>. Maksimal ukuran file <strong>5MB</strong>.
              </span>
            </div>

            {!isFull && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                leftIcon={<Upload className="w-4 h-4" />}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-xs border-none w-full sm:w-auto"
              >
                Unggah Foto Baru
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
