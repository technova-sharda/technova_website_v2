import { requireUser, fail, json } from "@/lib/mobile/api"
import { myTickets } from "@/lib/mobile/data"

/** GET /api/mobile/v1/tickets: upcoming and live registrations, with the QR to show at the door. */
export async function GET() {
    const session = await requireUser()
    if (!session) return fail(401, "Sign in again")
    return json({ tickets: await myTickets(session.user.id!) })
}
