import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/authHelper';
import { adminPartnerService } from '@/services/adminPartnerService';
import { isValidUuid } from '@/utils/formatters';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ partnerId: string; serviceId: string }> }
) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ success: false, message: 'Tidak Terotentikasi' }, { status: 401 });
    }
    if (!auth.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, message: 'Akses Ditolak: Hanya Platform Ops Admin yang berhak memperbarui layanan partner.' },
        { status: 403 }
      );
    }

    const { partnerId, serviceId } = await params;
    if (!isValidUuid(partnerId) || !isValidUuid(serviceId)) {
      return NextResponse.json({ success: false, message: 'ID partner atau service tidak valid.' }, { status: 400 });
    }

    const body = await request.json();

    // Check if toggle action
    if (body.action === 'toggle' || (body.isActive !== undefined && Object.keys(body).length <= 2)) {
      const targetActive = Boolean(body.isActive);
      const result = await adminPartnerService.togglePartnerServiceStatusAsync(
        partnerId,
        serviceId,
        targetActive,
        auth.accessToken || undefined
      );

      return NextResponse.json({
        success: true,
        message: result.message || `Layanan berhasil ${targetActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
        service: result.service,
      });
    }

    // General update
    const result = await adminPartnerService.updatePartnerServiceAsync(
      partnerId,
      serviceId,
      {
        name: body.name ? body.name.trim() : undefined,
        code: body.code,
        description: body.description,
        category: body.category,
        pricingType: body.pricingType,
        price: body.price !== undefined ? Number(body.price) : undefined,
        unit: body.unit,
        minWeight: body.minWeight !== undefined && body.minWeight !== null && body.minWeight !== '' ? Number(body.minWeight) : (body.unit === 'pcs' ? null : undefined),
        estimatedHours: body.estimatedHours !== undefined ? Number(body.estimatedHours) : undefined,
        iconName: body.iconName,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
        imageUrl: body.imageUrl !== undefined ? body.imageUrl : undefined,
        storagePath: body.storagePath !== undefined ? body.storagePath : undefined,
      },
      auth.accessToken || undefined
    );

    return NextResponse.json({
      success: true,
      message: result.message || 'Layanan berhasil diperbarui.',
      service: result.service,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memperbarui layanan partner.';
    const isDuplicate = message.toLowerCase().includes('duplikasi') || message.toLowerCase().includes('sudah terdaftar');
    const isNotFound = message.toLowerCase().includes('tidak ditemukan');

    if (isDuplicate) {
      return NextResponse.json({ success: false, message }, { status: 409 });
    }
    if (isNotFound) {
      return NextResponse.json({ success: false, message }, { status: 404 });
    }
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
