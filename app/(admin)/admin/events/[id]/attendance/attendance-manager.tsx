'use client'

import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, ClipboardList, FileUp, Loader2, Search, UserCheck, UserX } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { markAttendanceBulk, type AttendanceRoster, type RosterEntry } from "@/lib/actions/attendance"

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

type Match = { toMark: RosterEntry[]; already: RosterEntry[]; pending: RosterEntry[]; notRegistered: string[] }

/** Finds registered students in a pasted/uploaded attendance list by email or system ID. */
function matchAttendance(text: string, roster: RosterEntry[], dayKey: string): Match {
    const byEmail = new Map(roster.filter(r => r.email).map(r => [r.email!.toLowerCase(), r]))
    const bySystemId = new Map(roster.filter(r => r.systemId).map(r => [r.systemId!.toLowerCase(), r]))
    const found = new Map<string, RosterEntry>()
    const notRegistered = new Set<string>()

    for (const raw of text.match(EMAIL) ?? []) {
        const email = raw.toLowerCase()
        const entry = byEmail.get(email)
        if (entry) found.set(entry.registrationId, entry)
        else notRegistered.add(email)
    }
    for (const token of text.split(/[^A-Za-z0-9]+/)) {
        const entry = token.length >= 5 ? bySystemId.get(token.toLowerCase()) : undefined
        if (entry) found.set(entry.registrationId, entry)
    }

    const list = Array.from(found.values())
    return {
        toMark: list.filter(r => !r.paymentPending && !r.checkedInDays.includes(dayKey)),
        already: list.filter(r => !r.paymentPending && r.checkedInDays.includes(dayKey)),
        pending: list.filter(r => r.paymentPending),
        notRegistered: Array.from(notRegistered),
    }
}

export function AttendanceManager({ data }: { data: AttendanceRoster }) {
    const router = useRouter()
    const { event, days, roster } = data
    const [dayKey, setDayKey] = useState(days[0]?.key ?? "")
    const [tab, setTab] = useState<"upload" | "pick">("upload")
    const [text, setText] = useState("")
    const [match, setMatch] = useState<Match | null>(null)
    const [picked, setPicked] = useState<Set<string>>(new Set())
    const [query, setQuery] = useState("")
    const [confirm, setConfirm] = useState<RosterEntry[] | null>(null)
    const [saving, startSaving] = useTransition()
    const fileRef = useRef<HTMLInputElement>(null)

    const dayLabel = days.find(d => d.key === dayKey)?.label ?? dayKey
    const checkedInToday = roster.filter(r => r.checkedInDays.includes(dayKey)).length
    const attendedAny = roster.filter(r => r.attended || r.checkedInDays.length > 0).length

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase()
        return roster.filter(r => !q || [r.name, r.email, r.systemId].some(v => v?.toLowerCase().includes(q)))
    }, [roster, query])

    const onFile = async (file: File | undefined) => {
        if (!file) return
        if (file.size > 5 * 1024 * 1024) return toast.error("File is too big (max 5 MB)")
        const content = await file.text()
        setText(content)
        setMatch(matchAttendance(content, roster, dayKey))
    }

    const run = (entries: RosterEntry[]) => {
        startSaving(async () => {
            try {
                const res = await markAttendanceBulk(event.id, entries.map(e => e.registrationId), dayKey)
                const parts = [`${res.marked} marked`]
                if (res.alreadyDone) parts.push(`${res.alreadyDone} were already marked`)
                if (res.failed.length) parts.push(`${res.failed.length} failed`)
                ;(res.failed.length ? toast.warning : toast.success)(`${dayLabel}: ${parts.join(", ")}`)
                if (res.failed.length) console.warn("Attendance failures:", res.failed)
                setConfirm(null)
                setMatch(null)
                setText("")
                setPicked(new Set())
                router.refresh()
            } catch (e: any) {
                toast.error(e?.message || "Could not mark attendance")
            }
        })
    }

    const toggle = (id: string) => setPicked(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                        <UserCheck className="w-8 h-8 text-emerald-400" /> Bulk Attendance
                    </h1>
                    <p className="text-gray-400 mt-1">{event.title}</p>
                </div>
                {days.length > 1 && (
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                        Day
                        <select
                            value={dayKey}
                            onChange={e => { setDayKey(e.target.value); setMatch(text ? matchAttendance(text, roster, e.target.value) : null) }}
                            className="h-10 rounded-lg bg-zinc-950 border border-white/10 text-white px-3"
                        >
                            {days.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                        </select>
                    </label>
                )}
            </div>

            <div className="grid grid-cols-3 gap-3">
                {[
                    ["Registered", roster.length],
                    [days.length > 1 ? `Checked in, ${dayLabel}` : "Checked in", checkedInToday],
                    ["Attended (any day)", attendedAny],
                ].map(([label, value]) => (
                    <div key={label as string} className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                        <div className="text-2xl font-bold text-white">{value}</div>
                        <div className="text-xs sm:text-sm text-gray-500">{label}</div>
                    </div>
                ))}
            </div>

            <div className="flex gap-2 border-b border-white/10">
                {([["upload", "Upload Meet / Zoom list", FileUp], ["pick", "Pick from registrations", ClipboardList]] as const).map(([value, label, Icon]) => (
                    <button
                        key={value}
                        onClick={() => setTab(value)}
                        className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px transition-colors ${tab === value ? "border-emerald-400 text-white" : "border-transparent text-gray-400 hover:text-white"}`}
                    >
                        <Icon className="w-4 h-4" /> {label}
                    </button>
                ))}
            </div>

            {tab === "upload" ? (
                <div className="space-y-4">
                    <p className="text-sm text-gray-400">
                        Upload the attendance CSV from Google Meet or Zoom, or paste any list. Students are matched by <b className="text-gray-200">email</b> or <b className="text-gray-200">system ID</b>; names alone aren&apos;t used, to avoid marking the wrong person.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
                        <button onClick={() => fileRef.current?.click()} className="h-10 px-4 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm inline-flex items-center gap-2 hover:bg-zinc-800">
                            <FileUp className="w-4 h-4" /> Choose file
                        </button>
                    </div>
                    <textarea
                        value={text}
                        onChange={e => { setText(e.target.value); setMatch(null) }}
                        rows={6}
                        placeholder={"…or paste here, e.g.\n2023012345@ug.sharda.ac.in\n2023067890"}
                        className="w-full rounded-xl bg-zinc-950 border border-white/10 text-white text-sm p-3 font-mono placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
                    />
                    <button
                        onClick={() => setMatch(matchAttendance(text, roster, dayKey))}
                        disabled={!text.trim()}
                        className="h-10 px-5 rounded-lg bg-white text-black text-sm font-semibold disabled:opacity-40"
                    >
                        Match students
                    </button>

                    {match && (
                        <div className="space-y-4 p-4 rounded-xl bg-white/[0.02] border border-white/10">
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                                <span className="text-emerald-400">{match.toMark.length} to mark</span>
                                <span className="text-gray-400">{match.already.length} already marked for this day</span>
                                {match.pending.length > 0 && <span className="text-amber-400">{match.pending.length} payment pending (skipped)</span>}
                                <span className="text-gray-500">{match.notRegistered.length} emails not registered</span>
                            </div>
                            {match.toMark.length > 0 && (
                                <div className="max-h-64 overflow-y-auto rounded-lg border border-white/5 divide-y divide-white/5">
                                    {match.toMark.map(r => (
                                        <div key={r.registrationId} className="px-3 py-2 text-sm flex justify-between gap-3">
                                            <span className="text-white truncate">{r.name || "Unnamed"}</span>
                                            <span className="text-gray-500 truncate">{r.email}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {match.notRegistered.length > 0 && (
                                <details className="text-sm text-gray-500">
                                    <summary className="cursor-pointer">Show emails that aren&apos;t registered for this event</summary>
                                    <p className="mt-2 font-mono text-xs break-all">{match.notRegistered.join(", ")}</p>
                                </details>
                            )}
                            <button
                                onClick={() => setConfirm(match.toMark)}
                                disabled={match.toMark.length === 0}
                                className="h-10 px-5 rounded-lg bg-emerald-500 text-black text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-2"
                            >
                                <CheckCircle2 className="w-4 h-4" /> Mark {match.toMark.length} as attended
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search name, email or system ID"
                                className="w-full h-10 pl-9 pr-3 rounded-lg bg-zinc-950 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
                            />
                        </div>
                        <button
                            onClick={() => setConfirm(roster.filter(r => picked.has(r.registrationId)))}
                            disabled={picked.size === 0}
                            className="h-10 px-5 rounded-lg bg-emerald-500 text-black text-sm font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-2"
                        >
                            <CheckCircle2 className="w-4 h-4" /> Mark {picked.size} as attended
                        </button>
                    </div>
                    <div className="rounded-xl border border-white/10 divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
                        {visible.map(r => {
                            const done = r.checkedInDays.includes(dayKey)
                            const disabled = done || r.paymentPending
                            return (
                                <label key={r.registrationId} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${disabled ? "opacity-60" : "cursor-pointer hover:bg-white/[0.02]"}`}>
                                    <input
                                        type="checkbox"
                                        disabled={disabled}
                                        checked={done || picked.has(r.registrationId)}
                                        onChange={() => toggle(r.registrationId)}
                                        className="w-4 h-4 accent-emerald-500"
                                    />
                                    <span className="flex-1 min-w-0">
                                        <span className="text-white block truncate">{r.name || "Unnamed"}</span>
                                        <span className="text-gray-500 block truncate">{r.email}{r.systemId ? ` · ${r.systemId}` : ""}</span>
                                    </span>
                                    {done && <span className="text-xs text-emerald-400 shrink-0">Checked in</span>}
                                    {r.paymentPending && <span className="text-xs text-amber-400 shrink-0 inline-flex items-center gap-1"><UserX className="w-3 h-3" /> Unpaid</span>}
                                </label>
                            )
                        })}
                        {visible.length === 0 && <p className="p-4 text-sm text-gray-500">No one matches.</p>}
                    </div>
                </div>
            )}

            <Dialog open={!!confirm} onOpenChange={open => { if (!open && !saving) setConfirm(null) }}>
                <DialogContent className="bg-zinc-950 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Mark {confirm?.length ?? 0} students as attended?</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            For <b className="text-white">{dayLabel}</b>. Each student gets the same check-in and XP as a QR scan. Anyone already checked in for this day is left as is.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <button onClick={() => setConfirm(null)} disabled={saving} className="h-10 px-4 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5">Cancel</button>
                        <button onClick={() => confirm && run(confirm)} disabled={saving} className="h-10 px-4 rounded-lg bg-emerald-500 text-black font-semibold disabled:opacity-60 inline-flex items-center gap-2">
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Mark attended
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
