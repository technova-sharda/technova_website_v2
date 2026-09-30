import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'next_auth' } }
);

async function del() {
  const { error } = await authClient.from('users').delete().eq('email', '2026171913.naina@ug.sharda.ac.in');
  console.log('Deleted user:', error);
}

del();
