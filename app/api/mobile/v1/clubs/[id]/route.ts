import { requireUser, fail, json } from "@/lib/mobile/api"
import { clubDetail } from "@/lib/mobile/data"

/** GET /api/mobile/v1/clubs/<id>: about, coordinators (public contact details, by design), events. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireUser()
    if (!session) return fail(401, "Sign in again")
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "Club not found")
    const club = await clubDetail(session.user.id!, id)
    return club ? json({ club }) : fail(404, "Club not found")
}
