import { NextRequest, NextResponse } from 'next/server';
import { dispatchService } from '@/services/dispatchService';

export const runtime = 'nodejs';

/**
 * Server-Side Cron API Endpoint for Dispatch Engine Expired Batches Processing.
 * Secured via `x-cron-secret` request header check.
 */
export async function POST(request: NextRequest) {
  const receivedSecret = request.headers.get('x-cron-secret') || '';
  const configuredSecret = process.env.CRON_SECRET || 'freshlaundry_cron_secret_2026';

  if (!receivedSecret || receivedSecret !== configuredSecret) {
    return NextResponse.json(
      { success: false, message: 'Autentikasi Cron Secret tidak valid.' },
      { status: 401 }
    );
  }

  try {
    await dispatchService.processExpiredDispatchBatchesAsync();
    return NextResponse.json(
      {
        success: true,
        message: 'Worker pemrosesan batch expired berhasil dijalankan.',
        processedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[CRON-EXPIRED-BATCHES-ERROR]', err.message);
    return NextResponse.json(
      { success: false, message: 'Gagal memproses batch expired.', error: err.message },
      { status: 500 }
    );
  }
}
