'use client'

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { BarChart3, CheckCircle2, CircleAlert, FileDown, FileText, Image as ImageIcon, Loader2, Plus, RotateCcw, Trash2, Users } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { EcrConvener, EcrCustomSection, EcrFields, EcrMeta, EcrSectionPosition, EcrSpeaker } from "@/lib/reports/ecr-data"

/**
 * Opens before an ECR download: every field of the Sharda format, prefilled from
 * the website, with empty ones flagged. Edits stay in this browser (per event;
 * conveners and department for all events) and go into the Word / PDF file.
 */

type Format = "docx" | "pdf" | "full"
// v3: only the fields you changed are saved, so auto-filled ones stay up to date
const eventKey = (id: string) => `ecr-edits-v3:${id}`
const SHARED_KEY = "ecr-shared-v2"
type Shared = Pick<EcrFields, "department" | "school" | "conveners">

function readStore<T>(key: string): T | null {
    try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null } catch { return null }
}
function writeStore(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode: edits just aren't remembered */ }
}
function removeStore(key: string) {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
}

const inputCls = (empty: boolean) =>
    `w-full rounded-lg bg-zinc-900 border px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${empty ? "border-amber-500/60" : "border-white/10"}`

function Field({ label, empty, hint, children }: { label: string; empty: boolean; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block space-y-1.5">
            <span className="flex items-center gap-2 text-xs font-medium text-gray-300">
                {label}
                {empty
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400"><CircleAlert className="w-3 h-3" /> Empty</span>
                    : <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 className="w-3 h-3" /> Filled</span>}
            </span>
            {children}
            {hint && <span className="block text-[11px] text-gray-500">{hint}</span>}
        </label>
    )
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
    return (
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
            <div>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                {note && <p className="text-[11px] text-gray-500 mt-0.5">{note}</p>}
            </div>
            {children}
        </section>
    )
}

export function EcrDialog({ eventId, open, onOpenChange }: { eventId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
    const [website, setWebsite] = useState<EcrFields | null>(null)
    const [fields, setFields] = useState<EcrFields | null>(null)
    const [meta, setMeta] = useState<EcrMeta | null>(null)
    const [eventTypes, setEventTypes] = useState<string[]>([])
    const [positions, setPositions] = useState<{ id: EcrSectionPosition; label: string }[]>([])
    const [loadError, setLoadError] = useState<string | null>(null)
    const [onlyEmpty, setOnlyEmpty] = useState(false)
    const [busy, setBusy] = useState<Format | null>(null)
    const [useAi, setUseAi] = useState(true)
    const [edited, setEdited] = useState(false)

    useEffect(() => {
        if (!open || website) return
        let cancelled = false
        fetch(`/api/admin/events/${eventId}/ecr?format=json`, { cache: "no-store" })
            .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't load the event"); return r.json() })
            .then((res: { fields: EcrFields; meta: EcrMeta; eventTypes: string[]; sectionPositions: { id: EcrSectionPosition; label: string }[] }) => {
                if (cancelled) return
                const saved = readStore<Partial<EcrFields>>(eventKey(eventId))
                const shared = readStore<Shared>(SHARED_KEY)
                setWebsite(res.fields)
                setFields({ ...res.fields, ...(shared ?? {}), ...(saved ?? {}), customSections: saved?.customSections ?? [] })
                setEdited(!!saved)
                setMeta(res.meta)
                setEventTypes(res.eventTypes)
                setPositions(res.sectionPositions)
            })
            .catch(e => !cancelled && setLoadError(e.message))
        return () => { cancelled = true }
    }, [open, website, eventId])

    const update = (patch: Partial<EcrFields>) => {
        setFields(f => {
            if (!f) return f
            const next = { ...f, ...patch }
            const shared = "department" in patch || "school" in patch || "conveners" in patch
            const own = Object.fromEntries(Object.entries(patch).filter(([k]) => !["department", "school", "conveners"].includes(k)))
            if (Object.keys(own).length) writeStore(eventKey(eventId), { ...(readStore<Partial<EcrFields>>(eventKey(eventId)) ?? {}), ...own })
            if (shared) writeStore(SHARED_KEY, { department: next.department, school: next.school, conveners: next.conveners })
            return next
        })
        setEdited(true)
    }
    const reset = () => {
        if (!website) return
        removeStore(eventKey(eventId))
        removeStore(SHARED_KEY)
        setFields(website)
        setEdited(false)
        toast.success("Back to the website's data")
    }

    const empty = useMemo(() => {
        if (!fields) return {} as Record<string, boolean>
        const blank = (v: string) => !v.trim()
        return {
            eventName: blank(fields.eventName), dateText: blank(fields.dateText), location: blank(fields.location), sponsor: blank(fields.sponsor),
            summary: blank(fields.summary), highlights: fields.highlights.length === 0, videoText: blank(fields.videoText),
            speakers: !fields.speakers.some(s => s.name.trim()), department: blank(fields.department), school: blank(fields.school),
            conveners: !fields.conveners.some(c => c.name.trim()), feedback: fields.feedback.length === 0, certificateText: blank(fields.certificateText),
        }
    }, [fields])
    const emptyCount = Object.values(empty).filter(Boolean).length
    const show = (key: string) => !onlyEmpty || empty[key]

    const download = async (format: Format) => {
        if (!fields) return
        setBusy(format)
        try {
            const res = await fetch(`/api/admin/events/${eventId}/ecr`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ format, fields, ai: useAi }),
            })
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Download failed (${res.status})`)
            const blob = await res.blob()
            const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `ECR.${format === "docx" ? "docx" : "pdf"}`
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url; a.download = name
            document.body.appendChild(a); a.click(); a.remove()
            setTimeout(() => URL.revokeObjectURL(url), 10_000)
            toast.success(`${name} downloaded`)
        } catch (e: any) {
            toast.error(e.message || "Download failed")
        } finally {
            setBusy(null)
        }
    }

    const lines = (v: string) => v.split("\n").map(s => s.trim()).filter(Boolean)
    const setSection = (i: number, patch: Partial<EcrCustomSection>) => fields && update({ customSections: fields.customSections.map((c, k) => (k === i ? { ...c, ...patch } : c)) })
    const setRow = <T extends EcrSpeaker | EcrConvener>(list: T[], i: number, patch: Partial<T>) => list.map((r, k) => (k === i ? { ...r, ...patch } : r))

    return (
        <Dialog open={open} onOpenChange={o => { if (!busy) onOpenChange(o) }}>
            <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-3xl w-[calc(100vw-1.5rem)] p-0 gap-0 max-h-[92dvh] flex flex-col overflow-hidden">
                <DialogHeader className="p-4 sm:p-5 border-b border-white/10 text-left">
                    <DialogTitle className="flex items-center gap-2 text-base sm:text-lg"><FileText className="w-5 h-5 text-amber-400" /> Event Completion Report</DialogTitle>
                    <DialogDescription className="text-gray-400 text-xs sm:text-sm">
                        Check what&apos;s filled from the website and fill in what&apos;s empty. Edits are saved in this browser.
                    </DialogDescription>
                    {fields && (
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                            {emptyCount
                                ? <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400"><CircleAlert className="w-3.5 h-3.5" /> {emptyCount} empty field{emptyCount > 1 ? "s" : ""}</span>
                                : <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Everything is filled</span>}
                            {emptyCount > 0 && (
                                <button type="button" onClick={() => setOnlyEmpty(v => !v)} className={`rounded-full px-3 py-1 text-xs border transition-colors ${onlyEmpty ? "bg-amber-500 text-black border-amber-500" : "border-white/15 text-gray-300 hover:bg-white/5"}`}>
                                    {onlyEmpty ? "Showing empty only" : "Show only empty"}
                                </button>
                            )}
                            {edited && (
                                <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs border border-white/15 text-gray-400 hover:bg-white/5">
                                    <RotateCcw className="w-3 h-3" /> Reset to website data
                                </button>
                            )}
                        </div>
                    )}
                </DialogHeader>

                <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
                    {loadError && <p className="text-sm text-red-400">{loadError}</p>}
                    {!fields && !loadError && <div className="flex items-center gap-2 text-sm text-gray-400 py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading event details…</div>}
                    {fields && (
                        <>
                            {(show("eventName") || show("dateText") || show("location") || show("sponsor") || !onlyEmpty) && (
                                <Section title="Event">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {show("eventName") && <div className="sm:col-span-2"><Field label="Name of the Event" empty={empty.eventName}><input className={inputCls(empty.eventName)} value={fields.eventName} onChange={e => update({ eventName: e.target.value })} /></Field></div>}
                                        {show("dateText") && <Field label="Date of the Event" empty={empty.dateText}><input className={inputCls(empty.dateText)} value={fields.dateText} onChange={e => update({ dateText: e.target.value })} /></Field>}
                                        {show("location") && <Field label="Location" empty={empty.location}><input className={inputCls(empty.location)} value={fields.location} onChange={e => update({ location: e.target.value })} /></Field>}
                                        {show("sponsor") && <Field label="Sponsoring Organization" empty={empty.sponsor} hint="Write NA if there was no sponsor"><input className={inputCls(empty.sponsor)} value={fields.sponsor} onChange={e => update({ sponsor: e.target.value })} /></Field>}
                                        {!onlyEmpty && (
                                            <Field label="Type of the Event" empty={false}>
                                                <div className="flex gap-2">
                                                    <select className={inputCls(false)} value={fields.eventTypeColumn} onChange={e => update({ eventTypeColumn: e.target.value as EcrFields["eventTypeColumn"] })}>
                                                        {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                    <select className={`${inputCls(false)} w-36`} value={fields.eventScope} onChange={e => update({ eventScope: e.target.value as EcrFields["eventScope"] })}>
                                                        <option>National</option><option>International</option>
                                                    </select>
                                                </div>
                                            </Field>
                                        )}
                                    </div>
                                </Section>
                            )}

                            {(show("summary") || show("highlights") || show("videoText")) && (
                                <Section title="Summary and highlights">
                                    {show("summary") && <Field label="Event Caption / Summary" empty={empty.summary}><textarea rows={5} className={inputCls(empty.summary)} value={fields.summary} onChange={e => update({ summary: e.target.value })} /></Field>}
                                    {show("highlights") && <Field label="Notes and Highlights" empty={empty.highlights} hint="One point per line. Add sessions, speakers and activities day by day."><textarea rows={5} className={inputCls(empty.highlights)} value={fields.highlights.join("\n")} onChange={e => update({ highlights: lines(e.target.value) })} /></Field>}
                                    {show("videoText") && <Field label="Video / recording link" empty={empty.videoText}><input className={inputCls(empty.videoText)} placeholder="https://youtube.com/…" value={fields.videoText} onChange={e => update({ videoText: e.target.value })} /></Field>}
                                </Section>
                            )}

                            {show("speakers") && (
                                <Section title="Speakers" note="Name, affiliation and area (Academics / Industry / Research Organization / Others).">
                                    <Field label="Speaker details" empty={empty.speakers}>
                                        <div className="space-y-2">
                                            {fields.speakers.map((sp, i) => (
                                                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] rounded-lg border border-white/5 p-2 sm:p-0 sm:border-0">
                                                    <input className={inputCls(false)} placeholder="Name of the speaker" value={sp.name} onChange={e => update({ speakers: setRow(fields.speakers, i, { name: e.target.value }) })} />
                                                    <input className={inputCls(false)} placeholder="Affiliation (company / university)" value={sp.affiliation} onChange={e => update({ speakers: setRow(fields.speakers, i, { affiliation: e.target.value }) })} />
                                                    <input className={inputCls(false)} placeholder="Area, e.g. Industry" list="ecr-areas" value={sp.area} onChange={e => update({ speakers: setRow(fields.speakers, i, { area: e.target.value }) })} />
                                                    <button type="button" aria-label="Remove speaker" onClick={() => update({ speakers: fields.speakers.filter((_, k) => k !== i) })} className="justify-self-end p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                            <datalist id="ecr-areas"><option value="Academics" /><option value="Industry" /><option value="Research Organization" /><option value="Others" /></datalist>
                                            {fields.speakers.length < 10 && (
                                                <button type="button" onClick={() => update({ speakers: [...fields.speakers, { name: "", affiliation: "", area: "" }] })} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 py-2 text-xs text-gray-300 hover:bg-white/5">
                                                    <Plus className="w-3.5 h-3.5" /> Add speaker
                                                </button>
                                            )}
                                        </div>
                                    </Field>
                                </Section>
                            )}

                            {(show("department") || show("school") || show("conveners")) && (
                                <Section title="Organizing department and conveners" note="Prefilled with the current conveners. Changes here are remembered for every event in this browser.">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {show("department") && <Field label="Department" empty={empty.department}><input className={inputCls(empty.department)} value={fields.department} onChange={e => update({ department: e.target.value })} /></Field>}
                                        {show("school") && <Field label="School" empty={empty.school}><input className={inputCls(empty.school)} value={fields.school} onChange={e => update({ school: e.target.value })} /></Field>}
                                    </div>
                                    {show("conveners") && (
                                        <Field label="Conveners" empty={empty.conveners}>
                                            <div className="space-y-2">
                                                {fields.conveners.map((c, i) => (
                                                    <div key={i} className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1.3fr_auto] rounded-lg border border-white/5 p-2 sm:p-0 sm:border-0">
                                                        <input className={inputCls(false)} placeholder="Name" value={c.name} onChange={e => update({ conveners: setRow(fields.conveners, i, { name: e.target.value }) })} />
                                                        <input className={inputCls(false)} placeholder="Contact number" inputMode="tel" value={c.phone} onChange={e => update({ conveners: setRow(fields.conveners, i, { phone: e.target.value }) })} />
                                                        <input className={inputCls(false)} placeholder="Email" inputMode="email" value={c.email} onChange={e => update({ conveners: setRow(fields.conveners, i, { email: e.target.value }) })} />
                                                        <button type="button" aria-label="Remove convener" onClick={() => update({ conveners: fields.conveners.filter((_, k) => k !== i) })} className="justify-self-end p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                ))}
                                                {fields.conveners.length < 8 && (
                                                    <button type="button" onClick={() => update({ conveners: [...fields.conveners, { name: "", phone: "", email: "" }] })} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 py-2 text-xs text-gray-300 hover:bg-white/5">
                                                        <Plus className="w-3.5 h-3.5" /> Add convener
                                                    </button>
                                                )}
                                            </div>
                                        </Field>
                                    )}
                                </Section>
                            )}

                            {(show("feedback") || show("certificateText")) && (
                                <Section title="Feedback and certificate">
                                    {show("feedback") && <Field label="Event Feedback" empty={empty.feedback} hint="One comment per line. Prefilled with the longest written comments from the feedback form."><textarea rows={5} className={inputCls(empty.feedback)} value={fields.feedback.join("\n")} onChange={e => update({ feedback: lines(e.target.value) })} /></Field>}
                                    {show("certificateText") && <Field label="Certificate" empty={empty.certificateText}><input className={inputCls(empty.certificateText)} value={fields.certificateText} onChange={e => update({ certificateText: e.target.value })} /></Field>}
                                </Section>
                            )}

                            {!onlyEmpty && (
                                <Section title="Extra sections" note="Add anything the format doesn't have (Agenda, Outcomes, Winners, Vote of thanks…) and choose where it goes. It prints as a row like the rest of the ECR.">
                                    <div className="space-y-3">
                                        {fields.customSections.map((c, i) => (
                                            <div key={i} className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
                                                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                                    <input className={inputCls(!c.title.trim())} placeholder="Section title, e.g. Outcomes" value={c.title} onChange={e => setSection(i, { title: e.target.value })} />
                                                    <select className={inputCls(false)} value={c.after} onChange={e => setSection(i, { after: e.target.value as EcrSectionPosition })} aria-label="Position">
                                                        {positions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                                    </select>
                                                    <button type="button" aria-label="Remove section" onClick={() => update({ customSections: fields.customSections.filter((_, k) => k !== i) })} className="justify-self-end p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                                <textarea rows={4} className={inputCls(!c.body.trim())} placeholder={"Write the content. Start a line with - for a bullet point."} value={c.body} onChange={e => setSection(i, { body: e.target.value })} />
                                            </div>
                                        ))}
                                        {fields.customSections.length < 12 && (
                                            <button type="button" onClick={() => update({ customSections: [...fields.customSections, { title: "", body: "", after: "highlights" }] })} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-amber-500/40 px-3 py-2 text-xs text-amber-300 hover:bg-amber-500/10">
                                                <Plus className="w-3.5 h-3.5" /> Add section
                                            </button>
                                        )}
                                    </div>
                                </Section>
                            )}

                            {meta && !onlyEmpty && (
                                <Section title="Added automatically from the website">
                                    <ul className="grid gap-2 sm:grid-cols-3 text-xs">
                                        <li className={`flex items-start gap-2 rounded-lg p-3 ${meta.photoCount ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
                                            <ImageIcon className="w-4 h-4 shrink-0" />
                                            {meta.photoCount ? `${meta.photoCount} photo${meta.photoCount > 1 ? "s" : ""} from the event gallery` : "No photos in the gallery. Add them in Edit Event, or paste them into the Word file."}
                                        </li>
                                        <li className={`flex items-start gap-2 rounded-lg p-3 ${meta.hasPamphlet ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
                                            <ImageIcon className="w-4 h-4 shrink-0" />
                                            {meta.hasPamphlet ? "Event banner used as the pamphlet" : "No banner, so the pamphlet section will be empty"}
                                        </li>
                                        <li className={`flex items-start gap-2 rounded-lg p-3 ${meta.participantCount ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
                                            <Users className="w-4 h-4 shrink-0" />
                                            {meta.participantCount ? `${meta.participantCount} participants listed${meta.participantsNote ? " (registered, no attendance recorded)" : " (attended)"}` : "No participants yet"}
                                        </li>
                                    </ul>
                                </Section>
                            )}
                        </>
                    )}
                </div>

                <div className="border-t border-white/10 p-3 sm:p-4 bg-zinc-950 space-y-3">
                    <label className="flex items-center gap-2 text-xs text-gray-400">
                        <input type="checkbox" checked={useAi} onChange={e => setUseAi(e.target.checked)} className="accent-amber-500" />
                        Add an AI summary and recommendations to the analytics PDF (adds a few seconds)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button type="button" disabled={!fields || !!busy} onClick={() => download("docx")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm font-medium hover:bg-blue-600/20 disabled:opacity-50">
                            {busy === "docx" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 text-blue-400" />} ECR Word
                        </button>
                        <button type="button" disabled={!fields || !!busy} onClick={() => download("pdf")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm font-medium hover:bg-red-600/20 disabled:opacity-50">
                            {busy === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 text-red-400" />} ECR PDF
                        </button>
                        <button type="button" disabled={!fields || !!busy} onClick={() => download("full")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50">
                            {busy === "full" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />} ECR + Analytics PDF
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
