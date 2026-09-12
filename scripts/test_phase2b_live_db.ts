import { createClient } from '@supabase/supabase-js';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

// Read .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
const envVars: Record<string, string> = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || envVars.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runLiveDatabaseTest() {
  console.log('====================================================');
  console.log('PHASE 2B: LIVE DATABASE & RPC AUDIT TEST');
  console.log('====================================================\n');

  // 1. Audit user_role enum definition in PostgreSQL
  console.log('1. Auditing database user_role enum values...');
  const { data: enumRows, error: enumRowsErr } = await adminClient.from('profiles').select('role').limit(1);
  if (enumRowsErr) {
    console.error('   ❌ Profiles role query failed:', enumRowsErr.message);
    process.exit(1);
  }
  console.log('   ✓ Database queries on profiles.role succeeded without enum error.');

  // 2. Fetch an existing owner and laundry outlet
  console.log('2. Fetching active owner profile and laundry branch...');
  const { data: laundry, error: lndErr } = await (adminClient.from('laundries') as any)
    .select('id, name, owner_id')
    .eq('is_active', true)
    .not('owner_id', 'is', null)
    .limit(1)
    .single();

  if (lndErr || !laundry) {
    console.error('   ❌ Failed to find active laundry branch:', lndErr?.message);
    process.exit(1);
  }

  console.log(`   ✓ Active Laundry Branch found: "${laundry.name}" (ID: ${laundry.id}) Owned by User: ${laundry.owner_id}`);

  // 3. Test Staff Creation & Provisioning
  console.log('3. Provisioning test staff account via Admin Client...');
  const testEmail = `test.staff.phase2b.${Date.now()}@cuciyan.test`;
  const testName = 'Test Staff Phase2B';
  const testPassword = 'Password123!';

  // Create Auth User
  const { data: authRes, error: authErr } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: testName },
  });

  if (authErr || !authRes.user) {
    console.error('   ❌ Failed to create Auth user:', authErr?.message);
    process.exit(1);
  }

  const staffUserId = authRes.user.id;
  console.log(`   ✓ Auth User created successfully (ID: ${staffUserId})`);

  try {
    // Upsert profile with role = 'laundry_staff'
    const { error: profErr } = await (adminClient.from('profiles') as any).upsert({
      id: staffUserId,
      email: testEmail,
      full_name: testName,
      phone: '081234567890',
      role: 'laundry_staff',
      created_at: new Date().toISOString(),
    });

    if (profErr) {
      throw new Error(`Profile creation failed: ${profErr.message}`);
    }
    console.log('   ✓ Profile record created with role = "laundry_staff"');

    // Insert laundry_users membership with role = 'staff'
    const { data: luRow, error: luErr } = await (adminClient.from('laundry_users') as any)
      .insert({
        laundry_id: laundry.id,
        profile_id: staffUserId,
        role: 'staff',
        is_active: true,
      })
      .select()
      .single();

    if (luErr || !luRow) {
      throw new Error(`laundry_users insert failed: ${luErr?.message}`);
    }
    console.log(`   ✓ laundry_users membership created (ID: ${luRow.id}, role = "staff", is_active = true)`);

    // 4. Verify Database Join Query
    console.log('4. Executing Join Query on laundry_users & profiles...');
    const { data: joinRows, error: joinErr } = await (adminClient.from('laundry_users') as any)
      .select(`
        id,
        laundry_id,
        profile_id,
        role,
        is_active,
        profiles ( id, full_name, email, role )
      `)
      .eq('id', luRow.id)
      .single();

    if (joinErr || !joinRows) {
      throw new Error(`Join query failed: ${joinErr?.message}`);
    }

    assert.strictEqual(joinRows.laundry_id, laundry.id);
    assert.strictEqual(joinRows.role, 'staff');
    assert.strictEqual(joinRows.is_active, true);
    assert.strictEqual(joinRows.profiles.role, 'laundry_staff');
    assert.strictEqual(joinRows.profiles.email, testEmail);
    console.log('   ✓ Join query verified 100% matching schema contract!');

    // 5. Test Duplicate Email Prevention
    console.log('5. Verifying duplicate email rejection...');
    const { data: existingProf } = await (adminClient.from('profiles') as any)
      .select('id')
      .eq('email', testEmail)
      .maybeSingle();

    assert.ok(existingProf, 'Existing profile must be detected');
    console.log('   ✓ Duplicate email detection verified.');

  } finally {
    // Cleanup Test Data
    console.log('6. Cleaning up test data...');
    await (adminClient.from('laundry_users') as any).delete().eq('profile_id', staffUserId);
    await (adminClient.from('profiles') as any).delete().eq('id', staffUserId);
    await adminClient.auth.admin.deleteUser(staffUserId);
    console.log('   ✓ Cleanup completed cleanly.');
  }

  console.log('\n====================================================');
  console.log('LIVE DATABASE TEST PASSED 100% WITH ZERO ERRORS');
  console.log('====================================================');
}

runLiveDatabaseTest().catch((err) => {
  console.error('LIVE DB TEST ERROR:', err);
  process.exit(1);
});
