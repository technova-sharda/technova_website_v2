import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data, error } = await supabase.from('users').select('*').eq('email', '2026171913.naina@ug.sharda.ac.in');
  console.log('Query users:', data, error);

  // Let's also check next_auth.users because NextAuth uses the next_auth schema
  // wait, the supabase client uses the default schema (public).
  // NextAuth uses next_auth schema. Let's specify schema: 'next_auth'
  
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { db: { schema: 'next_auth' } }
  );
  
  const { data: authData, error: authError } = await authClient.from('users').select('*').eq('email', '2026171913.naina@ug.sharda.ac.in');
  console.log('Query next_auth.users:', authData, authError);
}

test();
