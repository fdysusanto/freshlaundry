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
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Hanya Platform Ops Admin yang berhak memverifikasi partner.' }, { status: 403 });
    }

    const { partnerId } = await params;
    const body = await request.json();
    const verificationStatus: 'verified' | 'rejected' = body.status || body.verificationStatus || 'verified';
    const notes: string | undefined = body.notes;

    await adminPartnerService.verifyPartnerAsync(partnerId, verificationStatus, notes);

    return NextResponse.json({
      success: true,
      message: `Verifikasi partner berhasil diperbarui menjadi ${verificationStatus.toUpperCase()}`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}
