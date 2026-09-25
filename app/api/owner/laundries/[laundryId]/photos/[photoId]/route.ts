import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, createServiceRoleClient } from '@/services/supabase';
import { isValidUuid } from '@/utils/formatters';
import { LAUNDRY_PHOTOS_BUCKET } from '@/services/laundryPhotoService';
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

  const { data: profile } = await (adminClient.from('profiles') as any)
    .select('role')
    .eq('id', userId)
    .single();

  if (profile?.role === 'platform_admin' || profile?.role === 'admin') {
    return { authorized: true, userId };
  }

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
 * DELETE /api/owner/laundries/[laundryId]/photos/[photoId]
 * Deletes a photo from public.laundry_photos and removes binary from Supabase Storage.
 * If the deleted photo was primary, promotes the lowest sort_order remaining photo to primary.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ laundryId: string; photoId: string }> }
) {
  try {
    const { laundryId, photoId } = await params;
    if (!laundryId || !isValidUuid(laundryId)) {
      return NextResponse.json({ success: false, message: 'ID Laundry tidak valid.' }, { status: 400 });
    }
    if (!photoId || !isValidUuid(photoId)) {
      return NextResponse.json({ success: false, message: 'ID Foto tidak valid.' }, { status: 400 });
    }

    const authCheck = await verifyOwnerAccess(request, laundryId);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, message: authCheck.error }, { status: authCheck.status || 403 });
    }

    // Mock Mode
    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({ success: true, message: 'Foto berhasil dihapus (Mock Mode).' });
    }

    const adminClient = createServiceRoleClient();

    // 1. Fetch target photo details & verify it belongs to laundryId
    const { data: targetPhoto, error: fetchErr } = await (adminClient.from('laundry_photos') as any)
      .select('*')
      .eq('id', photoId)
      .eq('laundry_id', laundryId)
      .single();

    if (fetchErr || !targetPhoto) {
      return NextResponse.json({ success: false, message: 'Foto tidak ditemukan di outlet laundry ini.' }, { status: 404 });
    }

    const wasPrimary = targetPhoto.is_primary;
    const storagePath = targetPhoto.storage_path;

    // 2. Delete DB record first
    const { error: dbDeleteErr } = await (adminClient.from('laundry_photos') as any)
      .delete()
      .eq('id', photoId)
      .eq('laundry_id', laundryId);

    if (dbDeleteErr) {
      return NextResponse.json({ success: false, message: `Gagal menghapus data foto: ${dbDeleteErr.message}` }, { status: 500 });
    }

    // 3. Delete Storage object
    if (storagePath) {
      const { error: storageDeleteErr } = await adminClient.storage
        .from(LAUNDRY_PHOTOS_BUCKET)
        .remove([storagePath]);

      if (storageDeleteErr) {
        console.warn('[OWNER-PHOTO-API] Storage delete warning (orphan file):', storageDeleteErr.message);
      }
    }

    // 4. If deleted photo was primary, promote remaining lowest sort_order photo to primary
    let newPrimaryId: string | null = null;
    if (wasPrimary) {
      const { data: remainingPhotos } = await (adminClient.from('laundry_photos') as any)
        .select('*')
        .eq('laundry_id', laundryId)
        .order('sort_order', { ascending: true })
        .order('photo_slot', { ascending: true });

      const remaining = (remainingPhotos || []) as LaundryPhoto[];
      if (remaining.length > 0) {
        newPrimaryId = remaining[0].id;
        await (adminClient.from('laundry_photos') as any)
          .update({ is_primary: true })
          .eq('id', newPrimaryId)
          .eq('laundry_id', laundryId);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Foto berhasil dihapus.',
      promotedPrimaryId: newPrimaryId,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
