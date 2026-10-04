/**
 * Pure metric functions over the analytics dataset. Shared by the Analytics
 * dashboard, the event report PDF and the Ask Technova tools, so a number means
 * the same thing everywhere.
 *
 * Definitions:
 * - "Attended" = registration marked attended OR at least one QR/bulk check-in.
 * - Turnout = attended / registered.
 * - Dates are bucketed by IST calendar day/month.
 */
import type { AnalyticsDataset, DsEvent } from "./dataset"
import { istDateKey } from "@/lib/dates/ist"

const round1 = (n: number) => Math.round(n * 10) / 10
const pct = (a: number, b: number) => (b > 0 ? round1((a / b) * 100) : 0)

/** Events that actually happened or are open (drafts/cancelled excluded). */
export function publishedEvents(ds: AnalyticsDataset) {
    return ds.events.filter(e => e.status === "live" || e.status === "completed")
}

function attendedSet(ds: AnalyticsDataset) {
    const set = new Set<string>()
    for (const r of ds.registrations) if (r.attended) set.add(`${r.event_id}|${r.user_id}`)
    for (const c of ds.checkins) set.add(`${c.event_id}|${c.user_id}`)
    return set
}

export type EventSummary = {
    id: string; title: string; slug: string | null; club: string | null; date: string; is_virtual: boolean
    capacity: number | null; registrations: number; attended: number; turnoutPct: number; fillPct: number | null
    avgRating: number | null; ratings: number; feedbackResponses: number; certificates: number; certificatesEmailed: number
    attendanceRecorded: boolean
}

export function eventSummaries(ds: AnalyticsDataset, events: DsEvent[] = publishedEvents(ds)): EventSummary[] {
    const att = attendedSet(ds)
    const regs = new Map<string, number>(), attended = new Map<string, number>()
    for (const r of ds.registrations) {
        regs.set(r.event_id, (regs.get(r.event_id) ?? 0) + 1)
        if (att.has(`${r.event_id}|${r.user_id}`)) attended.set(r.event_id, (attended.get(r.event_id) ?? 0) + 1)
    }
    const ratingSum = new Map<string, number>(), ratingCount = new Map<string, number>(), fb = new Map<string, number>()
    for (const r of ds.ratings) { ratingSum.set(r.event_id, (ratingSum.get(r.event_id) ?? 0) + r.rating); ratingCount.set(r.event_id, (ratingCount.get(r.event_id) ?? 0) + 1) }
    for (const f of ds.feedbackResponses) fb.set(f.event_id, (fb.get(f.event_id) ?? 0) + 1)
    const certs = new Map<string, number>(), emailed = new Map<string, number>()
    for (const c of ds.certificates) {
        if (c.status !== "valid") continue
        certs.set(c.event_id, (certs.get(c.event_id) ?? 0) + 1)
        if (c.emailed) emailed.set(c.event_id, (emailed.get(c.event_id) ?? 0) + 1)
    }
    return events
        .map(e => {
            const r = regs.get(e.id) ?? 0, a = attended.get(e.id) ?? 0, rc = ratingCount.get(e.id) ?? 0
            return {
                id: e.id, title: e.title, slug: e.slug, club: e.club, date: e.start_time, is_virtual: e.is_virtual,
                capacity: e.capacity, registrations: r, attended: a, turnoutPct: pct(a, r),
                fillPct: e.capacity ? pct(r, e.capacity) : null,
                avgRating: rc ? round1((ratingSum.get(e.id) ?? 0) / rc) : null, ratings: rc,
                feedbackResponses: fb.get(e.id) ?? 0, certificates: certs.get(e.id) ?? 0, certificatesEmailed: emailed.get(e.id) ?? 0,
                attendanceRecorded: a > 0,
            }
        })
        .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
}

export function overview(ds: AnalyticsDataset) {
    const summaries = eventSummaries(ds)
    const withAttendance = summaries.filter(s => s.attendanceRecorded && s.registrations > 0)
    const registeredStudents = new Set(ds.registrations.map(r => r.user_id))
    const att = attendedSet(ds)
    const attendedStudents = new Set([...att].map(k => k.split("|")[1]))
    const ratings = ds.ratings
    return {
        students: ds.students.length,
        activeStudents: registeredStudents.size,
        attendedStudents: attendedStudents.size,
        events: summaries.length,
        registrations: ds.registrations.length,
        attended: summaries.reduce((s, e) => s + e.attended, 0),
        avgTurnoutPct: withAttendance.length ? round1(withAttendance.reduce((s, e) => s + e.turnoutPct, 0) / withAttendance.length) : 0,
        avgRating: ratings.length ? round1(ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) : null,
        feedbackResponses: ds.feedbackResponses.length,
        certificates: ds.certificates.filter(c => c.status === "valid").length,
        eventsWithoutAttendance: summaries.filter(s => !s.attendanceRecorded && new Date(s.date).getTime() < Date.now()).length,
    }
}

/** Registrations, attendance and first-time students per IST month. */
export function monthlyTrend(ds: AnalyticsDataset) {
    const month = (iso: string) => istDateKey(iso).slice(0, 7)
    const rows = new Map<string, { month: string; registrations: number; newStudents: number; checkins: number }>()
    const get = (m: string) => rows.get(m) ?? rows.set(m, { month: m, registrations: 0, newStudents: 0, checkins: 0 }).get(m)!
    const firstSeen = new Map<string, string>()
    for (const r of [...ds.registrations].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
        get(month(r.created_at)).registrations++
        if (!firstSeen.has(r.user_id)) { firstSeen.set(r.user_id, r.created_at); get(month(r.created_at)).newStudents++ }
    }
    for (const c of ds.checkins) get(c.date.slice(0, 7)).checkins++
    // Fill quiet months with zeros so charts don't draw activity that never happened.
    const months = [...rows.keys()].sort()
    if (months.length > 1) {
        let [y, m] = months[0].split("-").map(Number)
        const last = months[months.length - 1]
        for (let key = months[0]; key <= last; ) {
            get(key)
            m++
            if (m > 12) { m = 1; y++ }
            key = `${y}-${String(m).padStart(2, "0")}`
        }
    }
    return [...rows.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export type Dimension = "year" | "course" | "section" | "branch"

/** How many distinct students by year/course/section, for all registrations or one event. */
export function audience(ds: AnalyticsDataset, by: Dimension, eventId?: string, attendedOnly = false) {
    const studentById = new Map(ds.students.map(s => [s.id, s]))
    const att = attendedOnly ? attendedSet(ds) : null
    const seen = new Set<string>()
    const counts = new Map<string, number>()
    for (const r of ds.registrations) {
        if (eventId && r.event_id !== eventId) continue
        if (att && !att.has(`${r.event_id}|${r.user_id}`)) continue
        if (seen.has(r.user_id)) continue
        seen.add(r.user_id)
        const s = studentById.get(r.user_id)
        const raw = s?.[by]
        const key = raw === null || raw === undefined || raw === "" ? "Not set" : (by === "year" ? `Year ${raw}` : String(raw).trim().toUpperCase())
        counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
}

/** Registrations per IST day for one event, with a running total. */
export function registrationsByDay(ds: AnalyticsDataset, eventId: string) {
    const days = new Map<string, number>()
    for (const r of ds.registrations) if (r.event_id === eventId) days.set(istDateKey(r.created_at), (days.get(istDateKey(r.created_at)) ?? 0) + 1)
    let total = 0
    return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count, total: (total += count) }))
}

export function ratingDistribution(ds: AnalyticsDataset, eventId?: string) {
    const counts = [1, 2, 3, 4, 5].map(star => ({ star, count: 0 }))
    for (const r of ds.ratings) if (!eventId || r.event_id === eventId) counts[Math.round(r.rating) - 1].count++
    return counts
}

export function clubStats(ds: AnalyticsDataset) {
    const rows = new Map<string, { club: string; events: number; registrations: number; attended: number; ratingSum: number; ratingCount: number }>()
    for (const s of eventSummaries(ds)) {
        const key = s.club ?? "Unassigned"
        const row = rows.get(key) ?? rows.set(key, { club: key, events: 0, registrations: 0, attended: 0, ratingSum: 0, ratingCount: 0 }).get(key)!
        row.events++
        row.registrations += s.registrations
        row.attended += s.attended
        if (s.avgRating !== null) { row.ratingSum += s.avgRating * s.ratings; row.ratingCount += s.ratings }
    }
    return [...rows.values()]
        .map(r => ({ club: r.club, events: r.events, registrations: r.registrations, attended: r.attended, avgRating: r.ratingCount ? round1(r.ratingSum / r.ratingCount) : null }))
        .sort((a, b) => b.registrations - a.registrations)
}

/** Student XP spread (anonymous buckets). */
export function xpDistribution(ds: AnalyticsDataset) {
    const buckets = [
        { label: "0", min: 0, max: 0 }, { label: "1–49", min: 1, max: 49 }, { label: "50–99", min: 50, max: 99 },
        { label: "100–199", min: 100, max: 199 }, { label: "200–499", min: 200, max: 499 }, { label: "500+", min: 500, max: Infinity },
    ]
    return buckets.map(b => ({ label: b.label, students: ds.students.filter(s => s.xp >= b.min && s.xp <= b.max).length }))
}

/** How many events each student has registered for (engagement depth). */
export function repeatParticipation(ds: AnalyticsDataset) {
    const perStudent = new Map<string, number>()
    for (const r of ds.registrations) perStudent.set(r.user_id, (perStudent.get(r.user_id) ?? 0) + 1)
    const buckets = new Map<string, number>([["1 event", 0], ["2 events", 0], ["3–4 events", 0], ["5+ events", 0]])
    for (const n of perStudent.values()) {
        const k = n === 1 ? "1 event" : n === 2 ? "2 events" : n <= 4 ? "3–4 events" : "5+ events"
        buckets.set(k, buckets.get(k)! + 1)
    }
    return [...buckets.entries()].map(([label, students]) => ({ label, students }))
}

export function findEvents(ds: AnalyticsDataset, query: string) {
    const q = query.trim().toLowerCase()
    return publishedEvents(ds).filter(e => !q || e.title.toLowerCase().includes(q) || (e.club ?? "").toLowerCase().includes(q))
}
