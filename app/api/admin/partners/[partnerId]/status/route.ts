import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/authHelper';
import { adminPartnerService } from '@/services/adminPartnerService';
import { partnerPermissionService } from '@/services/partnerPermissionService';
import { PartnerLifecycleStatus } from '@/types/laundry';

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
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Hanya Platform Ops Admin yang berhak memperbarui status partner.' }, { status: 403 });
    }

    const { partnerId } = await params;
    const body = await request.json();
    const targetStatus: PartnerLifecycleStatus = body.status || body.targetStatus;
    const reason: string | undefined = body.reason;

    if (!targetStatus) {
      return NextResponse.json({ success: false, message: 'Target status wajib diisi.' }, { status: 400 });
    }

    const currentPartner = await adminPartnerService.getPartnerDetailAsync(partnerId, auth.accessToken || undefined);
    if (!currentPartner) {
      return NextResponse.json({ success: false, message: 'Partner tidak ditemukan.' }, { status: 404 });
    }

    const transitionCheck = partnerPermissionService.isValidStatusTransition(
      currentPartner.status || 'listed',
      targetStatus
    );

    if (!transitionCheck.valid) {
      return NextResponse.json({ success: false, message: transitionCheck.error }, { status: 400 });
    }

    if (targetStatus === 'suspended' && (!reason || reason.trim().length < 5)) {
      return NextResponse.json(
        { success: false, message: 'Alasan penghentian sementara (suspend) wajib diisi minimal 5 karakter.' },
        { status: 400 }
      );
    }

    const result = await adminPartnerService.updatePartnerStatusAsync(partnerId, targetStatus, reason, auth.accessToken || undefined);

    return NextResponse.json({
      success: true,
      message: `Status partner berhasil diperbarui menjadi ${targetStatus.toUpperCase()}`,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}
