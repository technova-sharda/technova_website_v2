import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { createMobileSession, verifyCode } from "@/lib/mobile/session"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"
import { fail, json } from "@/lib/mobile/api"

/** Step 4: the app swaps code + verifier for its own session token. */
export async function POST(req: NextRequest) {
    const limit = checkRateLimit(getClientIdentifier(req), { limit: 20, windowSeconds: 60, bucket: "mobile-token" })
    if (!limit.success) return fail(429, "Too many attempts. Wait a minute.")
    const body = await req.json().catch(() => ({}))
    const userId = verifyCode(body?.code ?? "", body?.verifier ?? "")
    if (!userId) return fail(401, "Sign-in expired. Try again.")
    const { data: user } = await createAdminClient().schema("next_auth").from("users").select("id, name, email, image, role, system_id").eq("id", userId).maybeSingle()
    if (!user) return fail(404, "Account not found")
    const session = await createMobileSession(userId)
    return json({ ...session, user: { ...user, needsOnboarding: user.role === "student" && !user.system_id } })
}
