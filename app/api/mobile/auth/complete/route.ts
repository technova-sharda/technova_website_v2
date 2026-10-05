import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAllowedAppRedirect, signCode } from "@/lib/mobile/session"

/** Step 3: the student is signed in on the website; send a short-lived code back to the app. */
export async function GET(req: NextRequest) {
    let pending: { challenge?: string; redirect?: string } = {}
    try { pending = JSON.parse(req.cookies.get("tn_mobile_auth")?.value ?? "{}") } catch { /* missing or broken */ }
    if (!pending.challenge || !pending.redirect || !isAllowedAppRedirect(pending.redirect)) {
        return NextResponse.json({ error: "Sign-in expired. Start again from the app." }, { status: 400 })
    }
    const session = await auth()
    if (!session?.user?.id) {
        const login = new URL("/login", req.nextUrl.origin)
        login.searchParams.set("callbackUrl", "/api/mobile/auth/complete")
        return NextResponse.redirect(login)
    }
    const back = new URL(pending.redirect)
    back.searchParams.set("code", signCode(session.user.id, pending.challenge))
    const res = NextResponse.redirect(back.toString())
    res.cookies.delete({ name: "tn_mobile_auth", path: "/api/mobile/auth" })
    return res
}
