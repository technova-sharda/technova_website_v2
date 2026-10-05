import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Activity, Database, FileUp, Pencil, Plus, ScrollText, Search, Trash2, Users } from "lucide-react"
import { auth } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { AUDIT_TABLE, entityLabel } from "@/lib/audit/audit"
import { canViewAuditLog } from "@/lib/audit/viewers"
import { PageHeader } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Activity Logs" }

const PAGE_SIZE = 60
const RANGES = { "1": "Today", "7": "Last 7 days", "30": "Last 30 days", all: "All time" } as const
const ACTIONS = { insert: "Added", update: "Updated", upsert: "Saved", delete: "Deleted", upload: "Uploaded", remove: "Removed files", email: "Emails sent" } as const

type Row = {
    id: number; created_at: string; request_id: string | null; actor_name: string | null; actor_email: string | null; actor_role: string | null
    action: string; entity: string; target_id: string | null; target_label: string | null; summary: string; page: string | null; details: any
}
type Search = { who?: string; what?: string; act?: string; range?: string; q?: string; page?: string }

const IST = "Asia/Kolkata"
const fmtTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, weekday: "long", day: "numeric", month: "long", year: "numeric" })
function ago(iso: string) {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
    if (s < 60) return "just now"
    if (s < 3600) return `${Math.floor(s / 60)} min ago`
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`
    return `${Math.floor(s / 86400)} d ago`
}
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
function since(range: string) {
    if (range === "all") return null
    const days = Number(range) || 30
    if (days === 1) {
        // start of today in IST
        const key = new Date().toLocaleDateString("en-CA", { timeZone: IST })
        return new Date(`${key}T00:00:00+05:30`).toISOString()
    }
    return daysAgo(days)
}

function actionStyle(action: string) {
    if (action === "insert") return { Icon: Plus, cls: "bg-emerald-500/15 text-emerald-400" }
    if (action === "delete" || action === "remove") return { Icon: Trash2, cls: "bg-red-500/15 text-red-400" }
    if (action === "upload") return { Icon: FileUp, cls: "bg-sky-500/15 text-sky-400" }
    if (action === "update" || action === "upsert") return { Icon: Pencil, cls: "bg-amber-500/15 text-amber-400" }
    return { Icon: Activity, cls: "bg-violet-500/15 text-violet-400" }
}

function Value({ v }: { v: unknown }) {
    if (v === null || v === undefined) return <span className="text-gray-600">empty</span>
    if (typeof v === "object") return <code className="text-[11px] text-gray-300 break-all">{JSON.stringify(v)}</code>
    return <span className="break-all">{String(v)}</span>
}

function Details({ d }: { d: any }) {
    if (!d) return null
    const changes = d.changes
    const filters = d.filters && Object.keys(d.filters).length ? d.filters : null
    const paths: string[] | undefined = d.paths
    return (
        <div className="mt-2 rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-gray-300 space-y-2">
            {filters && <p><span className="text-gray-500">Which rows:</span> {Object.entries(filters).map(([k, v]) => `${k} ${v}`).join(", ")}</p>}
            {d.rows > 1 && <p><span className="text-gray-500">Rows:</span> {d.rows}</p>}
            {paths && <ul className="list-disc pl-4 space-y-0.5">{paths.map(p => <li key={p} className="break-all">{p}</li>)}</ul>}
            {changes && typeof changes === "object" && !Array.isArray(changes) && (
                <table className="w-full">
                    <tbody>
                        {Object.entries(changes).map(([k, v]) => (
                            <tr key={k} className="border-t border-white/5 align-top">
                                <td className="py-1 pr-3 text-gray-500 whitespace-nowrap">{k}</td>
                                <td className="py-1"><Value v={v} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {Array.isArray(changes) && <Value v={changes} />}
        </div>
    )
}

export default async function LogsPage({ searchParams }: { searchParams: Promise<Search> }) {
    const session = await auth()
    // Not even a "no access" message: for everyone else this page doesn't exist.
    if (!session?.user || session.user.role !== "super_admin" || !canViewAuditLog(session.user.email)) notFound()

    const sp = await searchParams
    const range = sp.range && sp.range in RANGES ? sp.range : "30"
    const page = Math.max(1, Number(sp.page) || 1)
    const from = since(range)
    const sb = createAdminClient()

    let query = sb.from(AUDIT_TABLE).select("*", { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false })
    if (from) query = query.gte("created_at", from)
    if (sp.who) query = query.eq("actor_email", sp.who)
    if (sp.what) query = query.eq("entity", sp.what)
    if (sp.act) query = query.eq("action", sp.act)
    if (sp.q?.trim()) {
        const q = sp.q.trim().replace(/[%,()]/g, " ")
        query = query.or(`summary.ilike.%${q}%,target_label.ilike.%${q}%,actor_name.ilike.%${q}%`)
    }

    // Filter options and "most active" from the last 30 days (two small columns)
    const [{ data, count, error }, facets] = await Promise.all([
        query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
        sb.from(AUDIT_TABLE).select("actor_email, actor_name, entity, created_at").gte("created_at", daysAgo(30)).limit(5000),
    ])

    if (error) {
        const missing = /does not exist|could not find the table|PGRST205|42P01/i.test(error.message + (error.code ?? ""))
        return (
            <div className="max-w-2xl mx-auto mt-10 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
                <h1 className="text-xl font-bold text-white flex items-center gap-2"><Database className="w-5 h-5 text-amber-400" /> Activity Logs</h1>
                {missing ? (
                    <p className="text-gray-300 mt-3 text-sm leading-relaxed">
                        The log table isn&apos;t in the database yet. Run <code className="text-amber-300">supabase/migrations/20261005_admin_audit_log.sql</code> in the Supabase SQL editor; logging starts the moment it exists. It only adds a new table and touches nothing else.
                    </p>
                ) : <p className="text-red-400 mt-3 text-sm">{error.message}</p>}
            </div>
        )
    }

    const rows = (data ?? []) as Row[]
    const recent = (facets.data ?? []) as { actor_email: string | null; actor_name: string | null; entity: string; created_at: string }[]
    const people = new Map<string, { name: string; count: number }>()
    const entities = new Map<string, number>()
    for (const r of recent) {
        if (r.actor_email) people.set(r.actor_email, { name: r.actor_name || r.actor_email, count: (people.get(r.actor_email)?.count ?? 0) + 1 })
        entities.set(r.entity, (entities.get(r.entity) ?? 0) + 1)
    }
    const top = [...people.entries()].sort((a, b) => b[1].count - a[1].count)
    const todayStart = since("1")!
    const today = recent.filter(r => r.created_at >= todayStart).length
    const week = recent.filter(r => r.created_at >= daysAgo(7)).length

    // One card per click (request), split by day
    const groups: { key: string; day: string; rows: Row[] }[] = []
    for (const r of rows) {
        const key = r.request_id ?? `row-${r.id}`
        const last = groups[groups.length - 1]
        if (last && last.key === key) last.rows.push(r)
        else groups.push({ key, day: fmtDay(r.created_at), rows: [r] })
    }
    const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
    const link = (patch: Partial<Search>) => {
        const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][])
        return `/admin/logs${p.size ? `?${p}` : ""}`
    }
    const select = "h-10 rounded-lg bg-zinc-950 border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-amber-500/50"

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <PageHeader icon={ScrollText} title="Activity logs" description="Every change made in the admin panel by a super admin, and in Club Management by anyone. Only you can see this page." />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[["Changes today", today], ["Last 7 days", week], ["Last 30 days", recent.length], ["People active (30 days)", people.size]].map(([l, v]) => (
                    <div key={l as string} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                        <p className="text-[11px] uppercase tracking-wider text-gray-500">{l}</p>
                        <p className="text-2xl font-bold text-white mt-1">{v}</p>
                    </div>
                ))}
            </div>

            {top.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="text-xs font-semibold text-gray-400 flex items-center gap-2 mb-3"><Users className="w-4 h-4" /> Most active (30 days)</p>
                    <div className="flex flex-wrap gap-2">
                        {top.slice(0, 8).map(([email, p]) => (
                            <Link key={email} href={link({ who: email, page: undefined })} className={`rounded-full border px-3 py-1 text-xs transition-colors ${sp.who === email ? "bg-amber-500 text-black border-amber-500" : "border-white/10 text-gray-300 hover:bg-white/5"}`}>
                                {p.name} <span className="opacity-60">· {p.count}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <form method="get" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_0.9fr_auto] items-center">
                <label className="relative">
                    <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input name="q" defaultValue={sp.q ?? ""} placeholder="Search event, member, person…" className={`${select} w-full pl-9`} />
                </label>
                <select name="who" defaultValue={sp.who ?? ""} className={select} aria-label="Person">
                    <option value="">Everyone</option>
                    {top.map(([email, p]) => <option key={email} value={email}>{p.name}</option>)}
                </select>
                <select name="what" defaultValue={sp.what ?? ""} className={select} aria-label="What">
                    <option value="">Everything</option>
                    {[...entities.keys()].sort().map(e => <option key={e} value={e}>{entityLabel(e.replace(/^next_auth\./, ""))}</option>)}
                </select>
                <select name="act" defaultValue={sp.act ?? ""} className={select} aria-label="Action">
                    <option value="">Any action</option>
                    {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select name="range" defaultValue={range} className={select} aria-label="When">
                    {Object.entries(RANGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <div className="flex gap-2">
                    <button className="h-10 px-4 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400">Apply</button>
                    <Link href="/admin/logs" className="h-10 px-3 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5 flex items-center">Clear</Link>
                </div>
            </form>

            <p className="text-xs text-gray-500">{count ?? 0} change{count === 1 ? "" : "s"} · {RANGES[range as keyof typeof RANGES].toLowerCase()}</p>

            {groups.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-gray-400 text-sm">No changes recorded for these filters yet.</div>
            )}

            <div className="space-y-3">
                {groups.map((g, i) => {
                    const r0 = g.rows[0]
                    const initials = (r0.actor_name || r0.actor_email || "?").split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase()
                    return (
                        <div key={g.key}>
                            {(i === 0 || groups[i - 1].day !== g.day) && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-3 pb-2">{g.day}</p>}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                                <div className="flex flex-wrap items-start gap-3">
                                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-gray-200 shrink-0">{initials}</div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-white font-medium">
                                            {r0.actor_name || "Unknown"}
                                            {r0.actor_role && r0.actor_role !== "super_admin" && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-300">{r0.actor_role}</span>}
                                        </p>
                                        <p className="text-xs text-gray-500 break-all">{r0.actor_email}</p>
                                    </div>
                                    <div className="text-right text-xs text-gray-500">
                                        <p className="text-gray-300">{fmtTime(r0.created_at)}</p>
                                        <p>{ago(r0.created_at)}</p>
                                    </div>
                                </div>
                                <ul className="mt-3 space-y-2">
                                    {g.rows.map(r => {
                                        const { Icon, cls } = actionStyle(r.action)
                                        return (
                                            <li key={r.id}>
                                                <details className="group">
                                                    <summary className="flex items-start gap-2 cursor-pointer list-none text-sm text-gray-200 hover:text-white">
                                                        <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${cls}`}><Icon className="w-3 h-3" /></span>
                                                        <span className="min-w-0 break-words">{r.summary}</span>
                                                        <span className="ml-auto text-[11px] text-gray-600 group-open:hidden shrink-0">details</span>
                                                    </summary>
                                                    <Details d={r.details} />
                                                </details>
                                            </li>
                                        )
                                    })}
                                </ul>
                                {r0.page && (
                                    <p className="mt-3 text-[11px] text-gray-500">
                                        From <Link href={r0.page} className="text-gray-400 underline decoration-white/20 hover:text-white break-all">{r0.page}</Link>
                                    </p>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {pages > 1 && (
                <div className="flex items-center justify-between pt-2 text-sm">
                    {page > 1 ? <Link href={link({ page: String(page - 1) })} className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5">Newer</Link> : <span />}
                    <span className="text-gray-500 text-xs">Page {page} of {pages}</span>
                    {page < pages ? <Link href={link({ page: String(page + 1) })} className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5">Older</Link> : <span />}
                </div>
            )}
        </div>
    )
}
