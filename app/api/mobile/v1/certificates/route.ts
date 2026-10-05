import { requireUser, fail, json } from "@/lib/mobile/api"
import { myCertificates } from "@/lib/mobile/data"

/** GET /api/mobile/v1/certificates */
export async function GET() {
    const session = await requireUser()
    if (!session) return fail(401, "Sign in again")
    return json({ certificates: await myCertificates(session.user.id!) })
}
