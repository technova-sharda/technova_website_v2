/**
 * Admin activity log (/admin/logs). Every successful write made through the
 * server's Supabase clients (insert / update / upsert / delete, storage upload /
 * remove) is recorded when the signed-in user is a super admin, or when the
 * change comes from Club Management. Nothing to add per action: new features
 * are covered automatically.
 *
 * Zero added latency: the entry is written with after(), once the response has
 * been sent. Logging never throws and never blocks the actual change.
 * Scanner (admin role) check-ins and students' own actions are not logged.
 *
 * Table: admin_audit_log (supabase/migrations/20261005_admin_audit_log.sql).
 */
import { cache } from "react"
import { after } from "next/server"
import { headers } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export const AUDIT_TABLE = "admin_audit_log"

/** Tables never logged: auth plumbing (written on every sign-in) and the log itself. */
const SKIP = new Set([AUDIT_TABLE, "sessions", "accounts", "verification_tokens", "email_logs"])

/** Readable name and the column holding a row's name, for tables admins change. */
const ENTITIES: Record<string, { label: string; nameCol?: string }> = {
    events: { label: "Event", nameCol: "title" },
    clubs: { label: "Club", nameCol: "name" },
    club_members: { label: "Club member", nameCol: "name" },
    registrations: { label: "Registration" },
    daily_checkins: { label: "Check-in" },
    certificates: { label: "Certificate", nameCol: "certificate_id" },
    certificate_templates: { label: "Certificate template" },
    certificate_positions: { label: "Position certificate", nameCol: "title" },
    event_feedback_forms: { label: "Feedback form", nameCol: "title" },
    feedback_questions: { label: "Feedback question", nameCol: "label" },
    feedback_responses: { label: "Feedback response" },
    forms: { label: "Form", nameCol: "title" },
    form_fields: { label: "Form field", nameCol: "label" },
    form_evaluators: { label: "Form evaluator", nameCol: "name" },
    hackathon_teams: { label: "Hackathon team", nameCol: "name" },
    hackathon_participants: { label: "Hackathon participant", nameCol: "name" },
    hackathon_evaluators: { label: "Hackathon evaluator", nameCol: "name" },
    hackathon_volunteers: { label: "Hackathon volunteer", nameCol: "name" },
    hackathon_schedule: { label: "Hackathon schedule item", nameCol: "title" },
    hackathon_settings: { label: "Hackathon settings" },
    hackathon_roles: { label: "Hackathon role", nameCol: "email" },
    resources: { label: "Resource", nameCol: "title" },
    projects: { label: "Project", nameCol: "title" },
    community_posts: { label: "Community post", nameCol: "title" },
    bug_reports: { label: "Bug report", nameCol: "title" },
    event_attendees: { label: "Event attendee", nameCol: "name" },
    users: { label: "User", nameCol: "name" },
    role_changes: { label: "Role change" },
    xp_awards: { label: "XP award" },
    sponsorships: { label: "Sponsorship" },
    referrals: { label: "Referral" },
}

export function entityLabel(entity: string) {
    if (entity.startsWith("storage:")) return `File (${entity.slice(8)})`
    const known = ENTITIES[entity]?.label
    if (known) return known
    const words = entity.replace(/_/g, " ")
    return words.charAt(0).toUpperCase() + words.slice(1).replace(/s$/, "")
}

/** Raw service-role client for the log itself and label lookups (not audited, no recursion). */
function rawClient() {
    return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } })
}

type Entry = { action: string; entity: string; summary: string; targetId?: string | null; targetLabel?: string | null; details?: unknown }

/**
 * Per-request buffer: everything one click changes is saved together, with one
 * session check and one insert, after the response. Entries share a request id
 * so the page can group them.
 */
const requestBuffer = cache(() => ({ id: crypto.randomUUID(), jobs: [] as (() => Promise<Entry | null>)[], scheduled: false }))

function enqueue(job: () => Promise<Entry | null>) {
    try {
        const buf = requestBuffer()
        buf.jobs.push(job)
        if (buf.scheduled) return
        buf.scheduled = true
        after(() => flush(buf).catch(e => console.warn("[audit] skipped:", e?.message)))
    } catch {
        // outside a request (scripts, build): nothing to attribute it to
    }
}

export type DbWrite = {
    action: "insert" | "update" | "upsert" | "delete"
    schema: string
    table: string
    url: URL
    body: unknown
    data: unknown
    /** Name of the row, read before a delete (it's gone afterwards). */
    label?: string | null
}

const SECRET = /pass(word)?|secret|token|api[_-]?key|otp|hash/i

/** Values shortened so a log row stays small; secrets hidden. */
function shorten(v: unknown, depth = 0): unknown {
    if (v === null || v === undefined || typeof v === "number" || typeof v === "boolean") return v
    if (typeof v === "string") return v.length > 300 ? `${v.slice(0, 297)}…` : v
    if (Array.isArray(v)) return depth > 1 ? `[${v.length} items]` : [...v.slice(0, 5).map(x => shorten(x, depth + 1)), ...(v.length > 5 ? [`… ${v.length - 5} more`] : [])]
    if (typeof v === "object") {
        if (depth > 2) return "{…}"
        return Object.fromEntries(Object.entries(v as Record<string, unknown>).slice(0, 40).map(([k, x]) => [k, SECRET.test(k) ? "[hidden]" : shorten(x, depth + 1)]))
    }
    return String(v)
}

/** Filters of the request, e.g. "id=eq.123", without select/order params. */
function filtersOf(url: URL) {
    const out: Record<string, string> = {}
    url.searchParams.forEach((v, k) => { if (!["select", "columns", "on_conflict", "order", "limit", "offset"].includes(k)) out[k] = v })
    return out
}

function idFromFilters(f: Record<string, string>) {
    const v = f.id
    if (!v) return null
    if (v.startsWith("eq.")) return v.slice(3)
    if (v.startsWith("in.")) return v.slice(3)
    return null
}

/** Before a delete: the row's name, for the tables that have one. Small and only for named tables. */
export async function labelBeforeDelete(schema: string, table: string, url: URL): Promise<string | null> {
    const col = ENTITIES[table]?.nameCol
    const id = idFromFilters(filtersOf(url))
    if (!col || !id || id.startsWith("(")) return null
    try {
        const sb = rawClient()
        const q = schema === "public" ? sb.from(table) : sb.schema(schema).from(table)
        const { data } = await q.select(col).eq("id", id).maybeSingle()
        const v = (data as unknown as Record<string, unknown> | null)?.[col]
        return v ? String(v) : null
    } catch { return null }
}

export function shouldSkip(table: string) {
    return SKIP.has(table)
}

/** Called by the client wrapper after a write succeeded. Never throws. */
export function recordDbWrite(w: DbWrite) {
    enqueue(() => describeDbWrite(w))
}

/** For changes that aren't a database write (e.g. sending a blast email). */
export function recordAction(entry: Entry) {
    enqueue(async () => entry)
}

const VERB = { insert: "Added", update: "Updated", upsert: "Saved", delete: "Deleted" } as const

async function describeDbWrite(w: DbWrite): Promise<Entry> {
    const filters = filtersOf(w.url)
    const rows = Array.isArray(w.body) ? w.body : w.body && typeof w.body === "object" ? [w.body] : []
    const first = (rows[0] ?? {}) as Record<string, unknown>
    const returned = (Array.isArray(w.data) ? w.data[0] : w.data) as Record<string, unknown> | null | undefined
    const targetId = idFromFilters(filters) ?? (first.id ? String(first.id) : returned?.id ? String(returned.id) : null)
    const col = ENTITIES[w.table]?.nameCol

    let label: string | null = w.label ?? null
    if (!label && col && rows.length <= 1) label = (first[col] ?? returned?.[col]) ? String(first[col] ?? returned?.[col]) : null
    if (!label && col && targetId && !targetId.startsWith("(") && w.action !== "delete") {
        try {
            const sb = rawClient()
            const q = w.schema === "public" ? sb.from(w.table) : sb.schema(w.schema).from(w.table)
            const { data } = await q.select(col).eq("id", targetId).maybeSingle()
            const v = (data as unknown as Record<string, unknown> | null)?.[col]
            if (v) label = String(v)
        } catch { /* label is optional */ }
    }

    const entity = w.schema === "public" ? w.table : `${w.schema}.${w.table}`
    const name = entityLabel(w.table)
    const fieldNames = w.action === "delete" ? [] : Object.keys(first).filter(k => !["id", "created_at", "updated_at"].includes(k))
    const many = rows.length > 1 ? `${rows.length} ${name.toLowerCase()}s` : null
    const summary = [
        `${VERB[w.action]} ${many ?? name}`,
        label ? ` "${label.length > 80 ? label.slice(0, 79) + "…" : label}"` : "",
        w.action === "update" && fieldNames.length ? ` · ${fieldNames.slice(0, 6).join(", ")}${fieldNames.length > 6 ? "…" : ""}` : "",
    ].join("")

    return {
        action: w.action, entity, summary, targetId, targetLabel: label,
        details: { filters, rows: rows.length || undefined, changes: w.action === "delete" ? undefined : shorten(rows.length > 1 ? rows : first) },
    }
}

async function flush(buf: ReturnType<typeof requestBuffer>) {
    const { auth } = await import("@/lib/auth")
    const user = (await auth())?.user
    if (!user) return
    let page: string | null = null
    try {
        const ref = (await headers()).get("referer")
        page = ref ? new URL(ref).pathname : null
    } catch { /* headers not available here */ }
    // Super admins everywhere; anyone (club leads) in Club Management. Scanner check-ins and students' own actions aren't logged.
    if (user.role !== "super_admin" && !page?.startsWith("/club-management")) return

    const entries = (await Promise.all(buf.jobs.map(j => j().catch(() => null)))).filter((e): e is Entry => !!e)
    if (!entries.length) return
    const { error } = await rawClient().from(AUDIT_TABLE).insert(entries.map(e => ({
        request_id: buf.id,
        actor_id: user.id ?? null, actor_name: user.name ?? null, actor_email: user.email ?? null, actor_role: user.role ?? null,
        action: e.action, entity: e.entity, target_id: e.targetId ?? null, target_label: e.targetLabel ?? null,
        summary: e.summary.slice(0, 500), page, details: e.details ?? null,
    })))
    if (error) console.warn("[audit] not saved:", error.message)
}

/** Storage upload / remove through the server client (logos, photos, banners, certificates). */
export function recordStorageWrite(action: "upload" | "remove" | "move" | "copy", bucket: string, paths: string[]) {
    const list = paths.filter(Boolean)
    if (!list.length) return
    const verb = { upload: "Uploaded", remove: "Removed", move: "Moved", copy: "Copied" }[action]
    recordAction({
        action, entity: `storage:${bucket}`, targetId: list[0],
        summary: `${verb} ${list.length > 1 ? `${list.length} files` : "file"} in ${bucket}${list.length === 1 ? ` · ${list[0].length > 90 ? "…" + list[0].slice(-89) : list[0]}` : ""}`,
        details: { paths: list.slice(0, 20), count: list.length },
    })
}
