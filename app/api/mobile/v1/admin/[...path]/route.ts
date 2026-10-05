/**
 * Admin API for the phone app: /api/mobile/v1/admin/<...>. Every handler calls
 * the same server function the website's admin panel uses, so permissions,
 * validation, cache refreshes and the activity log all behave identically.
 * Super admins only, except Club Management (club leads too; the actions check).
 */
import { NextRequest } from "next/server"
import { fail, json, requireRole, requireUser } from "@/lib/mobile/api"
import { getAnalyticsDataset } from "@/lib/analytics/dataset"
import { eventSummaries, publishedEvents } from "@/lib/analytics/metrics"
import { computeOverview } from "@/lib/admin/overview"
import { loadAdminEventRows } from "@/app/(admin)/admin/events/events-data"
import { createEvent, deleteEvent, setRegistrationsClosed, togglePastEvent, updateEvent } from "@/lib/actions/events"
import { getAttendanceRoster, markAttendanceBulk } from "@/lib/actions/attendance"
import { closeFeedbackForm, getEventFeedbackForms, getFeedbackAnalytics, getFeedbackResponses, releaseFeedbackForm } from "@/lib/actions/feedback"
import { summarizeEventFeedback } from "@/lib/actions/feedback-ai"
import { getBlastHistory } from "@/lib/actions/notifications"
import { getPerson, searchPeople } from "@/lib/actions/people"
import { getRecentRoleChanges, getRoleHolders, searchUsersForRole, setUserRole, type ManagedRole } from "@/lib/actions/roles"
import { searchCertificates } from "@/lib/actions/certificates-hub"
import { exportFormResponsesToCSV, getFormResponses, getForms, updateFormSettings } from "@/lib/actions/forms"
import { addMember, getClubForManagement, getManageableClubs, removeMember, updateClubDetails, updateMember, uploadClubLogo, uploadMemberPhoto } from "@/lib/actions/club-management"
import { createAdminClient } from "@/lib/supabase/server"
import { canViewAuditLog } from "@/lib/audit/viewers"
import { applyPinnedPositions } from "@/lib/constants/leadership"
import { AUDIT_TABLE } from "@/lib/audit/audit"

export const maxDuration = 60
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Ctx = { req: NextRequest; p: string[]; q: URLSearchParams }
type Handler = (c: Ctx) => Promise<Response>

const body = (req: NextRequest) => req.json().catch(() => ({} as Record<string, any>))
const run = async (fn: () => Promise<unknown>) => {
    try { return json(await fn() ?? { ok: true }) } catch (e) { return fail(400, e instanceof Error ? e.message : "Something went wrong") }
}
const brief = (o: ReturnType<typeof computeOverview>) => (e: { id: string; title: string; start_time: string; capacity: number | null; phase: string }) => {
    const s = o.summaries.get(e.id)
    return { id: e.id, title: e.title, start: e.start_time, phase: e.phase, capacity: e.capacity, registered: s?.registrations ?? 0, attended: s?.attended ?? 0, attendanceRecorded: !!s?.attendanceRecorded, turnoutPct: s?.turnoutPct ?? 0, rating: s?.avgRating ?? null }
}

/** [method, path pattern, needs super admin, handler] */
const ROUTES: [string, string, boolean, Handler][] = [
    ["GET", "overview", true, async () => {
        const o = computeOverview(await getAnalyticsDataset(), Date.now())
        return json({
            kpis: { liveAndUpcoming: o.live.length + o.upcoming.length, live: o.live.length, regs30: o.regs30, change: o.change, avgTurnout: o.avgTurnout, avgRating: o.avgRating, ratingCount: o.ratingCount, ratingScope: o.ratingScope },
            totals: o.totals, perDay: o.perDay, todos: o.todos, nextUp: o.nextUp.map(brief(o)), recent: o.recent.map(brief(o)),
        })
    }],
    ["GET", "analytics", true, async () => {
        const ds = await getAnalyticsDataset()
        return json({ generatedAt: ds.generatedAt, events: eventSummaries(ds, publishedEvents(ds)) })
    }],

    // ── events ──
    ["GET", "events", true, async () => json({ events: await loadAdminEventRows() })],
    ["POST", "events", true, async ({ req }) => run(async () => createEvent(await req.formData()))],
    ["GET", "club-options", true, async () => {
        const { data, error } = await createAdminClient().from("clubs").select("id, name").order("name")
        return error ? fail(400, error.message) : json({ clubs: data ?? [] })
    }],
    ["GET", "events/:id", true, async ({ p }) => {
        const sb = createAdminClient()
        const [{ data: event }, { data: clubs }] = await Promise.all([
            sb.from("events").select("*").eq("id", p[1]).maybeSingle(),
            sb.from("clubs").select("id, name").order("name"),
        ])
        return event ? json({ event, clubs: clubs ?? [] }) : fail(404, "Event not found")
    }],
    ["PUT", "events/:id", true, async ({ req, p }) => run(async () => { const fd = await req.formData(); fd.set("id", p[1]); return updateEvent(fd) })],
    ["DELETE", "events/:id", true, async ({ req, p }) => {
        const r = await deleteEvent(p[1], (await body(req)).confirmTitle)
        return "error" in r ? fail(400, r.error) : json(r)
    }],
    ["POST", "events/:id/registrations", true, async ({ req, p }) => {
        const b = await body(req)
        if (typeof b.closed !== "boolean") return fail(400, "closed must be true or false")
        return run(() => setRegistrationsClosed(p[1], b.closed))
    }],
    ["POST", "events/:id/past", true, async ({ p }) => run(() => togglePastEvent(p[1]))],
    ["GET", "events/:id/roster", true, async ({ p }) => run(() => getAttendanceRoster(p[1]))],
    ["POST", "events/:id/attendance", true, async ({ req, p }) => {
        const b = await body(req)
        return run(() => markAttendanceBulk(p[1], Array.isArray(b.registrationIds) ? b.registrationIds : [], String(b.day ?? "")))
    }],
    ["GET", "events/:id/feedback", true, async ({ p }) => run(async () => ({ forms: await getEventFeedbackForms(p[1]), analytics: await getFeedbackAnalytics(p[1]).catch(() => null) }))],
    ["POST", "events/:id/feedback-summary", true, async ({ p }) => run(() => summarizeEventFeedback(p[1]))],
    ["GET", "events/:id/blasts", true, async ({ p }) => run(async () => ({ blasts: await getBlastHistory(p[1]) }))],
    ["POST", "feedback/:id/release", true, async ({ p }) => run(() => releaseFeedbackForm(p[1]))],
    ["POST", "feedback/:id/close", true, async ({ p }) => run(() => closeFeedbackForm(p[1]))],
    ["GET", "feedback/:id/responses", true, async ({ p }) => run(async () => ({ responses: await getFeedbackResponses(p[1]) }))],

    // ── people, roles, certificates ──
    ["GET", "people", true, async ({ q }) => run(async () => ({ people: await searchPeople(q.get("q") ?? "") }))],
    ["GET", "people/:id", true, async ({ p }) => { const person = await getPerson(p[1]); return person ? json({ person }) : fail(404, "Not found") }],
    ["GET", "roles", true, async () => run(async () => ({ holders: await getRoleHolders(), changes: await getRecentRoleChanges() }))],
    ["GET", "roles/search", true, async ({ q }) => run(async () => ({ users: await searchUsersForRole(q.get("q") ?? "") }))],
    ["POST", "roles", true, async ({ req }) => {
        const b = await body(req)
        const r = await setUserRole(String(b.userId ?? ""), b.role as ManagedRole)
        return "error" in r ? fail(400, r.error) : json(r)
    }],
    ["GET", "certificates", true, async ({ q }) => run(async () => ({ certificates: await searchCertificates(q.get("q") ?? "") }))],

    // ── forms ──
    ["GET", "forms", true, async () => run(async () => ({ forms: await getForms() }))],
    ["GET", "forms/:id/responses", true, async ({ p }) => run(() => getFormResponses(p[1]))],
    ["POST", "forms/:id/settings", true, async ({ req, p }) => {
        const b = await body(req)
        return run(() => updateFormSettings(p[1], { ...(typeof b.is_active === "boolean" ? { is_active: b.is_active } : {}), ...(typeof b.is_published === "boolean" ? { is_published: b.is_published } : {}) }))
    }],
    ["GET", "forms/:id/csv", true, async ({ p }) => {
        try {
            const csv = await exportFormResponsesToCSV(p[1])
            return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="responses-${p[1].slice(0, 8)}.csv"`, "Cache-Control": "private, no-store" } })
        } catch (e) { return fail(400, e instanceof Error ? e.message : "Export failed") }
    }],

    // ── activity log (only the people in lib/audit/viewers.ts) ──
    ["GET", "logs", true, async ({ q }) => {
        const session = await requireUser()
        if (!canViewAuditLog(session?.user?.email)) return fail(403, "Not available for your account")
        const page = Math.max(1, Number(q.get("page")) || 1)
        let query = createAdminClient().from(AUDIT_TABLE).select("id, created_at, actor_name, actor_email, action, entity, summary, page, details", { count: "exact" }).order("created_at", { ascending: false })
        if (q.get("q")) query = query.or(`summary.ilike.%${q.get("q")!.replace(/[%,()]/g, " ")}%,actor_name.ilike.%${q.get("q")!.replace(/[%,()]/g, " ")}%`)
        const { data, count, error } = await query.range((page - 1) * 50, page * 50 - 1)
        return error ? fail(400, error.message) : json({ logs: data ?? [], total: count ?? 0, page })
    }],

    // ── club management (club leads and executives; the actions decide who may edit what) ──
    ["GET", "clubs", false, async () => run(async () => ({ clubs: await getManageableClubs() }))],
    // Same order as the Leadership page (e.g. the Tech Lead right after the Joint Secretary)
    ["GET", "clubs/:id", false, async ({ p }) => run(async () => { const d = await getClubForManagement(p[1]); return { ...d, members: applyPinnedPositions(d.members) } })],
    ["PATCH", "clubs/:id", false, async ({ req, p }) => run(async () => updateClubDetails(p[1], await body(req)))],
    ["POST", "clubs/:id/logo", false, async ({ req, p }) => run(async () => uploadClubLogo(p[1], await req.formData()))],
    ["POST", "clubs/:id/members", false, async ({ req, p }) => run(async () => addMember(p[1], await body(req)))],
    ["PATCH", "members/:id", false, async ({ req, p }) => run(async () => updateMember(p[1], await body(req)))],
    ["DELETE", "members/:id", false, async ({ p }) => run(() => removeMember(p[1]))],
    ["POST", "members/:id/photo", false, async ({ req, p }) => run(async () => uploadMemberPhoto(p[1], await req.formData()))],
]

async function dispatch(method: string, req: NextRequest, params: Promise<{ path: string[] }>) {
    const { path } = await params
    for (const [m, pattern, superOnly, handler] of ROUTES) {
        const parts = pattern.split("/")
        if (m !== method || parts.length !== path.length) continue
        if (!parts.every((x, i) => (x === ":id" ? UUID.test(path[i]) : x === path[i]))) continue
        const session = superOnly ? await requireRole(["super_admin"]) : await requireUser()
        if (!session) return fail(superOnly ? 403 : 401, superOnly ? "Admins only" : "Sign in again")
        const res = await handler({ req, p: path, q: req.nextUrl.searchParams })
        // Server actions report "can't manage" as { error }; surface those as 400s
        if (res.headers.get("content-type")?.includes("json")) {
            const data = await res.clone().json().catch(() => null)
            if (data && typeof data === "object" && "error" in data && res.status === 200) return fail(400, String((data as { error: unknown }).error))
        }
        return res
    }
    return fail(404, "Unknown admin endpoint")
}

type Params = { params: Promise<{ path: string[] }> }
export const GET = (req: NextRequest, { params }: Params) => dispatch("GET", req, params)
export const POST = (req: NextRequest, { params }: Params) => dispatch("POST", req, params)
export const PUT = (req: NextRequest, { params }: Params) => dispatch("PUT", req, params)
export const PATCH = (req: NextRequest, { params }: Params) => dispatch("PATCH", req, params)
export const DELETE = (req: NextRequest, { params }: Params) => dispatch("DELETE", req, params)
