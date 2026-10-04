const { Client } = require('pg');
require('dotenv').config();
const client = new Client({ connectionString: process.env.DATABASE_URL });
async function main() {
    await client.connect();
    const res = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'hackathon_evaluations'`);
    console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
}
main().catch(console.error);
