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
    const mainPartner = await adminPartnerService.getPartnerDetailAsync(partnerId);

    if (!mainPartner) {
      return NextResponse.json({ success: false, message: 'Partner tidak ditemukan' }, { status: 404 });
    }

    // Return branches associated with the owner if applicable
    const branches = [mainPartner];

    return NextResponse.json({
      success: true,
      branches,
      count: branches.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
