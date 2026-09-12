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
 * Verify that the calling user is authenticated and is either an owner of target laundryId or platform_admin.
 */
async function verifyOwnerOrAdmin(
  request: Request,
  laundryId: string
): Promise<{ authorized: boolean; userId?: string; isPlatformAdmin?: boolean; error?: string }> {
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
    return { authorized: false, error: 'Token autentikasi tidak ditemukan. Silakan login terlebih dahulu.' };
  }

  const adminClient = getAdminClient() || supabase;
  const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return { authorized: false, error: 'Sesi pengguna tidak valid.' };
  }

  const userId = userData.user.id;

  // 1. Check if platform admin
  const { data: profile } = await (adminClient.from('profiles') as any)
    .select('role')
    .eq('id', userId)
    .single();

  if (profile && (profile.role === 'platform_admin' || profile.role === 'admin')) {
    return { authorized: true, userId, isPlatformAdmin: true };
  }

  // 2. Check ownership of laundryId via public.laundries
  const { data: laundry } = await (adminClient.from('laundries') as any)
    .select('id, owner_id')
    .eq('id', laundryId)
    .single();

  if (laundry && laundry.owner_id === userId) {
    return { authorized: true, userId, isPlatformAdmin: false };
  }

  // 3. Check ownership via public.laundry_users table (role = 'owner')
  const { data: membership } = await (adminClient.from('laundry_users') as any)
    .select('id')
    .eq('laundry_id', laundryId)
    .eq('profile_id', userId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .maybeSingle();

  if (membership) {
    return { authorized: true, userId, isPlatformAdmin: false };
  }

  return { authorized: false, error: 'Akses ditolak: Anda bukan pemilik dari cabang laundry ini.' };
}

// GET /api/owner/staff?laundryId=... -> Fetch staff members for a specific branch owned by caller
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const laundryId = searchParams.get('laundryId');

    if (!laundryId || !isValidUuid(laundryId)) {
      return NextResponse.json(
        { success: false, error: 'ID cabang laundry wajib disertakan.' },
        { status: 400 }
      );
    }

    const authCheck = await verifyOwnerOrAdmin(request, laundryId);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error || 'Forbidden' },
        { status: 403 }
      );
    }

    const adminClient = getAdminClient() || supabase;
    if (!adminClient) {
      return NextResponse.json(
        { success: false, error: 'Koneksi database belum terkonfigurasi.' },
        { status: 500 }
      );
    }

    const { data: staffMemberships, error: fetchErr } = await (adminClient.from('laundry_users') as any)
      .select(`
        id,
        laundry_id,
        profile_id,
        role,
        is_active,
        created_at,
        profiles ( id, full_name, email, phone ),
        laundries ( id, name, code )
      `)
      .eq('laundry_id', laundryId)
      .eq('role', 'staff')
      .order('created_at', { ascending: false });

    if (fetchErr) {
      return NextResponse.json(
        { success: false, error: `Gagal memuat staf cabang: ${fetchErr.message}` },
        { status: 500 }
      );
    }

    const formattedStaff = (staffMemberships || []).map((m: any) => ({
      id: m.id,
      profileId: m.profile_id,
      fullName: m.profiles?.full_name || 'Laundry Staff',
      email: m.profiles?.email || '',
      phone: m.profiles?.phone || '',
      laundryId: m.laundry_id,
      laundryName: m.laundries?.name || 'Cabang Laundry',
      laundryCode: m.laundries?.code || 'LND',
      role: 'laundry_staff',
      isActive: m.is_active,
      createdAt: m.created_at,
    }));

    return NextResponse.json({
      success: true,
      staff: formattedStaff,
      count: formattedStaff.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Server error saat memuat staf cabang.' },
      { status: 500 }
    );
  }
}

// POST /api/owner/staff -> Create a new Laundry Staff account for a branch owned by caller
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fullName, email, password, phone = '', laundryId, isActive = true } = body;

    // 1. Validations
    if (!laundryId || !isValidUuid(laundryId)) {
      return NextResponse.json(
        { success: false, error: 'Cabang laundry wajib dipilih.' },
        { status: 400 }
      );
    }

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return NextResponse.json(
        { success: false, error: 'Nama lengkap staf wajib diisi.' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Alamat email tidak valid.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password sementara minimal 6 karakter.' },
        { status: 400 }
      );
    }

    // 2. Auth Authorization Check (MUST happen BEFORE Auth user creation)
    const authCheck = await verifyOwnerOrAdmin(request, laundryId);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error || 'Forbidden' },
        { status: 403 }
      );
    }

    const adminClient = getAdminClient();
    if (!adminClient) {
      return NextResponse.json(
        { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY belum terkonfigurasi di server.' },
        { status: 500 }
      );
    }

    // 3. Check laundry outlet existence and active status
    const { data: laundry, error: laundryErr } = await (adminClient.from('laundries') as any)
      .select('id, name, code, is_active')
      .eq('id', laundryId)
      .single();

    if (laundryErr || !laundry) {
      return NextResponse.json(
        { success: false, error: 'Cabang laundry tidak ditemukan.' },
        { status: 404 }
      );
    }

    if (!laundry.is_active) {
      return NextResponse.json(
        { success: false, error: 'Cabang laundry terpilih sedang tidak aktif.' },
        { status: 400 }
      );
    }

    // 4. Check email existence in profiles table
    const { data: existingProfile } = await (adminClient.from('profiles') as any)
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { success: false, error: 'Email sudah terdaftar di sistem.' },
        { status: 409 }
      );
    }

    // 5. Create Auth User via Supabase Admin API
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName.trim() },
    });

    if (authErr || !authData?.user) {
      return NextResponse.json(
        { success: false, error: `Gagal membuat akun auth staff: ${authErr?.message || 'Unknown error'}` },
        { status: 400 }
      );
    }

    const newUserId = authData.user.id;

    // 6. Create Profile & Laundry Users Membership
    try {
      const { error: profileErr } = await (adminClient.from('profiles') as any).upsert({
        id: newUserId,
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        phone: phone.trim(),
        role: 'laundry_staff',
        created_at: new Date().toISOString(),
      });

      if (profileErr) {
        throw new Error(`Profile insert error: ${profileErr.message}`);
      }

      const { data: membership, error: memberErr } = await (adminClient.from('laundry_users') as any)
        .insert({
          laundry_id: laundryId,
          profile_id: newUserId,
          role: 'staff',
          is_active: Boolean(isActive),
        })
        .select()
        .single();

      if (memberErr || !membership) {
        throw new Error(`Membership insert error: ${memberErr?.message || 'Unknown error'}`);
      }

      return NextResponse.json(
        {
          success: true,
          staff: {
            id: membership.id,
            profileId: newUserId,
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            laundryId: laundry.id,
            laundryName: laundry.name,
            laundryCode: laundry.code,
            role: 'laundry_staff',
            isActive: Boolean(isActive),
            createdAt: membership.created_at,
          },
          message: 'Staf cabang baru berhasil didaftarkan.',
        },
        { status: 201 }
      );
    } catch (dbErr: any) {
      // Safe cleanup of orphan auth user
      await adminClient.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        { success: false, error: `Gagal menyimpan data staf: ${dbErr.message}` },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Server error saat membuat akun staf.' },
      { status: 500 }
    );
  }
}
