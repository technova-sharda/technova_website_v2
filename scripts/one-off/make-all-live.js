
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function makeLive() {
    const { error } = await supabase.from('events')
        .update({ status: 'live' })
        .eq('status', 'draft')

    if (error) console.error(error)
    else console.log("Updated drafts to live.")
}

makeLive()
