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

async function verifyPlatformAdmin(request: Request): Promise<{ isAdmin: boolean }> {
  if (!isSupabaseConfigured || !supabase) {
    return { isAdmin: false };
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
    return { isAdmin: false };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return { isAdmin: false };
  }

  const adminClient = getAdminClient() || supabase;

  const { data: profile } = await (adminClient.from('profiles') as any)
    .select('role')
    .eq('id', userData.user.id)
    .single();

  return { isAdmin: Boolean(profile && profile.role === 'platform_admin') };
}

// PATCH /api/admin/staff/[staffId] -> Update staff assignment or status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ staffId: string }> }
) {
  try {
    const { isAdmin } = await verifyPlatformAdmin(request);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const staffId = resolvedParams.staffId;

    if (!staffId || !isValidUuid(staffId)) {
      return NextResponse.json(
        { success: false, error: 'ID keanggotaan staf tidak valid.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { laundryId, isActive } = body;

    const adminClient = getAdminClient() || supabase;
    if (!adminClient) {
      return NextResponse.json(
        { success: false, error: 'Koneksi database belum terkonfigurasi.' },
        { status: 500 }
      );
    }

    const updateFields: Record<string, any> = {};

    if (typeof isActive === 'boolean') {
      updateFields.is_active = isActive;
    }

    if (laundryId) {
      if (!isValidUuid(laundryId)) {
        return NextResponse.json(
          { success: false, error: 'Laundry ID tidak valid.' },
          { status: 400 }
        );
      }

      // Check if laundry exists
      const { data: laundry } = await (adminClient.from('laundries') as any)
        .select('id')
        .eq('id', laundryId)
        .single();

      if (!laundry) {
        return NextResponse.json(
          { success: false, error: 'Laundry outlet tidak ditemukan.' },
          { status: 404 }
        );
      }

      updateFields.laundry_id = laundryId;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada data perubahan yang dikirim.' },
        { status: 400 }
      );
    }

    const { error: updateErr } = await (adminClient.from('laundry_users') as any)
      .update(updateFields)
      .eq('id', staffId)
      .eq('role', 'staff');

    if (updateErr) {
      return NextResponse.json(
        { success: false, error: `Gagal mengedit data staf: ${updateErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Data staf laundry berhasil diperbarui.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Server error saat memperbarui staf.' },
      { status: 500 }
    );
  }
}
