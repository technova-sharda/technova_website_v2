/**
 * Ask Technova: plain-English questions about events and participation.
 *
 * Safety design (it's real student data):
 * - The model never writes SQL and never sees the database. It can only call the
 *   fixed, read-only tools below, which compute from the anonymous analytics
 *   dataset (no names, emails, phones, system IDs or comments).
 * - Every number in a chart is taken from a tool result on the server by id, so a
 *   chart can't show a number the database didn't produce.
 * - At most MAX_STEPS model rounds per question.
 */
import { getAnalyticsDataset, type AnalyticsDataset } from "@/lib/analytics/dataset"
import {
    audience, clubStats, eventSummaries, findEvents, monthlyTrend, overview, ratingDistribution,
    registrationsByDay, repeatParticipation, xpDistribution, type Dimension,
} from "@/lib/analytics/metrics"
import { nvidiaChat, stripThinking, type ChatMessage, type ToolSpec } from "./nvidia"

const MAX_STEPS = 6
const MAX_ROWS = 60

type Rows = Record<string, string | number | boolean | null>[]
export type InsightStep = { tool: string; args: Record<string, unknown>; resultId: string; rowCount: number }
export type InsightChart = { type: "bar" | "line" | "pie" | "table"; title: string; x: string; y: string[]; data: Rows }
export type InsightAnswer = { summary: string; chart: InsightChart | null; followUps: string[]; steps: InsightStep[]; model: string }

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })
const inRange = (iso: string, from?: string, to?: string) =>
    (!from || iso.slice(0, 10) >= from) && (!to || iso.slice(0, 10) <= to)

function resolveEvent(ds: AnalyticsDataset, ref: string) {
    const q = String(ref ?? "").trim().toLowerCase()
    const all = findEvents(ds, "")
    return all.find(e => e.id === ref) ?? all.find(e => e.title.toLowerCase() === q) ?? findEvents(ds, q)[0] ?? null
}

const eventRow = (e: ReturnType<typeof eventSummaries>[number]) => ({
    event: e.title, date: fmtDate(e.date), club: e.club, registered: e.registrations, capacity: e.capacity,
    attended: e.attendanceRecorded ? e.attended : null, turnout_pct: e.attendanceRecorded ? e.turnoutPct : null,
    avg_rating: e.avgRating, ratings: e.ratings, certificates: e.certificates,
})

// ─────────────────────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────────────────────
const dateProps = {
    from: { type: "string", description: "Start date YYYY-MM-DD (inclusive), optional" },
    to: { type: "string", description: "End date YYYY-MM-DD (inclusive), optional" },
}

const TOOLS: ToolSpec[] = [
    { type: "function", function: { name: "get_overview", description: "Headline totals: students, active students, events, registrations, attendance, average turnout and rating, certificates.", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "list_events", description: "Events with registrations, attendance, turnout %, rating and certificates. Newest first. Use 'search' to find an event by name or club.", parameters: { type: "object", properties: { search: { type: "string" }, ...dateProps, limit: { type: "integer", description: "max rows, default 20" } } } } },
    { type: "function", function: { name: "event_details", description: "Everything about one event: totals, registrations per day, audience by year and course, rating distribution.", parameters: { type: "object", properties: { event: { type: "string", description: "Event name (or part of it) or id" } }, required: ["event"] } } },
    { type: "function", function: { name: "top_events", description: "Rank events by a metric.", parameters: { type: "object", properties: { metric: { type: "string", enum: ["registrations", "attended", "turnout_pct", "avg_rating"] }, limit: { type: "integer" }, ...dateProps }, required: ["metric"] } } },
    { type: "function", function: { name: "audience_breakdown", description: "Distinct students by year, course, section or branch, for all events or one event.", parameters: { type: "object", properties: { by: { type: "string", enum: ["year", "course", "section", "branch"] }, event: { type: "string", description: "optional event name or id" }, attended_only: { type: "boolean" } }, required: ["by"] } } },
    { type: "function", function: { name: "monthly_trend", description: "Per month (IST): registrations, first-time students, check-ins.", parameters: { type: "object", properties: { ...dateProps } } } },
    { type: "function", function: { name: "club_comparison", description: "Per club: number of events, registrations, attended, average rating.", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "engagement", description: "How many events students register for (repeat participation) and the XP spread.", parameters: { type: "object", properties: {} } } },
    {
        type: "function", function: {
            name: "present_answer",
            description: "Give the final answer. Call this exactly once, after you have the numbers.",
            parameters: {
                type: "object",
                properties: {
                    summary: { type: "string", description: "2–4 plain sentences, answer first. Only numbers that came from tool results." },
                    chart: {
                        type: "object", description: "Optional chart built from ONE earlier tool result",
                        properties: {
                            type: { type: "string", enum: ["bar", "line", "pie", "table"] },
                            title: { type: "string" },
                            resultId: { type: "string", description: "id of the tool result to plot, e.g. r2" },
                            x: { type: "string", description: "column for labels" },
                            y: { type: "array", items: { type: "string" }, description: "numeric column(s) to plot" },
                        },
                        required: ["type", "title", "resultId", "x", "y"],
                    },
                    followUps: { type: "array", items: { type: "string" }, description: "2–3 short follow-up questions" },
                },
                required: ["summary"],
            },
        },
    },
]

function runTool(ds: AnalyticsDataset, name: string, a: any): Rows | { error: string } {
    switch (name) {
        case "get_overview":
            return [overview(ds)]
        case "list_events": {
            const list = findEvents(ds, a.search ?? "").filter(e => inRange(e.start_time, a.from, a.to))
            return eventSummaries(ds, list).slice(0, Math.min(a.limit ?? 20, MAX_ROWS)).map(eventRow)
        }
        case "event_details": {
            const e = resolveEvent(ds, a.event)
            if (!e) return { error: `No event matches "${a.event}". Try list_events with a search.` }
            const s = eventSummaries(ds, [e])[0]
            return [
                { section: "totals", ...eventRow(s), venue_online: e.is_virtual },
                ...registrationsByDay(ds, e.id).map(d => ({ section: "registrations_by_day", day: d.day, count: d.count, running_total: d.total })),
                ...audience(ds, "year", e.id).map(r => ({ section: "by_year", label: r.label, count: r.count })),
                ...audience(ds, "course", e.id).slice(0, 8).map(r => ({ section: "by_course", label: r.label, count: r.count })),
                ...ratingDistribution(ds, e.id).map(r => ({ section: "ratings", star: r.star, count: r.count })),
            ]
        }
        case "top_events": {
            const keys: Record<string, "registrations" | "attended" | "turnoutPct" | "avgRating"> = { registrations: "registrations", attended: "attended", turnout_pct: "turnoutPct", avg_rating: "avgRating" }
            const key = keys[a.metric] ?? "registrations"
            const list = eventSummaries(ds, findEvents(ds, "").filter(e => inRange(e.start_time, a.from, a.to)))
                .filter(e => (key === "turnoutPct" || key === "attended" ? e.attendanceRecorded : true) && (key !== "avgRating" || e.avgRating !== null))
                .sort((x, y) => ((y[key] ?? 0) as number) - ((x[key] ?? 0) as number))
            return list.slice(0, Math.min(a.limit ?? 5, MAX_ROWS)).map(eventRow)
        }
        case "audience_breakdown": {
            const by = (["year", "course", "section", "branch"].includes(a.by) ? a.by : "year") as Dimension
            let eventId: string | undefined
            if (a.event) {
                const e = resolveEvent(ds, a.event)
                if (!e) return { error: `No event matches "${a.event}".` }
                eventId = e.id
            }
            return audience(ds, by, eventId, !!a.attended_only).slice(0, MAX_ROWS)
        }
        case "monthly_trend":
            return monthlyTrend(ds).filter(m => (!a.from || m.month >= a.from.slice(0, 7)) && (!a.to || m.month <= a.to.slice(0, 7)))
        case "club_comparison":
            return clubStats(ds)
        case "engagement":
            return [
                ...repeatParticipation(ds).map(r => ({ section: "events_per_student", label: r.label, students: r.students })),
                ...xpDistribution(ds).map(r => ({ section: "xp_range", label: r.label, students: r.students })),
            ]
        default:
            return { error: `Unknown tool ${name}` }
    }
}

function systemPrompt() {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    return `You are "Ask Technova", the data assistant for the admins of Technova, the technical society of Sharda University.
Today is ${today} (IST). All dates are IST.

Rules:
- Get every number from the tools. Never guess or invent numbers. If the tools can't answer, say so plainly.
- You only have anonymous, aggregated data: no student names, emails or phone numbers exist in your tools. If asked about specific students, explain that and offer aggregate numbers instead.
- "Attended" means the student was checked in (QR scan or bulk attendance). Many past events have attendance "not recorded" (attended = null); say so instead of reporting 0% turnout.
- Find events by name with list_events(search) or event_details(event).
- Finish by calling present_answer exactly once: a short, direct summary (answer first), an optional chart that points at one tool result by its id (e.g. "r2") and existing column names, and 2–3 follow-up questions.
- Keep the summary under 80 words. Use Indian number formatting (1,014).`
}

export async function answerQuestion(
    question: string,
    history: { q: string; a: string }[] = [],
    loadDataset: () => Promise<AnalyticsDataset> = getAnalyticsDataset,
): Promise<InsightAnswer> {
    const ds = await loadDataset()
    const results = new Map<string, Rows>()
    const steps: InsightStep[] = []
    const messages: ChatMessage[] = [{ role: "system", content: systemPrompt() }]
    for (const h of history.slice(-3)) {
        messages.push({ role: "user", content: h.q.slice(0, 500) }, { role: "assistant", content: h.a.slice(0, 800) })
    }
    messages.push({ role: "user", content: question.slice(0, 500) })

    let model = ""
    for (let step = 0; step < MAX_STEPS; step++) {
        const isLast = step === MAX_STEPS - 1
        // Reasoning ("thinking") roughly doubles response time; tool picking works fine without it. NVIDIA_THINKING=on to enable.
        const res = await nvidiaChat({ messages, tools: TOOLS, thinking: process.env.NVIDIA_THINKING === "on" })
        model = res.model
        const msg = res.message
        const calls = msg.tool_calls ?? []

        if (calls.length === 0) {
            // Model answered in plain text instead of present_answer: still show it.
            return { summary: stripThinking(msg.content) || "I couldn't work that out. Try rephrasing the question.", chart: null, followUps: [], steps, model }
        }

        messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls })
        for (const call of calls) {
            let args: any = {}
            try { args = JSON.parse(call.function.arguments || "{}") } catch { args = {} }

            if (call.function.name === "present_answer") {
                return buildAnswer(args, results, steps, model)
            }
            const out = runTool(ds, call.function.name, args)
            const resultId = `r${results.size + 1}`
            if (!("error" in out)) {
                results.set(resultId, out)
                steps.push({ tool: call.function.name, args, resultId, rowCount: out.length })
            }
            messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify("error" in out ? out : { resultId, rows: out }).slice(0, 12_000),
            })
        }
        if (isLast) break
    }
    // Ran out of steps: ask for the final answer without tools.
    messages.push({ role: "user", content: "Answer now in 2–3 sentences using only the numbers above." })
    const final = await nvidiaChat({ messages })
    return { summary: stripThinking(final.message.content), chart: null, followUps: [], steps, model: final.model }
}

function buildAnswer(args: any, results: Map<string, Rows>, steps: InsightStep[], model: string): InsightAnswer {
    let chart: InsightChart | null = null
    const c = args?.chart
    const all = c?.resultId ? results.get(String(c.resultId)) : undefined
    // Some results mix sections (event_details); keep only rows that have the chosen columns.
    const yKeys: string[] = c ? (Array.isArray(c.y) ? c.y : [c.y]) : []
    const rows = all?.filter(r => r[c.x] !== undefined && r[c.x] !== null && (c.type === "table" || yKeys.some(k => typeof r[k] === "number")))
    if (c && rows && rows.length) {
        const columns = new Set(Object.keys(rows[0]))
        const y = (Array.isArray(c.y) ? c.y : [c.y]).filter((k: string) => columns.has(k) && rows.some(r => typeof r[k] === "number"))
        if (columns.has(c.x) && (y.length || c.type === "table")) {
            chart = { type: ["bar", "line", "pie", "table"].includes(c.type) ? c.type : "bar", title: String(c.title || ""), x: c.x, y, data: rows.slice(0, MAX_ROWS) }
        }
    }
    return {
        summary: stripThinking(String(args?.summary ?? "")) || "Here's what I found.",
        chart,
        followUps: (Array.isArray(args?.followUps) ? args.followUps : []).slice(0, 3).map(String),
        steps,
        model,
    }
}
