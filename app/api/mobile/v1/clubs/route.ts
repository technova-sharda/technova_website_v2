import { requireUser, fail, json } from "@/lib/mobile/api"
import { listClubs } from "@/lib/mobile/data"

/** GET /api/mobile/v1/clubs */
export async function GET() {
    if (!(await requireUser())) return fail(401, "Sign in again")
    return json({ clubs: await listClubs() })
}
