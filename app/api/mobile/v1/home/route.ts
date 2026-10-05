import { requireUser, fail, json } from "@/lib/mobile/api"
import { listEvents, myTickets } from "@/lib/mobile/data"

/** GET /api/mobile/v1/home: everything the Home tab needs in one request. */
export async function GET() {
    const session = await requireUser()
    if (!session) return fail(401, "Sign in again")
    const [upcoming, tickets] = await Promise.all([listEvents(session.user.id!, "upcoming"), myTickets(session.user.id!)])
    return json({
        nextTicket: tickets[0] ?? null,
        live: upcoming.filter(e => e.phase === "live"),
        upcoming: upcoming.filter(e => e.phase === "upcoming").slice(0, 12),
    })
}
