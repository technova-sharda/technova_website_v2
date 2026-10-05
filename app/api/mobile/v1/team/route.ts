import { requireUser, fail, json } from "@/lib/mobile/api"
import { team } from "@/lib/mobile/data"

/** GET /api/mobile/v1/team: faculty mentors and Technova executives (same order as the Leadership page). */
export async function GET() {
    if (!(await requireUser())) return fail(401, "Sign in again")
    return json(await team())
}
