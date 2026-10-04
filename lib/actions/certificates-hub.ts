'use server'

import { auth } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { fetchInChunks } from "@/lib/supabase/fetch-all"

/** Certificates hub search (super admins). Read-only. */
export type CertificateHit = {
    certificate_id: string; status: string; issued_at: string; emailed: boolean; downloads: number
    type: string | null; role_title: string | null
    event: { id: string; title: string } | null
    student: { name: string | null; email: string | null } | null
}

export async function searchCertificates(query: string): Promise<CertificateHit[]> {
    const session = await auth()
    if (session?.user?.role !== "super_admin") throw new Error("Unauthorized")
    const q = query.replace(/[%_,()*\\]/g, " ").trim().slice(0, 80)
    if (q.length < 2) return []

    const sb = createAdminClient()
    const select = "certificate_id, status, issued_at, email_sent_at, downloaded_count, certificate_type, role_title, user_id, event:events(id, title)"

    // 1. Certificate ID (case-insensitive prefix)
    const byId = await sb.from("certificates").select(select).ilike("certificate_id", `${q}%`).limit(20)
    let rows: any[] = byId.data ?? []

    // 2. Student name or email
    if (rows.length === 0) {
        const { data: users } = await sb.schema("next_auth").from("users").select("id").or(`name.ilike.%${q}%,email.ilike.%${q}%`).limit(30)
        const ids = (users ?? []).map(u => u.id)
        if (ids.length) {
            const res = await fetchInChunks<any>(ids, chunk => sb.from("certificates").select(select).in("user_id", chunk).order("issued_at", { ascending: false }))
            rows = res.data.slice(0, 50)
        }
    }
    if (rows.length === 0) return []

    const { data: people } = await fetchInChunks<any>(
        Array.from(new Set(rows.map(r => r.user_id))),
        chunk => sb.schema("next_auth").from("users").select("id, name, email").in("id", chunk)
    )
    const personById = new Map(people.map(p => [p.id, p]))

    return rows.map(r => {
        const ev = Array.isArray(r.event) ? r.event[0] : r.event
        const p = personById.get(r.user_id)
        return {
            certificate_id: r.certificate_id, status: r.status, issued_at: r.issued_at, emailed: !!r.email_sent_at,
            downloads: r.downloaded_count ?? 0, type: r.certificate_type ?? null, role_title: r.role_title ?? null,
            event: ev ? { id: ev.id, title: ev.title } : null,
            student: p ? { name: p.name ?? null, email: p.email ?? null } : null,
        }
    })
}
