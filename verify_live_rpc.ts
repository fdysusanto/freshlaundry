import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
for (const line of envFile.split('\n')) {
  if (line.includes('=')) {
    const [key, ...rest] = line.split('=');
    env[key.trim()] = rest.join('=').trim().replace(/^"|"$/g, '');
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase.rpc('accept_courier_assignment_atomic', { p_assignment_id: '00000000-0000-0000-0000-000000000000', p_courier_id: '00000000-0000-0000-0000-000000000000' });
  console.log('Result:', JSON.stringify(data), 'Error:', error?.message);
}
test();
