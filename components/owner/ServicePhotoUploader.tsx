'use client';

import React, { useState, useRef, useEffect } from 'react';
import { resolveServicePhoto } from '@/utils/servicePhotoFallbacks';
import { Upload, Trash2, RefreshCw, AlertCircle, Check, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ServicePhotoUploaderProps {
  currentImageUrl?: string | null;
  serviceId?: string;
  laundryId?: string;
  category?: string | null;
  serviceCode?: string | null;
  serviceName?: string | null;
  onPhotoUploaded: (imageUrl: string | null, storagePath?: string | null) => void;
  disabled?: boolean;
}

export const ServicePhotoUploader: React.FC<ServicePhotoUploaderProps> = ({
  currentImageUrl,
  serviceId,
  laundryId,
  category,
  serviceCode,
  serviceName,
  onPhotoUploaded,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [isCustomPhoto, setIsCustomPhoto] = useState<boolean>(Boolean(currentImageUrl));
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setPreviewUrl(currentImageUrl || null);
    setIsCustomPhoto(Boolean(currentImageUrl));
  }, [currentImageUrl]);

  const displayPhoto = previewUrl || resolveServicePhoto({
    imageUrl: null,
    category,
    code: serviceCode,
    name: serviceName,
  });

  /**
   * Compress image client-side to max 1000px and convert to WebP / JPEG
   */
  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1000;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          'image/webp',
          0.85
        );
      };

      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate MIME
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type.toLowerCase())) {
      setErrorMsg('Format file tidak didukung. Harap pilih gambar JPG, PNG, atau WebP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate raw size
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Ukuran file melebihi batas 5 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setIsUploading(true);

      // Compress client-side
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], `photo_${Date.now()}.webp`, {
        type: 'image/webp',
      });

      // If we have existing serviceId and laundryId, upload immediately to server
      if (serviceId && laundryId) {
        const formData = new FormData();
        formData.append('file', compressedFile);
        formData.append('laundryId', laundryId);

        const res = await fetch(`/api/owner/services/${serviceId}/photo`, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Gagal mengunggah foto ke server.');
        }

        setPreviewUrl(data.data.imageUrl);
        setIsCustomPhoto(true);
        setSuccessMsg('Foto layanan berhasil diperbarui!');
        onPhotoUploaded(data.data.imageUrl, data.data.storagePath);
      } else {
        // If creating new service without serviceId yet, create local blob preview and pass placeholder
        const localBlobUrl = URL.createObjectURL(compressedBlob);
        setPreviewUrl(localBlobUrl);
        setIsCustomPhoto(true);
        setSuccessMsg('Foto dipilih. Akan disimpan bersama layanan baru.');
        onPhotoUploaded(localBlobUrl, `pending_upload_${Date.now()}`);
      }

      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat mengunggah foto.';
      setErrorMsg(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async () => {
    if (!confirm('Hapus foto kustom dan gunakan foto standar kategori?')) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      setIsUploading(true);

      if (serviceId && laundryId) {
        const res = await fetch(`/api/owner/services/${serviceId}/photo?laundryId=${laundryId}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Gagal menghapus foto.');
        }
      }

      setPreviewUrl(null);
      setIsCustomPhoto(false);
      setSuccessMsg('Foto kustom dihapus. Menggunakan foto standar.');
      onPhotoUploaded(null, null);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus foto.';
      setErrorMsg(msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 rounded-2xl border border-slate-200 bg-slate-50/60">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-brand-primary" />
            <span>Foto Layanan Marketplace</span>
          </label>
          <p className="text-[11px] text-slate-500 font-medium">
            Foto ini akan tampil pada katalog kartu layanan profil outlet di hadapan customer.
          </p>
        </div>

        <span
          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
            isCustomPhoto
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {isCustomPhoto ? '✓ Foto Kustom Mitra' : 'ℹ Foto Standar Kategori'}
        </span>
      </div>

      {/* Photo Preview & Controls */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        {/* Preview Frame */}
        <div className="relative w-36 h-28 sm:w-44 sm:h-32 rounded-2xl overflow-hidden bg-slate-200 border-2 border-slate-200 shadow-xs shrink-0 group">
          <img
            src={displayPhoto}
            alt={serviceName || 'Foto Layanan'}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=600&q=80';
            }}
          />
          {isUploading && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="space-y-3 flex-1 text-center sm:text-left w-full">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={disabled || isUploading}
          />

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              leftIcon={<Upload className="w-3.5 h-3.5 text-brand-primary" />}
              className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-xs cursor-pointer"
            >
              {isCustomPhoto ? 'Ganti Foto' : 'Unggah Foto Baru'}
            </Button>

            {isCustomPhoto && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeletePhoto}
                disabled={disabled || isUploading}
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                className="bg-white hover:bg-rose-50 text-rose-600 border-rose-200 text-xs font-bold cursor-pointer"
              >
                Hapus &amp; Reset
              </Button>
            )}
          </div>

          <p className="text-[10px] text-slate-400">
            Format: JPG, PNG, atau WebP (Otomatis dikompresi). Disarankan foto jernih rasio 4:3 atau 1:1.
          </p>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
