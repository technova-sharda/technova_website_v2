import { NextRequest } from "next/server"
import { requireUser, fail, json } from "@/lib/mobile/api"
import { listEvents } from "@/lib/mobile/data"

/** GET /api/mobile/v1/events?scope=upcoming|past&q= */
export async function GET(req: NextRequest) {
    const session = await requireUser()
    if (!session) return fail(401, "Sign in again")
    const scope = req.nextUrl.searchParams.get("scope") === "past" ? "past" : "upcoming"
    return json({ events: await listEvents(session.user.id!, scope, req.nextUrl.searchParams.get("q") ?? "") })
}
