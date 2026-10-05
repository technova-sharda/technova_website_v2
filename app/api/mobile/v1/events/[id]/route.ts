import { requireUser, fail, json } from "@/lib/mobile/api"
import { eventDetail } from "@/lib/mobile/data"

/** GET /api/mobile/v1/events/<id or slug> */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireUser()
    if (!session) return fail(401, "Sign in again")
    const { id } = await params
    const event = await eventDetail(session.user.id!, decodeURIComponent(id))
    return event ? json({ event }) : fail(404, "Event not found")
}
