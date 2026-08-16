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

async function verifyPlatformAdmin(request: Request): Promise<{ isAdmin: boolean; userId?: string }> {
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

  const userId = userData.user.id;
  const adminClient = getAdminClient() || supabase;

  const { data: profile } = await (adminClient.from('profiles') as any)
    .select('role')
    .eq('id', userId)
    .single();

  if (profile && profile.role === 'platform_admin') {
    return { isAdmin: true, userId };
  }

  return { isAdmin: false, userId };
}

// GET /api/admin/staff -> Retrieve all laundry staff accounts
export async function GET(request: Request) {
  try {
    const { isAdmin } = await verifyPlatformAdmin(request);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
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
        profiles ( id, full_name, email ),
        laundries ( id, name, code )
      `)
      .eq('role', 'staff')
      .order('created_at', { ascending: false });

    if (fetchErr) {
      return NextResponse.json(
        { success: false, error: `Gagal memuat data staf: ${fetchErr.message}` },
        { status: 500 }
      );
    }

    const formattedStaff = (staffMemberships || []).map((m: any) => ({
      id: m.id,
      profileId: m.profile_id,
      fullName: m.profiles?.full_name || 'Laundry Staff',
      email: m.profiles?.email || '',
      laundryId: m.laundry_id,
      laundryName: m.laundries?.name || 'Toko Laundry',
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
      { success: false, error: err.message || 'Server error saat memuat data staf.' },
      { status: 500 }
    );
  }
}

// POST /api/admin/staff -> Create a new Laundry Staff account (Platform Admin Only)
export async function POST(request: Request) {
  try {
    const { isAdmin } = await verifyPlatformAdmin(request);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { fullName, email, password, laundryId, isActive = true } = body;

    // Validation
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

    if (!laundryId || !isValidUuid(laundryId)) {
      return NextResponse.json(
        { success: false, error: 'Outlet laundry wajib dipilih.' },
        { status: 400 }
      );
    }

    const adminClient = getAdminClient();
    if (!adminClient) {
      return NextResponse.json(
        { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY belum terkonfigurasi di server.' },
        { status: 500 }
      );
    }

    // 1. Verify laundry existence and active status
    const { data: laundry, error: laundryErr } = await (adminClient.from('laundries') as any)
      .select('id, name, code, is_active')
      .eq('id', laundryId)
      .single();

    if (laundryErr || !laundry) {
      return NextResponse.json(
        { success: false, error: 'Outlet laundry tidak ditemukan.' },
        { status: 404 }
      );
    }

    if (!laundry.is_active) {
      return NextResponse.json(
        { success: false, error: 'Outlet laundry terpilih sedang tidak aktif.' },
        { status: 400 }
      );
    }

    // 2. Check if email already registered in public.profiles
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

    // 3. Create Auth User using Server-Side Supabase Admin API
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

    // 4. Create Profile & Membership in Database
    try {
      // Upsert profile for new user
      const { error: profileErr } = await (adminClient.from('profiles') as any).upsert({
        id: newUserId,
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        phone: '',
        role: 'laundry_staff',
        created_at: new Date().toISOString(),
      });

      if (profileErr) {
        throw new Error(`Profile insert error: ${profileErr.message}`);
      }

      // Insert laundry_users relationship
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
            laundryId: laundry.id,
            laundryName: laundry.name,
            laundryCode: laundry.code,
            role: 'laundry_staff',
            isActive: Boolean(isActive),
            createdAt: membership.created_at,
          },
          message: 'Akun Laundry Staff berhasil dibuat.',
        },
        { status: 201 }
      );
    } catch (dbErr: any) {
      // Clean up created Auth User if database profile/membership creation fails
      await adminClient.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        { success: false, error: `Gagal menyelesaikan data staf: ${dbErr.message}` },
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
