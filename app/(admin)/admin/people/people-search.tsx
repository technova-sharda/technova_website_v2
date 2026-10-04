'use client'

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Award, Calendar, CheckCircle2, Loader2, Mail, Phone, Search, Trophy, UserRound, X } from "lucide-react"
import { getPerson, searchPeople, type PersonDetail, type PersonSummary } from "@/lib/actions/people"

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })

function Avatar({ p, size = 40 }: { p: PersonSummary; size?: number }) {
    const initials = (p.name || p.email || "?").split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase()
    return p.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image} alt="" referrerPolicy="no-referrer" loading="lazy" style={{ width: size, height: size }} className="rounded-full object-cover border border-white/10 shrink-0" />
    ) : (
        <div style={{ width: size, height: size }} className="rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-gray-300 shrink-0">{initials}</div>
    )
}

function Detail({ person, onClose }: { person: PersonDetail; onClose: () => void }) {
    const daysByEvent = useMemo(() => {
        const m = new Map<string, number>()
        for (const c of person.checkinDays) m.set(c.event_id, (m.get(c.event_id) ?? 0) + 1)
        return m
    }, [person])
    const certByEvent = useMemo(() => new Map(person.certificates.map(c => [c.event_id, c])), [person])
    const checkinXp = person.checkinDays.reduce((s, c) => s + (c.xp_awarded || 0), 0)
    const awardXp = person.xpAwards.reduce((s, a) => s + (a.xp_amount || 0), 0)
    const attended = person.registrations.filter(r => r.attended || daysByEvent.has(r.event.id)).length

    return (
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-6">
            <div className="flex items-start gap-4">
                <Avatar p={person} size={56} />
                <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-white">{person.name || "Unnamed"}</h2>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                        {person.email && <a href={`mailto:${person.email}`} className="flex items-center gap-1.5 hover:text-white"><Mail className="w-4 h-4" />{person.email}</a>}
                        {person.mobile && <a href={`tel:${person.mobile}`} className="flex items-center gap-1.5 hover:text-white"><Phone className="w-4 h-4" />{person.mobile}</a>}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                        {[person.system_id, person.course, person.year ? `Year ${person.year}` : null, person.section ? `Sec ${person.section}` : null, person.role].filter(Boolean).join(" · ")}
                    </p>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-gray-400" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    ["XP (profile)", person.xp_points ?? 0, Trophy],
                    ["Registered", person.registrations.length, Calendar],
                    ["Attended", attended, CheckCircle2],
                    ["Certificates", person.certificates.filter(c => c.status === "valid").length, Award],
                ].map(([label, value, Icon]: any) => (
                    <div key={label} className="p-3 rounded-xl bg-black/40 border border-white/5">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500"><Icon className="w-3.5 h-3.5" />{label}</div>
                        <div className="text-xl font-bold text-white mt-1">{value}</div>
                    </div>
                ))}
            </div>
            <p className="text-xs text-gray-500">XP history: {checkinXp} from check-ins + {awardXp} from other awards. Referral and bug-report XP isn&apos;t recorded per event, so the profile total can be higher.</p>

            <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Events</h3>
                {person.registrations.length === 0 ? (
                    <p className="text-sm text-gray-500">No registrations.</p>
                ) : (
                    <div className="rounded-xl border border-white/10 divide-y divide-white/5">
                        {person.registrations.map(r => {
                            const days = daysByEvent.get(r.event.id) ?? 0
                            const cert = certByEvent.get(r.event.id)
                            return (
                                <div key={r.id} className="px-3 py-2.5 text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                    <Link href={`/admin/events/${r.event.id}`} className="flex-1 text-white hover:text-blue-300 truncate">{r.event.title}</Link>
                                    <span className="text-gray-500 shrink-0">{fmt(r.event.start_time)}</span>
                                    <span className={`shrink-0 text-xs ${r.attended || days ? "text-emerald-400" : "text-gray-500"}`}>
                                        {r.attended || days ? `Attended${days > 1 ? ` (${days} days)` : ""}` : r.payment_status === "pending" ? "Payment pending" : "Registered"}
                                    </span>
                                    {cert && <a href={`/verify/${cert.certificate_id}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-violet-300 hover:underline">{cert.status === "valid" ? "Certificate" : `Certificate (${cert.status})`}</a>}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

export function PeopleSearch() {
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<PersonSummary[]>([])
    const [searching, setSearching] = useState(false)
    const [selected, setSelected] = useState<PersonDetail | null>(null)
    const [loadingId, setLoadingId] = useState<string | null>(null)

    useEffect(() => {
        const q = query.trim()
        if (q.length < 2) return
        let cancelled = false
        const timer = setTimeout(async () => {
            setSearching(true)
            try {
                const found = await searchPeople(q)
                if (!cancelled) setResults(found)
            } catch (e: any) {
                if (!cancelled) toast.error(e?.message || "Search failed")
            } finally {
                if (!cancelled) setSearching(false)
            }
        }, 300)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [query])

    const open = async (id: string) => {
        setLoadingId(id)
        try {
            const p = await getPerson(id)
            if (p) setSelected(p)
            else toast.error("Person not found")
        } catch (e: any) {
            toast.error(e?.message || "Could not load")
        } finally {
            setLoadingId(null)
        }
    }

    return (
        <div className="min-h-screen bg-black p-4 sm:p-6 md:p-8">
            <div className="max-w-5xl space-y-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3"><UserRound className="w-8 h-8 text-blue-400" /> People</h1>
                    <p className="text-gray-400 mt-1">Look up any student: events registered and attended, certificates and XP.</p>
                </div>

                <div className="relative max-w-xl">
                    <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Name, email or system ID"
                        autoFocus
                        className="w-full h-12 pl-9 pr-9 rounded-xl bg-zinc-950 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
                    />
                    {searching && <Loader2 className="w-4 h-4 text-gray-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                </div>

                {selected && <Detail person={selected} onClose={() => setSelected(null)} />}

                {query.trim().length >= 2 && (
                    <div className="space-y-2">
                        {results.length === 0 && !searching && <p className="text-sm text-gray-500">No one found.</p>}
                        {results.map(p => (
                            <button
                                key={p.id}
                                onClick={() => open(p.id)}
                                className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors ${selected?.id === p.id ? "border-blue-500/40 bg-blue-500/5" : "border-white/5 bg-white/[0.02] hover:border-white/15"}`}
                            >
                                <Avatar p={p} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-white font-medium truncate">{p.name || "Unnamed"}</div>
                                    <div className="text-sm text-gray-500 truncate">{p.email}{p.system_id ? ` · ${p.system_id}` : ""}</div>
                                </div>
                                <span className="text-sm text-gray-400 shrink-0">{p.xp_points ?? 0} XP</span>
                                {loadingId === p.id && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
