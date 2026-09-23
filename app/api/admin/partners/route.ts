import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/authHelper';
import { adminPartnerService } from '@/services/adminPartnerService';
import { isValidCoordinate } from '@/services/locationService';

export async function GET(request: Request) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, message: 'Tidak Terotentikasi: Sesi atau token tidak ditemukan.' },
        { status: 401 }
      );
    }
    if (!auth.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, message: 'Akses Ditolak: Hanya Platform Ops Admin yang dapat melihat data partner.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const verificationStatus = searchParams.get('verificationStatus') || undefined;
    const claimStatus = searchParams.get('claimStatus') || undefined;
    const onboardingStatus = searchParams.get('onboardingStatus') || undefined;
    const cityName = searchParams.get('city') || searchParams.get('cityName') || undefined;
    const searchQuery = searchParams.get('q') || searchParams.get('search') || undefined;

    const partners = await adminPartnerService.getAllPartnersAsync(
      {
        status,
        verificationStatus,
        claimStatus,
        onboardingStatus,
        cityName,
        searchQuery,
      },
      auth.accessToken || undefined
    );

    return NextResponse.json({
      success: true,
      partners,
      count: partners.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memuat data partner.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, message: 'Tidak Terotentikasi: Sesi atau token tidak ditemukan.' },
        { status: 401 }
      );
    }
    if (!auth.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, message: 'Akses Ditolak: Hanya Platform Ops Admin yang dapat membuat listing partner.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, message: 'Validasi Gagal: Nama bisnis laundry wajib diisi.' },
        { status: 400 }
      );
    }

    const rawLat = body.latitude !== undefined && body.latitude !== null && body.latitude !== '' ? Number(body.latitude) : null;
    const rawLng = body.longitude !== undefined && body.longitude !== null && body.longitude !== '' ? Number(body.longitude) : null;

    if (rawLat !== null || rawLng !== null) {
      if (rawLat === null || rawLng === null || isNaN(rawLat) || isNaN(rawLng) || !isValidCoordinate(rawLat, rawLng)) {
        return NextResponse.json(
          { success: false, message: 'Validasi Gagal: Koordinat tidak valid. Latitude (-90 s/d 90) dan Longitude (-180 s/d 180).' },
          { status: 400 }
        );
      }
    }

    const result = await adminPartnerService.createPartnerListingAsync(
      {
        name: body.name,
        category: body.category,
        address: body.address || '-',
        cityName: body.cityName || body.city,
        districtName: body.districtName || body.district,
        latitude: body.latitude,
        longitude: body.longitude,
        phone: body.phone,
        businessEmail: body.businessEmail || body.email,
        legalName: body.legalName,
        notes: body.notes,
      },
      auth.accessToken || undefined
    );

    return NextResponse.json({
      success: true,
      message: 'Listing partner berhasil dibuat dalam status UNCLAIMED / LISTED.',
      data: result,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal membuat listing partner.' },
      { status: 400 }
    );
  }
}
