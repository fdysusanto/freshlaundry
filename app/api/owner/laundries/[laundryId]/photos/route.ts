import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, createServiceRoleClient } from '@/services/supabase';
import { isValidUuid } from '@/utils/formatters';
import {
  LAUNDRY_PHOTOS_BUCKET,
  MAX_LAUNDRY_PHOTOS,
  MAX_PHOTO_FILE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
  sortLaundryPhotosForGallery,
} from '@/services/laundryPhotoService';
import { LaundryPhoto } from '@/types/laundry';

async function verifyOwnerAccess(
  request: Request,
  targetLaundryId: string
): Promise<{ authorized: boolean; userId?: string; error?: string; status?: number }> {
  const authHeader = request.headers.get('authorization') || '';
  let accessToken = '';
  if (authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7).trim();
  }

  // Handle mock mode
  if (!isSupabaseConfigured || !supabase) {
    if (authHeader.includes('mock_customer_token')) {
      return { authorized: false, error: 'Akses Ditolak: Customer tidak diizinkan mengubah foto laundry.', status: 403 };
    }
    return { authorized: true, userId: 'usr_owner_01' };
  }

  if (!accessToken) {
    const { data: { session } } = await supabase.auth.getSession();
    accessToken = session?.access_token || '';
  }

  if (!accessToken) {
    return { authorized: false, error: 'Tidak Terotentikasi. Silakan login terlebih dahulu.', status: 401 };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return { authorized: false, error: 'Sesi otentikasi tidak valid atau telah kedaluwarsa.', status: 401 };
  }

  const userId = userData.user.id;
  const adminClient = createServiceRoleClient();

  // Check if caller is platform_admin
  const { data: profile } = await (adminClient.from('profiles') as any)
    .select('role')
    .eq('id', userId)
    .single();

  if (profile?.role === 'platform_admin' || profile?.role === 'admin') {
    return { authorized: true, userId };
  }

  // Check if caller is owner of targetLaundryId
  const { data: laundryData } = await (adminClient.from('laundries') as any)
    .select('owner_id')
    .eq('id', targetLaundryId)
    .single();

  if (laundryData?.owner_id === userId) {
    return { authorized: true, userId };
  }

  const { data: laundryUser } = await (adminClient.from('laundry_users') as any)
    .select('role, is_active')
    .eq('laundry_id', targetLaundryId)
    .eq('profile_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (laundryUser && (laundryUser.role === 'owner' || laundryUser.role === 'laundry_owner')) {
    return { authorized: true, userId };
  }

  return { authorized: false, error: 'Akses Ditolak: Anda bukan pemilik outlet laundry ini.', status: 403 };
}

/**
 * GET /api/owner/laundries/[laundryId]/photos
 * Returns all gallery photos for the laundry, sorted deterministically (primary at index 0).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ laundryId: string }> }
) {
  try {
    const { laundryId } = await params;
    if (!laundryId || !isValidUuid(laundryId)) {
      return NextResponse.json({ success: false, message: 'ID Laundry tidak valid.' }, { status: 400 });
    }

    const authCheck = await verifyOwnerAccess(request, laundryId);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, message: authCheck.error }, { status: authCheck.status || 403 });
    }

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({ success: true, photos: [], primaryPhoto: null });
    }

    const adminClient = createServiceRoleClient();
    const { data, error } = await (adminClient.from('laundry_photos') as any)
      .select('*')
      .eq('laundry_id', laundryId)
      .order('sort_order', { ascending: true })
      .order('photo_slot', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    const rawPhotos = (data || []) as LaundryPhoto[];
    const photos = sortLaundryPhotosForGallery(rawPhotos);
    const primaryPhoto = photos.find((p) => p.is_primary) || photos[0] || null;

    return NextResponse.json({ success: true, photos, primaryPhoto });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

/**
 * POST /api/owner/laundries/[laundryId]/photos
 * Uploads a new photo into public.laundry_photos.
 * Auto-promotes to primary ONLY if no primary photo exists yet.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ laundryId: string }> }
) {
  try {
    const { laundryId } = await params;
    if (!laundryId || !isValidUuid(laundryId)) {
      return NextResponse.json({ success: false, message: 'ID Laundry tidak valid.' }, { status: 400 });
    }

    const authCheck = await verifyOwnerAccess(request, laundryId);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, message: authCheck.error }, { status: authCheck.status || 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'File gambar wajib disertakan.' }, { status: 400 });
    }

    // 1. Validate MIME
    const mime = file.type.toLowerCase();
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mime)) {
      return NextResponse.json(
        { success: false, message: 'Format file tidak didukung. Harap upload gambar JPG, PNG, atau WebP (SVG ditolak untuk keamanan).' },
        { status: 400 }
      );
    }

    // 2. Validate Size
    if (file.size > MAX_PHOTO_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, message: 'Ukuran file melebihi batas maksimal 5 MB.' },
        { status: 400 }
      );
    }

    // Mock Mode
    if (!isSupabaseConfigured || !supabase) {
      const mockPhoto: LaundryPhoto = {
        id: `lp_mock_${Date.now()}`,
        laundry_id: laundryId,
        storage_path: `${laundryId}/mock_${Date.now()}.webp`,
        public_url: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=800&q=80',
        photo_slot: 0,
        sort_order: 0,
        is_primary: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return NextResponse.json({ success: true, photo: mockPhoto, message: 'Foto berhasil diunggah (Mock Mode).' });
    }

    const adminClient = createServiceRoleClient();

    // 3. Fetch existing photos to check 5-photo limit & determine slot
    const { data: existingPhotos, error: fetchErr } = await (adminClient.from('laundry_photos') as any)
      .select('*')
      .eq('laundry_id', laundryId);

    if (fetchErr) {
      return NextResponse.json({ success: false, message: `Gagal memverifikasi slot foto: ${fetchErr.message}` }, { status: 500 });
    }

    const photosList = (existingPhotos || []) as LaundryPhoto[];
    if (photosList.length >= MAX_LAUNDRY_PHOTOS) {
      return NextResponse.json(
        { success: false, message: `Batas maksimal ${MAX_LAUNDRY_PHOTOS} foto profil per mitra telah tercapai.` },
        { status: 400 }
      );
    }

    const occupiedSlots = new Set(photosList.map((p) => p.photo_slot));
    let targetSlot = 0;
    for (let slot = 0; slot < MAX_LAUNDRY_PHOTOS; slot++) {
      if (!occupiedSlots.has(slot)) {
        targetSlot = slot;
        break;
      }
    }

    // 4. Determine primary status: Primary ONLY if no primary exists yet
    const hasPrimary = photosList.some((p) => p.is_primary);
    const isPrimary = !hasPrimary;

    // 5. Upload binary to Supabase Storage
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'webp';
    const photoId = crypto.randomUUID();
    const storagePath = `${laundryId}/${photoId}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminClient.storage
      .from(LAUNDRY_PHOTOS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mime,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, message: `Gagal mengunggah foto ke Storage: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = adminClient.storage
      .from(LAUNDRY_PHOTOS_BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // 6. Insert record into laundry_photos table
    try {
      const { data: dbRecord, error: dbError } = await (adminClient.from('laundry_photos') as any)
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
        throw new Error(dbError?.message || 'DB Insert returned null');
      }

      return NextResponse.json({
        success: true,
        photo: dbRecord as LaundryPhoto,
        message: isPrimary ? 'Foto berhasil diunggah dan dijadikan Foto Utama.' : 'Foto berhasil diunggah ke galeri.',
      });
    } catch (insertErr: any) {
      // CLEANUP ORPHAN STORAGE OBJECT IF DB INSERT FAILS
      console.warn('[OWNER-PHOTO-API] DB insert failed. Pruning newly uploaded storage file:', storagePath);
      await adminClient.storage.from(LAUNDRY_PHOTOS_BUCKET).remove([storagePath]);
      return NextResponse.json(
        { success: false, message: `Gagal menyimpan metadata foto: ${insertErr.message}` },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
