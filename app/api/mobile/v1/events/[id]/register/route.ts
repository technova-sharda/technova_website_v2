import { requireUser, fail, json } from "@/lib/mobile/api"
import { eventDetail } from "@/lib/mobile/data"
import { registerForEvent } from "@/lib/actions/registrations"

/**
 * POST /api/mobile/v1/events/<id>/register
 * Free events without extra questions register right here (same rules, capacity
 * check and ticket email as the website). Paid events and events with a
 * registration form answer 409 with the web page to finish on.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireUser()
    if (!session) return fail(401, "Sign in again")
    if ((session.user as any).role === "student" && !(session.user as any).system_id) return fail(409, "Finish your profile first", { needsOnboarding: true })
    const { id } = await params
    const before = await eventDetail(session.user.id!, id)
    if (!before) return fail(404, "Event not found")
    if (!before.canRegisterInApp) return fail(409, before.price > 0 ? "This is a paid event. Finish on the website." : "This event has a registration form. Finish on the website.", { webUrl: before.webUrl })
    try {
        await registerForEvent(before.id)
    } catch (e: any) {
        return fail(400, e?.message || "Couldn't register")
    }
    return json({ event: await eventDetail(session.user.id!, before.id) })
}
