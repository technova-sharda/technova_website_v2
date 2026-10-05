/**
 * Sign-in for the Technova phone app.
 *
 * The app gets an ordinary Auth.js database session (a row in next_auth.sessions,
 * same as a browser) and sends its token as `Authorization: Bearer <token>`.
 * auth() reads that header (lib/auth/index.ts), so every existing route and
 * permission check works for the app unchanged, and signing out deletes the row.
 *
 * Hand-off (PKCE-style, so another app on the phone can't steal the login):
 *  1. App makes a random verifier and opens /api/mobile/auth/start?challenge=sha256(verifier)
 *     in the system browser.
 *  2. The student signs in with Google on the website as usual.
 *  3. /api/mobile/auth/complete redirects back to the app with a 2-minute signed code
 *     bound to the challenge.
 *  4. The app POSTs code + verifier to /api/mobile/auth/token and gets its session token.
 *
 * Server-only module.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/server"

export const MOBILE_SESSION_DAYS = 90
const CODE_TTL_MS = 2 * 60 * 1000

/** Where the app may be sent back to: the installed app, or Expo Go during development. */
export function isAllowedAppRedirect(url: string) {
    return /^technova:\/\//.test(url) || /^exp(s)?:\/\/[^\s]+$/.test(url)
}

const b64url = (buf: Buffer) => buf.toString("base64url")
const secret = () => {
    const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
    if (!s) throw new Error("AUTH_SECRET is not set")
    return s
}

export function signCode(userId: string, challenge: string) {
    const body = b64url(Buffer.from(JSON.stringify({ u: userId, c: challenge, x: Date.now() + CODE_TTL_MS })))
    const sig = b64url(createHmac("sha256", secret()).update(`mobile-code.${body}`).digest())
    return `${body}.${sig}`
}

/** Returns the user id when the code is genuine, unexpired and matches the verifier. */
export function verifyCode(code: string, verifier: string): string | null {
    const [body, sig] = String(code).split(".")
    if (!body || !sig) return null
    const expected = createHmac("sha256", secret()).update(`mobile-code.${body}`).digest()
    const given = Buffer.from(sig, "base64url")
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    let data: { u: string; c: string; x: number }
    try { data = JSON.parse(Buffer.from(body, "base64url").toString()) } catch { return null }
    if (!data?.u || Date.now() > data.x) return null
    const challenge = b64url(createHash("sha256").update(String(verifier)).digest())
    return challenge === data.c ? data.u : null
}

/** Creates a database session for the app, exactly like Auth.js does for a browser. */
export async function createMobileSession(userId: string) {
    const sessionToken = randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + MOBILE_SESSION_DAYS * 86_400_000)
    const { error } = await createAdminClient().schema("next_auth").from("sessions").insert({ sessionToken, userId, expires: expires.toISOString() })
    if (error) throw new Error(error.message)
    return { token: sessionToken, expires: expires.toISOString() }
}

export async function deleteMobileSession(token: string) {
    await createAdminClient().schema("next_auth").from("sessions").delete().eq("sessionToken", token)
}

/** Session for an `Authorization: Bearer` token, shaped like Auth.js's database session. */
export async function sessionFromBearer(token: string) {
    if (!/^[a-f0-9]{64}$/i.test(token)) return null
    const sb = createAdminClient().schema("next_auth")
    const { data: row } = await sb.from("sessions").select("userId, expires").eq("sessionToken", token).maybeSingle()
    if (!row || new Date(row.expires).getTime() < Date.now()) return null
    const { data: user } = await sb.from("users").select("*").eq("id", row.userId).maybeSingle()
    if (!user) return null
    return { user, expires: row.expires as string }
}
