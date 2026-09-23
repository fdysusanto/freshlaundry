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
    const partner = await adminPartnerService.getPartnerDetailAsync(partnerId, auth.accessToken || undefined);

    if (!partner) {
      return NextResponse.json({ success: false, message: 'Partner tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, partner });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memuat data partner.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(
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
    const body = await request.json();

    await adminPartnerService.updatePartnerPlatformFieldsAsync(partnerId, body);

    return NextResponse.json({
      success: true,
      message: 'Data partner berhasil diperbarui.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memperbarui data partner.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
