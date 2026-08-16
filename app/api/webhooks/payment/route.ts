import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/services/paymentService';
import { createServiceRoleClient } from '@/services/supabase';
import { PaymentStatus } from '@/types/payment';

export const runtime = 'nodejs';

/**
 * Production Inbound Webhook Endpoint for Xendit Payment Gateway Callbacks.
 * Enforces timing-safe token verification, idempotency logging, amount integrity,
 * service_role isolation, and atomic payment state transitions.
 */
export async function POST(request: NextRequest) {
  // 1. WEBHOOK AUTHENTICATION (x-callback-token)
  const receivedToken = request.headers.get('x-callback-token') || '';
  const configuredToken = process.env.XENDIT_WEBHOOK_TOKEN || '';

  if (!configuredToken) {
    console.error('[WEBHOOK-SECURITY-ERROR] XENDIT_WEBHOOK_TOKEN tidak dikonfigurasi di environment variables.');
    return NextResponse.json(
      { success: false, message: 'Konfigurasi server webhook tidak valid.' },
      { status: 500 }
    );
  }

  if (!receivedToken) {
    return NextResponse.json(
      { success: false, message: 'Header x-callback-token tidak ditemukan.' },
      { status: 401 }
    );
  }

  const bufReceived = Buffer.from(receivedToken);
  const bufConfigured = Buffer.from(configuredToken);

  if (
    bufReceived.length !== bufConfigured.length ||
    !timingSafeEqual(bufReceived, bufConfigured)
  ) {
    return NextResponse.json(
      { success: false, message: 'Autentikasi token webhook Xendit tidak valid.' },
      { status: 401 }
    );
  }

  // 2. RAW BODY & JSON PARSING
  let body: any;
  try {
    const rawText = await request.text();
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json(
      { success: false, message: 'Format payload webhook tidak valid (JSON Parse Error).' },
      { status: 400 }
    );
  }

  // 3. PAYLOAD FIELD EXTRACTION
  const data = body.data || body;
  const eventId =
    body.event_id ||
    body.id ||
    (data.id && data.status ? `${data.id}_${data.status}` : null) ||
    (data.external_id && data.status ? `${data.external_id}_${data.status}` : null);

  const providerReference = data.id || data.external_id || body.provider_reference;
  const rawStatus = (data.status || body.status || '').toUpperCase();
  const incomingAmount = Number(data.paid_amount || data.amount || body.amount || 0);
  const currency = (data.currency || body.currency || 'IDR').toUpperCase();

  if (!eventId || !providerReference) {
    return NextResponse.json(
      { success: false, message: 'Payload webhook tidak lengkap (missing event_id / provider_reference).' },
      { status: 400 }
    );
  }

  if (currency !== 'IDR') {
    return NextResponse.json(
      { success: false, message: `Mata uang '${currency}' tidak didukung. Hanya 'IDR' yang diperbolehkan.` },
      { status: 400 }
    );
  }

  // 4. EVENT STATUS MAPPING
  let targetStatus: PaymentStatus;
  if (rawStatus === 'PAID' || rawStatus === 'SETTLED') {
    targetStatus = 'paid';
  } else if (rawStatus === 'EXPIRED') {
    targetStatus = 'expired';
  } else if (rawStatus === 'PENDING') {
    targetStatus = 'pending';
  } else {
    return NextResponse.json(
      { success: false, message: `Status provider '${rawStatus}' tidak didukung atau tidak relevan.` },
      { status: 400 }
    );
  }

  // 5. SERVER-SIDE SERVICE ROLE EXECUTION
  try {
    const adminClient = createServiceRoleClient();
    const result = await paymentService.processXenditWebhookAsync({
      eventId,
      providerReference,
      targetStatus,
      incomingAmount,
      rawPayload: body,
      client: adminClient,
    });

    if (result.idempotent) {
      return NextResponse.json(
        { success: true, idempotent: true, message: 'Event webhook telah diproses sebelumnya.' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: true, message: `Status pembayaran berhasil diperbarui ke '${targetStatus}'.` },
      { status: 200 }
    );
  } catch (err: any) {
    const errorMsg = err.message || '';
    if (errorMsg.includes('tidak ditemukan')) {
      return NextResponse.json({ success: false, message: errorMsg }, { status: 404 });
    }
    if (errorMsg.includes('Validasi Jumlah') || errorMsg.includes('Provider mismatch')) {
      return NextResponse.json({ success: false, message: errorMsg }, { status: 400 });
    }

    console.error('[WEBHOOK-PROCESSING-ERROR]', errorMsg);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan internal saat memproses webhook.' },
      { status: 500 }
    );
  }
}
