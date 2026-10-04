const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
    await client.connect();
    const sql = fs.readFileSync('supabase/migrations/20260311_hackathon_revamp.sql', 'utf8');
    await client.query(sql);
    console.log("Migration executed successfully!");
    await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
