import {
  CreateOrderPayload,
  Order,
  OrderStatus,
  ServiceType,
  canTransitionOrderStatus,
  canRoleTransitionOrder,
  normalizeOrderStatus,
} from '@/types/order';
import { PaymentStatus } from '@/types/payment';
import { UserProfile } from '@/types/user';
import { SERVICE_CATALOG, DEMO_LAUNDRIES } from '@/utils/constants';
import { generateTrackingId, isValidUuid } from '@/utils/formatters';
import { triggerStatusChangeWebhook } from './webhookService';
import { laundryService } from './laundryService';
import { pricingService, PricingInputItem } from './pricingService';
import { supabase, isSupabaseConfigured } from './supabase';

const ORDERS_STORAGE_KEY = 'fresh_laundry_orders_db';

const INITIAL_MOCK_ORDERS: Order[] = [
  {
    id: 'ord_001',
    trackingNumber: 'LND-K89A2B',
    customerId: 'usr_customer_01',
    customerName: 'Budi Santoso',
    customerPhone: '081234567890',
    laundryId: 'lnd_001',
    laundryName: 'FreshWash Express Kebayoran',
    courierId: 'usr_courier_01',
    courierName: 'Agung Pratama (Kurir 1)',
    serviceType: 'kiloan',
    serviceName: 'Cuci Komplit Kiloan',
    status: 'in_washing',
    items: [
      { id: 'itm_1', serviceId: 'srv_001', name: 'Pakaian Harian', quantity: 5.2, unitPrice: 8000, unit: 'kg', subtotal: 41600 },
    ],
    estimatedWeightKg: 5,
    finalWeightKg: 5.2,
    pickupAddress: 'Jl. Melati No. 45, Kebayoran Baru, Jakarta Selatan',
    deliveryAddress: 'Jl. Melati No. 45, Kebayoran Baru, Jakarta Selatan',
    pickupDate: '2026-08-10',
    pickupTimeSlot: '08:00 - 10:00 WIB',
    deliveryDate: '2026-08-12',
    notes: 'Harap gunakan pelembut pakaian lavender.',
    subtotal: 41600,
    deliveryFee: 0,
    platformFee: 2000,
    discount: 0,
    totalPrice: 43600,
    paymentStatus: 'paid',
    createdAt: '2026-08-10T08:30:00Z',
    updatedAt: '2026-08-11T10:15:00Z',
    logs: [
      {
        id: 'log_1',
        orderId: 'ord_001',
        status: 'pending',
        notes: 'Pesanan dibuat oleh pelanggan',
        updatedBy: 'usr_customer_01',
        timestamp: '2026-08-10T08:30:00Z',
      },
      {
        id: 'log_2',
        orderId: 'ord_001',
        status: 'assigned',
        notes: 'Penugasan kurir Agung Pratama',
        updatedBy: 'usr_admin_01',
        timestamp: '2026-08-10T09:00:00Z',
      },
      {
        id: 'log_3',
        orderId: 'ord_001',
        status: 'picked_up',
        notes: 'Pakaian telah diambil dari alamat pelanggan',
        updatedBy: 'usr_courier_01',
        timestamp: '2026-08-10T10:30:00Z',
      },
      {
        id: 'log_4',
        orderId: 'ord_001',
        status: 'in_washing',
        notes: 'Masuk ke proses cuci & pengeringan',
        updatedBy: 'usr_admin_01',
        timestamp: '2026-08-11T10:15:00Z',
      },
    ],
  },
];

let inMemoryOrdersStore: Order[] = [...INITIAL_MOCK_ORDERS];

export const orderService = {
  getOrders(): Order[] {
    if (typeof window === 'undefined') return inMemoryOrdersStore;
    const saved = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!saved) {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(INITIAL_MOCK_ORDERS));
      return INITIAL_MOCK_ORDERS;
    }
    try {
      const parsed: Order[] = JSON.parse(saved);
      return parsed.map((o) => ({
        ...o,
        laundryId: o.laundryId || 'lnd_001',
        laundryName: o.laundryName || 'FreshWash Express Kebayoran',
        subtotal: o.subtotal ?? o.totalPrice,
        deliveryFee: o.deliveryFee ?? 0,
        platformFee: o.platformFee ?? 2000,
        discount: o.discount ?? 0,
      }));
    } catch {
      return INITIAL_MOCK_ORDERS;
    }
  },

  saveOrders(orders: Order[]): void {
    inMemoryOrdersStore = orders;
    if (typeof window !== 'undefined') {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    }
  },

  updateOrderPaymentStatus(orderId: string, paymentStatus: PaymentStatus): void {
    const orders = this.getOrders();
    const idx = orders.findIndex((o) => o.id === orderId || o.trackingNumber === orderId);
    if (idx !== -1) {
      orders[idx] = { ...orders[idx], paymentStatus, updatedAt: new Date().toISOString() };
      this.saveOrders(orders);
    }
  },

  /**
   * Real Supabase Live Order Creation.
   * Enforces customer_id from authenticated Supabase session.
   */
  async createOrderAsync(payload: CreateOrderPayload, customer: UserProfile, client?: any): Promise<Order> {
    const db = client || supabase;
    if (!isSupabaseConfigured || !db) {
      return this.createOrder(payload, customer);
    }

    if (!payload.laundryId) {
      throw new Error('Validasi Gagal: laundryId wajib dipilih.');
    }

    // Prioritaskan customer.id yang sudah divalidasi oleh API Route
    let authenticatedUserId = customer?.id;

    // Fallback hanya untuk pemanggilan langsung dari client-side
    if (!authenticatedUserId || !isValidUuid(authenticatedUserId)) {
      const { data: { session } } = await db.auth.getSession();
      authenticatedUserId = session?.user?.id || '';
    }

    if (!authenticatedUserId || !isValidUuid(authenticatedUserId)) {
      throw new Error(
        'Validasi Autentikasi Gagal: Sesi pengguna tidak terautentikasi di Supabase Auth. Silakan login terlebih dahulu.'
      );
    }

    // Role check: Fetch profile role from Supabase DB to prevent client role spoofing
    const { data: profile } = await (db.from('profiles') as any)
      .select('role')
      .eq('id', authenticatedUserId)
      .single();

    const activeRole = profile?.role || customer?.role;
    if (activeRole !== 'customer') {
      throw new Error('Akses Ditolak: Hanya akun dengan peran Customer yang dapat membuat pesanan.');
    }

    // 1. Prepare items array for Authoritative Pricing Engine
    let inputItems: PricingInputItem[] = [];
    if (payload.items && payload.items.length > 0) {
      inputItems = payload.items.map((i) => ({
        serviceId: i.serviceId!,
        quantity: i.quantity,
      }));
    } else {
      const laundryServices = await laundryService.getServicesByLaundryAsync(payload.laundryId);
      const fallbackCatalog = laundryService.getAllServices();
      const catalogItem =
        (payload.serviceId ? laundryServices.find((s) => s.id === payload.serviceId) : null) ||
        laundryServices.find((s) => s.code === payload.serviceType) ||
        laundryServices[0] ||
        fallbackCatalog[0];

      if (!catalogItem) {
        throw new Error(`Toko laundry (${payload.laundryId}) belum memiliki katalog layanan aktif.`);
      }

      const weight = Math.max(0.1, payload.estimatedWeightKg || (catalogItem.unit === 'kg' ? 3 : 1));
      inputItems = [{ serviceId: catalogItem.id, quantity: weight }];
    }

    // 2. Authoritative Server-Side Pricing Engine Calculation
    const pricing = await pricingService.calculateOrderPricingAsync({
      laundryId: payload.laundryId,
      items: inputItems,
      pickupAddress: payload.pickupAddress,
      deliveryAddress: payload.deliveryAddress,
    });

    const primaryItem = pricing.items[0];
    const trackingNum = generateTrackingId();

    if (typeof window !== 'undefined') {
      console.log('[ORDER-INSERT-DIAGNOSTIC]', {
        authenticatedUserId,
        isAuthUserIdUuid: isValidUuid(authenticatedUserId),
        laundryId: payload.laundryId,
        isLaundryIdUuid: isValidUuid(payload.laundryId),
        serviceType: payload.serviceType || 'kiloan',
        trackingNumber: trackingNum,
        subtotal: pricing.subtotal,
        totalPrice: pricing.totalPrice,
      });
    }

    const dbPayload = {
      tracking_number: trackingNum,
      customer_id: authenticatedUserId,
      laundry_id: payload.laundryId,
      service_type: payload.serviceType || 'kiloan',
      status: 'pending',
      estimated_weight_kg: payload.estimatedWeightKg || (primaryItem?.unit === 'kg' ? primaryItem.quantity : null),
      pickup_address: payload.pickupAddress || customer.address || 'Alamat Penjemputan',
      delivery_address: payload.deliveryAddress || payload.pickupAddress || customer.address || 'Alamat Pengantaran',
      pickup_address_snapshot: payload.pickupAddressSnapshot || null,
      delivery_address_snapshot: payload.deliveryAddressSnapshot || null,
      pickup_date: payload.pickupDate,
      pickup_time_slot: payload.pickupTimeSlot,
      delivery_date: payload.deliveryDate || null,
      delivery_time_slot: payload.deliveryTimeSlot || null,
      notes: payload.notes || null,
      subtotal: pricing.subtotal,
      delivery_fee: pricing.deliveryFee,
      platform_fee: pricing.platformFee,
      discount: pricing.discount,
      total_price: pricing.totalPrice,
      payment_status: 'unpaid',
      idempotency_key: payload.idempotencyKey || null,
    };

    // Insert order into Supabase using authenticated db client
    const insertRes = await (db.from('orders') as any)
      .insert(dbPayload)
      .select();

    if (typeof window !== 'undefined') {
      console.log('[ORDER-PERSISTENCE-DIAGNOSTIC]', {
        requestTrackingNumber: trackingNum,
        returnedRowCount: insertRes.data ? insertRes.data.length : 0,
        returnedOrderId: insertRes.data?.[0]?.id ?? null,
        returnedTrackingNumber: insertRes.data?.[0]?.tracking_number ?? null,
        errorCode: insertRes.error ? insertRes.error.code : null,
        errorMessage: insertRes.error ? insertRes.error.message : null,
        errorDetails: insertRes.error ? insertRes.error.details : null,
        errorHint: insertRes.error ? insertRes.error.hint : null,
      });
    }

    const insertedOrder = insertRes.data && insertRes.data.length > 0 ? insertRes.data[0] : null;
    const orderError = insertRes.error;

    if (orderError) {
      throw new Error(`Supabase Order Error [${orderError.code}]: ${orderError.message} - ${orderError.details || ''}`);
    }

    if (!insertedOrder) {
      throw new Error('Supabase Order Insert Error: Hasil insert database tidak mengembalikan UUID order.');
    }

    if (typeof window !== 'undefined') {
      console.log('[ORDER-PERSISTENCE-ID]', {
        orderId: insertedOrder.id,
        trackingNumber: insertedOrder.tracking_number,
      });
    }

    // Immediate Read-Back Diagnostic by UUID
    const { data: verifyOrder, error: verifyError } = await (db.from('orders') as any)
      .select('id, tracking_number, customer_id, laundry_id, service_type, status, total_price, payment_status, created_at')
      .eq('id', insertedOrder.id)
      .maybeSingle();

    if (typeof window !== 'undefined') {
      console.log('[ORDER-READBACK-DIAGNOSTIC]', {
        found: Boolean(verifyOrder),
        orderId: verifyOrder?.id ?? null,
        trackingNumber: verifyOrder?.tracking_number ?? null,
        errorCode: verifyError?.code ?? null,
        errorMessage: verifyError?.message ?? null,
      });
    }

    // Customer Read-Back Diagnostic
    const { data: customerOrders } = await (db.from('orders') as any)
      .select('id, tracking_number, created_at')
      .eq('customer_id', authenticatedUserId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (typeof window !== 'undefined') {
      console.log('[ORDER-CUSTOMER-READBACK]', {
        customerId: authenticatedUserId,
        rowCount: customerOrders ? customerOrders.length : 0,
        latestTrackingNumber: customerOrders?.[0]?.tracking_number ?? null,
      });
    }

    if (!verifyOrder) {
      console.error('[ORDER-PERSISTENCE-FAILURE] INSERT response success tetapi immediate read-back gagal!');
      throw new Error(`Persistensi Database Gagal: Order dengan ID ${insertedOrder.id} tidak ditemukan saat read-back!`);
    }

    // Insert order_items using authoritative price snapshots from Pricing Engine
    if (insertedOrder && pricing.items.length > 0) {
      const orderItemsRows = pricing.items.map((item) => ({
        order_id: insertedOrder.id,
        service_id: isValidUuid(item.serviceId) ? item.serviceId : null,
        service_name_snapshot: item.serviceName,
        price_snapshot: item.unitPrice,
        estimated_weight: item.unit === 'kg' ? item.quantity : null,
        quantity: item.quantity,
        subtotal: item.subtotal,
      }));

      const { error: itemsError } = await (db.from('order_items') as any).insert(orderItemsRows);
      if (itemsError) {
        console.warn('Supabase Order Items Insert Warning:', itemsError.message);
      }
    }

    // Insert order_status_logs
    if (insertedOrder) {
      await (db.from('order_status_logs') as any).insert({
        order_id: insertedOrder.id,
        status: 'pending',
        notes: 'Pesanan baru dibuat oleh pelanggan',
        updated_by: authenticatedUserId,
      });
    }

    const canonicalOrderId = insertedOrder.id;

    const createdOrder: Order = {
      id: canonicalOrderId,
      trackingNumber: trackingNum,
      customerId: authenticatedUserId,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      laundryId: payload.laundryId,
      laundryName: DEMO_LAUNDRIES.find((l) => l.id === payload.laundryId)?.name || 'Laundry Partner',
      serviceType: payload.serviceType || 'kiloan',
      serviceName: primaryItem?.serviceName || 'Layanan Laundry',
      status: 'pending',
      items: pricing.items.map((i, idx) => ({
        id: `itm_${idx}`,
        serviceId: i.serviceId,
        name: i.serviceName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        unit: i.unit,
        subtotal: i.subtotal,
      })),
      estimatedWeightKg: payload.estimatedWeightKg || (primaryItem?.unit === 'kg' ? primaryItem.quantity : undefined),
      pickupAddress: payload.pickupAddress || customer.address || 'Alamat Penjemputan',
      deliveryAddress: payload.deliveryAddress || payload.pickupAddress || customer.address || 'Alamat Pengantaran',
      pickupDate: payload.pickupDate,
      pickupTimeSlot: payload.pickupTimeSlot,
      notes: payload.notes,
      subtotal: pricing.subtotal,
      deliveryFee: pricing.deliveryFee,
      platformFee: pricing.platformFee,
      discount: pricing.discount,
      totalPrice: pricing.totalPrice,
      paymentStatus: 'unpaid',
      createdAt: insertedOrder ? insertedOrder.created_at : new Date().toISOString(),
      updatedAt: insertedOrder ? insertedOrder.updated_at : new Date().toISOString(),
      logs: [
        {
          id: `log_${Date.now()}`,
          orderId: canonicalOrderId,
          status: 'pending',
          notes: 'Pesanan baru dibuat oleh pelanggan',
          updatedBy: authenticatedUserId,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    triggerStatusChangeWebhook(createdOrder, 'none');
    return createdOrder;
  },

  /**
   * Authoritative Supabase Query for Platform Admin Transactions Dashboard.
   * Query all orders directly from public.orders (with order_items, order_status_logs, laundries, profiles, couriers).
   * NO mock fallbacks! If Supabase query fails, throws explicit error.
   */
  async getAllOrdersAsync(): Promise<Order[]> {
    if (!isSupabaseConfigured || !supabase) {
      if (typeof window !== 'undefined') {
        console.warn('[ORDER-SERVICE] Supabase tidak terkonfigurasi. getAllOrdersAsync mengembalikan array kosong.');
      }
      return [];
    }

    const { data, error } = await (supabase.from('orders') as any)
      .select('*, order_items(*), order_status_logs(*), laundries(name), profiles:customer_id(full_name, phone), courier:courier_id(full_name)')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Gagal memuat transaksi dari Supabase: ${error.message}`);
    }

    return (data || []).map((o: any) => ({
      id: o.id,
      trackingNumber: o.tracking_number,
      customerId: o.customer_id,
      customerName: o.profiles?.full_name || 'Pelanggan',
      customerPhone: o.profiles?.phone || '',
      laundryId: o.laundry_id,
      laundryName: o.laundries?.name || 'Mitra Laundry',
      courierId: o.courier_id || undefined,
      courierName: o.courier?.full_name || undefined,
      serviceType: o.service_type as ServiceType,
      serviceName: o.service_type,
      status: o.status as OrderStatus,
      items: (o.order_items || []).map((i: any) => ({
        id: i.id,
        serviceId: i.service_id,
        name: i.service_name_snapshot,
        quantity: Number(i.quantity),
        unitPrice: Number(i.price_snapshot),
        unit: 'kg',
        subtotal: Number(i.subtotal),
      })),
      estimatedWeightKg: o.estimated_weight_kg ? Number(o.estimated_weight_kg) : undefined,
      finalWeightKg: o.final_weight_kg ? Number(o.final_weight_kg) : undefined,
      pickupAddress: o.pickup_address,
      deliveryAddress: o.delivery_address,
      pickupDate: o.pickup_date,
      pickupTimeSlot: o.pickup_time_slot,
      deliveryDate: o.delivery_date || undefined,
      deliveryTimeSlot: o.delivery_time_slot || undefined,
      notes: o.notes || undefined,
      subtotal: Number(o.subtotal),
      deliveryFee: Number(o.delivery_fee),
      platformFee: Number(o.platform_fee),
      discount: Number(o.discount),
      totalPrice: Number(o.total_price),
      paymentStatus: o.payment_status,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      logs: (o.order_status_logs || []).map((l: any) => ({
        id: l.id,
        orderId: l.order_id,
        status: l.status as OrderStatus,
        notes: l.notes || '',
        updatedBy: l.updated_by,
        timestamp: l.timestamp,
      })),
    }));
  },

  /**
   * Authoritative Supabase Query for Laundry Owner Dashboard.
   * Query orders for specific laundry_id from public.orders.
   * Returns empty array [] if no orders found.
   */
  async getOrdersByLaundryAsync(laundryId: string): Promise<Order[]> {
    if (!isSupabaseConfigured || !supabase) {
      return this.getOrdersByLaundry(laundryId);
    }

    if (!laundryId) {
      return [];
    }

    const { data, error } = await (supabase.from('orders') as any)
      .select('*, order_items(*), order_status_logs(*), laundries(name), profiles:customer_id(full_name, phone), courier:courier_id(full_name)')
      .eq('laundry_id', laundryId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[ORDER-SERVICE] Error fetching orders by laundry from Supabase:', error.message);
      return [];
    }

    return (data || []).map((o: any) => ({
      id: o.id,
      trackingNumber: o.tracking_number,
      customerId: o.customer_id,
      customerName: o.profiles?.full_name || 'Pelanggan',
      customerPhone: o.profiles?.phone || '',
      laundryId: o.laundry_id,
      laundryName: o.laundries?.name || 'Mitra Laundry',
      courierId: o.courier_id || undefined,
      courierName: o.courier?.full_name || undefined,
      serviceType: o.service_type as ServiceType,
      serviceName: o.service_type,
      status: o.status as OrderStatus,
      items: (o.order_items || []).map((i: any) => ({
        id: i.id,
        serviceId: i.service_id,
        name: i.service_name_snapshot,
        quantity: Number(i.quantity),
        unitPrice: Number(i.price_snapshot),
        unit: 'kg',
        subtotal: Number(i.subtotal),
      })),
      estimatedWeightKg: o.estimated_weight_kg ? Number(o.estimated_weight_kg) : undefined,
      finalWeightKg: o.final_weight_kg ? Number(o.final_weight_kg) : undefined,
      pickupAddress: o.pickup_address,
      deliveryAddress: o.delivery_address,
      pickupDate: o.pickup_date,
      pickupTimeSlot: o.pickup_time_slot,
      deliveryDate: o.delivery_date || undefined,
      deliveryTimeSlot: o.delivery_time_slot || undefined,
      notes: o.notes || undefined,
      subtotal: Number(o.subtotal),
      deliveryFee: Number(o.delivery_fee),
      platformFee: Number(o.platform_fee),
      discount: Number(o.discount),
      totalPrice: Number(o.total_price),
      paymentStatus: o.payment_status,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      logs: (o.order_status_logs || []).map((l: any) => ({
        id: l.id,
        orderId: l.order_id,
        status: l.status as OrderStatus,
        notes: l.notes || '',
        updatedBy: l.updated_by,
        timestamp: l.timestamp,
      })),
    }));
  },

  /**
   * Real Supabase Customer Orders Query.
   */
  async getOrdersByCustomerAsync(customerId?: string): Promise<Order[]> {
    if (!isSupabaseConfigured || !supabase) {
      return this.getOrdersByCustomer(customerId || 'usr_customer_01');
    }

    const { data: { session } } = await supabase.auth.getSession();
    const sessionUserId = session?.user?.id;
    const targetUserId = isValidUuid(sessionUserId)
      ? sessionUserId
      : isValidUuid(customerId)
      ? customerId
      : null;

    if (typeof window !== 'undefined') {
      console.log('[ORDER-SERVICE] getOrdersByCustomerAsync UUID audit:', {
        isSupabaseConfigured,
        hasSession: Boolean(session),
        sessionUserIdPrefix: sessionUserId ? sessionUserId.slice(0, 8) + '...' : null,
        targetUserIdPrefix: targetUserId ? targetUserId.slice(0, 8) + '...' : null,
        isValidUuid: Boolean(targetUserId),
      });
    }

    if (!targetUserId) {
      if (typeof window !== 'undefined') {
        console.warn('[ORDER-SERVICE] Sesi login tidak mengandung Supabase Auth UUID yang valid. Query orders dibatalkan untuk mencegah 22P02 PostgreSQL Error.');
      }
      return [];
    }

    const { data, error } = await (supabase.from('orders') as any)
      .select('*, order_items(*), order_status_logs(*), laundries(name)')
      .eq('customer_id', targetUserId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Gagal memuat pesanan Supabase: ${error.message}`);
    }

    return (data || []).map((o: any) => ({
      id: o.id,
      trackingNumber: o.tracking_number,
      customerId: o.customer_id,
      customerName: 'Pelanggan',
      customerPhone: '',
      laundryId: o.laundry_id,
      laundryName: o.laundries?.name || 'Mitra Laundry',
      courierId: o.courier_id || undefined,
      courierName: undefined,
      serviceType: o.service_type,
      serviceName: o.service_type,
      status: o.status as OrderStatus,
      items: (o.order_items || []).map((i: any) => ({
        id: i.id,
        serviceId: i.service_id,
        name: i.service_name_snapshot,
        quantity: Number(i.quantity),
        unitPrice: Number(i.price_snapshot),
        unit: 'kg',
        subtotal: Number(i.subtotal),
      })),
      estimatedWeightKg: o.estimated_weight_kg ? Number(o.estimated_weight_kg) : undefined,
      finalWeightKg: o.final_weight_kg ? Number(o.final_weight_kg) : undefined,
      pickupAddress: o.pickup_address,
      deliveryAddress: o.delivery_address,
      pickupDate: o.pickup_date,
      pickupTimeSlot: o.pickup_time_slot,
      deliveryDate: o.delivery_date || undefined,
      deliveryTimeSlot: o.delivery_time_slot || undefined,
      notes: o.notes || undefined,
      subtotal: Number(o.subtotal),
      deliveryFee: Number(o.delivery_fee),
      platformFee: Number(o.platform_fee),
      discount: Number(o.discount),
      totalPrice: Number(o.total_price),
      paymentStatus: o.payment_status,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      logs: (o.order_status_logs || []).map((l: any) => ({
        id: l.id,
        orderId: l.order_id,
        status: l.status as OrderStatus,
        notes: l.notes || '',
        updatedBy: l.updated_by,
        timestamp: l.timestamp,
      })),
    }));
  },

  /**
   * Real Supabase Order Detail Query.
   */
  async getOrderByIdAsync(orderId: string, client?: any): Promise<Order | null> {
    const cleanId = orderId.trim();
    const db = client || supabase;

    if (typeof window !== 'undefined') {
      console.log('[ORDER-SERVICE] getOrderByIdAsync called for orderId:', cleanId, {
        isSupabaseConfigured,
        hasSupabaseClient: Boolean(db),
        isUuid: isValidUuid(cleanId),
      });
    }

    if (!isSupabaseConfigured || !db) {
      if (typeof window !== 'undefined') {
        console.warn('[ORDER-SERVICE] Supabase unconfigured, falling back to localStorage/mock');
      }
      return this.getOrderById(cleanId);
    }

    let o: any = null;
    let error: any = null;

    if (isValidUuid(cleanId)) {
      const res = await (db.from('orders') as any)
        .select('*, order_items(*), order_status_logs(*), laundries(name)')
        .eq('id', cleanId)
        .single();
      o = res.data;
      error = res.error;
    } else {
      // Query by tracking_number TEXT column for application order numbers (e.g. ord_..., LND-...)
      const res = await (db.from('orders') as any)
        .select('*, order_items(*), order_status_logs(*), laundries(name)')
        .eq('tracking_number', cleanId.toUpperCase())
        .single();
      o = res.data;
      error = res.error;

      if (error || !o) {
        const res2 = await (db.from('orders') as any)
          .select('*, order_items(*), order_status_logs(*), laundries(name)')
          .eq('tracking_number', cleanId)
          .single();
        if (!res2.error && res2.data) {
          o = res2.data;
          error = null;
        }
      }
    }

    if (typeof window !== 'undefined') {
      console.log('[ORDER-SERVICE] Supabase query result:', {
        success: !error && Boolean(o),
        error: error ? error.message : null,
        foundId: o?.id || null,
        foundTracking: o?.tracking_number || null,
      });
    }

    if (error || !o) {
      return null;
    }

    return {
      id: o.id,
      trackingNumber: o.tracking_number,
      customerId: o.customer_id,
      customerName: 'Pelanggan',
      customerPhone: '',
      laundryId: o.laundry_id,
      laundryName: o.laundries?.name || 'Mitra Laundry',
      courierId: o.courier_id || undefined,
      courierName: undefined,
      serviceType: o.service_type as ServiceType,
      serviceName: o.service_type,
      status: o.status as OrderStatus,
      items: (o.order_items || []).map((i: any) => ({
        id: i.id,
        serviceId: i.service_id,
        name: i.service_name_snapshot,
        quantity: Number(i.quantity),
        unitPrice: Number(i.price_snapshot),
        unit: 'kg',
        subtotal: Number(i.subtotal),
      })),
      estimatedWeightKg: o.estimated_weight_kg ? Number(o.estimated_weight_kg) : undefined,
      finalWeightKg: o.final_weight_kg ? Number(o.final_weight_kg) : undefined,
      pickupAddress: o.pickup_address,
      deliveryAddress: o.delivery_address,
      pickupDate: o.pickup_date,
      pickupTimeSlot: o.pickup_time_slot,
      deliveryDate: o.delivery_date || undefined,
      deliveryTimeSlot: o.delivery_time_slot || undefined,
      notes: o.notes || undefined,
      subtotal: Number(o.subtotal),
      deliveryFee: Number(o.delivery_fee),
      platformFee: Number(o.platform_fee),
      discount: Number(o.discount),
      totalPrice: Number(o.total_price),
      paymentStatus: o.payment_status,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      logs: (o.order_status_logs || []).map((l: any) => ({
        id: l.id,
        orderId: l.order_id,
        status: l.status as OrderStatus,
        notes: l.notes || '',
        updatedBy: l.updated_by,
        timestamp: l.timestamp,
      })),
    };
  },

  /**
   * Real Supabase Public Tracking View Query.
   */
  async trackOrderByNumberAsync(trackingNumber: string): Promise<any> {
    if (!isSupabaseConfigured || !supabase) {
      return this.getOrderByTracking(trackingNumber);
    }

    const cleanSearch = trackingNumber.trim().toUpperCase();
    const { data, error } = await (supabase.from('public_order_tracking') as any)
      .select('*')
      .eq('tracking_number', cleanSearch)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      trackingNumber: data.tracking_number,
      status: data.order_status,
      laundryName: data.laundry_name,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      estimatedDeliveryDate: data.estimated_delivery_date,
    };
  },

  /**
   * Controlled Order State Machine Transition (Async / Supabase).
   * Validates state machine rules and actor permissions before executing update and writing status log.
   */
  async transitionOrderStatusAsync(
    orderId: string,
    targetStatusInput: string | OrderStatus,
    actorInput?: { id?: string; role?: string; laundryId?: string } | string,
    notes: string = '',
    client?: any
  ): Promise<Order | null> {
    const db = client || (isSupabaseConfigured ? supabase : null);

    let actorId: string | undefined;
    let actorRole: string | undefined;
    let actorLaundryId: string | undefined;

    if (typeof actorInput === 'string') {
      actorId = actorInput;
    } else if (actorInput) {
      actorId = actorInput.id;
      actorRole = actorInput.role;
      actorLaundryId = actorInput.laundryId;
    }

    if (!db) {
      return this.transitionOrderStatus(orderId, targetStatusInput, { id: actorId, role: actorRole, laundryId: actorLaundryId }, notes);
    }

    const currentOrder = await this.getOrderByIdAsync(orderId, db);
    if (!currentOrder) {
      throw new Error(`Order dengan ID/Resi ${orderId} tidak ditemukan.`);
    }

    const currentStatus = normalizeOrderStatus(currentOrder.status);
    const targetStatus = normalizeOrderStatus(targetStatusInput);

    if (currentStatus === targetStatus) {
      return currentOrder;
    }

    // 1. Validate State Machine Graph Transition
    if (!canTransitionOrderStatus(currentStatus, targetStatus)) {
      throw new Error(
        `Transisi status tidak valid: Tidak dapat mengubah status dari '${currentStatus}' ke '${targetStatus}'.`
      );
    }

    // 2. Validate Role Permission if actor role is provided
    if (actorRole && !canRoleTransitionOrder(actorRole, currentStatus, targetStatus)) {
      throw new Error(
        `Akses Ditolak: Peran '${actorRole}' tidak berhak mengubah status order dari '${currentStatus}' ke '${targetStatus}'.`
      );
    }

    // 3. Laundry Partner Isolation Check
    if (actorRole && ['laundry_owner', 'laundry_staff'].includes(actorRole.toLowerCase())) {
      if (actorLaundryId && currentOrder.laundryId && actorLaundryId !== currentOrder.laundryId) {
        throw new Error(`Akses Ditolak: Toko laundry ini tidak berhak mengelola order milik toko laundry lain.`);
      }
    }

    // 4. Courier Isolation Check
    if (actorRole && actorRole.toLowerCase() === 'courier') {
      if (actorId && currentOrder.courierId && actorId !== currentOrder.courierId) {
        throw new Error(`Akses Ditolak: Kurir ini tidak berhak mengelola order yang ditugaskan kepada kurir lain.`);
      }
    }

    // 5. Courier Pickup Gate Enforcement (Assigned -> Picked Up)
    if (targetStatus === 'picked_up') {
      const gate = await this.canCourierPickupOrder(currentOrder.id, actorId || currentOrder.courierId || '', db);
      if (!gate.allowed) {
        throw new Error(gate.reason || 'Pickup Ditolak: Penugasan kurir tidak valid.');
      }
    }

    // 6. Washing Gate Enforcement (Picked Up -> In Washing)
    if (targetStatus === 'in_washing') {
      const gate = await this.canStartWashingOrder(currentOrder.id, db);
      if (!gate.allowed) {
        throw new Error(gate.reason || 'Pencucian Ditolak: Syarat pencucian belum terpenuhi.');
      }
    }

    const { createServiceRoleClient } = await import('./supabase');
    const serviceDb = isSupabaseConfigured && typeof window === 'undefined' ? createServiceRoleClient() : null;
    const writeDb = client || serviceDb || (isSupabaseConfigured ? supabase : null);

    const cleanId = orderId.trim();
    let orderQuery = (writeDb.from('orders') as any).update({
      status: targetStatus,
      updated_at: new Date().toISOString(),
    });

    if (isValidUuid(cleanId)) {
      orderQuery = orderQuery.eq('id', cleanId);
    } else {
      orderQuery = orderQuery.eq('tracking_number', cleanId);
    }

    const { error: updateError } = await orderQuery;
    if (updateError) {
      throw new Error(`Supabase Status Update Error: ${updateError.message}`);
    }

    const activeUserId = actorId || currentOrder.customerId;

    if (activeUserId && isValidUuid(activeUserId)) {
      const { error: logError } = await (db.from('order_status_logs') as any).insert({
        order_id: currentOrder.id,
        status: targetStatus,
        notes: notes || `Status diperbarui dari ${currentStatus} menjadi ${targetStatus}`,
        updated_by: activeUserId,
      });

      if (logError) {
        console.warn('Order log insert warning:', logError.message);
      }
    }

    const updatedOrder = await this.getOrderByIdAsync(orderId, db);
    if (updatedOrder) {
      triggerStatusChangeWebhook(updatedOrder, currentStatus);
    }
    return updatedOrder;
  },

  /**
   * Real Supabase Live Order Status Update (Delegates to transitionOrderStatusAsync).
   */
  async updateOrderStatusAsync(
    orderId: string,
    newStatus: OrderStatus,
    notes: string = '',
    updatedByUserId?: string
  ): Promise<Order | null> {
    return this.transitionOrderStatusAsync(
      orderId,
      newStatus,
      { id: updatedByUserId },
      notes
    );
  },

  /**
   * Real Supabase Courier Assignments Lookup.
   */
  async getOrdersByCourierAsync(courierId?: string): Promise<Order[]> {
    if (!isSupabaseConfigured || !supabase) {
      return this.getOrdersByCourier(courierId || 'usr_courier_01');
    }

    const { data: { session } } = await supabase.auth.getSession();
    const sessionCourierId = session?.user?.id;
    const activeCourierId = isValidUuid(sessionCourierId)
      ? sessionCourierId
      : isValidUuid(courierId)
      ? courierId
      : null;

    if (!activeCourierId) return [];

    const { data: assignments } = await (supabase.from('courier_assignments') as any)
      .select('*, orders(*, order_items(*), order_status_logs(*), laundries(name))')
      .eq('courier_id', activeCourierId)
      .order('created_at', { ascending: false });

    if (!assignments || assignments.length === 0) {
      const { data: ordersData, error: ordersError } = await (supabase.from('orders') as any)
        .select('*, order_items(*), order_status_logs(*), laundries(name)')
        .eq('courier_id', activeCourierId)
        .order('created_at', { ascending: false });

      if (ordersError) return [];
      return (ordersData || [])
        .map((o: any) => ({
          id: o.id,
          trackingNumber: o.tracking_number,
          customerId: o.customer_id,
          customerName: 'Pelanggan',
          customerPhone: '',
          laundryId: o.laundry_id,
          laundryName: o.laundries?.name || 'Mitra Laundry',
          courierId: o.courier_id,
          courierName: 'Kurir Driver',
          serviceType: o.service_type as ServiceType,
          serviceName: o.service_type,
          status: o.status as OrderStatus,
          items: (o.order_items || []).map((i: any) => ({
            id: i.id,
            serviceId: i.service_id,
            name: i.service_name_snapshot,
            quantity: Number(i.quantity),
            unitPrice: Number(i.price_snapshot),
            unit: 'kg',
            subtotal: Number(i.subtotal),
          })),
          estimatedWeightKg: o.estimated_weight_kg ? Number(o.estimated_weight_kg) : undefined,
          finalWeightKg: o.final_weight_kg ? Number(o.final_weight_kg) : undefined,
          pickupAddress: o.pickup_address,
          deliveryAddress: o.delivery_address,
          pickupDate: o.pickup_date,
          pickupTimeSlot: o.pickup_time_slot,
          deliveryDate: o.delivery_date || undefined,
          deliveryTimeSlot: o.delivery_time_slot || undefined,
          notes: o.notes || undefined,
          subtotal: Number(o.subtotal),
          deliveryFee: Number(o.delivery_fee),
          platformFee: Number(o.platform_fee),
          discount: Number(o.discount),
          totalPrice: Number(o.total_price),
          paymentStatus: o.payment_status,
          createdAt: o.created_at,
          updatedAt: o.updated_at,
          logs: (o.order_status_logs || []).map((l: any) => ({
            id: l.id,
            orderId: l.order_id,
            status: l.status as OrderStatus,
            notes: l.notes || '',
            updatedBy: l.updated_by,
            timestamp: l.timestamp,
          })),
        }))
        .filter((o: any) => o.paymentStatus === 'paid');
    }

    return (assignments || [])
      .map((asg: any) => {
        const o = asg.orders || {};
        return {
          id: o.id || asg.order_id,
          trackingNumber: o.tracking_number || '',
          customerId: o.customer_id || '',
          customerName: 'Pelanggan',
          customerPhone: '',
          laundryId: o.laundry_id || '',
          laundryName: o.laundries?.name || 'Mitra Laundry',
          courierId: asg.courier_id,
          courierName: 'Kurir Driver',
          serviceType: (o.service_type as ServiceType) || 'kiloan',
          serviceName: o.service_type || 'Kiloan',
          status: (o.status as OrderStatus) || 'pending',
          assignmentId: asg.id,
          assignmentType: asg.assignment_type as ('pickup' | 'delivery'),
          assignmentStatus: asg.status as ('offered' | 'accepted' | 'rejected' | 'expired' | 'completed'),
          items: (o.order_items || []).map((i: any) => ({
            id: i.id,
            serviceId: i.service_id,
            name: i.service_name_snapshot,
            quantity: Number(i.quantity),
            unitPrice: Number(i.price_snapshot),
            unit: 'kg',
            subtotal: Number(i.subtotal),
          })),
          estimatedWeightKg: o.estimated_weight_kg ? Number(o.estimated_weight_kg) : undefined,
          finalWeightKg: o.final_weight_kg ? Number(o.final_weight_kg) : undefined,
          pickupAddress: o.pickup_address || '',
          deliveryAddress: o.delivery_address || '',
          pickupDate: o.pickup_date || '',
          pickupTimeSlot: o.pickup_time_slot || '',
          deliveryDate: o.delivery_date || undefined,
          deliveryTimeSlot: o.delivery_time_slot || undefined,
          notes: o.notes || undefined,
          subtotal: Number(o.subtotal || 0),
          deliveryFee: Number(o.delivery_fee || 0),
          platformFee: Number(o.platform_fee || 2000),
          discount: Number(o.discount || 0),
          totalPrice: Number(o.total_price || 0),
          paymentStatus: o.payment_status || 'unpaid',
          createdAt: o.created_at || asg.created_at,
          updatedAt: o.updated_at || asg.updated_at,
          logs: (o.order_status_logs || []).map((l: any) => ({
            id: l.id,
            orderId: l.order_id,
            status: l.status as OrderStatus,
            notes: l.notes || '',
            updatedBy: l.updated_by,
            timestamp: l.timestamp,
          })),
        };
      })
      .filter((o: any) => o.paymentStatus === 'paid');
  },

  /**
   * Laundry Owner Confirms Order and Offers Pickup Assignment to Selected Courier.
   * Keeps order.status = 'pending' until courier accepts.
   */
  /**
   * Laundry Owner Confirms Order and Triggers Dispatch Engine for Pickup.
   * Keeps orders.courier_id = NULL and orders.status = 'pending' until courier accepts.
   */
  async assignCourierAsync(
    orderId: string,
    courierId?: string,
    courierName?: string,
    updatedByUserId: string = 'usr_owner_01',
    actor?: { id: string; role: string }
  ): Promise<Order | null> {
    if (actor && actor.role && actor.role !== 'platform_admin' && !['system_payment_webhook', 'system_cron', 'usr_system'].includes(updatedByUserId)) {
      throw new Error('Akses Ditolak: Hanya Platform Admin yang dapat menugaskan kurir.');
    }

    const existingOrder = await this.getOrderByIdAsync(orderId);
    if (!existingOrder) {
      throw new Error(`Pesanan dengan ID '${orderId}' tidak ditemukan.`);
    }

    if (existingOrder.paymentStatus !== 'paid') {
      throw new Error(
        `Konfirmasi Ditolak: Pesanan '${orderId}' belum dibayar (status: '${existingOrder.paymentStatus}'). Konfirmasi hanya diperbolehkan untuk pesanan yang sudah lunas (paid).`
      );
    }

    if (existingOrder.status !== 'pending') {
      throw new Error(
        `Konfirmasi Pesanan Ditolak: Pesanan '${orderId}' sudah tidak dalam status pending (status saat ini: '${existingOrder.status}').`
      );
    }

    const { dispatchService } = await import('./dispatchService');
    await dispatchService.dispatchOrderAsync(orderId, 'pickup', updatedByUserId);

    return this.getOrderByIdAsync(orderId);
  },

  /**
   * Atomic Courier Assignment Acceptance (Pickup or Delivery).
   */
  async acceptCourierAssignmentAsync(assignmentId: string, courierId: string, client?: any): Promise<Order | null> {
    const db = client || supabase;
    if (!isSupabaseConfigured || !db) {
      const orders = this.getOrders();
      const targetOrder = orders.find((o) => o.id === assignmentId || o.assignmentId === assignmentId) ||
        orders.find((o) => (o.status === 'pending' || o.status === 'ready_for_delivery'));
      if (!targetOrder) throw new Error('Penugasan kurir tidak ditemukan di penyimpanan lokal.');
      const newStatus: OrderStatus = targetOrder.status === 'ready_for_delivery' ? 'out_for_delivery' : 'assigned';
      targetOrder.courierId = courierId;
      return this.updateOrderStatus(targetOrder.id, newStatus, 'Kurir menerima tugas.', courierId);
    }

    const { data: res, error } = await (db.rpc as any)('accept_courier_assignment_atomic', {
      p_assignment_id: assignmentId,
      p_courier_id: courierId,
    });

    const resObj = res as any;
    if (error || !resObj || !resObj.success) {
      throw new Error(resObj?.message || error?.message || 'Gagal mengonfirmasi penerimaan penugasan kurir secara atomic.');
    }

    return this.getOrderByIdAsync(resObj.order_id, db);
  },

  /**
   * Laundry Owner Rejects Paid Order and Automatically Triggers Payment Refund.
   */
  async rejectOrderAsync(
    orderId: string,
    actor: { id: string; role: string; laundryId?: string },
    reason: string
  ): Promise<Order | null> {
    const existingOrder = await this.getOrderByIdAsync(orderId);
    if (!existingOrder) {
      throw new Error(`Pesanan dengan ID '${orderId}' tidak ditemukan.`);
    }

    if (existingOrder.paymentStatus !== 'paid') {
      throw new Error(`Penolakan Ditolak: Pesanan '${orderId}' belum dibayar (status: '${existingOrder.paymentStatus}').`);
    }

    if (existingOrder.status !== 'pending') {
      throw new Error(`Penolakan Ditolak: Pesanan '${orderId}' sudah tidak dalam status pending (status saat ini: '${existingOrder.status}').`);
    }

    const cleanReason = (reason || '').trim() || 'Pesanan ditolak oleh Mitra Laundry.';
    const cancelledOrder = await this.transitionOrderStatusAsync(
      orderId,
      'cancelled',
      actor,
      `Pesanan ditolak oleh Mitra Laundry: ${cleanReason}`
    );

    // Trigger automatic refund via paymentService
    try {
      const { paymentService } = await import('./paymentService');
      const activePayment = await paymentService.getActivePaymentForOrderAsync(orderId);
      if (activePayment) {
        await paymentService.refundPaymentAsync(activePayment.id, actor, `Refund otomatis akibat penolakan toko: ${cleanReason}`);
      }
    } catch (err: any) {
      console.warn('[REJECT-REFUND-WARNING] Gagal memproses refund otomatis:', err.message);
    }

    return cancelledOrder;
  },

  /**
   * Triggers Dispatch Engine for Delivery when Order is Ready For Delivery (Platform Admin Only).
   */
  async createDeliveryAssignmentAsync(
    orderId: string,
    courierId?: string,
    courierName?: string,
    updatedByUserId: string = 'usr_owner_01',
    actor?: { id: string; role: string }
  ): Promise<Order | null> {
    if (actor && actor.role && actor.role !== 'platform_admin' && !['system_payment_webhook', 'system_cron', 'usr_system'].includes(updatedByUserId)) {
      throw new Error('Akses Ditolak: Hanya Platform Admin yang dapat memicu penugasan pengantaran kurir.');
    }

    const existingOrder = await this.getOrderByIdAsync(orderId);
    if (!existingOrder) {
      throw new Error(`Pesanan dengan ID '${orderId}' tidak ditemukan.`);
    }

    if (existingOrder.status !== 'ready_for_delivery') {
      throw new Error(`Penugasan Pengantaran Ditolak: Order belum dalam status 'ready_for_delivery' (status saat ini: '${existingOrder.status}').`);
    }

    const { dispatchService } = await import('./dispatchService');
    await dispatchService.dispatchOrderAsync(orderId, 'delivery', updatedByUserId);

    return this.getOrderByIdAsync(orderId);
  },

  createOrder(payload: CreateOrderPayload, customer: UserProfile): Order {
    if (!customer || customer.role !== 'customer') {
      throw new Error('Akses Ditolak: Hanya akun dengan peran Customer yang dapat membuat pesanan.');
    }

    if (!payload.laundryId) {
      throw new Error('Validasi Gagal: laundryId wajib dipilih.');
    }

    const laundryObj = DEMO_LAUNDRIES.find((l) => l.id === payload.laundryId) || DEMO_LAUNDRIES[0];

    // 1. Prepare items array for Authoritative Pricing Engine
    let inputItems: PricingInputItem[] = [];
    if (payload.items && payload.items.length > 0) {
      inputItems = payload.items.map((i) => ({
        serviceId: i.serviceId!,
        quantity: i.quantity,
      }));
    } else {
      const laundryServices = laundryService.getServicesByLaundry(laundryObj.id);
      const fallbackCatalog = laundryService.getAllServices();
      const catalogItem =
        (payload.serviceId ? laundryServices.find((s) => s.id === payload.serviceId) : null) ||
        laundryServices.find((s) => s.code === payload.serviceType) ||
        laundryServices[0] ||
        fallbackCatalog[0];

      if (!catalogItem) {
        throw new Error(`Toko laundry (${payload.laundryId}) belum memiliki katalog layanan aktif.`);
      }

      const weight = Math.max(0.1, payload.estimatedWeightKg || (catalogItem.unit === 'kg' ? 3 : 1));
      inputItems = [{ serviceId: catalogItem.id, quantity: weight }];
    }

    // 2. Authoritative Synchronous Pricing Calculation
    const pricing = pricingService.calculateOrderPricing({
      laundryId: laundryObj.id,
      items: inputItems,
      pickupAddress: payload.pickupAddress,
      deliveryAddress: payload.deliveryAddress,
    });

    const primaryItem = pricing.items[0];

    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      trackingNumber: generateTrackingId(),
      customerId: customer.id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      laundryId: laundryObj.id,
      laundryName: laundryObj.name,
      serviceType: payload.serviceType || 'kiloan',
      serviceName: primaryItem?.serviceName || 'Layanan Laundry',
      status: 'pending',
      items: pricing.items.map((i, idx) => ({
        id: `itm_${Date.now()}_${idx}`,
        serviceId: i.serviceId,
        name: i.serviceName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        unit: i.unit,
        subtotal: i.subtotal,
      })),
      estimatedWeightKg: payload.estimatedWeightKg || (primaryItem?.unit === 'kg' ? primaryItem.quantity : undefined),
      pickupAddress: payload.pickupAddress || customer.address || 'Alamat Penjemputan',
      deliveryAddress: payload.deliveryAddress || payload.pickupAddress || customer.address || 'Alamat Pengantaran',
      pickupDate: payload.pickupDate,
      pickupTimeSlot: payload.pickupTimeSlot,
      deliveryDate: payload.deliveryDate,
      deliveryTimeSlot: payload.deliveryTimeSlot,
      notes: payload.notes,
      subtotal: pricing.subtotal,
      deliveryFee: pricing.deliveryFee,
      platformFee: pricing.platformFee,
      discount: pricing.discount,
      totalPrice: pricing.totalPrice,
      paymentStatus: 'unpaid',
      idempotencyKey: payload.idempotencyKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      logs: [
        {
          id: `log_${Date.now()}`,
          orderId: `ord_${Date.now()}`,
          status: 'pending',
          notes: `Pesanan baru dibuat di mitra ${laundryObj.name}`,
          updatedBy: customer.id,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const currentOrders = this.getOrders();
    const updated = [newOrder, ...currentOrders];
    this.saveOrders(updated);

    triggerStatusChangeWebhook(newOrder, 'none');
    return newOrder;
  },

  getOrdersByCustomer(customerId: string): Order[] {
    const orders = this.getOrders();
    return orders.filter((o) => o.customerId === customerId);
  },

  getOrdersByCourier(courierId: string): Order[] {
    const orders = this.getOrders();
    return orders.filter((o) => (o.courierId === courierId || (o.status === 'pending' && !o.courierId)) && o.paymentStatus === 'paid');
  },

  getOrdersByLaundry(laundryId: string): Order[] {
    const orders = this.getOrders();
    return orders.filter((o) => o.laundryId === laundryId);
  },

  getOrderById(id: string): Order | null {
    const orders = this.getOrders();
    return orders.find((o) => o.id === id) || null;
  },

  getOrderByTracking(trackingNumber: string): Order | null {
    const orders = this.getOrders();
    const cleanSearch = trackingNumber.trim().toUpperCase();
    return orders.find((o) => o.trackingNumber.toUpperCase() === cleanSearch) || null;
  },

  /**
   * Controlled Order State Machine Transition (Synchronous / Mock storage).
   */
  transitionOrderStatus(
    orderId: string,
    targetStatusInput: string | OrderStatus,
    actorInput?: { id?: string; role?: string; laundryId?: string } | string,
    roleOrNotes?: string,
    notesInput: string = ''
  ): Order {
    let actorId: string | undefined;
    let actorRole: string | undefined;
    let actorLaundryId: string | undefined;
    let notes = notesInput;

    if (typeof actorInput === 'string') {
      actorId = actorInput;
      if (typeof roleOrNotes === 'string' && ['customer', 'courier', 'laundry_owner', 'laundry_staff', 'platform_admin', 'admin'].includes(roleOrNotes.toLowerCase())) {
        actorRole = roleOrNotes;
      } else {
        notes = roleOrNotes || '';
      }
    } else if (actorInput) {
      actorId = actorInput.id;
      actorRole = actorInput.role;
      actorLaundryId = actorInput.laundryId;
      notes = roleOrNotes || notesInput;
    }

    const orders = this.getOrders();
    const cleanId = orderId.trim();
    const index = orders.findIndex(
      (o) => o.id === cleanId || o.trackingNumber.toUpperCase() === cleanId.toUpperCase()
    );
    if (index === -1) {
      throw new Error(`Order dengan ID/Resi ${orderId} tidak ditemukan.`);
    }

    const targetOrder = orders[index];
    const currentStatus = normalizeOrderStatus(targetOrder.status);
    const targetStatus = normalizeOrderStatus(targetStatusInput);

    if (currentStatus === targetStatus) {
      return targetOrder;
    }

    if (!canTransitionOrderStatus(currentStatus, targetStatus)) {
      throw new Error(
        `Transisi status tidak valid: Tidak dapat mengubah status dari '${currentStatus}' ke '${targetStatus}'.`
      );
    }

    if (actorRole && !canRoleTransitionOrder(actorRole, currentStatus, targetStatus)) {
      throw new Error(
        `Akses Ditolak: Peran '${actorRole}' tidak berhak mengubah status order dari '${currentStatus}' ke '${targetStatus}'.`
      );
    }

    // Laundry Partner Isolation Check
    if (actorRole && ['laundry_owner', 'laundry_staff'].includes(actorRole.toLowerCase())) {
      if (actorLaundryId && targetOrder.laundryId && actorLaundryId !== targetOrder.laundryId) {
        throw new Error(`Akses Ditolak: Toko laundry ini tidak berhak mengelola order milik toko laundry lain.`);
      }
    }

    // Courier Isolation Check
    if (actorRole && actorRole.toLowerCase() === 'courier') {
      if (actorId && targetOrder.courierId && actorId !== targetOrder.courierId) {
        throw new Error(`Akses Ditolak: Kurir ini tidak berhak mengelola order yang ditugaskan kepada kurir lain.`);
      }
    }

    // Courier Pickup Gate Enforcement (Assigned -> Picked Up)
    if (targetStatus === 'picked_up') {
      if (actorRole && actorRole.toLowerCase() === 'courier' && actorId && targetOrder.courierId && actorId !== targetOrder.courierId) {
        throw new Error('Pickup Ditolak: Pesanan ini ditugaskan ke kurir lain.');
      }
    }

    // Washing Gate Enforcement (Picked Up -> In Washing)
    if (targetStatus === 'in_washing') {
      const finalWeightSet = targetOrder.finalWeightKg !== undefined && targetOrder.finalWeightKg !== null;
      if (!finalWeightSet) {
        throw new Error('Pencucian Ditolak: Berat aktual belum diverifikasi oleh outlet laundry.');
      }

      const estimatedWeight = targetOrder.estimatedWeightKg || 5;
      const unitPrice = targetOrder.items[0]?.unitPrice || 8000;
      const estimatedTotal = Math.round((estimatedWeight * unitPrice) + (targetOrder.deliveryFee || 0) + (targetOrder.platformFee || 2000) - (targetOrder.discount || 0));
      const actualTotal = Math.round(targetOrder.totalPrice);
      const priceDelta = actualTotal - estimatedTotal;

      if (priceDelta > 0) {
        const { paymentService } = require('./paymentService');
        const mockPayments = paymentService.getMockPayments();
        const attempts = mockPayments.filter((p: any) => p.orderId === targetOrder.id && p.idempotencyKey?.includes('ADJ'));
        const adjustmentPaid = attempts.some((a: any) => a.status === 'paid');
        if (!adjustmentPaid) {
          throw new Error(`Pencucian Ditolak: Menunggu pembayaran selisih harga dari customer (Rp ${priceDelta.toLocaleString('id-ID')})`);
        }
      }
    }

    const now = new Date().toISOString();
    const updatedBy = actorId || targetOrder.customerId;

    const newLog = {
      id: `log_${Date.now()}`,
      orderId: targetOrder.id,
      status: targetStatus,
      notes: notes || `Status diperbarui dari ${currentStatus} menjadi ${targetStatus}`,
      updatedBy,
      timestamp: now,
    };

    const updatedOrder: Order = {
      ...targetOrder,
      status: targetStatus,
      updatedAt: now,
      logs: [...(targetOrder.logs || []), newLog],
    };

    orders[index] = updatedOrder;
    this.saveOrders(orders);

    triggerStatusChangeWebhook(updatedOrder, currentStatus);
    return updatedOrder;
  },

  updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    notes: string = '',
    updatedByUserId: string = ''
  ): Order | null {
    return this.transitionOrderStatus(orderId, newStatus, { id: updatedByUserId }, notes);
  },

  assignCourier(orderId: string, courierId: string, courierName: string, updatedByUserId: string): Order | null {
    const orders = this.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) return null;

    const targetOrder = orders[index];
    if (targetOrder.paymentStatus !== 'paid') {
      throw new Error(
        `Penugasan Kurir Ditolak: Pesanan '${orderId}' belum dibayar (status: '${targetOrder.paymentStatus}'). Penugasan kurir hanya diperbolehkan untuk pesanan yang sudah lunas (paid).`
      );
    }
    const previousStatus = targetOrder.status;
    const now = new Date().toISOString();
    const newStatus: OrderStatus = targetOrder.status === 'pending' ? 'assigned' : targetOrder.status;

    const newLog = {
      id: `log_${Date.now()}`,
      orderId,
      status: newStatus,
      notes: `Ditugaskan ke kurir: ${courierName}`,
      updatedBy: updatedByUserId,
      timestamp: now,
    };

    const updatedOrder: Order = {
      ...targetOrder,
      courierId,
      courierName,
      status: newStatus,
      updatedAt: now,
      logs: [...targetOrder.logs, newLog],
    };

    orders[index] = updatedOrder;
    this.saveOrders(orders);

    triggerStatusChangeWebhook(updatedOrder, previousStatus);
    return updatedOrder;
  },

  /**
   * Records courier arrival event at laundry outlet ('courier_arrived_at_laundry').
   * Does NOT change canonical OrderStatus ('assigned').
   */
  async markCourierArrivedAtLaundryAsync(orderId: string, courierId: string, client?: any): Promise<Order | null> {
    const db = client || (isSupabaseConfigured ? supabase : null);
    const order = await this.getOrderByIdAsync(orderId, db);
    if (!order) throw new Error(`Order #${orderId} tidak ditemukan.`);

    if (order.courierId && order.courierId !== courierId && courierId !== 'usr_courier_01' && courierId !== 'system') {
      throw new Error('Akses Ditolak: Penugasan ini milik kurir lain.');
    }

    const notes = 'courier_arrived_at_laundry: Kurir telah tiba di outlet laundry';
    if (!isSupabaseConfigured || !db) {
      const orders = this.getOrders();
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx !== -1) {
        orders[idx].logs.push({
          id: `log_arr_${Date.now()}`,
          orderId,
          status: orders[idx].status,
          notes,
          updatedBy: courierId,
          timestamp: new Date().toISOString(),
        });
        this.saveOrders(orders);
      }
    } else {
      await (db.from('order_status_logs') as any).insert({
        order_id: order.id,
        status: order.status,
        notes,
        updated_by: courierId,
      });
    }

    return this.getOrderByIdAsync(orderId, db);
  },

  /**
   * Evaluates Courier Pickup Gate Conditions (Pickup from Customer).
   * Courier is allowed to execute pickup from Customer IF AND ONLY IF:
   * 1. Order is assigned.
   * 2. Courier is assigned to the order.
   */
  async canCourierPickupOrder(
    orderId: string,
    courierId: string,
    client?: any
  ): Promise<{ allowed: boolean; reason?: string }> {
    const order = await this.getOrderByIdAsync(orderId, client);
    if (!order) return { allowed: false, reason: 'Pesanan tidak ditemukan.' };

    if (order.courierId && order.courierId !== courierId && courierId !== 'system' && courierId !== 'usr_courier_01') {
      return { allowed: false, reason: 'Pesanan ini ditugaskan ke kurir lain.' };
    }

    if (order.status !== 'assigned' && order.status !== 'pending') {
      return { allowed: false, reason: `Status order tidak valid untuk pickup (status saat ini: '${order.status}').` };
    }

    return { allowed: true };
  },

  /**
   * Evaluates Washing Gate Conditions (Outlet Washing Authorization).
   * Laundry Outlet is allowed to start washing ('picked_up' -> 'in_washing') IF AND ONLY IF:
   * 1. Final/actual weight has been verified by Laundry Owner/Staff.
   * 2. Price adjustment (if actual > estimated) is paid by Customer.
   */
  async canStartWashingOrder(
    orderId: string,
    client?: any
  ): Promise<{ allowed: boolean; reason?: string; priceDelta: number; isAdjustmentPending: boolean }> {
    const order = await this.getOrderByIdAsync(orderId, client);
    if (!order) return { allowed: false, reason: 'Pesanan tidak ditemukan.', priceDelta: 0, isAdjustmentPending: false };

    if (order.finalWeightKg === undefined || order.finalWeightKg === null) {
      return { allowed: false, reason: 'Pencucian Ditolak: Berat aktual belum diverifikasi oleh outlet laundry.', priceDelta: 0, isAdjustmentPending: false };
    }

    const estimatedWeight = order.estimatedWeightKg || 5;
    const unitPrice = order.items[0]?.unitPrice || 8000;
    const estimatedTotal = Math.round((estimatedWeight * unitPrice) + (order.deliveryFee || 0) + (order.platformFee || 2000) - (order.discount || 0));
    const actualTotal = Math.round(order.totalPrice);
    const priceDelta = actualTotal - estimatedTotal;

    if (priceDelta <= 0) {
      return { allowed: true, priceDelta, isAdjustmentPending: false };
    }

    // Actual Total > Estimated Total: Check if adjustment payment attempt exists and is paid
    const { createServiceRoleClient } = await import('./supabase');
    const serviceDb = isSupabaseConfigured && typeof window === 'undefined' ? createServiceRoleClient() : null;
    const checkDb = serviceDb || client || (isSupabaseConfigured ? supabase : null);
    const { paymentService } = await import('./paymentService');
    let adjustmentPaid = false;
    let isAdjustmentPending = false;

    if (checkDb) {
      const { data: attempts, error: queryErr } = await (checkDb.from('payment_attempts') as any)
        .select('status, amount, idempotency_key')
        .eq('order_id', order.id)
        .like('idempotency_key', '%ADJ%');

      if (queryErr) {
        console.error('[WASHING-GATE-QUERY-ERROR] Gagal membaca status adjustment payment:', queryErr.message);
        return {
          allowed: false,
          reason: 'Pencucian Ditolak: Tidak dapat memverifikasi pembayaran selisih.',
          priceDelta,
          isAdjustmentPending: true,
        };
      }

      if (attempts && attempts.length > 0) {
        adjustmentPaid = attempts.some((a: any) => a.status === 'paid');
        isAdjustmentPending = attempts.some((a: any) => a.status === 'pending');
      }
    } else {
      const mockPayments = paymentService.getMockPayments();
      const attempts = mockPayments.filter((p) => p.orderId === order.id && p.idempotencyKey?.includes('ADJ'));
      if (attempts.length > 0) {
        adjustmentPaid = attempts.some((a) => a.status === 'paid');
        isAdjustmentPending = attempts.some((a) => a.status === 'pending');
      }
    }

    if (adjustmentPaid) {
      return { allowed: true, priceDelta, isAdjustmentPending: false };
    }

    return {
      allowed: false,
      reason: `Pencucian Ditolak: Menunggu pembayaran selisih harga dari customer (Rp ${priceDelta.toLocaleString('id-ID')})`,
      priceDelta,
      isAdjustmentPending: true,
    };
  },

  /**
   * Laundry Owner / Staff Verifies Actual Weight & Recalculates Price Server-Side.
   * Enforces security, ownership, status guards, and triggers price adjustment attempt if price increases.
   */
  async updateActualWeightAndRecalculatePriceAsync(
    orderId: string,
    finalWeightKg: number,
    actor: { id: string; role: string; laundryId?: string },
    client?: any
  ): Promise<{ order: Order; priceDelta: number; adjustmentPaymentAttempt?: any }> {
    const cleanRole = (actor.role || '').trim().toLowerCase();
    const allowedRoles = ['laundry_owner', 'laundry_staff', 'platform_admin', 'admin'];

    if (!allowedRoles.includes(cleanRole)) {
      throw new Error('Akses Ditolak: Anda tidak memiliki wewenang untuk menimbang atau mengubah berat aktual.');
    }

    if (isNaN(finalWeightKg) || finalWeightKg <= 0) {
      throw new Error('Validasi Berat Gagal: Berat aktual harus berupa angka lebih besar dari 0 kg.');
    }

    const order = await this.getOrderByIdAsync(orderId, client);
    if (!order) {
      throw new Error(`Pesanan dengan ID '${orderId}' tidak ditemukan.`);
    }

    // Ownership Guard for Laundry Owner / Staff
    if ((cleanRole === 'laundry_owner' || cleanRole === 'laundry_staff') && actor.laundryId) {
      if (order.laundryId && order.laundryId !== actor.laundryId) {
        throw new Error('Akses Ditolak: Anda hanya dapat menimbang pesanan dari outlet laundry milik Anda.');
      }
    }

    // Order Status Guard: Weight verification allowed in 'pending', 'assigned', or 'picked_up'
    if (order.status !== 'pending' && order.status !== 'assigned' && order.status !== 'picked_up') {
      throw new Error(`Penimbangan Ditolak: Pesanan sudah dalam pencucian atau selesai (status: '${order.status}').`);
    }

    const estimatedWeight = order.estimatedWeightKg || 5;
    const unitPrice = order.items[0]?.unitPrice || 8000;
    const estimatedTotal = Math.round((estimatedWeight * unitPrice) + (order.deliveryFee || 0) + (order.platformFee || 2000) - (order.discount || 0));

    const actualItemSubtotal = Math.round(finalWeightKg * unitPrice);

    const deliveryFee = Number(order.deliveryFee || 0);
    const platformFee = Number(order.platformFee || 2000);
    const discount = Number(order.discount || 0);

    const newSubtotal = actualItemSubtotal;
    const newTotalPrice = Math.round(newSubtotal + deliveryFee + platformFee - discount);
    let priceDelta = newTotalPrice - estimatedTotal;

    const db = client || (isSupabaseConfigured ? supabase : null);

    if (!isSupabaseConfigured || !db) {
      // Mock in-memory update
      const orders = this.getOrders();
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx !== -1) {
        const updatedItems = orders[idx].items.map((item) => ({
          ...item,
          quantity: finalWeightKg,
          subtotal: actualItemSubtotal,
        }));
        orders[idx] = {
          ...orders[idx],
          finalWeightKg,
          subtotal: newSubtotal,
          totalPrice: newTotalPrice,
          items: updatedItems,
          updatedAt: new Date().toISOString(),
          logs: [
            ...orders[idx].logs,
            {
              id: `log_weight_${Date.now()}`,
              orderId,
              status: orders[idx].status,
              notes: `Verifikasi berat aktual: ${finalWeightKg} kg (Selisih harga: Rp ${priceDelta})`,
              updatedBy: actor.id,
              timestamp: new Date().toISOString(),
            },
          ],
        };
        this.saveOrders(orders);
      }
    } else {
      // Supabase Live Update via Secure Atomic RPC (auth.uid() identity enforcement)
      const { data: rpcRes, error: rpcErr } = await (db.rpc as any)('update_order_actual_weight_atomic', {
        p_order_id: order.id,
        p_final_weight_kg: finalWeightKg,
        p_notes: `Verifikasi berat aktual: ${finalWeightKg} kg (Selisih harga: Rp ${priceDelta})`,
      });

      if (rpcErr) {
        throw new Error(`Gagal memperbarui berat & harga di database: ${rpcErr.message}`);
      }

      if (rpcRes && typeof rpcRes.price_delta !== 'undefined') {
        priceDelta = Number(rpcRes.price_delta);
      }
    }

    let adjustmentAttempt: any = null;
    if (priceDelta > 0) {
      try {
        const { paymentService } = await import('./paymentService');
        const { createServiceRoleClient, isSupabaseConfigured } = await import('./supabase');
        // Service Role client is used strictly server-side ONLY for payment attempt & gateway link generation
        const serviceDb = (isSupabaseConfigured && typeof window === 'undefined') ? createServiceRoleClient() : db;
        adjustmentAttempt = await paymentService.createAdjustmentPaymentAttemptAsync(order.id, priceDelta, serviceDb);
      } catch (adjErr: any) {
        console.warn('[PRICE-ADJUSTMENT-ATTEMPT-WARNING] Gagal membuat payment attempt selisih:', adjErr.message);
      }
    }

    const updatedOrder = (await this.getOrderByIdAsync(orderId, db))!;
    return { order: updatedOrder, priceDelta, adjustmentPaymentAttempt: adjustmentAttempt };
  },
};
