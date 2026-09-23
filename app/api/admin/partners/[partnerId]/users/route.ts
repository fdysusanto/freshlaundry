import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/authHelper';
import { adminPartnerService } from '@/services/adminPartnerService';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ success: false, message: 'Tidak Terotentikasi' }, { status: 401 });
    }
    if (!auth.isPlatformAdmin) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak' }, { status: 403 });
    }

    const { partnerId } = await params;
    const users = await adminPartnerService.getPartnerUsersAsync(partnerId);

    return NextResponse.json({
      success: true,
      users,
      count: users.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
