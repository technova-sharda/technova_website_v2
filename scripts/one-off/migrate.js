const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  await client.connect();
  
  try {
    const res1 = await client.query('ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS evaluations_open BOOLEAN DEFAULT true;');
    console.log("Added evaluations_open");

    const res2 = await client.query('ALTER TABLE public.form_evaluations ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;');
    console.log("Added is_locked");

    const res3 = await client.query("ALTER TABLE public.form_evaluations ADD COLUMN IF NOT EXISTS unlock_status TEXT DEFAULT 'none';");
    console.log("Added unlock_status");

    console.log("Migration successful");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

run();
