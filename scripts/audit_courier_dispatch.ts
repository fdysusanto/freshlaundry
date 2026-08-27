import { supabase, isSupabaseConfigured } from '../services/supabase';
import { orderService } from '../services/orderService';

async function auditCourierDispatchRecords() {
  console.log('===================================================');
  console.log('DISPATCH & COURIER ASSIGNMENT DATABASE AUDIT');
  console.log('===================================================\n');

  if (isSupabaseConfigured && supabase) {
    console.log('--- SUPABASE LIVE DATABASE AUDIT ---');

    // 1. Fetch courier assignments
    const { data: assignments } = await (supabase.from('courier_assignments') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    console.log('Recent courier_assignments:', assignments || []);

    // 2. Fetch orders
    const { data: orders } = await (supabase.from('orders') as any)
      .select('id, tracking_number, status, payment_status, courier_id, pickup_date, pickup_time_slot, delivery_date, delivery_time_slot')
      .order('created_at', { ascending: false })
      .limit(10);
    console.log('Recent orders:', orders || []);

    // 3. Fetch dispatch batches
    const { data: batches } = await (supabase.from('dispatch_batches') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    console.log('Recent dispatch_batches:', batches || []);
  } else {
    console.log('--- IN-MEMORY / LOCAL STORE AUDIT ---');
    const orders = orderService.getOrders();
    console.log('Local store orders count:', orders.length);
    console.log('Orders summary:', orders.map((o) => ({
      id: o.id,
      trackingNumber: o.trackingNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      courierId: o.courierId || null,
      courierName: o.courierName || null,
    })));
  }
}

auditCourierDispatchRecords().catch((err) => console.error(err));
