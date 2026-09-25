import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, createServiceRoleClient } from '@/services/supabase';
import { isValidUuid } from '@/utils/formatters';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const LAUNDRY_PHOTOS_BUCKET = 'laundry-photos';

async function verifyOwnerAccess(request: Request, targetLaundryId: string): Promise<{ authorized: boolean; userId?: string; error?: string; status?: number }> {
  const authHeader = request.headers.get('authorization') || '';
  let accessToken = '';
  if (authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7).trim();
  }

  // Handle mock mode
  if (!isSupabaseConfigured || !supabase) {
    if (authHeader.includes('mock_customer_token')) {
      return { authorized: false, error: 'Akses Ditolak: Customer tidak diizinkan mengubah foto layanan.', status: 403 };
    }
    return { authorized: true, userId: 'usr_owner_01' };
  }

  if (!accessToken) {
    const { data: { session } } = await supabase.auth.getSession();
    accessToken = session?.access_token || '';
  }

  if (!accessToken) {
    return { authorized: false, error: 'Tidak Terotentikasi. Silakan login terlebih dahulu.', status: 401 };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return { authorized: false, error: 'Sesi otentikasi tidak valid atau telah kedaluwarsa.', status: 401 };
  }

  const userId = userData.user.id;
  const adminClient = createServiceRoleClient();

  // Check if caller is platform_admin
  const { data: profile } = await (adminClient.from('profiles') as any)
    .select('role')
    .eq('id', userId)
    .single();

  if (profile?.role === 'platform_admin' || profile?.role === 'admin') {
    return { authorized: true, userId };
  }

  // Check if caller is owner of targetLaundryId
  const { data: laundryData } = await (adminClient.from('laundries') as any)
    .select('owner_id')
    .eq('id', targetLaundryId)
    .single();

  if (laundryData?.owner_id === userId) {
    return { authorized: true, userId };
  }

  const { data: laundryUser } = await (adminClient.from('laundry_users') as any)
    .select('role, is_active')
    .eq('laundry_id', targetLaundryId)
    .eq('profile_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (laundryUser && (laundryUser.role === 'owner' || laundryUser.role === 'laundry_owner')) {
    return { authorized: true, userId };
  }

  return { authorized: false, error: 'Akses Ditolak: Anda bukan pemilik outlet laundry ini.', status: 403 };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    if (!serviceId) {
      return NextResponse.json({ success: false, message: 'ID layanan tidak valid.' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const laundryId = (formData.get('laundryId') as string) || '';

    if (!file) {
      return NextResponse.json({ success: false, message: 'File gambar wajib disertakan.' }, { status: 400 });
    }
    if (!laundryId) {
      return NextResponse.json({ success: false, message: 'laundryId wajib disertakan.' }, { status: 400 });
    }

    // Verify Authorization
    const authCheck = await verifyOwnerAccess(request, laundryId);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, message: authCheck.error }, { status: authCheck.status || 403 });
    }

    // Validate MIME type
    const mime = file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(mime)) {
      return NextResponse.json(
        { success: false, message: 'Format file tidak didukung. Harap upload gambar JPG, PNG, atau WebP.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, message: 'Ukuran foto melebihi batas maksimal 2 MB.' },
        { status: 400 }
      );
    }

    // Mock Mode fallback
    if (!isSupabaseConfigured || !supabase) {
      const mockUrl = URL.createObjectURL ? URL.createObjectURL(file) : `https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=600&q=80`;
      return NextResponse.json({
        success: true,
        message: 'Foto layanan berhasil disimpan (Mock Mode).',
        data: {
          serviceId,
          imageUrl: mockUrl,
          storagePath: `services/${laundryId}/${serviceId}_mock.webp`,
        },
      });
    }

    const adminClient = createServiceRoleClient();

    // 1. Fetch existing service to know current storage_path
    const { data: existingService, error: fetchErr } = await (adminClient.from('services') as any)
      .select('id, laundry_id, storage_path')
      .eq('id', serviceId)
      .eq('laundry_id', laundryId)
      .single();

    if (fetchErr || !existingService) {
      return NextResponse.json({ success: false, message: 'Layanan tidak ditemukan pada toko laundry ini.' }, { status: 404 });
    }

    const oldStoragePath = existingService.storage_path;

    // 2. Generate unique storage path
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'webp';
    const timestamp = Date.now();
    const newStoragePath = `services/${laundryId}/${serviceId}_${timestamp}.${fileExt}`;

    // 3. Upload binary to storage bucket
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await adminClient.storage
      .from(LAUNDRY_PHOTOS_BUCKET)
      .upload(newStoragePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadErr) {
      return NextResponse.json(
        { success: false, message: `Gagal mengunggah foto ke storage: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    // 4. Retrieve Public URL
    const { data: urlData } = adminClient.storage
      .from(LAUNDRY_PHOTOS_BUCKET)
      .getPublicUrl(newStoragePath);

    const publicUrl = urlData.publicUrl;

    // 5. Update Database Record
    const { error: dbUpdateErr } = await (adminClient.from('services') as any)
      .update({
        image_url: publicUrl,
        storage_path: newStoragePath,
      })
      .eq('id', serviceId)
      .eq('laundry_id', laundryId);

    if (dbUpdateErr) {
      // Cleanup newly uploaded file to avoid orphan
      console.warn('[SERVICE-PHOTO-UPLOAD] DB update failed, rolling back storage file:', newStoragePath);
      await adminClient.storage.from(LAUNDRY_PHOTOS_BUCKET).remove([newStoragePath]);
      return NextResponse.json(
        { success: false, message: `Gagal memperbarui data layanan di database: ${dbUpdateErr.message}` },
        { status: 500 }
      );
    }

    // 6. Delete old file asynchronously if replacing
    if (oldStoragePath && oldStoragePath !== newStoragePath) {
      adminClient.storage
        .from(LAUNDRY_PHOTOS_BUCKET)
        .remove([oldStoragePath])
        .catch((delErr: any) => {
          console.warn('[SERVICE-PHOTO-UPLOAD] Old photo cleanup warning:', delErr?.message);
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Foto layanan berhasil diperbarui.',
      data: {
        serviceId,
        imageUrl: publicUrl,
        storagePath: newStoragePath,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem internal.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const { searchParams } = new URL(request.url);
    const laundryId = searchParams.get('laundryId') || '';

    if (!serviceId || !laundryId) {
      return NextResponse.json({ success: false, message: 'serviceId dan laundryId wajib disertakan.' }, { status: 400 });
    }

    // Verify Authorization
    const authCheck = await verifyOwnerAccess(request, laundryId);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, message: authCheck.error }, { status: authCheck.status || 403 });
    }

    // Mock Mode fallback
    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({
        success: true,
        message: 'Foto layanan berhasil dihapus (Mock Mode).',
        data: { serviceId, imageUrl: null, storagePath: null },
      });
    }

    const adminClient = createServiceRoleClient();

    // Fetch existing service
    const { data: existingService, error: fetchErr } = await (adminClient.from('services') as any)
      .select('id, storage_path')
      .eq('id', serviceId)
      .eq('laundry_id', laundryId)
      .single();

    if (fetchErr || !existingService) {
      return NextResponse.json({ success: false, message: 'Layanan tidak ditemukan.' }, { status: 404 });
    }

    const oldPath = existingService.storage_path;

    // Update DB record
    const { error: dbUpdateErr } = await (adminClient.from('services') as any)
      .update({
        image_url: null,
        storage_path: null,
      })
      .eq('id', serviceId)
      .eq('laundry_id', laundryId);

    if (dbUpdateErr) {
      return NextResponse.json({ success: false, message: `Gagal memperbarui database: ${dbUpdateErr.message}` }, { status: 500 });
    }

    // Remove file from storage if present
    if (oldPath) {
      await adminClient.storage.from(LAUNDRY_PHOTOS_BUCKET).remove([oldPath]);
    }

    return NextResponse.json({
      success: true,
      message: 'Foto layanan berhasil dihapus. Layanan kini menggunakan foto default.',
      data: {
        serviceId,
        imageUrl: null,
        storagePath: null,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem internal.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
