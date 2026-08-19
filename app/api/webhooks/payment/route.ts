import { createHash, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/services/paymentService';
import { createServiceRoleClient } from '@/services/supabase';
import { PaymentStatus } from '@/types/payment';

export const runtime = 'nodejs';

/**
 * Production Inbound Webhook Endpoint for Payment Gateway Callbacks.
 * Supports Midtrans Notification Webhooks (SHA-512 Cryptographic Signature Verification)
 * as well as legacy Xendit Callbacks.
 */
export async function POST(request: NextRequest) {
  // 1. RAW BODY & JSON PARSING
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

  // 2. DETECT PROVIDER: MIDTRANS NOTIFICATION WEBHOOK
  const isMidtransNotification = Boolean(body.signature_key && body.order_id && body.transaction_status);

  if (isMidtransNotification) {
    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
    if (!serverKey) {
      console.error('[WEBHOOK-SECURITY-ERROR] MIDTRANS_SERVER_KEY tidak dikonfigurasi di environment variables.');
      return NextResponse.json(
        { success: false, message: 'Konfigurasi server webhook tidak valid.' },
        { status: 500 }
      );
    }

    const receivedSignature = body.signature_key || '';
    const orderId = body.order_id || '';
    const statusCode = body.status_code || '';
    const grossAmount = body.gross_amount || '';

    if (!orderId || !statusCode || !grossAmount || !receivedSignature) {
      return NextResponse.json(
        { success: false, message: 'Payload webhook Midtrans tidak lengkap (missing signature_key/order_id/status_code/gross_amount).' },
        { status: 400 }
      );
    }

    // SHA-512 Signature Calculation: SHA512(order_id + status_code + gross_amount + ServerKey)
    const payloadToHash = orderId + statusCode + grossAmount + serverKey;
    const calculatedSignature = createHash('sha512').update(payloadToHash).digest('hex');

    const bufCalculated = Buffer.from(calculatedSignature);
    const bufReceived = Buffer.from(receivedSignature);

    if (
      bufCalculated.length !== bufReceived.length ||
      !timingSafeEqual(bufCalculated, bufReceived)
    ) {
      return NextResponse.json(
        { success: false, message: 'Autentikasi tanda tangan (signature) webhook Midtrans tidak valid.' },
        { status: 401 }
      );
    }

    // Map Midtrans transaction_status & fraud_status to canonical PaymentStatus
    const transactionStatus = (body.transaction_status || '').toLowerCase();
    const fraudStatus = (body.fraud_status || '').toLowerCase();
    let targetStatus: PaymentStatus;

    if (transactionStatus === 'settlement') {
      targetStatus = 'paid';
    } else if (transactionStatus === 'capture') {
      targetStatus = fraudStatus === 'challenge' ? 'pending' : 'paid';
    } else if (transactionStatus === 'pending') {
      targetStatus = 'pending';
    } else if (transactionStatus === 'deny' || transactionStatus === 'cancel' || transactionStatus === 'failure') {
      targetStatus = 'failed';
    } else if (transactionStatus === 'expire') {
      targetStatus = 'expired';
    } else {
      return NextResponse.json(
        { success: false, message: `Status provider '${transactionStatus}' tidak didukung atau tidak relevan.` },
        { status: 400 }
      );
    }

    const incomingAmount = parseFloat(grossAmount);
    if (isNaN(incomingAmount) || incomingAmount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Nominal gross_amount webhook tidak valid.' },
        { status: 400 }
      );
    }

    // Deterministic Event ID for Webhook Idempotency Deduplication
    const eventId = body.transaction_id
      ? `${body.transaction_id}_${transactionStatus}`
      : `${orderId}_${statusCode}_${transactionStatus}`;

    try {
      const adminClient = createServiceRoleClient();
      const result = await paymentService.processMidtransWebhookAsync({
        eventId,
        providerReference: orderId,
        targetStatus,
        incomingAmount,
        rawPayload: body,
        client: adminClient,
      });

      if (result.idempotent) {
        return NextResponse.json(
          { success: true, idempotent: true, message: 'Event webhook Midtrans telah diproses sebelumnya.' },
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

      console.error('[MIDTRANS-WEBHOOK-ERROR]', errorMsg);
      return NextResponse.json(
        { success: false, message: 'Terjadi kesalahan internal saat memproses webhook Midtrans.' },
        { status: 500 }
      );
    }
  }

  // 3. FALLBACK: LEGACY XENDIT WEBHOOK CALLBACK
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

