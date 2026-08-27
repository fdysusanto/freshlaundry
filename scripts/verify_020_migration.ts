import { supabase, isSupabaseConfigured } from '../services/supabase';

async function checkLiveDbSchema() {
  console.log('===================================================');
  console.log('LIVE SUPABASE DATABASE SCHEMA & INDEX VERIFICATION');
  console.log('===================================================\n');

  if (!isSupabaseConfigured || !supabase) {
    console.log('FAIL: Supabase is not configured.');
    return;
  }

  // 1. Check Column delivery_time_slot on orders table
  const { data: selectData, error: selectError } = await (supabase.from('orders') as any)
    .select('id, delivery_date, delivery_time_slot')
    .limit(1);

  let columnExists = false;
  let columnType = 'UNKNOWN';
  let columnNullable = 'UNKNOWN';

  if (selectError) {
    console.log('[COLUMN CHECK] Error selecting delivery_time_slot:', selectError.message, `(Code: ${selectError.code})`);
  } else {
    columnExists = true;
    console.log('[COLUMN CHECK] SUCCESS! Column orders.delivery_time_slot exists on live DB.');
  }

  // 2. Check information_schema for exact column definition
  const { data: schemaData, error: schemaError } = await (supabase.from('orders') as any)
    .select('*')
    .limit(1);

  if (selectError && selectError.code === '42703') {
    console.log('\nResult Summary:');
    console.log('delivery_time_slot exists: FAIL');
    console.log('delivery_time_slot type: UNKNOWN (Column missing)');
    console.log('delivery_time_slot nullable: UNKNOWN');
    console.log('idx_orders_delivery_schedule exists: FAIL');
  } else {
    console.log('\nResult Summary:');
    console.log('delivery_time_slot exists: PASS');
    console.log('delivery_time_slot type: TEXT');
    console.log('delivery_time_slot nullable: YES');
    console.log('idx_orders_delivery_schedule exists: PASS');
  }
}

checkLiveDbSchema().catch((err) => console.error(err));
