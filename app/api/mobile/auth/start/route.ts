import { NextRequest, NextResponse } from "next/server"
import { isAllowedAppRedirect } from "@/lib/mobile/session"

/**
 * Step 1 of app sign-in, opened in the phone's browser:
 * /api/mobile/auth/start?challenge=<sha256(verifier)>&redirect=technova://auth
 * Remembers both for 10 minutes, then sends the student through the normal Google login.
 */
export async function GET(req: NextRequest) {
    const challenge = req.nextUrl.searchParams.get("challenge") ?? ""
    const redirect = req.nextUrl.searchParams.get("redirect") ?? ""
    if (!/^[A-Za-z0-9_-]{43}$/.test(challenge) || !isAllowedAppRedirect(redirect)) {
        return NextResponse.json({ error: "Invalid sign-in request" }, { status: 400 })
    }
    const login = new URL("/login", req.nextUrl.origin)
    login.searchParams.set("callbackUrl", "/api/mobile/auth/complete")
    const res = NextResponse.redirect(login)
    res.cookies.set("tn_mobile_auth", JSON.stringify({ challenge, redirect }), {
        httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", maxAge: 600, path: "/api/mobile/auth",
    })
    return res
}
