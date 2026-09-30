import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const uid = 'a2c1d90b-c638-4e28-9c37-e38302219235';
  
  // Check community_profiles
  const { data: p } = await supabase.from('community_profiles').select('id').eq('id', uid);
  console.log('community_profiles:', p);
  
  // Check hackathon_participants
  const { data: h } = await supabase.from('hackathon_participants').select('id').eq('id', uid);
  console.log('hackathon_participants:', h);
}

check();
