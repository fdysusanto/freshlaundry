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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function auditTestAccounts() {
  if (!supabaseUrl || !supabaseKey) {
    console.log('SUPABASE_NOT_CONFIGURED');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const emails = [
    'test-customer@freshlaundry.com',
    'test-courier@freshlaundry.com',
    'test-owner@freshlaundry.com',
    'test-staff@freshlaundry.com',
    'test-admin@freshlaundry.com',
  ];

  console.log('Auditing Supabase test accounts...\n');

  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, role')
      .in('email', emails);

    if (error) {
      console.error('Error fetching profiles:', error.message);
      return;
    }

    const profileMap = new Map((profiles || []).map((p) => [p.email, p]));

    const results = emails.map((email) => {
      const prof = profileMap.get(email);
      return {
        email,
        auth_user_exists: Boolean(prof),
        profile_exists: Boolean(prof),
        role: prof?.role || 'N/A',
        status: prof ? 'EXISTS' : 'MISSING',
      };
    });

    console.log(JSON.stringify(results, null, 2));
  } catch (err: any) {
    console.error('Network / Supabase error:', err.message);
  }
}

auditTestAccounts();
