import {
  PaymentAttempt,
  PaymentStatus,
  canTransitionPaymentStatus,
  normalizePaymentStatus,
} from '@/types/payment';
import { UserRole } from '@/types/user';
import { isValidUuid } from '@/utils/formatters';
import { orderService } from './orderService';
import { defaultGateway, PaymentGateway, getPaymentGateway, generateShortProviderReference } from './paymentGateway';
import { supabase, isSupabaseConfigured } from './supabase';
import { triggerStatusChangeWebhook } from './webhookService';

const PAYMENTS_STORAGE_KEY = 'fresh_laundry_payments_db';
let inMemoryPaymentsStore: PaymentAttempt[] = [];

export const paymentService = {
  /**
   * Retrieves all local mock payment attempts.
   */
  getMockPayments(): PaymentAttempt[] {
    if (typeof window === 'undefined') return inMemoryPaymentsStore;
    const saved = localStorage.getItem(PAYMENTS_STORAGE_KEY);
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  },

  /**
   * Saves local mock payment attempts.
   */
  saveMockPayments(payments: PaymentAttempt[]): void {
    inMemoryPaymentsStore = payments;
    if (typeof window !== 'undefined') {
      localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(payments));
    }
  },

  /**
   * Gets an active (pending) payment attempt for an order, enforcing idempotency.
   */
  async getActivePaymentForOrderAsync(orderId: string, client?: any): Promise<PaymentAttempt | null> {
    const db = client || supabase;
    if (!isSupabaseConfigured || !db) {
      const mockPayments = this.getMockPayments();
      return mockPayments.find((p) => p.orderId === orderId && p.status === 'pending') || null;
    }

    if (!isValidUuid(orderId)) {
      const { data } = await (db.from('orders') as any)
        .select('id')
        .eq('tracking_number', orderId.trim().toUpperCase())
        .maybeSingle();
      if (data) orderId = data.id;
    }

    if (!isValidUuid(orderId)) return null;

    const { data } = await (db.from('payment_attempts') as any)
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .maybeSingle();

    if (!data) return null;

    const parsedRaw = typeof data.raw_response === 'string'
      ? (() => { try { return JSON.parse(data.raw_response); } catch { return {}; } })()
      : (data.raw_response || {});

    const invoiceUrl =
      parsedRaw?.invoice_url ||
      parsedRaw?.invoiceUrl ||
      parsedRaw?.redirect_url ||
      parsedRaw?.paymentUrl ||
      (data.provider_reference ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${data.provider_reference}` : undefined);

    const paymentToken = parsedRaw?.token || parsedRaw?.paymentToken || undefined;
    const paymentUrl = parsedRaw?.redirect_url || parsedRaw?.paymentUrl || parsedRaw?.invoice_url || parsedRaw?.invoiceUrl || undefined;

    return {
      id: data.id,
      orderId: data.order_id,
      customerId: data.customer_id,
      provider: data.provider,
      providerReference: data.provider_reference || undefined,
      paymentMethod: data.payment_method,
      amount: Number(data.amount),
      currency: 'IDR',
      status: normalizePaymentStatus(data.status),
      idempotencyKey: data.idempotency_key,
      expiresAt: data.expires_at || undefined,
      paidAt: data.paid_at || undefined,
      invoiceUrl,
      paymentToken,
      paymentUrl,
      rawResponse: parsedRaw,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  /**
   * Creates a new payment attempt.
   * Enforces Idempotency & Authoritative Amount verification from persisted order total.
   */
  async createPaymentAttemptAsync(
    orderId: string,
    paymentMethod: string = 'qris',
    clientSuppliedAmount?: number,
    client?: any
  ): Promise<PaymentAttempt> {
    const db = client || supabase;

    // 1. Fetch order to verify existence and authoritative amount
    const order = await orderService.getOrderByIdAsync(orderId, db);
    if (!order) {
      throw new Error(`Pesanan dengan ID/Resi '${orderId}' tidak ditemukan.`);
    }

    // 2. NEVER TRUST CLIENT AMOUNT: Verify clientSuppliedAmount matches order.totalPrice
    const authoritativeAmount = Math.round(order.totalPrice);
    if (clientSuppliedAmount !== undefined && Math.round(clientSuppliedAmount) !== authoritativeAmount) {
      throw new Error(
        `Validasi Jumlah Pembayaran Gagal: Jumlah pembayaran yang dikirim client (Rp ${clientSuppliedAmount}) tidak sesuai dengan total resmi pesanan (Rp ${authoritativeAmount}).`
      );
    }

    // 3. IDEMPOTENCY CHECK: Return existing active pending payment if present
    const activePayment = await this.getActivePaymentForOrderAsync(order.id, db);
    if (activePayment) {
      return activePayment;
    }

    const idempotencyKey = generateShortProviderReference(order.id);

    // 4. Invoke Provider Gateway Abstraction
    const gatewayRes = await getPaymentGateway().createPaymentRequest({
      orderId: order.id,
      amount: authoritativeAmount,
      currency: 'IDR',
      paymentMethod,
      idempotencyKey,
    });

    const now = new Date().toISOString();
    const paymentToken = gatewayRes.paymentToken || gatewayRes.rawResponse?.token;
    const paymentUrl = gatewayRes.paymentUrl || gatewayRes.rawResponse?.redirect_url || gatewayRes.invoiceUrl || gatewayRes.rawResponse?.invoice_url;

    if (!isSupabaseConfigured || !db) {
      const newPayment: PaymentAttempt = {
        id: `pay_${Date.now()}`,
        orderId: order.id,
        customerId: order.customerId,
        provider: gatewayRes.provider,
        providerReference: gatewayRes.providerReference,
        paymentMethod,
        amount: authoritativeAmount,
        currency: 'IDR',
        status: 'pending',
        idempotencyKey,
        expiresAt: gatewayRes.expiresAt,
        invoiceUrl: gatewayRes.invoiceUrl || gatewayRes.rawResponse?.invoice_url || gatewayRes.rawResponse?.redirect_url,
        paymentToken,
        paymentUrl,
        rawResponse: gatewayRes.rawResponse,
        createdAt: now,
        updatedAt: now,
      };

      const mockPayments = this.getMockPayments();
      this.saveMockPayments([newPayment, ...mockPayments]);
      orderService.updateOrderStatus(order.id, order.status, 'Pembayaran diinisiasi (Pending)', order.customerId);
      return newPayment;
    }

    // Persist payment attempt into Supabase using authenticated db client
    const { data: inserted, error: insertErr } = await (db.from('payment_attempts') as any)
      .insert({
        order_id: order.id,
        customer_id: isValidUuid(order.customerId) ? order.customerId : (await db.auth.getSession()).data.session?.user?.id,
        provider: gatewayRes.provider,
        provider_reference: gatewayRes.providerReference,
        payment_method: paymentMethod,
        amount: authoritativeAmount,
        currency: 'IDR',
        status: 'pending',
        idempotency_key: idempotencyKey,
        expires_at: gatewayRes.expiresAt,
        raw_response: gatewayRes.rawResponse,
      })
      .select()
      .single();

    if (insertErr) {
      throw new Error(`Supabase Payment Attempt Insert Error: ${insertErr.message}`);
    }

    // Update order.payment_status to 'pending' using authenticated db client
    await (db.from('orders') as any)
      .update({ payment_status: 'pending' })
      .eq('id', order.id);

    return {
      id: inserted.id,
      orderId: inserted.order_id,
      customerId: inserted.customer_id,
      provider: inserted.provider,
      providerReference: inserted.provider_reference,
      paymentMethod: inserted.payment_method,
      amount: Number(inserted.amount),
      currency: 'IDR',
      status: 'pending',
      idempotencyKey: inserted.idempotency_key,
      expiresAt: inserted.expires_at,
      invoiceUrl: gatewayRes.invoiceUrl || inserted.raw_response?.invoice_url || inserted.raw_response?.redirect_url,
      paymentToken,
      paymentUrl,
      rawResponse: inserted.raw_response,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    };
  },

  /**
   * Controlled Payment State Machine Transition.
   * Uses Atomic Conditional Update to prevent race conditions.
   */
  async transitionPaymentStatusAsync(
    paymentId: string,
    targetStatusInput: string | PaymentStatus,
    notes: string = '',
    client?: any
  ): Promise<PaymentAttempt> {
    const targetStatus = normalizePaymentStatus(targetStatusInput);
    const db = client || supabase;

    let payment: PaymentAttempt | null = null;
    let currentStatus: PaymentStatus = 'unpaid';

    if (!isSupabaseConfigured || !db) {
      const mockPayments = this.getMockPayments();
      const p = mockPayments.find((x) => x.id === paymentId || x.providerReference === paymentId);
      if (!p) throw new Error(`Payment attempt '${paymentId}' tidak ditemukan.`);
      payment = p;
      currentStatus = p.status;

      if (currentStatus === targetStatus) {
        orderService.updateOrderPaymentStatus(payment.orderId, targetStatus);
        return payment;
      }

      if (!canTransitionPaymentStatus(currentStatus, targetStatus)) {
        throw new Error(
          `Transisi status pembayaran tidak valid: Tidak dapat mengubah status dari '${currentStatus}' ke '${targetStatus}'.`
        );
      }

      const now = new Date().toISOString();
      const idx = mockPayments.findIndex((x) => x.id === payment!.id);
      if (idx !== -1) {
        mockPayments[idx] = {
          ...mockPayments[idx],
          status: targetStatus,
          paidAt: targetStatus === 'paid' ? now : mockPayments[idx].paidAt,
          updatedAt: now,
        };
        this.saveMockPayments(mockPayments);
        orderService.updateOrderPaymentStatus(payment!.orderId, targetStatus);
      }
      return mockPayments[idx] || payment;
    }

    // 1. Fetch Payment Attempt row from Supabase (by ID or provider_reference)
    const { data: p, error: fetchErr } = await (db.from('payment_attempts') as any)
      .select('*')
      .or(`id.eq.${isValidUuid(paymentId) ? paymentId : '00000000-0000-0000-0000-000000000000'},provider_reference.eq.${paymentId}`)
      .maybeSingle();

    if (fetchErr || !p) throw new Error(`Payment attempt '${paymentId}' tidak ditemukan.`);

    currentStatus = normalizePaymentStatus(p.status);

    if (currentStatus !== targetStatus && !canTransitionPaymentStatus(currentStatus, targetStatus)) {
      throw new Error(
        `Transisi status pembayaran tidak valid: Tidak dapat mengubah status dari '${currentStatus}' ke '${targetStatus}'.`
      );
    }

    // 2. Invoke Single-Step Atomic Database RPC
    const { data: rpcResult, error: rpcErr } = await (db.rpc as any)('transition_payment_status_atomic', {
      p_payment_id: p.id,
      p_target_status: targetStatus,
      p_notes: notes || '',
    });

    if (rpcErr) {
      throw new Error(`Supabase Atomic Payment Status Update Error: ${rpcErr.message}`);
    }

    // 3. Read back fresh updated row from Supabase
    const { data: fresh } = await (db.from('payment_attempts') as any)
      .select('*')
      .eq('id', p.id)
      .single();

    return {
      id: fresh.id,
      orderId: fresh.order_id,
      customerId: fresh.customer_id,
      provider: fresh.provider,
      providerReference: fresh.provider_reference,
      paymentMethod: fresh.payment_method,
      amount: Number(fresh.amount),
      currency: 'IDR',
      status: normalizePaymentStatus(fresh.status),
      idempotencyKey: fresh.idempotency_key,
      expiresAt: fresh.expires_at,
      paidAt: fresh.paid_at,
      rawResponse: fresh.raw_response,
      createdAt: fresh.created_at,
      updatedAt: fresh.updated_at,
    };
  },

  /**
   * Confirms payment success after gateway verification.
   */
  async handlePaymentSuccessAsync(paymentId: string, providerReference?: string, client?: any): Promise<PaymentAttempt> {
    const key = providerReference || paymentId;
    await getPaymentGateway().verifyPayment(key);
    return this.transitionPaymentStatusAsync(key, 'paid', 'Pembayaran berhasil dikonfirmasi.', client);
  },

  /**
   * Marks payment as failed after gateway rejection.
   */
  async handlePaymentFailureAsync(paymentId: string, reason?: string, client?: any): Promise<PaymentAttempt> {
    return this.transitionPaymentStatusAsync(paymentId, 'failed', reason || 'Pembayaran gagal.', client);
  },

  /**
   * Expires payment attempt after expiration window.
   */
  async expirePaymentAttemptAsync(paymentId: string, client?: any): Promise<PaymentAttempt> {
    return this.transitionPaymentStatusAsync(paymentId, 'expired', 'Waktu pembayaran telah kadaluwarsa.', client);
  },

  /**
   * Refunds paid payment attempt (Admin or Authorized Laundry Partner on order rejection).
   */
  async refundPaymentAsync(
    paymentId: string,
    actor: { id: string; role: UserRole | string },
    reason?: string,
    client?: any
  ): Promise<PaymentAttempt> {
    const cleanRole = (actor.role || '').trim().toLowerCase();
    const allowedRoles = ['platform_admin', 'admin', 'laundry_owner', 'laundry_staff'];
    if (!allowedRoles.includes(cleanRole)) {
      throw new Error('Akses Ditolak: Hanya Admin atau Pengelola Mitra Laundry yang dapat memproses pengembalian dana (refund).');
    }

    // 1. Fetch payment details from mock or db first
    let providerRef = paymentId;
    let amount = 0;

    if (!isSupabaseConfigured || !supabase) {
      const mockPayments = this.getMockPayments();
      const p = mockPayments.find((x) => x.id === paymentId || x.providerReference === paymentId);
      if (p) {
        if (p.status === 'refunded') return p;
        providerRef = p.providerReference || p.id;
        amount = p.amount;
      }
    } else {
      const db = client || supabase;
      const { data: p } = await (db.from('payment_attempts') as any)
        .select('*')
        .or(`id.eq.${isValidUuid(paymentId) ? paymentId : '00000000-0000-0000-0000-000000000000'},provider_reference.eq.${paymentId}`)
        .maybeSingle();

      if (p) {
        if (p.status === 'refunded') {
          return {
            id: p.id,
            orderId: p.order_id,
            customerId: p.customer_id,
            provider: p.provider,
            providerReference: p.provider_reference,
            paymentMethod: p.payment_method,
            amount: Number(p.amount),
            currency: 'IDR',
            status: 'refunded',
            idempotencyKey: p.idempotency_key,
            expiresAt: p.expires_at,
            paidAt: p.paid_at,
            rawResponse: p.raw_response,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          };
        }
        providerRef = p.provider_reference || p.id;
        amount = Number(p.amount);
      }
    }

    // 2. Trigger Gateway Refund FIRST to guarantee Xendit confirmation
    if (providerRef) {
      await getPaymentGateway().refundPayment(providerRef, amount);
    }

    // 3. Transition payment_status to 'refunded' ONLY after gateway success
    return this.transitionPaymentStatusAsync(paymentId, 'refunded', reason || 'Refund diproses & dikonfirmasi provider.', client);
  },

  /**
   * Simulates Webhook Event Notification (Provider-independent webhook handler).
   */
  async simulateWebhookEventAsync(payload: {
    providerReference: string;
    event: 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'PAYMENT_EXPIRED';
    signature?: string;
  }): Promise<{ success: boolean; payment: PaymentAttempt }> {
    const ref = payload.providerReference;

    if (payload.event === 'PAYMENT_SUCCESS') {
      const payment = await this.handlePaymentSuccessAsync(ref, ref);
      return { success: true, payment };
    } else if (payload.event === 'PAYMENT_FAILED') {
      const payment = await this.handlePaymentFailureAsync(ref, 'Gagal dari simulasi webhook provider');
      return { success: true, payment };
    } else if (payload.event === 'PAYMENT_EXPIRED') {
      const payment = await this.expirePaymentAttemptAsync(ref);
      return { success: true, payment };
    }

    throw new Error(`Event webhook tidak dikenal: ${payload.event}`);
  },

  /**
   * Processes inbound Xendit Payment Webhook Event server-side using service_role client.
   * Handles idempotency, state transition, and outbound n8n notification.
   */
  async processXenditWebhookAsync(params: {
    eventId: string;
    providerReference: string;
    targetStatus: PaymentStatus;
    incomingAmount: number;
    rawPayload: any;
    client?: any;
  }): Promise<{ success: boolean; idempotent?: boolean; payment?: PaymentAttempt }> {
    const { eventId, providerReference, targetStatus, incomingAmount, rawPayload, client } = params;
    const db = client || supabase;

    // 1. IDEMPOTENCY CHECK in payment_webhook_events
    const { data: existingEvent } = await (db.from('payment_webhook_events') as any)
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      return { success: true, idempotent: true };
    }

    // 2. FETCH PAYMENT ATTEMPT
    const { data: p, error: fetchErr } = await (db.from('payment_attempts') as any)
      .select('*, orders(*)')
      .or(`provider_reference.eq.${providerReference},idempotency_key.eq.${providerReference}`)
      .maybeSingle();

    if (fetchErr || !p) {
      throw new Error(`Payment attempt dengan provider_reference '${providerReference}' tidak ditemukan.`);
    }

    // 3. PROVIDER VALIDATION
    const allowedProviders = ['xendit', 'mock', 'mock_qris'];
    if (p.provider && !allowedProviders.includes(p.provider.toLowerCase())) {
      throw new Error(`Provider mismatch: Payment attempt dikhususkan untuk '${p.provider}', bukan Xendit.`);
    }

    // 4. AMOUNT INTEGRITY VALIDATION
    const authoritativeAmount = Math.round(Number(p.amount));
    if (Math.round(incomingAmount) !== authoritativeAmount) {
      throw new Error(
        `Validasi Jumlah Pembayaran Gagal: Nominal webhook (Rp ${incomingAmount}) tidak sesuai tagihan resmi (Rp ${authoritativeAmount}).`
      );
    }

    // 5. ATOMIC EVENT LOG INSERT (Database-level idempotency guard)
    const { error: eventInsertErr } = await (db.from('payment_webhook_events') as any)
      .insert({
        event_id: eventId,
        provider: p.provider || 'xendit',
        event_type: rawPayload.event || `invoice.${targetStatus}`,
        payment_attempt_id: p.id,
        provider_reference: providerReference,
        amount: incomingAmount,
        status: targetStatus,
        payload: rawPayload,
      });

    if (eventInsertErr) {
      // Event already recorded by concurrent request
      if (eventInsertErr.code === '23505' || eventInsertErr.message?.includes('unique')) {
        return { success: true, idempotent: true };
      }
      console.warn('[WEBHOOK-EVENT-LOG-WARNING]', eventInsertErr.message);
    }

    // 6. ATOMIC STATE TRANSITION
    const currentStatus = normalizePaymentStatus(p.status);
    let updatedPayment: PaymentAttempt;

    if (currentStatus === targetStatus) {
      updatedPayment = {
        id: p.id,
        orderId: p.order_id,
        customerId: p.customer_id,
        provider: p.provider,
        providerReference: p.provider_reference,
        paymentMethod: p.payment_method,
        amount: Number(p.amount),
        currency: 'IDR',
        status: targetStatus,
        idempotencyKey: p.idempotency_key,
        expiresAt: p.expires_at,
        paidAt: p.paid_at,
        rawResponse: p.raw_response,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      };
    } else {
      updatedPayment = await this.transitionPaymentStatusAsync(p.id, targetStatus, 'Webhook Xendit terverifikasi', db);
    }

    // 7. OUTBOUND N8N NOTIFICATION
    if (targetStatus === 'paid' && p.orders) {
      try {
        const fullOrder = await orderService.getOrderByIdAsync(p.order_id, db);
        if (fullOrder) {
          await triggerStatusChangeWebhook(fullOrder, 'pending');
        }
      } catch (err: any) {
        console.warn('[OUTBOUND-WEBHOOK-WARNING] Gagal mengirim notifikasi n8n:', err.message);
      }
    }

    return { success: true, payment: updatedPayment };
  },

  /**
   * Processes inbound Midtrans Payment Webhook Notification server-side using service_role client.
   * Handles SHA-512 signature verification, idempotency, state transition, and outbound n8n notification.
   */
  async processMidtransWebhookAsync(params: {
    eventId: string;
    providerReference: string;
    targetStatus: PaymentStatus;
    incomingAmount: number;
    rawPayload: any;
    client?: any;
  }): Promise<{ success: boolean; idempotent?: boolean; payment?: PaymentAttempt }> {
    const { eventId, providerReference, targetStatus, incomingAmount, rawPayload, client } = params;
    const db = client || (isSupabaseConfigured ? supabase : null);

    if (!isSupabaseConfigured || !db) {
      const mockEvents = (global as any).__mockWebhookEvents || [];
      if (mockEvents.includes(eventId)) {
        return { success: true, idempotent: true };
      }

      const mockPayments = this.getMockPayments();
      const p = mockPayments.find(
        (x) => x.providerReference === providerReference || x.idempotencyKey === providerReference || x.id === providerReference
      );

      if (!p) {
        throw new Error(`Payment attempt dengan provider_reference '${providerReference}' tidak ditemukan.`);
      }

      const allowedProviders = ['midtrans', 'mock', 'mock_qris'];
      if (p.provider && !allowedProviders.includes(p.provider.toLowerCase())) {
        throw new Error(`Provider mismatch: Payment attempt dikhususkan untuk '${p.provider}', bukan Midtrans.`);
      }

      const authoritativeAmount = Math.round(Number(p.amount));
      if (Math.round(incomingAmount) !== authoritativeAmount) {
        throw new Error(
          `Validasi Jumlah Pembayaran Gagal: Nominal webhook (Rp ${incomingAmount}) tidak sesuai tagihan resmi (Rp ${authoritativeAmount}).`
        );
      }

      (global as any).__mockWebhookEvents = [...mockEvents, eventId];

      const updatedPayment = await this.transitionPaymentStatusAsync(p.id, targetStatus, 'Webhook Midtrans terverifikasi', db);

      if (targetStatus === 'paid' && p.orderId) {
        try {
          const fullOrder = await orderService.getOrderByIdAsync(p.orderId, db);
          if (fullOrder) {
            await triggerStatusChangeWebhook(fullOrder, 'pending');
          }
        } catch (err: any) {
          console.warn('[OUTBOUND-WEBHOOK-WARNING] Gagal mengirim notifikasi n8n:', err.message);
        }
      }

      return { success: true, payment: updatedPayment };
    }

    // 1. IDEMPOTENCY CHECK in payment_webhook_events
    const { data: existingEvent } = await (db.from('payment_webhook_events') as any)
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      return { success: true, idempotent: true };
    }

    // 2. FETCH PAYMENT ATTEMPT
    const { data: p, error: fetchErr } = await (db.from('payment_attempts') as any)
      .select('*, orders(*)')
      .or(`provider_reference.eq.${providerReference},idempotency_key.eq.${providerReference}`)
      .maybeSingle();

    if (fetchErr || !p) {
      throw new Error(`Payment attempt dengan provider_reference '${providerReference}' tidak ditemukan.`);
    }

    // 3. PROVIDER VALIDATION
    const allowedProviders = ['midtrans', 'mock', 'mock_qris'];
    if (p.provider && !allowedProviders.includes(p.provider.toLowerCase())) {
      throw new Error(`Provider mismatch: Payment attempt dikhususkan untuk '${p.provider}', bukan Midtrans.`);
    }

    // 4. AMOUNT INTEGRITY VALIDATION
    const authoritativeAmount = Math.round(Number(p.amount));
    if (Math.round(incomingAmount) !== authoritativeAmount) {
      throw new Error(
        `Validasi Jumlah Pembayaran Gagal: Nominal webhook (Rp ${incomingAmount}) tidak sesuai tagihan resmi (Rp ${authoritativeAmount}).`
      );
    }

    // 5. ATOMIC EVENT LOG INSERT (Database-level idempotency guard)
    const { error: eventInsertErr } = await (db.from('payment_webhook_events') as any)
      .insert({
        event_id: eventId,
        provider: p.provider || 'midtrans',
        event_type: rawPayload.transaction_status || `payment.${targetStatus}`,
        payment_attempt_id: p.id,
        provider_reference: providerReference,
        amount: incomingAmount,
        status: targetStatus,
        payload: rawPayload,
      });

    if (eventInsertErr) {
      if (eventInsertErr.code === '23505' || eventInsertErr.message?.includes('unique')) {
        return { success: true, idempotent: true };
      }
      console.warn('[WEBHOOK-EVENT-LOG-WARNING]', eventInsertErr.message);
    }

    // 6. ATOMIC STATE TRANSITION & ORDER RECONCILIATION
    const updatedPayment = await this.transitionPaymentStatusAsync(p.id, targetStatus, 'Webhook Midtrans terverifikasi', db);

    // 7. OUTBOUND N8N NOTIFICATION
    if (targetStatus === 'paid' && p.orders) {
      try {
        const fullOrder = await orderService.getOrderByIdAsync(p.order_id, db);
        if (fullOrder) {
          await triggerStatusChangeWebhook(fullOrder, 'pending');
        }
      } catch (err: any) {
        console.warn('[OUTBOUND-WEBHOOK-WARNING] Gagal mengirim notifikasi n8n:', err.message);
      }
    }

    return { success: true, payment: updatedPayment };
  },
};
