'use client'

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Award, ExternalLink, Loader2, MailWarning, Search } from "lucide-react"
import { searchCertificates, type CertificateHit } from "@/lib/actions/certificates-hub"

export type HubEventRow = {
    id: string; title: string; date: string; club: string | null
    valid: number; pending: number; revoked: number; emailed: number; notEmailed: number; downloads: number; positions: number
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })

function Stat({ label, value, tone = "text-white" }: { label: string; value: number; tone?: string }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value.toLocaleString("en-IN")}</div>
        </div>
    )
}

export function CertificatesHub({ rows, missing, generatedAt }: {
    rows: HubEventRow[]
    missing: { id: string; title: string; date: string; hasAttendance: boolean }[]
    generatedAt: string
}) {
    const [query, setQuery] = useState("")
    const [hits, setHits] = useState<CertificateHit[]>([])
    const [searching, setSearching] = useState(false)

    useEffect(() => {
        const q = query.trim()
        if (q.length < 2) return
        let cancelled = false
        const t = setTimeout(async () => {
            setSearching(true)
            try {
                const found = await searchCertificates(q)
                if (!cancelled) setHits(found)
            } catch (e: any) {
                if (!cancelled) toast.error(e?.message || "Search failed")
            } finally {
                if (!cancelled) setSearching(false)
            }
        }, 300)
        return () => { cancelled = true; clearTimeout(t) }
    }, [query])

    const total = rows.reduce((acc, r) => ({
        valid: acc.valid + r.valid, pending: acc.pending + r.pending, revoked: acc.revoked + r.revoked,
        notEmailed: acc.notEmailed + r.notEmailed, downloads: acc.downloads + r.downloads,
    }), { valid: 0, pending: 0, revoked: 0, notEmailed: 0, downloads: 0 })

    return (
        <div className="min-h-screen bg-black p-4 sm:p-6 md:p-8">
            <div className="max-w-6xl space-y-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3"><Award className="w-8 h-8 text-violet-400" /> Certificates</h1>
                    <p className="text-gray-400 mt-1">Every event&apos;s certificates in one place. Sending and editing stay on each event&apos;s certificate page.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Stat label="Issued (valid)" value={total.valid} />
                    <Stat label="Prepared, not sent" value={total.pending} tone="text-amber-300" />
                    <Stat label="Valid but not emailed" value={total.notEmailed} tone={total.notEmailed ? "text-amber-300" : "text-white"} />
                    <Stat label="Revoked" value={total.revoked} tone="text-red-300" />
                    <Stat label="Downloads" value={total.downloads} tone="text-violet-300" />
                </div>

                <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-white">Find a certificate</h2>
                    <div className="relative max-w-xl">
                        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Certificate ID, student name or email"
                            className="w-full h-11 pl-9 pr-9 rounded-xl bg-zinc-950 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50" />
                        {searching && <Loader2 className="w-4 h-4 text-gray-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                    </div>
                    {query.trim().length >= 2 && !searching && hits.length === 0 && <p className="text-sm text-gray-500">No certificates found.</p>}
                    {hits.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[720px]">
                                <thead className="text-xs text-gray-500 text-left"><tr className="border-b border-white/10">
                                    <th className="py-2 pr-3 font-medium">Student</th><th className="py-2 pr-3 font-medium">Event</th><th className="py-2 pr-3 font-medium">Certificate</th>
                                    <th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-3 font-medium">Emailed</th><th className="py-2 font-medium">Downloads</th>
                                </tr></thead>
                                <tbody className="divide-y divide-white/5">
                                    {hits.map(h => (
                                        <tr key={h.certificate_id}>
                                            <td className="py-2 pr-3"><div className="text-white">{h.student?.name || "Unknown"}</div><div className="text-xs text-gray-500">{h.student?.email}</div></td>
                                            <td className="py-2 pr-3 text-gray-300">{h.event ? <Link href={`/admin/events/${h.event.id}/certificates`} className="hover:text-violet-300">{h.event.title}</Link> : "–"}{h.role_title && <div className="text-xs text-amber-300">{h.role_title}</div>}</td>
                                            <td className="py-2 pr-3"><a href={`/verify/${h.certificate_id}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-violet-300 hover:underline inline-flex items-center gap-1">{h.certificate_id}<ExternalLink className="w-3 h-3" /></a></td>
                                            <td className="py-2 pr-3"><span className={`text-xs px-2 py-0.5 rounded-full ${h.status === "valid" ? "bg-green-500/15 text-green-300" : h.status === "pending" ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300"}`}>{h.status}</span></td>
                                            <td className="py-2 pr-3 text-gray-400">{h.emailed ? "Yes" : "No"}</td>
                                            <td className="py-2 text-gray-400 tabular-nums">{h.downloads}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                    <h2 className="text-sm font-semibold text-white">Events with certificates</h2>
                    {rows.length === 0 ? <p className="mt-3 text-sm text-gray-500">No certificates yet.</p> : (
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-sm min-w-[720px]">
                                <thead className="text-xs text-gray-500 text-left"><tr className="border-b border-white/10">
                                    <th className="py-2 pr-3 font-medium">Event</th><th className="py-2 pr-3 font-medium">Valid</th><th className="py-2 pr-3 font-medium">Not emailed</th>
                                    <th className="py-2 pr-3 font-medium">Pending</th><th className="py-2 pr-3 font-medium">Revoked</th><th className="py-2 pr-3 font-medium">Downloads</th><th className="py-2 font-medium" />
                                </tr></thead>
                                <tbody className="divide-y divide-white/5">
                                    {rows.map(r => (
                                        <tr key={r.id}>
                                            <td className="py-2.5 pr-3"><div className="text-white">{r.title}</div><div className="text-xs text-gray-500">{fmtDate(r.date)}{r.positions ? ` · ${r.positions} position certificates` : ""}</div></td>
                                            <td className="py-2.5 pr-3 tabular-nums text-gray-300">{r.valid}</td>
                                            <td className="py-2.5 pr-3 tabular-nums">{r.notEmailed ? <span className="inline-flex items-center gap-1 text-amber-300"><MailWarning className="w-3.5 h-3.5" />{r.notEmailed}</span> : <span className="text-gray-600">0</span>}</td>
                                            <td className="py-2.5 pr-3 tabular-nums text-gray-300">{r.pending}</td>
                                            <td className="py-2.5 pr-3 tabular-nums text-gray-300">{r.revoked}</td>
                                            <td className="py-2.5 pr-3 tabular-nums text-gray-300">{r.downloads}</td>
                                            <td className="py-2.5 text-right"><Link href={`/admin/events/${r.id}/certificates`} className="text-xs text-violet-300 hover:underline">Open</Link></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {missing.length > 0 && (
                    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                        <h2 className="text-sm font-semibold text-white">Past events without certificates</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Only events with recorded attendance can send participation certificates to attendees; record attendance first where it&apos;s missing.</p>
                        <ul className="mt-3 divide-y divide-white/5">
                            {missing.map(m => (
                                <li key={m.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-sm">
                                    <span className="text-gray-300">{m.title} <span className="text-gray-600">· {fmtDate(m.date)}</span></span>
                                    <span className="flex gap-3 text-xs">
                                        {!m.hasAttendance && <Link href={`/admin/events/${m.id}/attendance`} className="text-amber-300 hover:underline">Record attendance</Link>}
                                        <Link href={`/admin/events/${m.id}/certificates`} className="text-violet-300 hover:underline">Set up certificates</Link>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
                <p className="text-xs text-gray-600">Counts refresh every 5 minutes (last {new Date(generatedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST).</p>
            </div>
        </div>
    )
}
