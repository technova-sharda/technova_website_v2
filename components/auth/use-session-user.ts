'use client'

import { useEffect, useState } from "react"

export type SessionUser = {
    id?: string
    name?: string | null
    email?: string | null
    image?: string | null
    role?: 'student' | 'admin' | 'super_admin' | 'evaluator' | 'student_lead'
}

// One request per page load, shared by every component that asks.
let pending: Promise<SessionUser | null> | null = null

export function fetchSessionUser(): Promise<SessionUser | null> {
    pending ??= fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" })
        .then(r => (r.ok ? r.json() : null))
        .then(j => (j?.user ?? null) as SessionUser | null)
        .catch(() => null)
    return pending
}

/**
 * Who's signed in, read in the browser. Public pages don't read the session on the
 * server (that's what lets them be pre-built and served from the CDN).
 * Pass `known` when the server already has the user (dashboard); otherwise
 * `undefined` means "still loading" and `null` means "signed out".
 */
export function useSessionUser(known?: SessionUser | null): SessionUser | null | undefined {
    const [user, setUser] = useState<SessionUser | null | undefined>(known)
    useEffect(() => {
        if (known !== undefined) return
        let alive = true
        fetchSessionUser().then(u => { if (alive) setUser(u) })
        return () => { alive = false }
    }, [known])
    return known !== undefined ? known : user
}
