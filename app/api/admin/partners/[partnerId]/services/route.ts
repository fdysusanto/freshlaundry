import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/authHelper';
import { adminPartnerService } from '@/services/adminPartnerService';
import { isValidUuid } from '@/utils/formatters';

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
      return NextResponse.json(
        { success: false, message: 'Akses Ditolak: Hanya Platform Ops Admin yang berhak melihat katalog layanan partner.' },
        { status: 403 }
      );
    }

    const { partnerId } = await params;
    if (!isValidUuid(partnerId)) {
      return NextResponse.json({ success: false, message: 'ID partner tidak valid.' }, { status: 400 });
    }

    const services = await adminPartnerService.getPartnerServicesAsync(partnerId, auth.accessToken || undefined);

    return NextResponse.json({
      success: true,
      services,
      count: services.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memuat katalog layanan partner.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

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
        { success: false, message: 'Akses Ditolak: Hanya Platform Ops Admin yang berhak menambah layanan partner.' },
        { status: 403 }
      );
    }

    const { partnerId } = await params;
    if (!isValidUuid(partnerId)) {
      return NextResponse.json({ success: false, message: 'ID partner tidak valid.' }, { status: 400 });
    }

    const body = await request.json();

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 3) {
      return NextResponse.json({ success: false, message: 'Nama layanan wajib diisi minimal 3 karakter.' }, { status: 400 });
    }
    if (!body.price || Number(body.price) <= 0) {
      return NextResponse.json({ success: false, message: 'Tarif layanan harus lebih besar dari Rp 0.' }, { status: 400 });
    }

    const result = await adminPartnerService.createPartnerServiceAsync(
      partnerId,
      {
        name: body.name.trim(),
        code: body.code || 'kiloan',
        description: body.description,
        category: body.category,
        pricingType: body.pricingType,
        price: Number(body.price),
        unit: body.unit || 'kg',
        minWeight: body.minWeight !== undefined && body.minWeight !== null && body.minWeight !== '' ? Number(body.minWeight) : null,
        estimatedHours: body.estimatedHours ? Number(body.estimatedHours) : 24,
        iconName: body.iconName,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      },
      auth.accessToken || undefined
    );

    return NextResponse.json({
      success: true,
      message: result.message || 'Layanan berhasil ditambahkan.',
      service: result.service,
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal menambahkan layanan partner.';
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
      return NextResponse.json(
        { success: false, message: 'Akses Ditolak: Hanya Platform Ops Admin yang berhak memperbarui layanan partner.' },
        { status: 403 }
      );
    }

    const { partnerId } = await params;
    if (!isValidUuid(partnerId)) {
      return NextResponse.json({ success: false, message: 'ID partner tidak valid.' }, { status: 400 });
    }

    const body = await request.json();
    const serviceId = body.serviceId || body.id;

    if (!serviceId || !isValidUuid(serviceId)) {
      return NextResponse.json({ success: false, message: 'serviceId wajib diisi dan harus berupa UUID valid.' }, { status: 400 });
    }

    // Check if toggle action
    if (body.action === 'toggle' || (body.isActive !== undefined && Object.keys(body).length <= 3)) {
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
