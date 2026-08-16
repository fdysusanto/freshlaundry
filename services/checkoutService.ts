import { Order, OrderStatus, PaymentStatus, ServiceType } from '@/types/order';
import { UserProfile } from '@/types/user';
import { orderService } from './orderService';
import { paymentService } from './paymentService';
import { pricingService, PricingCalculationResult } from './pricingService';
import { supabase, isSupabaseConfigured } from './supabase';

import { AddressSnapshot } from '@/types/address';

export interface CheckoutItemInput {
  serviceId: string;
  quantity: number;
  unitPrice?: number; // IGNORED for calculation, server pricing engine is authoritative!
}

export interface CreateCheckoutInput {
  laundryId: string;
  items: CheckoutItemInput[];
  pickupAddress: string;
  deliveryAddress?: string;
  pickupAddressSnapshot?: AddressSnapshot;
  deliveryAddressSnapshot?: AddressSnapshot;
  pickupDate: string;
  pickupTimeSlot: string;
  notes?: string;
  voucherCode?: string;
  idempotencyKey: string;
  serviceType?: ServiceType;
  estimatedWeightKg?: number;
  paymentMethod?: string;
  clientSuppliedTotal?: number; // IGNORED for calculation!
}

export interface CheckoutResult {
  success: boolean;
  isDuplicate: boolean;
  order: {
    id: string;
    trackingNumber: string;
    laundryId: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    createdAt: string;
  };
  pricing: {
    subtotal: number;
    deliveryFee: number;
    platformFee: number;
    discount: number;
    totalPrice: number;
    itemsBreakdown: {
      serviceId: string;
      serviceName: string;
      unitPrice: number;
      quantity: number;
      subtotal: number;
    }[];
  };
  payment: {
    id: string;
    status: PaymentStatus;
    provider: string;
    providerReference?: string;
    qrCodeUrl?: string;
    expiresAt?: string;
  };
}

export const checkoutService = {
  /**
   * Consolidated Authoritative Order Checkout.
   * Orchestrates: Idempotency -> Service Validation -> Pricing Engine -> Order Creation -> Price Snapshot -> Payment Initiation.
   */
  async processCheckoutAsync(input: CreateCheckoutInput, customer: UserProfile, client?: any): Promise<CheckoutResult> {
    // 0. AUTHORIZATION GUARD: Role MUST be customer
    if (!customer || customer.role !== 'customer') {
      throw new Error('Akses Ditolak: Hanya akun dengan peran Customer yang dapat membuat pesanan.');
    }

    // 1. Input Validation
    if (!input.laundryId) {
      throw new Error('Validasi Checkout Gagal: laundryId wajib dipilih.');
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('Validasi Checkout Gagal: Order wajib memiliki minimal 1 item layanan.');
    }

    const cleanIdempotencyKey = (input.idempotencyKey || '').trim();
    if (!cleanIdempotencyKey) {
      throw new Error('Validasi Checkout Gagal: idempotencyKey wajib disertakan oleh client.');
    }

    // 2. IDEMPOTENCY CHECK: Search for existing order with this idempotency_key
    const existingOrder = await this.getExistingOrderByIdempotencyKey(cleanIdempotencyKey, client);
    if (existingOrder) {
      // Re-use active payment attempt or create one if unpaid
      let paymentAttempt = await paymentService.getActivePaymentForOrderAsync(existingOrder.id);
      if (!paymentAttempt) {
        paymentAttempt = await paymentService.createPaymentAttemptAsync(existingOrder.id, input.paymentMethod || 'qris', undefined, client);
      }

      return {
        success: true,
        isDuplicate: true,
        order: {
          id: existingOrder.id,
          trackingNumber: existingOrder.trackingNumber,
          laundryId: existingOrder.laundryId || input.laundryId,
          status: existingOrder.status,
          paymentStatus: existingOrder.paymentStatus,
          createdAt: existingOrder.createdAt,
        },
        pricing: {
          subtotal: existingOrder.subtotal ?? existingOrder.totalPrice,
          deliveryFee: existingOrder.deliveryFee ?? 0,
          platformFee: existingOrder.platformFee ?? 2000,
          discount: existingOrder.discount ?? 0,
          totalPrice: existingOrder.totalPrice,
          itemsBreakdown: (existingOrder.items || []).map((i) => ({
            serviceId: i.serviceId || '',
            serviceName: i.name,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            subtotal: i.subtotal || i.unitPrice * i.quantity,
          })),
        },
        payment: {
          id: paymentAttempt.id,
          status: paymentAttempt.status,
          provider: paymentAttempt.provider,
          providerReference: paymentAttempt.providerReference,
          qrCodeUrl: paymentAttempt.providerReference ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${paymentAttempt.providerReference}` : undefined,
          expiresAt: paymentAttempt.expiresAt,
        },
      };
    }

    // 3. AUTHORITATIVE PRICING ENGINE CALCULATION & MULTI-TENANT VALIDATION
    // Ignores client unit prices completely!
    const pricingRes: PricingCalculationResult = await pricingService.calculateOrderPricingAsync({
      laundryId: input.laundryId,
      items: input.items.map((i) => ({ serviceId: i.serviceId, quantity: i.quantity })),
      pickupAddress: input.pickupAddress,
      deliveryAddress: input.deliveryAddress || input.pickupAddress,
      discountCode: input.voucherCode,
    });

    // 4. ATOMIC ORDER CREATION & ITEM PRICE SNAPSHOTTING
    const createPayload = {
      laundryId: input.laundryId,
      serviceType: input.serviceType || 'kiloan',
      pickupAddress: input.pickupAddress,
      deliveryAddress: input.deliveryAddress || input.pickupAddress,
      pickupAddressSnapshot: input.pickupAddressSnapshot,
      deliveryAddressSnapshot: input.deliveryAddressSnapshot || input.pickupAddressSnapshot,
      pickupDate: input.pickupDate,
      pickupTimeSlot: input.pickupTimeSlot,
      estimatedWeightKg: input.estimatedWeightKg,
      notes: input.notes,
      voucherCode: input.voucherCode,
      idempotencyKey: cleanIdempotencyKey,
      items: pricingRes.items.map((b) => ({
        serviceId: b.serviceId,
        name: b.serviceName,
        quantity: b.quantity,
        unitPrice: b.unitPrice,
        unit: b.unit,
        subtotal: b.subtotal,
      })),
    };

    const newOrder = await orderService.createOrderAsync(createPayload, customer, client);

    // 5. INITIAL PAYMENT ATTEMPT CREATION (Uses Authoritative order.totalPrice)
    const paymentAttempt = await paymentService.createPaymentAttemptAsync(
      newOrder.id,
      input.paymentMethod || 'qris',
      undefined,
      client
    );

    // 6. RETURN CONSOLIDATED CHECKOUT RESULT
    return {
      success: true,
      isDuplicate: false,
      order: {
        id: newOrder.id,
        trackingNumber: newOrder.trackingNumber,
        laundryId: newOrder.laundryId || input.laundryId,
        status: newOrder.status,
        paymentStatus: newOrder.paymentStatus,
        createdAt: newOrder.createdAt,
      },
      pricing: {
        subtotal: pricingRes.subtotal,
        deliveryFee: pricingRes.deliveryFee,
        platformFee: pricingRes.platformFee,
        discount: pricingRes.discount,
        totalPrice: pricingRes.totalPrice,
        itemsBreakdown: pricingRes.items.map((i) => ({
          serviceId: i.serviceId,
          serviceName: i.serviceName,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          subtotal: i.subtotal,
        })),
      },
      payment: {
        id: paymentAttempt.id,
        status: paymentAttempt.status,
        provider: paymentAttempt.provider,
        providerReference: paymentAttempt.providerReference,
        qrCodeUrl: paymentAttempt.providerReference ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${paymentAttempt.providerReference}` : undefined,
        expiresAt: paymentAttempt.expiresAt,
      },
    };
  },

  /**
   * Looks up an existing order by idempotency key.
   */
  async getExistingOrderByIdempotencyKey(idempotencyKey: string, client?: any): Promise<Order | null> {
    if (!idempotencyKey) return null;

    const db = client || supabase;
    if (!isSupabaseConfigured || !db) {
      const mockOrders = orderService.getOrders();
      return mockOrders.find((o) => o.idempotencyKey === idempotencyKey) || null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db.from('orders') as any)
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (error || !data) return null;

    return orderService.getOrderByIdAsync(data.id);
  },
};
