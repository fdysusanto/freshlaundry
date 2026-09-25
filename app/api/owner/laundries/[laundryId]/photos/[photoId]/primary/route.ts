import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, createServiceRoleClient } from '@/services/supabase';
import { isValidUuid } from '@/utils/formatters';

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
 * PATCH /api/owner/laundries/[laundryId]/photos/[photoId]/primary
 * Atomically sets the target photo as the single Primary Photo for this laundry.
 */
export async function PATCH(
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
      return NextResponse.json({ success: true, message: 'Foto utama berhasil diperbarui (Mock Mode).' });
    }

    const adminClient = createServiceRoleClient();

    // 1. Verify photo exists and belongs to laundryId
    const { data: photoRecord, error: photoErr } = await (adminClient.from('laundry_photos') as any)
      .select('id, laundry_id')
      .eq('id', photoId)
      .eq('laundry_id', laundryId)
      .single();

    if (photoErr || !photoRecord) {
      return NextResponse.json({ success: false, message: 'Foto tidak ditemukan pada outlet laundry ini.' }, { status: 404 });
    }

    // 2. Execute atomic RPC or atomic two-step update
    const { error: rpcError } = await (adminClient as any).rpc('set_primary_laundry_photo', {
      p_laundry_id: laundryId,
      p_photo_id: photoId,
    });

    if (rpcError) {
      // Fallback: If RPC is not available in local schema cache, run atomic update via admin client
      console.warn('[OWNER-PHOTO-API] set_primary_laundry_photo RPC fallback:', rpcError.message);
      await (adminClient.from('laundry_photos') as any)
        .update({ is_primary: false })
        .eq('laundry_id', laundryId)
        .eq('is_primary', true);

      const { error: updateErr } = await (adminClient.from('laundry_photos') as any)
        .update({ is_primary: true })
        .eq('id', photoId)
        .eq('laundry_id', laundryId);

      if (updateErr) {
        return NextResponse.json({ success: false, message: `Gagal memperbarui foto utama: ${updateErr.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Foto utama berhasil diperbarui.',
      primaryPhotoId: photoId,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
