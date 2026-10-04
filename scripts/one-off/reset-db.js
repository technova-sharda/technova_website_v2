
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

console.log("Starting DB Reset & Migration (v2 - Full Drop)...")

const rawUrl = process.env.DATABASE_URL
if (!rawUrl) {
    console.error("No DATABASE_URL")
    process.exit(1)
}

let connectionString = rawUrl
try {
    new URL(rawUrl)
} catch (e) {
    const lastAt = rawUrl.lastIndexOf('@')
    const schemaEnd = rawUrl.indexOf('://')
    if (lastAt > -1 && schemaEnd > -1) {
        const userPass = rawUrl.substring(schemaEnd + 3, lastAt)
        const hostPart = rawUrl.substring(lastAt + 1)
        const firstColon = userPass.indexOf(':')
        if (firstColon > -1) {
            const user = userPass.substring(0, firstColon)
            const password = userPass.substring(firstColon + 1)
            connectionString = `postgresql://${user}:${encodeURIComponent(password)}@${hostPart}`
        }
    }
}

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
})

async function run() {
    try {
        await client.connect()
        console.log("Connected to DB.")

        // 1. Drop EVERYTHING
        console.log("Dropping all tables...")
        await client.query(`DROP SCHEMA IF EXISTS next_auth CASCADE;`)
        await client.query(`DROP TABLE IF EXISTS public.registrations CASCADE;`)
        await client.query(`DROP TABLE IF EXISTS public.events CASCADE;`)
        await client.query(`DROP TABLE IF EXISTS public.admin_roles CASCADE;`)
        await client.query(`DROP TABLE IF EXISTS public.clubs CASCADE;`)
        await client.query(`DROP TABLE IF EXISTS public.accounts CASCADE;`)
        await client.query(`DROP TABLE IF EXISTS public.sessions CASCADE;`)
        await client.query(`DROP TABLE IF EXISTS public.verification_tokens CASCADE;`)
        await client.query(`DROP TABLE IF EXISTS public.users CASCADE;`)

        // 2. Run 0000 (Auth Tables)
        console.log("Running Migration 0000...")
        const sql0 = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', '0000_setup_auth_tables.sql'), 'utf8')
        await client.query(sql0)

        // 3. Run 0001 (Event Tables)
        console.log("Running Migration 0001...")
        const sql1 = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', '0001_setup_event_tables.sql'), 'utf8')
        await client.query(sql1)

        console.log("DB Reset & Migration Complete!")

    } catch (err) {
        console.error("Migration Error:", err)
    } finally {
        await client.end()
    }
}

run()
