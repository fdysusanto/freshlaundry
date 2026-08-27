import { NextRequest, NextResponse } from 'next/server';

export interface CronAuthResult {
  authorized: boolean;
  response?: NextResponse;
}

/**
 * Server-Side Cron Authentication Guard.
 * Verifies inbound Vercel Cron, n8n, or external scheduler requests.
 * Accepts `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret` request headers.
 * Rejects requests with 500 if CRON_SECRET is not configured in server environment.
 * Rejects unauthorized requests with 401.
 */
export function verifyCronAuth(request: NextRequest): CronAuthResult {
  const configuredSecret = (process.env.CRON_SECRET || '').trim();

  if (!configuredSecret) {
    console.error('[CRON-SECURITY-ERROR] CRON_SECRET tidak dikonfigurasi di environment variables.');
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, message: 'Konfigurasi server cron tidak valid (CRON_SECRET belum dikonfigurasi).' },
        { status: 500 }
      ),
    };
  }

  const receivedSecret =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    '';

  if (!receivedSecret || receivedSecret !== configuredSecret) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, message: 'Autentikasi Cron Secret tidak valid.' },
        { status: 401 }
      ),
    };
  }

  return { authorized: true };
}
