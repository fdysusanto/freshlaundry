import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/authHelper';
import { adminPartnerService } from '@/services/adminPartnerService';
import { isValidUuid } from '@/utils/formatters';

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
      return NextResponse.json(
        { success: false, message: 'Akses Ditolak: Hanya Platform Ops Admin yang berhak mengubah status operasional toko partner.' },
        { status: 403 }
      );
    }

    const { partnerId } = await params;
    if (!isValidUuid(partnerId)) {
      return NextResponse.json({ success: false, message: 'ID partner tidak valid.' }, { status: 400 });
    }

    const body = await request.json();
    if (typeof body.isOpen !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'Field isOpen bertipe boolean wajib disertakan (true untuk Buka, false untuk Tutup).' },
        { status: 400 }
      );
    }

    const result = await adminPartnerService.setPartnerOperationalStatusAsync(
      partnerId,
      body.isOpen,
      auth.accessToken || undefined
    );

    return NextResponse.json({
      success: true,
      message: result.message || `Status operasional toko berhasil diubah menjadi ${body.isOpen ? 'BUKA' : 'TUTUP'}.`,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memperbarui status operasional partner.';
    const isNotFound = message.toLowerCase().includes('tidak ditemukan');
    if (isNotFound) {
      return NextResponse.json({ success: false, message }, { status: 404 });
    }
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
