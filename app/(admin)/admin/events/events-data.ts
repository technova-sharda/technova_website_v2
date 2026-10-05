import { createAdminClient } from "@/lib/supabase/server"
import { fetchAllRows } from "@/lib/supabase/fetch-all"
import { eventPhase } from "@/lib/events/phase"
import type { AdminEventRow } from "./events-manager"

const IST = "Asia/Kolkata"
const currentTime = () => Date.now()
function whenText(start: string, end: string | null) {
    const d = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric" })
    const t = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" })
    if (!end || d(start) === d(end)) return `${d(start)} · ${t(start)}${end ? ` – ${t(end)}` : ""}`
    return `${d(start)} – ${d(end)}`
}

/** Every event with its registration and attendance counts, for the admin Events page. */
export async function loadAdminEventRows(): Promise<AdminEventRow[]> {
    const sb = createAdminClient()
    const [{ data: events }, regs, checkins] = await Promise.all([
        sb.from("events")
            .select("id, title, slug, status, is_past_event, start_time, end_time, capacity, banner, venue, is_virtual, registrations_closed, club:clubs!events_club_id_fkey(name)")
            .order("start_time", { ascending: false }),
        fetchAllRows<{ event_id: string; user_id: string; attended: boolean }>((f, t) => sb.from("registrations").select("id, event_id, user_id, attended").order("id").range(f, t)),
        fetchAllRows<{ event_id: string; user_id: string }>((f, t) => sb.from("daily_checkins").select("id, event_id, user_id").order("id").range(f, t)),
    ])

    // Attended = marked attended or at least one check-in (same rule as Analytics)
    const regCount = new Map<string, number>()
    const attended = new Map<string, Set<string>>()
    const mark = (e: string, u: string) => (attended.get(e) ?? attended.set(e, new Set()).get(e)!).add(u)
    for (const r of regs.data) {
        regCount.set(r.event_id, (regCount.get(r.event_id) ?? 0) + 1)
        if (r.attended) mark(r.event_id, r.user_id)
    }
    for (const c of checkins.data) mark(c.event_id, c.user_id)

    const now = currentTime()
    const rows: AdminEventRow[] = (events ?? []).map((e: any) => {
        const club = Array.isArray(e.club) ? e.club[0] : e.club
        return {
            id: e.id, title: e.title, slug: e.slug, banner: e.banner, club: club?.name ?? null,
            phase: eventPhase(e, now), startTime: e.start_time, when: whenText(e.start_time, e.end_time),
            where: e.is_virtual ? "Online" : (e.venue || "On campus"), capacity: e.capacity ?? null,
            registrations: regCount.get(e.id) ?? 0, attended: attended.get(e.id)?.size ?? 0, registrationsClosed: !!e.registrations_closed,
        }
    })

    return rows
}
