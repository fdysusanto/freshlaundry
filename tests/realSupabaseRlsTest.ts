import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value.trim();
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const TEST_PASSWORD = process.env.TEST_ACCOUNTS_PASSWORD || 'FreshWashTest2026!';

export interface TestResultRow {
  role: string;
  login: string;
  profileRole: string;
  directInsert: string;
  rpcCreateOrder: string;
  result: string;
  notes?: string;
}

export async function runRealSupabaseRlsTest(): Promise<TestResultRow[]> {
  console.log('===========================================================');
  console.log('RUNNING REAL SUPABASE AUTHENTICATED RLS SECURITY TEST');
  console.log('===========================================================\n');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.');
    process.exit(1);
  }

  // Create standard client using ANON KEY ONLY (No service_role!)
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Fetch valid laundry_id and service_id for test order creation
  const { data: laundries } = await supabase
    .from('laundries')
    .select('id')
    .eq('is_active', true)
    .limit(1);

  const validLaundryId = laundries && laundries.length > 0 ? laundries[0].id : null;

  if (!validLaundryId) {
    console.warn('WARN: No active laundry found in public.laundries for test order creation.');
  }

  const { data: services } = await supabase
    .from('services')
    .select('id, price_per_unit, name')
    .eq('is_active', true)
    .limit(1);

  const validService = services && services.length > 0 ? services[0] : null;

  const testRolesConfig = [
    { label: 'CUSTOMER', email: 'test-customer@freshlaundry.com', expectedRole: 'customer', shouldAllowInsert: true },
    { label: 'COURIER', email: 'test-courier@freshlaundry.com', expectedRole: 'courier', shouldAllowInsert: false },
    { label: 'OWNER', email: 'test-owner@freshlaundry.com', expectedRole: 'laundry_owner', shouldAllowInsert: false },
    { label: 'STAFF', email: 'test-staff@freshlaundry.com', expectedRole: 'laundry_staff', shouldAllowInsert: false },
    { label: 'ADMIN', email: 'test-admin@freshlaundry.com', expectedRole: 'platform_admin', shouldAllowInsert: false },
  ];

  const results: TestResultRow[] = [];

  for (const item of testRolesConfig) {
    console.log(`--- Testing Role: ${item.label} (${item.email}) ---`);
    let loginStatus = 'FAIL';
    let profileRoleText = 'N/A';
    let directInsertText = 'NOT TESTED';
    let rpcText = 'NOT TESTED';
    let overallResult = 'FAIL';
    let notes = '';

    // A. Login using signInWithPassword
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: item.email,
      password: TEST_PASSWORD,
    });

    if (authError || !authData.user) {
      console.log(`[LOGIN FAILED] ${item.email}: ${authError?.message || 'User not found'}`);
      results.push({
        role: item.label,
        login: 'FAIL',
        profileRole: 'MISSING',
        directInsert: 'NOT TESTED',
        rpcCreateOrder: 'NOT TESTED',
        result: 'NOT TESTED',
        notes: `Account missing or login failed: ${authError?.message || 'Unauthenticated'}`,
      });
      continue;
    }

    loginStatus = 'PASS';
    const userId = authData.user.id;

    // B. Query Profile Role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    profileRoleText = profile?.role || 'N/A';
    console.log(`[AUTHENTICATED] User ID: ${userId} | Profile Role: ${profileRoleText}`);

    const timestamp = Date.now();
    const trackingNo = `REAL-RLS-TEST-${timestamp}-${item.label}`;
    const idempotencyKey = `REAL-RLS-TEST-${timestamp}-${item.label}`;

    // C. Test Direct INSERT INTO public.orders
    if (validLaundryId) {
      const { data: orderData, error: insertError } = await supabase
        .from('orders')
        .insert({
          tracking_number: trackingNo,
          customer_id: userId,
          laundry_id: validLaundryId,
          service_type: 'kiloan',
          status: 'pending',
          estimated_weight_kg: 5,
          pickup_address: 'Jl. Test RLS Security No. 12',
          delivery_address: 'Jl. Test RLS Security No. 12',
          pickup_date: '2026-08-25',
          pickup_time_slot: '08:00 - 10:00 WIB',
          subtotal: 50000,
          delivery_fee: 10000,
          platform_fee: 2000,
          discount: 0,
          total_price: 62000,
          payment_status: 'unpaid',
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      if (item.shouldAllowInsert) {
        if (!insertError && orderData) {
          directInsertText = 'PASS (ALLOWED)';
          console.log(`[DIRECT INSERT SUCCESS] Order created: ${orderData.id}`);
        } else {
          directInsertText = 'FAIL (BLOCKED)';
          console.error(`[DIRECT INSERT ERROR] ${insertError?.message}`);
        }
      } else {
        // Operational Role -> Expect INSERT to be DENIED (RLS Violation Code 42501)
        if (insertError) {
          directInsertText = 'PASS (DENIED)';
          console.log(`[DIRECT INSERT BLOCKED AS EXPECTED] Error: ${insertError.message}`);
        } else {
          directInsertText = 'FAIL (ALLOWED BYPASS)';
          notes += ' SECURITY CONFLICT: Operational role bypassed Direct INSERT RLS!';
          console.error(`[SECURITY FAILURE] ${item.label} bypassed Direct INSERT RLS!`);
        }
      }
    } else {
      directInsertText = 'SKIPPED (No valid laundry_id)';
    }

    // D. Test Atomic RPC create_order_with_items_atomic
    if (validLaundryId && validService) {
      const rpcItemsJson = [
        {
          service_id: validService.id,
          service_name_snapshot: validService.name,
          price_snapshot: validService.price_per_unit,
          estimated_weight: 5,
          quantity: 1,
          subtotal: 50000,
        },
      ];

      const { data: rpcRes, error: rpcError } = await supabase.rpc('create_order_with_items_atomic', {
        p_tracking_number: trackingNo + '-RPC',
        p_customer_id: userId,
        p_laundry_id: validLaundryId,
        p_service_type: 'kiloan',
        p_estimated_weight_kg: 5,
        p_pickup_address: 'Jl. Test RLS Security No. 12',
        p_delivery_address: 'Jl. Test RLS Security No. 12',
        p_pickup_date: '2026-08-25',
        p_pickup_time_slot: '08:00 - 10:00 WIB',
        p_notes: 'Real RLS RPC test payload',
        p_subtotal: 50000,
        p_delivery_fee: 10000,
        p_platform_fee: 2000,
        p_discount: 0,
        p_total_price: 62000,
        p_idempotency_key: idempotencyKey + '-RPC',
        p_items_json: rpcItemsJson,
      });

      if (item.shouldAllowInsert) {
        if (!rpcError && rpcRes) {
          rpcText = 'PASS (ALLOWED)';
          console.log(`[RPC SUCCESS] Order created via RPC: ${rpcRes.order_id}`);
        } else {
          rpcText = 'FAIL (BLOCKED)';
          console.error(`[RPC ERROR] ${rpcError?.message}`);
        }
      } else {
        // Operational Role -> Expect RPC to be DENIED
        if (rpcError) {
          rpcText = 'PASS (DENIED)';
          console.log(`[RPC BLOCKED AS EXPECTED] Error: ${rpcError.message}`);
        } else {
          rpcText = 'FAIL (ALLOWED BYPASS)';
          notes += ' SECURITY FAILURE: Operational role bypassed RPC authorization!';
          console.error(`[SECURITY FAILURE] ${item.label} bypassed RPC security!`);
        }
      }
    } else {
      rpcText = 'SKIPPED (No valid service)';
    }

    // Determine overall result
    const isDirectOk = item.shouldAllowInsert ? directInsertText.startsWith('PASS') : directInsertText.startsWith('PASS');
    const isRpcOk = item.shouldAllowInsert ? rpcText.startsWith('PASS') : rpcText.startsWith('PASS');
    overallResult = isDirectOk && isRpcOk ? 'PASS' : 'FAIL';

    results.push({
      role: item.label,
      login: loginStatus,
      profileRole: profileRoleText,
      directInsert: directInsertText,
      rpcCreateOrder: rpcText,
      result: overallResult,
      notes: notes.trim() || undefined,
    });

    // E. Logout session
    await supabase.auth.signOut();
  }

  return results;
}

if (require.main === module) {
  runRealSupabaseRlsTest().then((res) => {
    console.log('\n===========================================================');
    console.log('REAL SUPABASE RLS SECURITY TEST RESULTS');
    console.log('===========================================================');
    console.table(res);
  });
}
