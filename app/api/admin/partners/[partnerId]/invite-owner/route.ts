import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/authHelper';
import { adminPartnerService } from '@/services/adminPartnerService';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ success: false, message: 'Tidak Terotentikasi' }, { status: 401 });
    }
    if (!auth.isPlatformAdmin) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Hanya Platform Ops Admin yang berhak mengundang pemilik laundry.' }, { status: 403 });
    }

    const { partnerId } = await params;
    const body = await request.json();
    const email = body.email || body.ownerEmail;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, message: 'Email pemilik wajib diisi dengan format valid.' }, { status: 400 });
    }

    const result = await adminPartnerService.inviteOwnerAsync(partnerId, email, auth.accessToken || undefined);

    return NextResponse.json({
      success: true,
      message: 'Undangan pemilik partner berhasil dibuat.',
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}
