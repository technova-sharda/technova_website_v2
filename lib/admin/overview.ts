/**
 * Numbers and "needs attention" items for the admin Overview. Shared by the
 * website's /admin/dashboard and the phone app's Admin screen.
 */
import type { AnalyticsDataset } from "@/lib/analytics/dataset"
import { eventSummaries, type EventSummary } from "@/lib/analytics/metrics"
import { istDateKey } from "@/lib/dates/ist"
import { eventPhase, type EventPhase } from "@/lib/events/phase"

const DAY = 86_400_000
const IST = "Asia/Kolkata"
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short" })
const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })

export type TodoKind = "attendance" | "certificates" | "email-certificates" | "feedback" | "low-registrations" | "draft"
export type Todo = { kind: TodoKind; eventId: string; title: string; detail: string }

export function computeOverview(ds: AnalyticsDataset, t: number) {
    const withPhase = ds.events.map(e => ({ ...e, phase: eventPhase(e, t) as EventPhase }))
    const summaries = new Map<string, EventSummary>(eventSummaries(ds, ds.events).map(s => [s.id, s]))

    const live = withPhase.filter(e => e.phase === "live")
    const upcoming = withPhase.filter(e => e.phase === "upcoming").sort((a, b) => a.start_time.localeCompare(b.start_time))
    const regsIn = (from: number, to: number) => ds.registrations.filter(r => { const x = new Date(r.created_at).getTime(); return x >= from && x < to }).length
    const regs30 = regsIn(t - 30 * DAY, t), regsPrev30 = regsIn(t - 60 * DAY, t - 30 * DAY)
    const change = regsPrev30 > 0 ? Math.round(((regs30 - regsPrev30) / regsPrev30) * 100) : null
    const recentEnded = withPhase.filter(e => e.phase === "ended" && new Date(e.end_time).getTime() > t - 120 * DAY).map(e => summaries.get(e.id)!).filter(Boolean)
    const withAtt = recentEnded.filter(s => s.attendanceRecorded && s.registrations > 0)
    const avgTurnout = withAtt.length ? Math.round(withAtt.reduce((a, s) => a + s.turnoutPct, 0) / withAtt.length) : null
    // Rating: recent events, or all time when none of them collected ratings
    const recentIds = new Set(recentEnded.map(s => s.id))
    const recentRatings = ds.ratings.filter(r => recentIds.has(r.event_id))
    const ratingPool = recentRatings.length ? recentRatings : ds.ratings
    const avgRating = ratingPool.length ? (ratingPool.reduce((a, r) => a + r.rating, 0) / ratingPool.length).toFixed(1) : null
    const ratingScope = recentRatings.length ? "last 4 months" : "all time"

    const days = Array.from({ length: 14 }, (_, i) => istDateKey(new Date(t - (13 - i) * DAY)))
    const perDayMap = new Map(days.map(d => [d, 0]))
    for (const r of ds.registrations) { const k = istDateKey(r.created_at); if (perDayMap.has(k)) perDayMap.set(k, perDayMap.get(k)! + 1) }
    const perDay = days.map(d => ({ day: d, count: perDayMap.get(d)! }))

    const todos: Todo[] = []
    for (const e of withPhase.filter(e => e.phase === "ended" && new Date(e.end_time).getTime() > t - 90 * DAY).sort((a, b) => b.end_time.localeCompare(a.end_time))) {
        const s = summaries.get(e.id)
        if (!s || s.registrations === 0) continue
        if (!s.attendanceRecorded) todos.push({ kind: "attendance", eventId: e.id, title: `Record attendance for ${e.title}`, detail: `${s.registrations} registered · ended ${fmtDay(e.end_time)}` })
        else if (s.certificates === 0) todos.push({ kind: "certificates", eventId: e.id, title: `Issue certificates for ${e.title}`, detail: `${s.attended} attended · none issued yet` })
        else if (s.certificatesEmailed < s.certificates) todos.push({ kind: "email-certificates", eventId: e.id, title: `Email certificates for ${e.title}`, detail: `${s.certificates - s.certificatesEmailed} of ${s.certificates} not emailed` })
        if (s.attendanceRecorded && s.feedbackResponses === 0) todos.push({ kind: "feedback", eventId: e.id, title: `Collect feedback for ${e.title}`, detail: `${s.attended} attended · no feedback yet` })
    }
    for (const e of upcoming.filter(e => new Date(e.start_time).getTime() < t + 4 * DAY)) {
        const s = summaries.get(e.id)
        if (e.capacity && s && s.registrations / e.capacity < 0.3) todos.push({ kind: "low-registrations", eventId: e.id, title: `Low registrations for ${e.title}`, detail: `${s.registrations} of ${e.capacity} seats · starts ${fmtWhen(e.start_time)}` })
    }
    for (const e of withPhase.filter(e => e.phase === "draft")) todos.push({ kind: "draft", eventId: e.id, title: `${e.title} is still a draft`, detail: "Not visible to students" })

    return {
        live, upcoming, regs30, change, avgTurnout, avgRating, ratingCount: ratingPool.length, ratingScope, perDay, todos, summaries,
        nextUp: [...live, ...upcoming].slice(0, 4),
        recent: withPhase.filter(e => e.phase === "ended").sort((a, b) => b.end_time.localeCompare(a.end_time)).slice(0, 5),
        totals: { students: ds.students.length, events: ds.events.length, registrations: ds.registrations.length },
    }
}
