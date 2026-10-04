import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function check() {
  console.log("Checking settings...")
  const { data: existing, error: err1 } = await supabase.from('hackathon_settings').select('id').limit(1).maybeSingle()
  console.log("Existing:", existing, "Error1:", err1)
  
  const payload = {
        timer_start: new Date().toISOString(),
        duration_hours: 24,
        is_running: true,
        updated_at: new Date().toISOString()
  }

  if (existing) {
      const { error: err2 } = await supabase.from('hackathon_settings').update(payload).eq('id', existing.id)
      console.log("Update Error:", err2)
  } else {
      const { error: err3 } = await supabase.from('hackathon_settings').insert(payload)
      console.log("Insert Error:", err3)
  }
}
check()
