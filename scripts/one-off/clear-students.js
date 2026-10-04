
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })
const { Client } = require('pg')

const url = process.env.DATABASE_URL
if (!url) {
    console.error("DATABASE_URL is missing")
    process.exit(1)
}

const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
})

async function clearStudents() {
    try {
        await client.connect()
        console.log("Connected to database")

        // 1. Get Student IDs
        const res = await client.query(`SELECT id, email FROM next_auth.users WHERE role = 'student'`)
        const students = res.rows
        const studentIds = students.map(s => s.id)

        console.log(`Found ${studentIds.length} students to remove.`)

        if (studentIds.length === 0) {
            console.log("No students found.")
            return
        }

        // 2. Delete Registrations (Manual cleanup due to missing cross-schema FK)
        // We use parameterized queries for safety. Since IN clause with array is tricky in plain SQL with pg, we can use ANY()
        const deleteRegRes = await client.query(`
            DELETE FROM public.registrations 
            WHERE user_id = ANY($1::uuid[])
        `, [studentIds])
        console.log(`Deleted ${deleteRegRes.rowCount} registrations.`)

        // 3. Delete Users
        // Accounts and Sessions should cascade delete
        const deleteUsersRes = await client.query(`
            DELETE FROM next_auth.users 
            WHERE id = ANY($1::uuid[])
        `, [studentIds])
        console.log(`Deleted ${deleteUsersRes.rowCount} student users.`)

    } catch (err) {
        console.error("Error clearing students:", err)
        process.exit(1)
    } finally {
        await client.end()
    }
}

clearStudents()
