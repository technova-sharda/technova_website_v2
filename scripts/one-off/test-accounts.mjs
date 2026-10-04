import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'next_auth' } }
);

async function test() {
  const { data, error } = await authClient.from('accounts').select('*').eq('userId', 'a2c1d90b-c638-4e28-9c37-e38302219235');
  console.log('Accounts for user:', data, error);
}

test();
