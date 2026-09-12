import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { isValidUuid } from '@/utils/formatters';

function getAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Verify caller ownership for the laundry associated with staffId membership record.
 */
async function verifyOwnerOfStaffRecord(
  request: Request,
  staffMembershipId: string
): Promise<{ authorized: boolean; membership?: any; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { authorized: false, error: 'Database belum terkonfigurasi.' };
  }

  const authHeader = request.headers.get('authorization') || '';
  let accessToken = '';
  if (authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7).trim();
  }

  if (!accessToken) {
    const { data: { session } } = await supabase.auth.getSession();
    accessToken = session?.access_token || '';
  }

  if (!accessToken) {
    return { authorized: false, error: 'Token autentikasi tidak ditemukan.' };
  }

  const adminClient = getAdminClient() || supabase;
  const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return { authorized: false, error: 'Sesi pengguna tidak valid.' };
  }

  const userId = userData.user.id;

  // 1. Fetch staff membership record
  const { data: membership, error: memErr } = await (adminClient.from('laundry_users') as any)
    .select('id, laundry_id, profile_id, role, is_active')
    .eq('id', staffMembershipId)
    .eq('role', 'staff')
    .single();

  if (memErr || !membership) {
    return { authorized: false, error: 'Data keanggotaan staf tidak ditemukan.' };
  }

  // 2. Check if platform admin
  const { data: profile } = await (adminClient.from('profiles') as any)
    .select('role')
    .eq('id', userId)
    .single();

  if (profile && (profile.role === 'platform_admin' || profile.role === 'admin')) {
    return { authorized: true, membership };
  }

  // 3. Check ownership of laundry_id
  const { data: laundry } = await (adminClient.from('laundries') as any)
    .select('id, owner_id')
    .eq('id', membership.laundry_id)
    .single();

  if (laundry && laundry.owner_id === userId) {
    return { authorized: true, membership };
  }

  // Check via laundry_users (role = 'owner')
  const { data: ownerMem } = await (adminClient.from('laundry_users') as any)
    .select('id')
    .eq('laundry_id', membership.laundry_id)
    .eq('profile_id', userId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .maybeSingle();

  if (ownerMem) {
    return { authorized: true, membership };
  }

  return { authorized: false, error: 'Akses ditolak: Anda bukan pemilik dari cabang staf ini.' };
}

// PATCH /api/owner/staff/[staffId] -> Activate or Deactivate Staff member
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ staffId: string }> }
) {
  try {
    const resolvedParams = await params;
    const staffId = resolvedParams.staffId;

    if (!staffId || !isValidUuid(staffId)) {
      return NextResponse.json(
        { success: false, error: 'ID staf tidak valid.' },
        { status: 400 }
      );
    }

    const authCheck = await verifyOwnerOfStaffRecord(request, staffId);
    if (!authCheck.authorized || !authCheck.membership) {
      return NextResponse.json(
        { success: false, error: authCheck.error || 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { isActive } = body;

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Status is_active (boolean) wajib diisi.' },
        { status: 400 }
      );
    }

    const adminClient = getAdminClient() || supabase;
    if (!adminClient) {
      return NextResponse.json(
        { success: false, error: 'Koneksi database belum terkonfigurasi.' },
        { status: 500 }
      );
    }

    const { error: updateErr } = await (adminClient.from('laundry_users') as any)
      .update({ is_active: isActive })
      .eq('id', staffId)
      .eq('role', 'staff');

    if (updateErr) {
      return NextResponse.json(
        { success: false, error: `Gagal memperbarui status staf: ${updateErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Status staf berhasil ${isActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Server error saat memperbarui staf.' },
      { status: 500 }
    );
  }
}
