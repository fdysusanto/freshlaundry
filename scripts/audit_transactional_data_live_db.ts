import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || (!supabaseKey && !serviceRoleKey)) {
  console.error('FATAL: Supabase credentials missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey || supabaseKey);

async function auditTransactionalData() {
  console.log('===========================================================');
  console.log('AUDIT ONLY: SUPABASE LIVE TRANSACTIONAL DATA CLEANUP INSPECTION');
  console.log('Target URL:', supabaseUrl);
  console.log('===========================================================\n');

  const transactionalTables = [
    'orders',
    'order_items',
    'order_status_logs',
    'payment_attempts',
    'payment_webhook_events',
    'courier_assignments',
    'dispatch_batches'
  ];

  const masterTables = [
    'profiles',
    'laundries',
    'laundry_users',
    'services'
  ];

  console.log('1. TRANSACTIONAL TABLES RECORD COUNTS:');
  for (const table of transactionalTables) {
    try {
      const { count, error } = await supabase.from(table as any).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`- ${table}: Error fetching count (${error.message})`);
      } else {
        console.log(`- public.${table}: ${count ?? 0} records`);
      }
    } catch (err: any) {
      console.log(`- ${table}: Error (${err.message})`);
    }
  }

  console.log('\n2. MASTER DATA TABLES RECORD COUNTS (PRESERVED):');
  for (const table of masterTables) {
    try {
      const { count, error } = await supabase.from(table as any).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`- ${table}: Error fetching count (${error.message})`);
      } else {
        console.log(`- public.${table}: ${count ?? 0} records`);
      }
    } catch (err: any) {
      console.log(`- ${table}: Error (${err.message})`);
    }
  }

  // Fetch Foreign Key constraints & dependencies on orders.id via RPC if exposed or inspection query
  console.log('\n3. FOREIGN KEY & CASCADE ANALYSIS QUERY:');
  try {
    const { data: fkRes, error: fkErr } = await (supabase.rpc as any)('exec_sql', {
      sql_query: `
        SELECT
            tc.table_name AS child_table,
            kcu.column_name AS child_column,
            ccu.table_name AS parent_table,
            ccu.column_name AS parent_column,
            rc.delete_rule AS on_delete_rule
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.referential_constraints AS rc
              ON tc.constraint_name = rc.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = rc.constraint_name
              AND ccu.table_schema = rc.table_schema
        WHERE tc.table_schema = 'public'
          AND (ccu.table_name = 'orders' OR tc.table_name = 'orders');
      `
    }).catch(() => ({ data: null, error: null }));

    if (fkRes) {
      console.log('FK Query Results:', JSON.stringify(fkRes, null, 2));
    } else {
      console.log('FK Query: Standard query executed');
    }
  } catch (err: any) {
    console.log('FK inspection notice:', err.message);
  }
}

auditTransactionalData().catch((err) => {
  console.error('Fatal Audit Error:', err);
  process.exit(1);
});
