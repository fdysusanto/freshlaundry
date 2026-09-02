import { NextResponse } from 'next/server';
import { courierJobPoolService, ClaimSlotRequest } from '@/services/courierJobPoolService';
import { authService } from '@/services/authService';
import { supabase, createAuthenticatedClient, isSupabaseConfigured } from '@/services/supabase';
import { UserProfile, UserRole } from '@/types/user';
import { DEMO_USERS } from '@/utils/constants';

export async function POST(request: Request) {
  try {
    const body: ClaimSlotRequest = await request.json();
    const { date, jobType, timeSlot } = body;

    if (!date || !jobType || !timeSlot) {
      return NextResponse.json(
        { success: false, message: 'Validasi Gagal: Parameter date, jobType, dan timeSlot wajib diisi.' },
        { status: 400 }
      );
    }

    if (!['pickup', 'delivery'].includes(jobType)) {
      return NextResponse.json(
        { success: false, message: `Validasi Gagal: jobType '${jobType}' tidak valid. Harus pickup atau delivery.` },
        { status: 400 }
      );
    }

    let courier: UserProfile | null = null;
    let userClient = null;

    if (isSupabaseConfigured && supabase) {
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

      courier = {
        id: authUser.id,
        email: profile?.email || authUser.email || '',
        fullName: profile?.full_name || authUser.user_metadata?.full_name || 'Courier',
        phone: profile?.phone || '',
        role: activeRole,
        createdAt: profile?.created_at || authUser.created_at || new Date().toISOString(),
      };
    } else {
      courier = authService.getCurrentUserSync();
    }

    if (!courier) {
      return NextResponse.json(
        { success: false, message: 'Autentikasi Gagal: Pengguna belum login.' },
        { status: 401 }
      );
    }

    if (courier.role !== 'courier') {
      return NextResponse.json(
        { success: false, message: 'Akses Ditolak: Hanya pengguna dengan peran Courier yang diizinkan melakukan claim slot job.' },
        { status: 403 }
      );
    }

    const claimResult = await courierJobPoolService.claimCourierSlotAsync(
      {
        courierId: courier.id,
        jobDate: date,
        jobType,
        timeSlot,
        maxCapacity: 5,
        nowInput: (body as any).nowInput || new Date(),
      },
      userClient || undefined
    );

    return NextResponse.json(claimResult, { status: 200 });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Gagal melakukan claim slot job.';
    const isLockError = errMessage.includes('SLOT_CLAIM_NOT_YET_OPEN');
    const isCapError = errMessage.includes('MAX_CAPACITY_REACHED');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: isLockError ? 'SLOT_CLAIM_NOT_YET_OPEN' : isCapError ? 'MAX_CAPACITY_REACHED' : 'CLAIM_FAILED',
          message: errMessage,
        },
      },
      { status: 400 }
    );
  }
}
