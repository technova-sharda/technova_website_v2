/** Small helpers for the phone app's JSON API (/api/mobile/v1). Server-only. */
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export const json = (body: unknown, init: ResponseInit = {}) =>
    NextResponse.json(body, { ...init, headers: { "Cache-Control": "private, no-store", ...(init.headers ?? {}) } })

export const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => json({ error, ...extra }, { status })

/** The signed-in user (Bearer token from the app, or a browser cookie). */
export async function requireUser() {
    const session = await auth()
    return session?.user?.id ? session : null
}

export const siteUrl = () => (process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://technovashardauniversity.in").replace(/\/$/, "")
