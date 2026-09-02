import { NextResponse } from 'next/server';
import { courierJobPoolService } from '@/services/courierJobPoolService';
import { authService } from '@/services/authService';
import { supabase, createAuthenticatedClient, isSupabaseConfigured } from '@/services/supabase';
import { UserProfile, UserRole } from '@/types/user';
import { DEMO_USERS } from '@/utils/constants';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date') || undefined;

    let user: UserProfile | null = null;
    let userClient = null;

    if (request.headers.get('x-unauthenticated') === 'true') {
      user = null;
    } else if (isSupabaseConfigured && supabase) {
      const authHeader = request.headers.get('authorization');
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

      if (!token) {
        return NextResponse.json(
          { success: false, message: 'Autentikasi Gagal: Token autentikasi (Bearer token) tidak ditemukan dalam request header.' },
          { status: 401 }
        );
      }

      userClient = createAuthenticatedClient(token);
      const authClient = userClient || supabase;

      const { data: { user: authUser }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !authUser) {
        return NextResponse.json(
          { success: false, message: 'Autentikasi Gagal: Sesi pengguna tidak valid atau telah kadaluarsa.' },
          { status: 401 }
        );
      }

      const { data: profile } = await (authClient.from('profiles') as any)
        .select('*')
        .eq('id', authUser.id)
        .single();

      const activeRole = (profile?.role || authUser.user_metadata?.role || 'customer') as UserRole;

      user = {
        id: authUser.id,
        email: profile?.email || authUser.email || '',
        fullName: profile?.full_name || authUser.user_metadata?.full_name || 'Courier',
        phone: profile?.phone || '',
        role: activeRole,
        createdAt: profile?.created_at || authUser.created_at || new Date().toISOString(),
      };
    } else {
      user = authService.getCurrentUserSync();
    }

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Autentikasi Gagal: Pengguna belum login.' },
        { status: 401 }
      );
    }

    if (user.role === 'customer') {
      return NextResponse.json(
        { success: false, message: 'Akses Ditolak: Customer tidak diizinkan mengakses Courier Job Pool.' },
        { status: 403 }
      );
    }

    const jobPoolData = await courierJobPoolService.getCourierJobPoolAsync(
      dateParam,
      user.id,
      new Date(),
      userClient || undefined
    );

    return NextResponse.json({
      success: true,
      data: jobPoolData,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Gagal mengambil data Courier Job Pool.';
    return NextResponse.json(
      { success: false, message: errMessage },
      { status: 400 }
    );
  }
}
