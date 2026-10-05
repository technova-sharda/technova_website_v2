import Link from "next/link"
import {
    ArrowRight, Award, BarChart3, Calendar, CheckCircle2, CircleAlert, Gauge, LayoutDashboard, MessageSquare, Plus, QrCode,
    Sparkles, Star, UserCheck, Users,
} from "lucide-react"
import { createAdminClient } from "@/lib/supabase/server"
import { getAnalyticsDataset } from "@/lib/analytics/dataset"
import { eventSummaries } from "@/lib/analytics/metrics"
import { istDateKey } from "@/lib/dates/ist"
import { eventPhase } from "@/lib/events/phase"
import { EmptyState, Meter, PageHeader, Panel, PhaseBadge, StatCard, buttonCls, type Tone } from "@/components/admin/ui"


const IST = "Asia/Kolkata"
const DAY = 86_400_000
const now = () => Date.now()
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short" })
const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
const pctChange = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null)
function greeting() {
    const h = Number(new Date().toLocaleString("en-IN", { timeZone: IST, hour: "numeric", hour12: false }))
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

type Todo = { tone: Tone; icon: typeof Calendar; title: string; detail: string; href: string; cta: string }

/** Overview content (data + layout). The page does the sign-in check. */
export async function Overview({ name }: { name: string | null }) {
    const sb = createAdminClient()
    const [ds, lastReminder] = await Promise.all([
        getAnalyticsDataset(),
        sb.from("events").select("reminder_sent_at").not("reminder_sent_at", "is", null).order("reminder_sent_at", { ascending: false }).limit(1).maybeSingle(),
    ])
    const t = now()
    const withPhase = ds.events.map(e => ({ ...e, phase: eventPhase(e, t) }))
    const summaries = new Map(eventSummaries(ds, ds.events).map(s => [s.id, s]))

    // KPIs
    const live = withPhase.filter(e => e.phase === "live")
    const upcoming = withPhase.filter(e => e.phase === "upcoming").sort((a, b) => a.start_time.localeCompare(b.start_time))
    const regsIn = (from: number, to: number) => ds.registrations.filter(r => { const x = new Date(r.created_at).getTime(); return x >= from && x < to }).length
    const regs30 = regsIn(t - 30 * DAY, t), regsPrev30 = regsIn(t - 60 * DAY, t - 30 * DAY)
    const recentEnded = withPhase.filter(e => e.phase === "ended" && new Date(e.end_time).getTime() > t - 120 * DAY).map(e => summaries.get(e.id)!).filter(Boolean)
    const withAtt = recentEnded.filter(s => s.attendanceRecorded && s.registrations > 0)
    const avgTurnout = withAtt.length ? Math.round(withAtt.reduce((a, s) => a + s.turnoutPct, 0) / withAtt.length) : null
    // Rating: recent events, or all time when none of them collected ratings
    const recentIds = new Set(recentEnded.map(s => s.id))
    const recentRatings = ds.ratings.filter(r => recentIds.has(r.event_id))
    const ratingPool = recentRatings.length ? recentRatings : ds.ratings
    const avgRating = ratingPool.length ? (ratingPool.reduce((a, r) => a + r.rating, 0) / ratingPool.length).toFixed(1) : null
    const ratingScope = recentRatings.length ? "last 4 months" : "all time"
    const change = pctChange(regs30, regsPrev30)

    // Registrations per day, last 14 days
    const days = Array.from({ length: 14 }, (_, i) => istDateKey(new Date(t - (13 - i) * DAY)))
    const perDay = new Map(days.map(d => [d, 0]))
    for (const r of ds.registrations) { const k = istDateKey(r.created_at); if (perDay.has(k)) perDay.set(k, perDay.get(k)! + 1) }
    const maxDay = Math.max(1, ...perDay.values())
    const total14 = [...perDay.values()].reduce((a, b) => a + b, 0)

    // Needs attention
    const todos: Todo[] = []
    for (const e of withPhase.filter(e => e.phase === "ended" && new Date(e.end_time).getTime() > t - 90 * DAY).sort((a, b) => b.end_time.localeCompare(a.end_time))) {
        const s = summaries.get(e.id)
        if (!s || s.registrations === 0) continue
        if (!s.attendanceRecorded) todos.push({ tone: "amber", icon: UserCheck, title: `Record attendance for ${e.title}`, detail: `${s.registrations} registered · ended ${fmtDay(e.end_time)}`, href: `/admin/events/${e.id}/attendance`, cta: "Attendance" })
        else if (s.certificates === 0) todos.push({ tone: "violet", icon: Award, title: `Issue certificates for ${e.title}`, detail: `${s.attended} attended · none issued yet`, href: `/admin/events/${e.id}/certificates`, cta: "Certificates" })
        else if (s.certificatesEmailed < s.certificates) todos.push({ tone: "violet", icon: Award, title: `Email certificates for ${e.title}`, detail: `${s.certificates - s.certificatesEmailed} of ${s.certificates} not emailed`, href: `/admin/events/${e.id}/certificates`, cta: "Certificates" })
        if (s.attendanceRecorded && s.feedbackResponses === 0) todos.push({ tone: "sky", icon: MessageSquare, title: `Collect feedback for ${e.title}`, detail: `${s.attended} attended · no feedback yet`, href: `/admin/events/${e.id}`, cta: "Open event" })
    }
    for (const e of upcoming.filter(e => new Date(e.start_time).getTime() < t + 4 * DAY)) {
        const s = summaries.get(e.id)
        if (e.capacity && s && s.registrations / e.capacity < 0.3) todos.push({ tone: "rose", icon: Users, title: `Low registrations for ${e.title}`, detail: `${s.registrations} of ${e.capacity} seats · starts ${fmtWhen(e.start_time)}`, href: `/admin/events/${e.id}`, cta: "Open event" })
    }
    for (const e of withPhase.filter(e => e.phase === "draft")) todos.push({ tone: "gray", icon: Calendar, title: `${e.title} is still a draft`, detail: "Not visible to students", href: `/admin/events/${e.id}/edit`, cta: "Edit" })

    const nextUp = [...live, ...upcoming].slice(0, 4)
    const recent = withPhase.filter(e => e.phase === "ended").sort((a, b) => b.end_time.localeCompare(a.end_time)).slice(0, 5)
    const reminderAt = (lastReminder.data?.reminder_sent_at as string | null) ?? null
    const firstName = (name ?? "").split(" ")[0]

    return (
        <div className="space-y-6">
            <PageHeader
                icon={LayoutDashboard}
                title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
                description={new Date().toLocaleDateString("en-IN", { timeZone: IST, weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                actions={<>
                    <Link href="/scan" className={buttonCls.secondary}><QrCode className="h-4 w-4" /> Scanner</Link>
                    <Link href="/admin/insights" className={buttonCls.secondary}><Sparkles className="h-4 w-4" /> Ask Technova</Link>
                    <Link href="/admin/events/new" className={buttonCls.primary}><Plus className="h-4 w-4" /> New event</Link>
                </>}
            />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Live & upcoming" value={live.length + upcoming.length} hint={live.length ? `${live.length} happening now` : upcoming[0] ? `Next: ${fmtDay(upcoming[0].start_time)}` : "Nothing scheduled"} icon={Calendar} tone="blue" href="/admin/events" />
                <StatCard label="Registrations (30 days)" value={regs30} hint={change === null ? `${ds.registrations.length} all time` : <span className={change >= 0 ? "text-emerald-400" : "text-rose-400"}>{change >= 0 ? "+" : ""}{change}% vs previous 30 days</span>} icon={Users} tone="emerald" href="/admin/analytics" />
                <StatCard label="Average turnout" value={avgTurnout === null ? "–" : `${avgTurnout}%`} hint="Events in the last 4 months" icon={Gauge} tone="amber" href="/admin/analytics" />
                <StatCard label="Average rating" value={avgRating ? `${avgRating} / 5` : "–"} hint={`${ratingPool.length} ratings, ${ratingScope}`} icon={Star} tone="violet" href="/admin/analytics" />
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
                <Panel title="Needs attention" icon={CircleAlert} tone="amber" className="lg:col-span-3"
                    action={todos.length ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">{todos.length}</span> : undefined}>
                    {todos.length === 0 ? (
                        <EmptyState icon={CheckCircle2} title="All caught up" hint="Attendance, certificates and feedback are done for recent events." />
                    ) : (
                        <ul className="-my-1 divide-y divide-white/5">
                            {todos.slice(0, 8).map(td => (
                                <li key={td.title} className="flex items-center gap-3 py-3">
                                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${td.tone === "gray" ? "bg-white/5 text-gray-400" : td.tone === "amber" ? "bg-amber-500/10 text-amber-400" : td.tone === "violet" ? "bg-violet-500/10 text-violet-400" : td.tone === "sky" ? "bg-sky-500/10 text-sky-400" : "bg-rose-500/10 text-rose-400"}`}>
                                        <td.icon className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm text-white">{td.title}</p>
                                        <p className="truncate text-xs text-gray-500">{td.detail}</p>
                                    </div>
                                    <Link href={td.href} className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/5">{td.cta}</Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                <Panel title="Live & next up" icon={Calendar} tone="blue" className="lg:col-span-2" action={<Link href="/admin/events" className="text-xs text-gray-400 hover:text-white">All events</Link>}>
                    {nextUp.length === 0 ? (
                        <EmptyState icon={Calendar} title="Nothing scheduled" action={<Link href="/admin/events/new" className={buttonCls.primary}>Create event</Link>} />
                    ) : (
                        <ul className="space-y-3">
                            {nextUp.map(e => {
                                const s = summaries.get(e.id)
                                return (
                                    <li key={e.id}>
                                        <Link href={`/admin/events/${e.id}`} className="block rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-white/15">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="truncate text-sm font-medium text-white">{e.title}</p>
                                                <PhaseBadge phase={e.phase} />
                                            </div>
                                            <p className="mt-0.5 text-xs text-gray-500">{fmtWhen(e.start_time)}{e.club ? ` · ${e.club}` : ""}</p>
                                            <div className="mt-2 flex items-center gap-3">
                                                <div className="flex-1"><Meter value={s?.registrations ?? 0} max={e.capacity ?? Math.max(1, s?.registrations ?? 0)} tone="blue" /></div>
                                                <span className="text-xs text-gray-300">{s?.registrations ?? 0}{e.capacity ? ` / ${e.capacity}` : ""}</span>
                                            </div>
                                        </Link>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </Panel>
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
                <Panel title="Recent events" icon={BarChart3} tone="emerald" className="lg:col-span-3" action={<Link href="/admin/analytics" className="text-xs text-gray-400 hover:text-white">Analytics</Link>}>
                    {recent.length === 0 ? <EmptyState icon={Calendar} title="No ended events yet" /> : (
                        <div className="-mx-4 overflow-x-auto sm:mx-0">
                            <table className="w-full min-w-[520px] text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-gray-500">
                                        <th className="px-4 pb-2 font-medium sm:px-0">Event</th>
                                        <th className="pb-2 text-right font-medium">Registered</th>
                                        <th className="pb-2 text-right font-medium">Attended</th>
                                        <th className="pb-2 text-right font-medium">Rating</th>
                                        <th className="pb-2" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {recent.map(e => {
                                        const s = summaries.get(e.id)
                                        return (
                                            <tr key={e.id}>
                                                <td className="max-w-[220px] px-4 py-2.5 sm:px-0">
                                                    <Link href={`/admin/events/${e.id}`} className="block truncate text-white hover:text-amber-300">{e.title}</Link>
                                                    <span className="text-xs text-gray-500">{fmtDay(e.start_time)}{e.club ? ` · ${e.club}` : ""}</span>
                                                </td>
                                                <td className="py-2.5 text-right text-gray-300">{s?.registrations ?? 0}</td>
                                                <td className="py-2.5 text-right">{s?.attendanceRecorded ? <span className="text-gray-300">{s.attended} <span className="text-xs text-gray-500">({s.turnoutPct}%)</span></span> : <span className="text-xs text-amber-400/80">not recorded</span>}</td>
                                                <td className="py-2.5 text-right text-gray-300">{s?.avgRating ?? "–"}</td>
                                                <td className="py-2.5 pl-3 text-right"><Link href={`/admin/events/${e.id}`} className="inline-flex text-gray-500 hover:text-white" aria-label="Open"><ArrowRight className="h-4 w-4" /></Link></td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>

                <Panel title="Registrations, last 14 days" icon={Users} tone="emerald" className="lg:col-span-2" action={<span className="text-xs text-gray-400">{total14} total</span>}>
                    <div className="flex h-36 items-end gap-1">
                        {days.map(d => {
                            const v = perDay.get(d)!
                            return (
                                <div key={d} className="group relative flex h-full flex-1 flex-col justify-end">
                                    <div className="w-full rounded-t bg-emerald-500/70 transition-colors group-hover:bg-emerald-400" style={{ height: `${Math.max(v ? 4 : 1, (v / maxDay) * 100)}%` }} />
                                    <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">{v} · {fmtDay(`${d}T12:00:00+05:30`)}</span>
                                </div>
                            )
                        })}
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-gray-500">
                        <span>{fmtDay(`${days[0]}T12:00:00+05:30`)}</span><span>Today</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/5 pt-4 text-xs">
                        <div><p className="text-gray-500">Students</p><p className="mt-0.5 font-semibold text-white">{ds.students.length}</p></div>
                        <div><p className="text-gray-500">Events</p><p className="mt-0.5 font-semibold text-white">{ds.events.length}</p></div>
                        <div><p className="text-gray-500">All registrations</p><p className="mt-0.5 font-semibold text-white">{ds.registrations.length}</p></div>
                    </div>
                </Panel>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-xs text-gray-400">
                <span className="font-medium text-gray-300">System</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Database connected</span>
                <span className="inline-flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${process.env.RESEND_API_KEY ? "bg-emerald-500" : "bg-rose-500"}`} /> Email {process.env.RESEND_API_KEY ? "configured" : "key missing"}</span>
                <span className="inline-flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${!process.env.CRON_SECRET ? "bg-rose-500" : reminderAt ? "bg-emerald-500" : "bg-amber-500"}`} />
                    Event reminders: {!process.env.CRON_SECRET ? "not scheduled (CRON_SECRET missing)" : reminderAt ? `last sent ${fmtDay(reminderAt)}` : "scheduled, none sent yet"}
                </span>
                <span className="ml-auto text-gray-600">Numbers refresh every 5 minutes</span>
            </div>
        </div>
    )
}
