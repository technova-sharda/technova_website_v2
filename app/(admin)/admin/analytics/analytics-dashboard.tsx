'use client'

import { useMemo, useState } from "react"
import Link from "next/link"
import {
    Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { AlertTriangle, ArrowUpDown, BarChart3, CalendarDays, FileDown, Star, UserCheck, Users } from "lucide-react"
import type { EventSummary } from "@/lib/analytics/metrics"
import { PageHeader } from "@/components/admin/ui"

const AMBER = "#F5A623", INDIGO = "#6366F1", GREEN = "#22C55E", GRID = "#27272A", MUTED = "#71717A"
const PALETTE = [AMBER, INDIGO, GREEN, "#EC4899", "#06B6D4", "#A855F7", "#F97316", "#84CC16"]

const tooltipStyle = { background: "#0A0A0B", border: "1px solid #27272A", borderRadius: 12, color: "#FAFAF9", fontSize: 12 }
const axis = { stroke: MUTED, fontSize: 11, tickLine: false, axisLine: false } as const
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00+05:30`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })

function Card({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
    return (
        <section className={`rounded-2xl border border-white/10 bg-white/[0.02] p-5 ${className}`}>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            <div className="mt-4">{children}</div>
        </section>
    )
}

function Kpi({ icon: Icon, label, value, hint, accent }: { icon: any; label: string; value: string; hint?: string; accent: string }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500"><Icon className="w-4 h-4" style={{ color: accent }} />{label}</div>
            <div className="mt-2 text-2xl md:text-3xl font-bold text-white tabular-nums">{value}</div>
            {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
        </div>
    )
}

type SortKey = "date" | "registrations" | "attended" | "turnoutPct" | "avgRating"

function SortHeader({ k, sort, setSort, children }: { k: SortKey; sort: SortKey; setSort: (k: SortKey) => void; children: React.ReactNode }) {
    return (
        <button onClick={() => setSort(k)} className={`inline-flex items-center gap-1 ${sort === k ? "text-white" : "hover:text-white"}`}>
            {children}<ArrowUpDown className="w-3 h-3" />
        </button>
    )
}

export function AnalyticsDashboard(props: {
    generatedAt: string
    kpis: ReturnType<typeof import("@/lib/analytics/metrics").overview>
    monthly: { month: string; registrations: number; newStudents: number; checkins: number }[]
    events: EventSummary[]
    byYear: { label: string; count: number }[]
    byCourse: { label: string; count: number }[]
    clubs: { club: string; events: number; registrations: number; attended: number; avgRating: number | null }[]
    ratings: { star: number; count: number }[]
    repeat: { label: string; students: number }[]
    xp: { label: string; students: number }[]
}) {
    const { kpis } = props
    const [sort, setSort] = useState<SortKey>("date")
    const events = useMemo(() => {
        const list = [...props.events]
        if (sort === "date") return list
        return list.sort((a, b) => ((b[sort] ?? -1) as number) - ((a[sort] ?? -1) as number))
    }, [props.events, sort])
    const monthly = props.monthly.map(m => ({ ...m, label: monthLabel(m.month) }))

    return (
        <div>
            <div className="max-w-7xl space-y-6">
                <PageHeader icon={BarChart3} title="Analytics" description="Every number comes straight from the database. Students are counted anonymously." actions={<p className="text-xs text-gray-500">Updated {new Date(props.generatedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST · refreshes every 5 min</p>} />

                {kpis.eventsWithoutAttendance > 0 && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <span>
                            <b>{kpis.eventsWithoutAttendance} past events have no attendance recorded</b>, so turnout for them shows 0%.
                            Open an event and use <b>Bulk Attendance</b> to upload the Meet/Zoom list.
                        </span>
                    </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    <Kpi icon={Users} label="Students" value={kpis.students.toLocaleString("en-IN")} hint={`${kpis.activeStudents.toLocaleString("en-IN")} registered for something`} accent={AMBER} />
                    <Kpi icon={CalendarDays} label="Events" value={String(kpis.events)} hint={`${kpis.registrations.toLocaleString("en-IN")} registrations`} accent={INDIGO} />
                    <Kpi icon={UserCheck} label="Attended" value={kpis.attended.toLocaleString("en-IN")} hint={`${kpis.attendedStudents} different students`} accent={GREEN} />
                    <Kpi icon={UserCheck} label="Avg turnout" value={`${kpis.avgTurnoutPct}%`} hint="events with attendance only" accent={GREEN} />
                    <Kpi icon={Star} label="Avg rating" value={kpis.avgRating ? `${kpis.avgRating} / 5` : "–"} hint={`${kpis.feedbackResponses} feedback responses`} accent={AMBER} />
                    <Kpi icon={FileDown} label="Certificates" value={String(kpis.certificates)} hint="valid, all events" accent={INDIGO} />
                </div>

                <div className="grid lg:grid-cols-3 gap-4">
                    <Card title="Activity by month" subtitle="Registrations, first-time students and check-ins (IST)" className="lg:col-span-2">
                        <div className="h-64">
                            <ResponsiveContainer>
                                <AreaChart data={monthly} margin={{ left: -20, right: 8 }}>
                                    <defs>
                                        <linearGradient id="gReg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={AMBER} stopOpacity={0.4} /><stop offset="100%" stopColor={AMBER} stopOpacity={0} /></linearGradient>
                                        <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={INDIGO} stopOpacity={0.35} /><stop offset="100%" stopColor={INDIGO} stopOpacity={0} /></linearGradient>
                                    </defs>
                                    <CartesianGrid stroke={GRID} vertical={false} />
                                    <XAxis dataKey="label" {...axis} />
                                    <YAxis {...axis} allowDecimals={false} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Legend wrapperStyle={{ fontSize: 12, color: MUTED }} />
                                    <Area type="monotone" dataKey="registrations" name="Registrations" stroke={AMBER} fill="url(#gReg)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="newStudents" name="First-time students" stroke={INDIGO} fill="url(#gNew)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="checkins" name="Check-ins" stroke={GREEN} fillOpacity={0} strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                    <Card title="Who registers: by year" subtitle="Distinct students">
                        <div className="h-64">
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie data={props.byYear} dataKey="count" nameKey="label" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
                                        {props.byYear.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Legend wrapperStyle={{ fontSize: 12, color: MUTED }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                    <Card title="Clubs compared" subtitle="Registrations and attendance across each club's events">
                        <div className="h-72">
                            <ResponsiveContainer>
                                <BarChart data={props.clubs} layout="vertical" margin={{ left: 10, right: 16 }}>
                                    <CartesianGrid stroke={GRID} horizontal={false} />
                                    <XAxis type="number" {...axis} allowDecimals={false} />
                                    <YAxis type="category" dataKey="club" {...axis} width={110} />
                                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                                    <Legend wrapperStyle={{ fontSize: 12, color: MUTED }} />
                                    <Bar dataKey="registrations" name="Registrations" fill={AMBER} radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="attended" name="Attended" fill={GREEN} radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                    <Card title="Courses" subtitle="Top courses among registered students">
                        <div className="h-72">
                            <ResponsiveContainer>
                                <BarChart data={props.byCourse} margin={{ left: -20, right: 8 }}>
                                    <CartesianGrid stroke={GRID} vertical={false} />
                                    <XAxis dataKey="label" {...axis} interval={0} angle={-25} textAnchor="end" height={50} />
                                    <YAxis {...axis} allowDecimals={false} />
                                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                                    <Bar dataKey="count" name="Students" fill={INDIGO} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                    <Card title="Feedback ratings" subtitle="All rating questions">
                        <div className="h-52">
                            <ResponsiveContainer>
                                <BarChart data={props.ratings.map(r => ({ ...r, label: `${r.star}★` }))} margin={{ left: -20, right: 8 }}>
                                    <XAxis dataKey="label" {...axis} />
                                    <YAxis {...axis} allowDecimals={false} />
                                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                                    <Bar dataKey="count" name="Ratings" fill={AMBER} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                    <Card title="Repeat participation" subtitle="Events registered per student">
                        <div className="h-52">
                            <ResponsiveContainer>
                                <BarChart data={props.repeat} margin={{ left: -20, right: 8 }}>
                                    <XAxis dataKey="label" {...axis} />
                                    <YAxis {...axis} allowDecimals={false} />
                                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                                    <Bar dataKey="students" name="Students" fill={GREEN} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                    <Card title="XP spread" subtitle="Students per XP range">
                        <div className="h-52">
                            <ResponsiveContainer>
                                <BarChart data={props.xp} margin={{ left: -20, right: 8 }}>
                                    <XAxis dataKey="label" {...axis} />
                                    <YAxis {...axis} allowDecimals={false} />
                                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                                    <Bar dataKey="students" name="Students" fill={INDIGO} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                <Card title="Every event" subtitle="Click a column to sort. Turnout needs attendance to be recorded.">
                    <div className="overflow-x-auto -mx-5 px-5">
                        <table className="w-full text-sm min-w-[760px]">
                            <thead className="text-xs text-gray-500 text-left">
                                <tr className="border-b border-white/10">
                                    <th className="py-2 pr-3 font-medium"><SortHeader k="date" sort={sort} setSort={setSort}>Event</SortHeader></th>
                                    <th className="py-2 pr-3 font-medium"><SortHeader k="registrations" sort={sort} setSort={setSort}>Registered</SortHeader></th>
                                    <th className="py-2 pr-3 font-medium"><SortHeader k="attended" sort={sort} setSort={setSort}>Attended</SortHeader></th>
                                    <th className="py-2 pr-3 font-medium"><SortHeader k="turnoutPct" sort={sort} setSort={setSort}>Turnout</SortHeader></th>
                                    <th className="py-2 pr-3 font-medium"><SortHeader k="avgRating" sort={sort} setSort={setSort}>Rating</SortHeader></th>
                                    <th className="py-2 pr-3 font-medium">Certificates</th>
                                    <th className="py-2 font-medium">Report</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {events.map(e => (
                                    <tr key={e.id} className="hover:bg-white/[0.02]">
                                        <td className="py-2.5 pr-3">
                                            <Link href={`/admin/events/${e.id}`} className="text-white hover:text-amber-300">{e.title}</Link>
                                            <div className="text-xs text-gray-500">{fmtDate(e.date)}{e.club ? ` · ${e.club}` : ""}</div>
                                        </td>
                                        <td className="py-2.5 pr-3 tabular-nums text-gray-300">{e.registrations}{e.capacity ? <span className="text-gray-600"> / {e.capacity}</span> : null}</td>
                                        <td className="py-2.5 pr-3 tabular-nums text-gray-300">{e.attendanceRecorded ? e.attended : <span className="text-amber-400/80 text-xs">not recorded</span>}</td>
                                        <td className="py-2.5 pr-3 tabular-nums">
                                            {e.attendanceRecorded ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 w-16 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${Math.min(100, e.turnoutPct)}%` }} /></div>
                                                    <span className="text-gray-300">{e.turnoutPct}%</span>
                                                </div>
                                            ) : <span className="text-gray-600">–</span>}
                                        </td>
                                        <td className="py-2.5 pr-3 tabular-nums text-gray-300">{e.avgRating !== null ? `${e.avgRating} (${e.ratings})` : <span className="text-gray-600">–</span>}</td>
                                        <td className="py-2.5 pr-3 tabular-nums text-gray-300">{e.certificates}</td>
                                        <td className="py-2.5"><a href={`/api/admin/events/${e.id}/report`} className="text-xs text-amber-300 hover:underline inline-flex items-center gap-1"><FileDown className="w-3.5 h-3.5" />PDF</a></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    )
}
