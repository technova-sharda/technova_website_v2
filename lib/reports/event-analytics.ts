/**
 * Everything the "ECR + Analytics" PDF says about one event: numbers, comparisons
 * with other Technova events, promotion and reach, feedback breakdown, and plain
 * findings ("where it fell short") worked out from those numbers.
 *
 * Numbers come from the anonymous analytics dataset (same definitions as the
 * Analytics dashboard). Feedback question labels and written comments are read
 * here for this one event only; comments are redacted before anything else sees them.
 */
import { createAdminClient } from "@/lib/supabase/server"
import { fetchAllRows } from "@/lib/supabase/fetch-all"
import type { AnalyticsDataset } from "@/lib/analytics/dataset"
import { audience, eventSummaries, publishedEvents, ratingDistribution, registrationsByDay } from "@/lib/analytics/metrics"
import { istDateKey } from "@/lib/dates/ist"
import { redact } from "@/lib/ai/feedback-themes"

const round1 = (n: number) => Math.round(n * 10) / 10
const pct = (a: number, b: number) => (b > 0 ? round1((a / b) * 100) : 0)
const avg = (xs: number[]) => (xs.length ? round1(xs.reduce((s, x) => s + x, 0) / xs.length) : null)
const DAY = 86_400_000

export type EventInfo = {
    id: string; title: string; club: string | null; coHost: string | null; clubLogoUrl: string | null; coHostLogoUrl: string | null
    start: string; end: string; isVirtual: boolean; venue: string | null; capacity: number | null; eventType: string | null
    feedbackRequired: boolean
}

export type Benchmark = { label: string; value: number | null; technova: number | null; club: number | null; unit: "" | "%" | "/5"; higherIsBetter: boolean }
export type ChoiceQuestion = { label: string; options: { label: string; count: number }[]; total: number; negativePct: number }

export type EventAnalytics = {
    event: EventInfo
    past: boolean
    kpi: {
        registered: number; attended: number; attendanceRecorded: boolean; turnoutPct: number | null; fillPct: number | null
        avgRating: number | null; ratings: number; feedbackResponses: number; feedbackRatePct: number | null
        certificates: number; certificatesEmailed: number; firstTimers: number; firstTimerPct: number
    }
    rank: { registrations: number; of: number } | null
    benchmarks: Benchmark[]
    comparedWith: { technova: number; club: number }
    timeline: { day: string; count: number; total: number }[]
    promo: { firstDay: string | null; windowDays: number | null; last48hPct: number | null; peak: { day: string; count: number } | null; afterStart: number }
    years: { label: string; count: number }[]
    courses: { label: string; count: number }[]
    yearTurnout: { label: string; registered: number; attended: number; pct: number }[]
    dayAttendance: { day: string; count: number }[]
    ratingDist: { star: number; count: number }[]
    questionRatings: { label: string; avg: number; count: number }[]
    choices: ChoiceQuestion[]
    comments: string[]
    score: { value: number; grade: "Excellent" | "Good" | "Average" | "Needs work"; parts: { label: string; value: number; weight: number }[] } | null
    findings: { worked: string[]; lacked: string[]; recommendations: string[] }
}

const NEGATIVE = /disagree|not relevant|irrelevant|poor|bad|very difficult|difficult|unsatisf|no\b/i

async function loadEventInfo(eventId: string) {
    const sb = createAdminClient()
    const { data: ev } = await sb
        .from("events")
        .select("id, title, venue, is_virtual, start_time, end_time, capacity, event_type, requires_feedback_for_attendance, club:clubs!events_club_id_fkey(name, logo_url), co_host_club_id")
        .eq("id", eventId)
        .maybeSingle()
    if (!ev) return null
    const club = (Array.isArray(ev.club) ? ev.club[0] : ev.club) as { name?: string; logo_url?: string | null } | null
    let coHost: { name: string; logo_url: string | null } | null = null
    if (ev.co_host_club_id) {
        const { data } = await sb.from("clubs").select("name, logo_url").eq("id", ev.co_host_club_id).maybeSingle()
        coHost = data
    }
    return {
        id: ev.id, title: String(ev.title).trim(), club: club?.name ?? null, coHost: coHost?.name ?? null,
        clubLogoUrl: club?.logo_url ?? null, coHostLogoUrl: coHost?.logo_url ?? null,
        start: ev.start_time, end: ev.end_time, isVirtual: !!ev.is_virtual, venue: ev.venue, capacity: ev.capacity ?? null,
        eventType: ev.event_type ?? null, feedbackRequired: !!ev.requires_feedback_for_attendance,
    } satisfies EventInfo
}

/** Per-question ratings, multiple-choice splits and written comments for one event. */
async function loadFeedbackDetail(eventId: string) {
    const sb = createAdminClient()
    const { data: forms } = await sb.from("event_feedback_forms").select("id").eq("event_id", eventId)
    const formIds = (forms ?? []).map(f => f.id)
    if (!formIds.length) return { questionRatings: [], choices: [], comments: [] }
    const [{ data: questions }, responses] = await Promise.all([
        sb.from("feedback_questions").select("id, question_type, label, options, order_index").in("form_id", formIds).order("order_index"),
        fetchAllRows<any>((f, t) => sb.from("feedback_responses").select("id, answers").in("form_id", formIds).order("id").range(f, t)),
    ])
    const qs = questions ?? []
    const label = (q: any) => String(q.label ?? "").replace(/\*+\s*$/, "").trim()

    // Multi-day events have a form per day with the same questions: merge them by label
    const byLabel = (type: (t: string) => boolean) => {
        const groups = new Map<string, any[]>()
        for (const q of qs.filter(q => type(q.question_type))) {
            const key = label(q).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
            ;(groups.get(key) ?? groups.set(key, []).get(key)!).push(q)
        }
        return [...groups.values()]
    }
    const questionRatings = byLabel(t => t === "rating").map(group => {
        const ids = group.map(q => q.id)
        const vals = responses.data.flatMap(r => ids.map(id => Number(r.answers?.[id]))).filter(n => Number.isFinite(n) && n >= 1 && n <= 5)
        return { label: label(group[0]), avg: avg(vals) ?? 0, count: vals.length }
    }).filter(q => q.count > 0)

    const choices: ChoiceQuestion[] = byLabel(t => t === "radio" || t === "select").map(group => {
        const q = group[0]
        const ids = group.map(g => g.id)
        const opts: { label: string; value: string }[] = Array.isArray(q.options) ? q.options.map((o: any) => (typeof o === "string" ? { label: o, value: o } : { label: String(o?.label ?? o?.value ?? ""), value: String(o?.value ?? o?.label ?? "") })) : []
        const counts = new Map<string, number>(opts.map(o => [o.label, 0]))
        let total = 0
        for (const r of responses.data) for (const id of ids) {
            const v = r.answers?.[id]
            if (v === undefined || v === null || v === "") continue
            const o = opts.find(o => o.value === String(v) || o.label === String(v))
            const key = o?.label ?? String(v).slice(0, 40)
            counts.set(key, (counts.get(key) ?? 0) + 1)
            total++
        }
        const options = [...counts.entries()].map(([l, count]) => ({ label: l, count }))
        const negative = options.filter(o => NEGATIVE.test(o.label) && !/^neutral/i.test(o.label)).reduce((s, o) => s + o.count, 0)
        return { label: label(q), options, total, negativePct: pct(negative, total) }
    }).filter(c => c.total > 0)

    const textIds = new Set(qs.filter(q => q.question_type === "textarea" || q.question_type === "text").map(q => q.id))
    const seen = new Set<string>()
    const comments: string[] = []
    for (const r of responses.data) {
        for (const [qid, v] of Object.entries((r.answers ?? {}) as Record<string, unknown>)) {
            if (!textIds.has(qid) || typeof v !== "string") continue
            const text = redact(v)
            const key = text.toLowerCase()
            if (text.length < 8 || seen.has(key) || /^(na|n\/a|nil|none|no|nothing|good|nice|ok)\.?$/i.test(text)) continue
            seen.add(key)
            comments.push(text.slice(0, 400))
        }
    }
    return { questionRatings, choices, comments }
}

export async function buildEventAnalytics(ds: AnalyticsDataset, eventId: string): Promise<EventAnalytics | null> {
    const [event, feedback] = await Promise.all([loadEventInfo(eventId), loadFeedbackDetail(eventId)])
    if (!event) return null

    const now = Date.now()
    const past = new Date(event.end).getTime() < now
    const dsEvent = ds.events.find(e => e.id === eventId)
    const s = eventSummaries(ds, dsEvent ? [dsEvent] : [])[0]
    const registered = s?.registrations ?? 0
    const attended = s?.attended ?? 0
    const attendanceRecorded = !!s?.attendanceRecorded
    const feedbackBase = attendanceRecorded ? attended : registered
    // Feedback is collected after the event, so a running/upcoming event has no rate yet
    const feedbackRatePct = feedbackBase && (past || (s?.feedbackResponses ?? 0) > 0) ? pct(s?.feedbackResponses ?? 0, feedbackBase) : null

    // First-timers: students whose first ever Technova registration was this event
    const firstEvent = new Map<string, { at: string; event: string }>()
    for (const r of ds.registrations) {
        const cur = firstEvent.get(r.user_id)
        if (!cur || r.created_at < cur.at) firstEvent.set(r.user_id, { at: r.created_at, event: r.event_id })
    }
    const regsHere = ds.registrations.filter(r => r.event_id === eventId)
    const firstTimers = regsHere.filter(r => firstEvent.get(r.user_id)?.event === eventId).length

    // Comparisons: other past events with registrations
    const others = eventSummaries(ds, publishedEvents(ds).filter(e => e.id !== eventId && new Date(e.end_time).getTime() < now)).filter(e => e.registrations > 0)
    const clubOthers = event.club ? others.filter(e => e.club === event.club) : []
    const fbRate = (e: (typeof others)[number]) => { const b = e.attendanceRecorded ? e.attended : e.registrations; return b ? pct(e.feedbackResponses, b) : null }
    const stat = (list: typeof others, pick: (e: (typeof others)[number]) => number | null) => avg(list.map(pick).filter((v): v is number => v !== null))
    const benchmarks: Benchmark[] = [
        { label: "Registrations", value: registered, technova: stat(others, e => e.registrations), club: stat(clubOthers, e => e.registrations), unit: "", higherIsBetter: true },
        { label: "Turnout", value: attendanceRecorded ? s!.turnoutPct : null, technova: stat(others.filter(e => e.attendanceRecorded), e => e.turnoutPct), club: stat(clubOthers.filter(e => e.attendanceRecorded), e => e.turnoutPct), unit: "%", higherIsBetter: true },
        { label: "Average rating", value: s?.avgRating ?? null, technova: stat(others, e => e.avgRating), club: stat(clubOthers, e => e.avgRating), unit: "/5", higherIsBetter: true },
        { label: "Feedback rate", value: feedbackRatePct, technova: stat(others, fbRate), club: stat(clubOthers, fbRate), unit: "%", higherIsBetter: true },
    ]
    const ranked = [...others.map(e => e.registrations), registered].sort((a, b) => b - a)
    const rank = past || registered ? { registrations: ranked.indexOf(registered) + 1, of: ranked.length } : null

    // Promotion: when did people register, relative to the start?
    const timeline = registrationsByDay(ds, eventId)
    const startMs = new Date(event.start).getTime()
    const firstReg = regsHere.reduce<string | null>((m, r) => (!m || r.created_at < m ? r.created_at : m), null)
    const last48 = regsHere.filter(r => { const t = new Date(r.created_at).getTime(); return t >= startMs - 2 * DAY && t < startMs }).length
    const afterStart = regsHere.filter(r => new Date(r.created_at).getTime() >= startMs).length
    const peak = timeline.reduce<{ day: string; count: number } | null>((m, d) => (!m || d.count > m.count ? { day: d.day, count: d.count } : m), null)
    const promo = {
        firstDay: firstReg ? istDateKey(firstReg) : null,
        windowDays: firstReg ? Math.max(0, Math.round((startMs - new Date(firstReg).getTime()) / DAY)) : null,
        last48hPct: registered ? pct(last48, registered) : null,
        peak, afterStart,
    }

    const years = audience(ds, "year", eventId)
    const courses = audience(ds, "course", eventId).slice(0, 8)
    const attendedYears = new Map(audience(ds, "year", eventId, true).map(r => [r.label, r.count]))
    const yearTurnout = attendanceRecorded
        ? years.map(y => ({ label: y.label, registered: y.count, attended: attendedYears.get(y.label) ?? 0, pct: pct(attendedYears.get(y.label) ?? 0, y.count) })).sort((a, b) => (a.label === "Not set" ? 1 : b.label === "Not set" ? -1 : a.label.localeCompare(b.label)))
        : []
    const dayCounts = new Map<string, Set<string>>()
    for (const c of ds.checkins) if (c.event_id === eventId) (dayCounts.get(c.date) ?? dayCounts.set(c.date, new Set()).get(c.date)!).add(c.user_id)
    const dayAttendance = [...dayCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, set]) => ({ day, count: set.size }))

    const kpi = {
        registered, attended, attendanceRecorded, turnoutPct: attendanceRecorded ? s!.turnoutPct : null, fillPct: s?.fillPct ?? null,
        avgRating: s?.avgRating ?? null, ratings: s?.ratings ?? 0, feedbackResponses: s?.feedbackResponses ?? 0, feedbackRatePct,
        certificates: s?.certificates ?? 0, certificatesEmailed: s?.certificatesEmailed ?? 0, firstTimers, firstTimerPct: pct(firstTimers, registered),
    }

    const a: EventAnalytics = {
        event, past, kpi, rank, benchmarks, comparedWith: { technova: others.length, club: clubOthers.length },
        timeline, promo, years, courses, yearTurnout, dayAttendance, ratingDist: ratingDistribution(ds, eventId),
        questionRatings: feedback.questionRatings, choices: feedback.choices, comments: feedback.comments,
        score: null, findings: { worked: [], lacked: [], recommendations: [] },
    }
    a.score = engagementScore(a)
    a.findings = findings(a)
    return a
}

/**
 * 0-100, from the parts we can measure: turnout 35, rating 25, reach 25, feedback 15.
 * Missing parts (e.g. no attendance recorded) are left out and the rest re-weighted;
 * with fewer than two parts there's no score (one number alone would mislead).
 */
export function engagementScore(a: EventAnalytics): EventAnalytics["score"] {
    if (!a.kpi.registered) return null
    const avgRegs = a.benchmarks[0].technova ?? a.kpi.registered
    const parts: { label: string; value: number; weight: number }[] = []
    if (a.kpi.turnoutPct !== null) parts.push({ label: "Turnout", value: Math.min(1, a.kpi.turnoutPct / 100), weight: 35 })
    if (a.kpi.avgRating !== null) parts.push({ label: "Rating", value: (a.kpi.avgRating - 1) / 4, weight: 25 })
    parts.push({ label: "Reach", value: Math.min(1, a.kpi.registered / Math.max(1, avgRegs) / 1.5), weight: 25 })
    if (a.kpi.feedbackRatePct !== null) parts.push({ label: "Feedback", value: Math.min(1, a.kpi.feedbackRatePct / 60), weight: 15 })
    if (parts.length < 2) return null
    const total = parts.reduce((s, p) => s + p.weight, 0)
    const value = Math.round((parts.reduce((s, p) => s + p.value * p.weight, 0) / total) * 100)
    const grade = value >= 80 ? "Excellent" : value >= 65 ? "Good" : value >= 45 ? "Average" : "Needs work"
    return { value, grade, parts: parts.map(p => ({ ...p, value: Math.round(p.value * 100) })) }
}

const fmtDay = (key: string) => new Date(`${key}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })

/** Plain-English findings, each backed by a number in the report. */
export function findings(a: EventAnalytics) {
    const worked: string[] = [], lacked: string[] = [], recs: string[] = []
    const { kpi, promo } = a
    const [regB, turnB, rateB, fbB] = a.benchmarks
    const avgRegs = regB.technova

    if (!kpi.registered) {
        lacked.push("Nobody registered on the website, so there is nothing to measure yet.")
        return { worked, lacked, recommendations: ["Share the event link in class WhatsApp groups and on Instagram at least a week before the event."] }
    }

    // Reach / promotion
    if (avgRegs && kpi.registered >= avgRegs * 1.3) worked.push(`${kpi.registered} registrations, ${round1(kpi.registered / avgRegs)}x the Technova average of ${Math.round(avgRegs)}.`)
    else if (avgRegs && kpi.registered < avgRegs * 0.7) {
        lacked.push(`Reach was low: ${kpi.registered} registrations against a Technova average of ${Math.round(avgRegs)}.`)
        recs.push("Promote earlier and in more places: class WhatsApp groups, Instagram story countdown, and a short in-class announcement by coordinators.")
    }
    if (a.rank && a.rank.of >= 5 && a.rank.registrations <= 3) worked.push(`Ranked #${a.rank.registrations} of ${a.rank.of} Technova events by registrations.`)
    if (kpi.fillPct !== null && kpi.fillPct >= 90) worked.push(`Seats were ${kpi.fillPct}% full.`)
    else if (kpi.fillPct !== null && kpi.fillPct < 50) lacked.push(`Only ${kpi.fillPct}% of the ${a.event.capacity} seats were filled.`)
    if (promo.last48hPct !== null && promo.last48hPct > 50 && kpi.registered >= 10) {
        lacked.push(`${promo.last48hPct}% of registrations came in the last 48 hours before the event, so promotion started late or early posts didn't land.`)
        recs.push("Open registrations 7-10 days ahead and post a reminder every 2-3 days, not just the day before.")
    }
    if (promo.windowDays !== null && promo.windowDays < 4 && kpi.registered >= 5) {
        lacked.push(`Registrations were open for only ${promo.windowDays} day${promo.windowDays === 1 ? "" : "s"} before the event.`)
        if (!recs.some(r => r.startsWith("Open registrations"))) recs.push("Open registrations at least a week before the event so more students can plan for it.")
    }
    if (kpi.firstTimerPct >= 40 && kpi.firstTimers >= 5) worked.push(`Brought in ${kpi.firstTimers} first-time students (${kpi.firstTimerPct}% of registrations).`)
    else if (kpi.registered >= 20 && kpi.firstTimerPct < 15) {
        lacked.push(`Mostly the same audience: only ${kpi.firstTimerPct}% were attending a Technova event for the first time.`)
        recs.push("Reach new students: collaborate with another club or department, and promote in first-year sections.")
    }

    // Audience spread
    const known = a.years.filter(y => y.label !== "Not set")
    const knownTotal = known.reduce((s, y) => s + y.count, 0)
    if (knownTotal >= 15) {
        const top = known[0]
        if (top && top.count / knownTotal > 0.7) {
            lacked.push(`${Math.round((top.count / knownTotal) * 100)}% of registrations were ${top.label} students; other years were barely reached.`)
            recs.push(`Ask coordinators from other years to share the poster in their class groups (most registrations came from ${top.label}).`)
        }
        const missing = [1, 2, 3, 4].filter(n => !known.some(y => y.label === `Year ${n}`))
        if (missing.length && missing.length < 4 && knownTotal >= 25) lacked.push(`No ${missing.map(n => `Year ${n}`).join(" / ")} students registered.`)
    }

    // Turnout
    if (!kpi.attendanceRecorded && a.past) {
        lacked.push("Attendance wasn't recorded, so turnout can't be judged.")
        recs.push("Record attendance with the QR scanner at the door, or upload the Meet/Zoom attendance CSV in Bulk Attendance.")
    } else if (kpi.turnoutPct !== null) {
        if (kpi.turnoutPct >= 70 || (turnB.technova !== null && kpi.turnoutPct >= turnB.technova + 10)) worked.push(`${kpi.turnoutPct}% of registered students attended${turnB.technova !== null ? ` (Technova average ${turnB.technova}%)` : ""}.`)
        else if (kpi.turnoutPct < 50) {
            lacked.push(`Only ${kpi.turnoutPct}% of registered students actually attended${turnB.technova !== null ? ` (Technova average ${turnB.technova}%)` : ""}.`)
            recs.push("Send a reminder email and WhatsApp message the evening before and 1 hour before the start, with the venue or joining link.")
        }
        const weakYear = a.yearTurnout.filter(y => y.registered >= 8 && y.label !== "Not set").sort((x, y) => x.pct - y.pct)[0]
        if (weakYear && kpi.turnoutPct - weakYear.pct >= 20) lacked.push(`${weakYear.label} students registered but showed up less (${weakYear.pct}% turnout vs ${kpi.turnoutPct}% overall), so check for a clash with their classes or exams.`)
    }
    if (a.dayAttendance.length > 1) {
        const first = a.dayAttendance[0].count, last = a.dayAttendance[a.dayAttendance.length - 1].count
        if (first > 0 && last / first < 0.6) {
            lacked.push(`Attendance dropped from ${first} on day 1 to ${last} on the last day (${fmtDay(a.dayAttendance[a.dayAttendance.length - 1].day)}).`)
            recs.push("For multi-day events, give a reason to come back each day: a hands-on task, a prize, or the certificate only for full attendance.")
        }
    }

    // Feedback and ratings
    if (kpi.avgRating !== null && kpi.avgRating >= 4.2) worked.push(`Students rated it ${kpi.avgRating} / 5 on average (${kpi.ratings} ratings).`)
    else if (kpi.avgRating !== null && kpi.avgRating < 3.5) {
        lacked.push(`The average rating was ${kpi.avgRating} / 5${rateB.technova !== null ? `, below the Technova average of ${rateB.technova}` : ""}.`)
        recs.push("Read the complaints in the feedback section and fix the top one before the next event (pace, audio, content level).")
    }
    const lowQ = a.questionRatings.filter(q => q.count >= 5 && q.avg < 3.5).sort((x, y) => x.avg - y.avg)[0]
    if (lowQ) lacked.push(`Lowest-rated question: "${lowQ.label}" at ${lowQ.avg} / 5.`)
    const negQ = a.choices.filter(c => c.total >= 5 && c.negativePct >= 25).sort((x, y) => y.negativePct - x.negativePct)[0]
    if (negQ) lacked.push(`${negQ.negativePct}% gave a negative answer to "${negQ.label}".`)
    if (kpi.feedbackRatePct !== null && a.past) {
        if (kpi.feedbackRatePct >= 50) worked.push(`${kpi.feedbackRatePct}% of ${kpi.attendanceRecorded ? "attendees" : "registered students"} gave feedback.`)
        else if (kpi.feedbackRatePct < 30) {
            lacked.push(`Only ${kpi.feedbackRatePct}% of ${kpi.attendanceRecorded ? "attendees" : "registered students"} gave feedback${fbB.technova !== null ? ` (Technova average ${fbB.technova}%)` : ""}, so the ratings may not represent everyone.`)
            recs.push(a.event.feedbackRequired
                ? "Show the feedback QR on the last slide and give 2 minutes at the end to fill it."
                : "Turn on \"feedback required for attendance\" for the next event, and show the feedback QR on the last slide.")
        }
    }

    // Certificates
    if (!kpi.certificates && a.past && (kpi.attended || kpi.registered) >= 5) {
        lacked.push("No certificates have been issued on the website for this event yet.")
        recs.push("Issue participation certificates from the event's Certificates page so attendees have proof of participation.")
    } else if (kpi.certificates && kpi.certificatesEmailed < kpi.certificates) lacked.push(`${kpi.certificates - kpi.certificatesEmailed} of ${kpi.certificates} certificates haven't been emailed yet.`)
    else if (kpi.certificates) worked.push(`All ${kpi.certificates} certificates were issued and emailed.`)

    return { worked: worked.slice(0, 6), lacked: lacked.slice(0, 8), recommendations: [...new Set(recs)].slice(0, 6) }
}

/** Numbers and findings for the AI write-up: totals and labels only, no people. */
export function analyticsFactsForAi(a: EventAnalytics) {
    return {
        event: a.event.title, club: a.event.club, co_host: a.event.coHost, date: istDateKey(a.event.start), online: a.event.isVirtual,
        kpis: a.kpi, rank_by_registrations: a.rank, benchmarks: a.benchmarks.map(b => ({ metric: b.label, this_event: b.value, technova_avg: b.technova, club_avg: b.club })),
        promotion: a.promo, registered_by_year: a.years, top_courses: a.courses.slice(0, 5), turnout_by_year: a.yearTurnout,
        attendance_by_day: a.dayAttendance, rating_questions: a.questionRatings,
        choice_questions: a.choices.map(c => ({ question: c.label, answers: c.options })),
        engagement_score: a.score?.value ?? null, findings: a.findings,
    }
}
