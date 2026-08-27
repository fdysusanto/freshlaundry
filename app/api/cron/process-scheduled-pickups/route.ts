import { NextRequest, NextResponse } from 'next/server';
import { dispatchService } from '@/services/dispatchService';
import { verifyCronAuth } from '@/utils/cronAuth';

export const runtime = 'nodejs';

/**
 * Server-Side Cron API Endpoint for Processing Scheduled Pickups.
 * Triggered periodically (e.g. every 5 minutes) by Vercel Cron, n8n, pg_cron, or external scheduler.
 * Secured via `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>` request header.
 */
export async function POST(request: NextRequest) {
  const auth = verifyCronAuth(request);
  if (!auth.authorized || auth.response) {
    return auth.response!;
  }

  try {
    const summary = await dispatchService.processScheduledPickupsAsync();
    console.log(
      `[PICKUP_SCHEDULER] scanned=${summary.scanned} eligible=${summary.eligible} dispatched=${summary.dispatched} skipped=${summary.skipped} failed=${summary.failed}`
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Pickup scheduler berhasil dijalankan.',
        summary,
        executedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[CRON-PICKUP-SCHEDULER-ERROR]', err.message);
    return NextResponse.json(
      { success: false, message: 'Gagal memproses scheduled pickups.', error: err.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
