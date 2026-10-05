'use client'

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Award, Calendar, ExternalLink, Loader2, MapPin, Pencil, Search, Settings2, Trash2, TriangleAlert, UserCheck, Users } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BannerImage } from "@/components/ui/banner-image"
import { EmptyState, Meter, PhaseBadge, buttonCls } from "@/components/admin/ui"
import { deleteEvent } from "@/lib/actions/events"
import type { EventPhase } from "@/lib/events/phase"

export type AdminEventRow = {
    id: string; title: string; slug: string | null; banner: string | null; club: string | null
    phase: EventPhase; startTime: string; when: string; where: string
    capacity: number | null; registrations: number; attended: number; registrationsClosed: boolean
}

type Tab = "active" | "drafts" | "past" | "all"
const TABS: { id: Tab; label: string; match: (p: EventPhase) => boolean }[] = [
    { id: "active", label: "Live & upcoming", match: p => p === "live" || p === "upcoming" },
    { id: "past", label: "Ended", match: p => p === "ended" },
    { id: "drafts", label: "Drafts", match: p => p === "draft" || p === "cancelled" },
    { id: "all", label: "All", match: () => true },
]

export function EventsManager({ rows }: { rows: AdminEventRow[] }) {
    const hasActive = rows.some(r => r.phase === "live" || r.phase === "upcoming")
    const [tab, setTab] = useState<Tab>(hasActive ? "active" : "past")
    const [q, setQ] = useState("")
    const [toDelete, setToDelete] = useState<AdminEventRow | null>(null)

    const counts = useMemo(() => Object.fromEntries(TABS.map(t => [t.id, rows.filter(r => t.match(r.phase)).length])) as Record<Tab, number>, [rows])
    const shown = useMemo(() => {
        const t = TABS.find(x => x.id === tab)!
        const needle = q.trim().toLowerCase()
        const list = rows.filter(r => t.match(r.phase) && (!needle || r.title.toLowerCase().includes(needle) || (r.club ?? "").toLowerCase().includes(needle)))
        // Upcoming: soonest first. Everything else: newest first.
        return tab === "active" ? [...list].sort((a, b) => a.startTime.localeCompare(b.startTime)) : list
    }, [rows, tab, q])

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02] p-1">
                    {TABS.map(t => (
                        <button key={t.id} type="button" onClick={() => setTab(t.id)}
                            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${tab === t.id ? "bg-white/10 font-medium text-white" : "text-gray-400 hover:text-white"}`}>
                            {t.label} <span className="ml-1 text-xs text-gray-500">{counts[t.id]}</span>
                        </button>
                    ))}
                </div>
                <label className="relative md:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search events or clubs" className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none" />
                </label>
            </div>

            {shown.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
                    <EmptyState
                        icon={Calendar}
                        title={q ? "No events match your search" : tab === "active" ? "No live or upcoming events" : tab === "drafts" ? "No drafts" : "Nothing here yet"}
                        hint={tab === "active" && !q ? "Create the next event, or look at the ended ones." : undefined}
                        action={tab === "active" && !q ? <Link href="/admin/events/new" className={buttonCls.primary}>Create event</Link> : undefined}
                    />
                </div>
            ) : (
                <ul className="space-y-3">
                    {shown.map(r => <EventCard key={r.id} r={r} onDelete={() => setToDelete(r)} />)}
                </ul>
            )}

            {toDelete && <DeleteDialog event={toDelete} onClose={() => setToDelete(null)} />}
        </div>
    )
}

function EventCard({ r, onDelete }: { r: AdminEventRow; onDelete: () => void }) {
    const ended = r.phase === "ended"
    const turnout = r.registrations ? Math.round((r.attended / r.registrations) * 100) : 0
    return (
        <li className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition-colors hover:border-white/20 sm:p-4">
            <div className="flex gap-3 sm:gap-4">
                <Link href={`/admin/events/${r.id}`} className="relative hidden h-[72px] w-[128px] shrink-0 overflow-hidden rounded-xl bg-white/5 sm:block">
                    {r.banner ? <BannerImage src={r.banner} alt="" sizes="128px" className="object-cover" /> : <Calendar className="absolute inset-0 m-auto h-6 w-6 text-gray-600" />}
                </Link>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/events/${r.id}`} className="truncate font-semibold text-white hover:text-amber-300">{r.title}</Link>
                        <PhaseBadge phase={r.phase} />
                        {r.registrationsClosed && !ended && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-gray-400">Registrations closed</span>}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                        {r.club && <span className="text-gray-300">{r.club}</span>}
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{r.when}</span>
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.where}</span>
                    </p>

                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,260px)_1fr] sm:items-end">
                        <div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="inline-flex items-center gap-1 text-gray-400"><Users className="h-3 w-3" /> Registered</span>
                                <span className="font-medium text-white">{r.registrations}{r.capacity ? <span className="text-gray-500"> / {r.capacity}</span> : null}</span>
                            </div>
                            {r.capacity ? <div className="mt-1.5"><Meter value={r.registrations} max={r.capacity} tone={r.registrations >= r.capacity ? "rose" : "blue"} /></div> : null}
                            {ended && (
                                <p className="mt-1.5 text-xs text-gray-400">
                                    {r.attended ? <><span className="font-medium text-emerald-300">{r.attended} attended</span> · {turnout}% turnout</> : <span className="text-amber-300/80">Attendance not recorded</span>}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                            <Link href={`/admin/events/${r.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400"><Settings2 className="h-3.5 w-3.5" /> Manage</Link>
                            {ended && <Link href={`/admin/events/${r.id}/attendance`} className={buttonCls.ghost}><UserCheck className="h-3.5 w-3.5" /> Attendance</Link>}
                            {ended && <Link href={`/admin/events/${r.id}/certificates`} className={buttonCls.ghost}><Award className="h-3.5 w-3.5" /> Certificates</Link>}
                            <Link href={`/admin/events/${r.id}/edit`} className={buttonCls.ghost}><Pencil className="h-3.5 w-3.5" /> Edit</Link>
                            <Link href={`/events/${r.slug || r.id}`} target="_blank" className={buttonCls.ghost} aria-label="Open public page"><ExternalLink className="h-3.5 w-3.5" /> Public</Link>
                            <button type="button" onClick={onDelete} className="inline-flex items-center rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400" aria-label="Delete event" title="Delete event">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </li>
    )
}

function DeleteDialog({ event, onClose }: { event: AdminEventRow; onClose: () => void }) {
    const router = useRouter()
    const [typed, setTyped] = useState("")
    const [pending, start] = useTransition()
    const needsName = event.registrations > 0
    const ok = !needsName || typed.trim() === event.title.trim()

    const confirm = () => start(async () => {
        const res = await deleteEvent(event.id, typed)
        if ("error" in res) return void toast.error(res.error)
        toast.success(`"${event.title}" deleted`)
        onClose()
        router.refresh()
    })

    return (
        <Dialog open onOpenChange={o => { if (!o && !pending) onClose() }}>
            <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md border-white/10 bg-zinc-950 text-white">
                <DialogHeader className="text-left">
                    <DialogTitle className="flex items-center gap-2"><TriangleAlert className="h-5 w-5 text-rose-400" /> Delete this event?</DialogTitle>
                    <DialogDescription className="text-gray-400">This can&apos;t be undone.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                    <p className="font-medium text-white">{event.title}</p>
                    {needsName ? (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200">
                            Also permanently deletes its <b>{event.registrations} registrations</b>{event.attended ? <>, <b>{event.attended} attendance records</b></> : null}, feedback, certificates and the XP students earned from it.
                        </div>
                    ) : <p className="text-gray-400">It has no registrations.</p>}
                    <p className="text-xs text-gray-500">To just hide it, edit the event and set its status to Draft instead.</p>
                    {needsName && (
                        <label className="block space-y-1.5">
                            <span className="text-xs text-gray-400">Type the event name to confirm</span>
                            <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={event.title} autoFocus
                                className="h-10 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 text-sm text-white placeholder:text-gray-700 focus:border-rose-500/50 focus:outline-none" />
                        </label>
                    )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" disabled={pending} onClick={onClose} className={buttonCls.secondary}>Cancel</button>
                    <button type="button" disabled={!ok || pending} onClick={confirm} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-40">
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete event
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
