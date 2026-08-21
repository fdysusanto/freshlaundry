import { supabase, isSupabaseConfigured } from './supabase';
import { LaundryPhoto } from '@/types/laundry';
import { isValidUuid } from '@/utils/formatters';

export const LAUNDRY_PHOTOS_BUCKET = 'laundry-photos';
export const MAX_LAUNDRY_PHOTOS = 5;
export const MAX_PHOTO_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export const laundryPhotoService = {
  /**
   * Fetch all profile photos for a laundry partner ordered by photo_slot.
   * Resolves primary photo (is_primary = true or photo_slot = 0).
   */
  async getPhotosByLaundryAsync(laundryId: string): Promise<{ photos: LaundryPhoto[]; primaryPhoto?: LaundryPhoto }> {
    if (!laundryId || !isValidUuid(laundryId)) {
      return { photos: [] };
    }

    if (!isSupabaseConfigured || !supabase) {
      return { photos: [] };
    }

    try {
      const { data, error } = await (supabase.from('laundry_photos') as any)
        .select('*')
        .eq('laundry_id', laundryId)
        .order('photo_slot', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error || !data) {
        console.warn(`[LAUNDRY-PHOTO-SERVICE] Fetch photos warning for ${laundryId}:`, error?.message);
        return { photos: [] };
      }

      const photos: LaundryPhoto[] = data as LaundryPhoto[];
      const primaryPhoto = photos.find((p) => p.is_primary) || photos[0];

      return { photos, primaryPhoto };
    } catch (err) {
      console.warn(`[LAUNDRY-PHOTO-SERVICE] Error fetching photos for ${laundryId}:`, err);
      return { photos: [] };
    }
  },

  /**
   * Upload a new laundry profile photo (Platform Admin ONLY).
   * Validates max 5 photo limit, image format, and max 5MB size.
   * Cleans up storage object if database insert fails.
   */
  async uploadLaundryPhotoAsync(laundryId: string, file: File): Promise<LaundryPhoto> {
    if (!isValidUuid(laundryId)) {
      throw new Error('ID Mitra Laundry tidak valid.');
    }

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase client belum terkonfigurasi.');
    }

    // 1. Validate File Format & Size
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type.toLowerCase())) {
      throw new Error('Format file tidak didukung. Harap upload gambar berformat JPG, PNG, atau WebP.');
    }

    if (file.size > MAX_PHOTO_FILE_SIZE_BYTES) {
      throw new Error('Ukuran foto melebihi batas maksimal 5 MB.');
    }

    // 2. Fetch existing photos to check 5-photo limit & determine slot
    const { photos } = await this.getPhotosByLaundryAsync(laundryId);
    if (photos.length >= MAX_LAUNDRY_PHOTOS) {
      throw new Error(`Batas maksimal ${MAX_LAUNDRY_PHOTOS} foto profil per mitra telah tercapai.`);
    }

    const occupiedSlots = new Set(photos.map((p) => p.photo_slot));
    let targetSlot = 0;
    for (let slot = 0; slot < MAX_LAUNDRY_PHOTOS; slot++) {
      if (!occupiedSlots.has(slot)) {
        targetSlot = slot;
        break;
      }
    }

    // 3. Generate unique file path
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const photoId = crypto.randomUUID();
    const storagePath = `${laundryId}/${photoId}.${fileExt}`;

    // 4. Upload binary to Supabase Storage bucket
    const { error: uploadError } = await supabase.storage
      .from(LAUNDRY_PHOTOS_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Gagal mengunggah gambar ke Storage: ${uploadError.message}`);
    }

    // 5. Get Public URL
    const { data: urlData } = supabase.storage
      .from(LAUNDRY_PHOTOS_BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;
    const isPrimary = photos.length === 0 || targetSlot === 0;

    // 6. Insert record into laundry_photos table
    try {
      const { data: dbRecord, error: dbError } = await (supabase.from('laundry_photos') as any)
        .insert({
          id: photoId,
          laundry_id: laundryId,
          storage_path: storagePath,
          public_url: publicUrl,
          photo_slot: targetSlot,
          sort_order: targetSlot,
          is_primary: isPrimary,
        })
        .select()
        .single();

      if (dbError || !dbRecord) {
        throw new Error(`DB Insert Error: ${dbError?.message}`);
      }

      return dbRecord as LaundryPhoto;
    } catch (dbErr: any) {
      // CLEANUP ORPHAN STORAGE FILE IF DB INSERT FAILS
      console.warn('[LAUNDRY-PHOTO-SERVICE] DB insert failed. Cleaning up storage file:', storagePath);
      await supabase.storage.from(LAUNDRY_PHOTOS_BUCKET).remove([storagePath]);
      throw new Error(`Gagal menyimpan data foto mitra: ${dbErr.message}`);
    }
  },

  /**
   * Set a photo as Primary Photo for a laundry using RPC `set_primary_laundry_photo` (Platform Admin ONLY).
   */
  async setPrimaryPhotoAsync(laundryId: string, photoId: string): Promise<void> {
    if (!isValidUuid(laundryId) || !isValidUuid(photoId)) {
      throw new Error('ID Laundry atau ID Foto tidak valid.');
    }

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase client tidak dikonfigurasi.');
    }

    const { error } = await (supabase as any).rpc('set_primary_laundry_photo', {
      p_laundry_id: laundryId,
      p_photo_id: photoId,
    });

    if (error) {
      throw new Error(`Gagal menetapkan foto utama: ${error.message}`);
    }
  },

  /**
   * Delete a laundry photo (Platform Admin ONLY).
   * Deletes database record first, then removes storage object.
   */
  async deleteLaundryPhotoAsync(photoId: string, laundryId: string): Promise<void> {
    if (!isValidUuid(photoId) || !isValidUuid(laundryId)) {
      throw new Error('ID Foto atau ID Laundry tidak valid.');
    }

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase client tidak dikonfigurasi.');
    }

    // 1. Fetch target photo details
    const { data: targetPhoto, error: fetchErr } = await (supabase.from('laundry_photos') as any)
      .select('*')
      .eq('id', photoId)
      .eq('laundry_id', laundryId)
      .single();

    if (fetchErr || !targetPhoto) {
      throw new Error('Foto tidak ditemukan di database.');
    }

    const wasPrimary = targetPhoto.is_primary;
    const storagePath = targetPhoto.storage_path;

    // 2. Delete DB record first
    const { error: dbDeleteErr } = await (supabase.from('laundry_photos') as any)
      .delete()
      .eq('id', photoId)
      .eq('laundry_id', laundryId);

    if (dbDeleteErr) {
      throw new Error(`Gagal menghapus record foto dari DB: ${dbDeleteErr.message}`);
    }

    // 3. Delete Storage object
    const { error: storageDeleteErr } = await supabase.storage
      .from(LAUNDRY_PHOTOS_BUCKET)
      .remove([storagePath]);

    if (storageDeleteErr) {
      console.warn('[LAUNDRY-PHOTO-SERVICE] Storage delete warning (orphan file):', storageDeleteErr.message);
    }

    // 4. If deleted photo was primary, assign remaining photo as primary
    if (wasPrimary) {
      const { photos: remaining } = await this.getPhotosByLaundryAsync(laundryId);
      if (remaining.length > 0) {
        await this.setPrimaryPhotoAsync(laundryId, remaining[0].id);
      }
    }
  },

  /**
   * Reorder photo slots for a laundry (Platform Admin ONLY).
   */
  async reorderLaundryPhotosAsync(laundryId: string, photoIdsInOrder: string[]): Promise<void> {
    if (!isValidUuid(laundryId) || photoIdsInOrder.length === 0) return;
    if (!isSupabaseConfigured || !supabase) return;

    try {
      // Offset slots temporarily to avoid unique constraint violations during swap
      for (let index = 0; index < photoIdsInOrder.length; index++) {
        const id = photoIdsInOrder[index];
        await (supabase.from('laundry_photos') as any)
          .update({ photo_slot: index, sort_order: index })
          .eq('id', id)
          .eq('laundry_id', laundryId);
      }
    } catch (err: any) {
      throw new Error(`Gagal mengubah urutan foto: ${err.message}`);
    }
  },
};
