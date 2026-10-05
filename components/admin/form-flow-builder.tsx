"use client"

/**
 * Form builder as a left-to-right flow.
 *
 *   [Start] → [Section 1] → [Section 2] → … → [Submit]
 *
 * - Drag question types (or "Section") from the bar on top onto the canvas.
 * - Drag questions inside a section or into another one; drag sections by their grip.
 * - Each section has an exit knob on its right edge: drag it onto the section it
 *   should continue to (or Submit). The arrow arcs above the boxes.
 * - Every dropdown lists its options with a knob each: drag a knob onto a section
 *   to send people who pick that answer there. Those arrows arc below the boxes,
 *   one colour per dropdown, labelled with the answer.
 * - Click a question or section to edit it in the side panel.
 *
 * Stored in the same flat format as before (lib/forms/sections.ts), so the public
 * form and existing responses are unaffected.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
    type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core"
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
    CheckCircle2, ChevronDown, CircleAlert, ExternalLink, Flag, GitBranch, GripVertical, Layers, ListTree, Loader2, Play, Save, Trash2, TriangleAlert, X,
} from "lucide-react"
import { saveFormFields } from "@/lib/actions/forms"
import { FIELD_TYPES, FieldCard, getFieldMeta, type QuestionType, type RegistrationField } from "@/components/admin/form-builder"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NEXT, START, SUBMIT, analyzeFlow, normalize, optionRoutes, resolveTarget, toFields, toSections, type FlowSection } from "@/lib/forms/sections"

const SUBMIT_NODE = "__submit__"
const START_NODE = "__start_node__"
const BRANCH_COLORS = ["#a78bfa", "#22d3ee", "#f472b6", "#34d399", "#fb923c", "#60a5fa"]
const sectionName = (s: FlowSection | undefined, i: number) => (s?.header?.label?.trim() || (s?.key === START ? "Start questions" : `Section ${i + 1}`))

function ensureHeaders(list: FlowSection[]): FlowSection[] {
    return normalize(list.map((s, i) => {
        if (i === 0 || s.header) return s
        const id = crypto.randomUUID()
        return { ...s, key: id, header: { id, type: "section", label: "Untitled section", description: "", required: false } }
    }))
}
const newSection = (questions: RegistrationField[] = []): FlowSection => {
    const id = crypto.randomUUID()
    return { key: id, header: { id, type: "section", label: "New section", description: "", required: false }, questions, next: NEXT }
}
const newQuestion = (type: QuestionType): RegistrationField => ({
    id: crypto.randomUUID(), type, required: true,
    label: `New ${getFieldMeta(type).label.toLowerCase()} question`,
    options: type === "select" || type === "checkbox" ? ["Option 1", "Option 2"] : undefined,
})

type Selection = { kind: "question"; id: string } | { kind: "section"; key: string } | null
type Pending = { kind: "question"; id: string; label: string; answers: number } | { kind: "section"; index: number }
type Active = { kind: "palette"; qtype: QuestionType | "section" } | { kind: "question"; id: string } | { kind: "section"; key: string } | null
type WireFrom = { kind: "exit"; key: string } | { kind: "option"; qid: string; option: string }

export function FormFlowBuilder({ initialFields, formId, answerCounts }: { initialFields: RegistrationField[]; formId: string; answerCounts: Record<string, number> }) {
    const router = useRouter()
    const [sections, setSectionsRaw] = useState<FlowSection[]>(() => ensureHeaders(toSections(initialFields)))
    const [selection, setSelection] = useState<Selection>(null)
    const [active, setActive] = useState<Active>(null)
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
    const [exiting, setExiting] = useState(false)
    const [pending, setPending] = useState<Pending | null>(null)
    const [hover, setHover] = useState<string | null>(null)
    const [showLogic, setShowLogic] = useState(true)
    const firstRender = useRef(true)
    const panel = usePanelSize()

    const setSections = useCallback((fn: (prev: FlowSection[]) => FlowSection[]) => setSectionsRaw(prev => ensureHeaders(fn(prev))), [])
    const fields = useMemo(() => toFields(sections), [sections])
    const emptyTitles = fields.filter(f => f.type !== "section" && !f.label.trim()).length
    const flow = useMemo(() => analyzeFlow(sections), [sections])
    const sectionOf = (qid: string) => sections.find(s => s.questions.some(q => q.id === qid))
    const findQ = (qid: string) => sections.flatMap(s => s.questions).find(q => q.id === qid)
    const nameOfKey = (key: string) => key === SUBMIT_NODE ? "Submit" : sectionName(sections.find(s => s.key === key), sections.findIndex(s => s.key === key))

    // Auto-save 1.5s after the last change (not mid-drag)
    useEffect(() => {
        if (firstRender.current) { firstRender.current = false; return }
        if (emptyTitles || active) return
        const t = setTimeout(async () => {
            setStatus("saving")
            try { await saveFormFields(formId, fields); setStatus("saved") } catch { setStatus("error") }
        }, 1500)
        return () => clearTimeout(t)
    }, [fields, emptyTitles, formId, active])

    const saveAndExit = async () => {
        if (emptyTitles) return void toast.error(`${emptyTitles} question${emptyTitles > 1 ? "s have" : " has"} no title yet`)
        setExiting(true)
        try { await saveFormFields(formId, fields); toast.success("Form saved"); router.push("/admin/forms"); router.refresh() }
        catch { toast.error("Couldn't save the form"); setExiting(false) }
    }

    // ── edits ──
    const patchSection = (key: string, patch: Partial<FlowSection>) => setSections(prev => prev.map(s => (s.key === key ? { ...s, ...patch } : s)))
    const setNext = (key: string, target: string) => setSections(prev => prev.map((s, i) => s.key !== key ? s : { ...s, next: target === prev[i + 1]?.key ? NEXT : target }))
    const mapQuestion = (id: string, fn: (q: RegistrationField) => RegistrationField) =>
        setSections(prev => prev.map(s => (s.questions.some(q => q.id === id) ? { ...s, questions: s.questions.map(q => (q.id === id ? fn(q) : q)) } : s)))
    const updateField = (id: string, u: Partial<RegistrationField>) => mapQuestion(id, q => ({ ...q, ...u }))
    const setRoute = (qid: string, option: string, target: string | null) => mapQuestion(qid, q => {
        const r = { ...(q.optionRouting ?? {}) }
        if (!target || target === "__none__") delete r[option]; else r[option] = target
        return { ...q, optionRouting: r }
    })
    const setTitle = (s: FlowSection, label: string) => {
        if (s.header) return patchSection(s.key, { header: { ...s.header, label } })
        if (!label.trim()) return
        const id = crypto.randomUUID()
        setSections(prev => prev.map(x => (x.key === s.key ? { ...x, key: id, header: { id, type: "section", label, description: "", required: false } } : x)))
        setSelection({ kind: "section", key: id })
    }
    const removeQuestionNow = (id: string) => { setSections(prev => prev.map(s => ({ ...s, questions: s.questions.filter(q => q.id !== id) }))); setSelection(null) }
    const removeQuestion = (id: string) => {
        const answers = answerCounts[id] ?? 0
        if (answers > 0) return setPending({ kind: "question", id, label: findQ(id)?.label || "this question", answers })
        removeQuestionNow(id)
    }
    const removeSection = (index: number) => {
        setSections(prev => {
            if (prev.length < 2) return prev
            const gone = prev[index], into = index === 0 ? 1 : index - 1
            return prev.map((s, i) => i === into ? { ...s, questions: index === 0 ? [...gone.questions, ...s.questions] : [...s.questions, ...gone.questions] } : s)
                .filter((_, i) => i !== index)
                .map(s => ({ ...s, next: s.next === gone.key ? NEXT : s.next, questions: s.questions.map(q => q.optionRouting ? { ...q, optionRouting: Object.fromEntries(Object.entries(q.optionRouting).filter(([, t]) => t !== gone.key)) } : q) }))
        })
        setSelection(null)
    }
    const addOption = (id: string) => mapQuestion(id, q => ({ ...q, options: [...(q.options ?? []), `Option ${(q.options?.length ?? 0) + 1}`] }))
    const updateOption = (id: string, i: number, v: string) => mapQuestion(id, q => {
        const options = [...(q.options ?? [])], old = options[i]
        options[i] = v
        const r = { ...(q.optionRouting ?? {}) }
        if (old in r && !(v in r)) { r[v] = r[old]; delete r[old] } // keep the branch when an answer is renamed
        return { ...q, options, optionRouting: r }
    })
    const handleOptionPaste = (id: string, i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
        const lines = e.clipboardData.getData("text").split(/\r?\n/).map(l => l.trim()).filter(Boolean)
        if (lines.length < 2) return
        e.preventDefault()
        mapQuestion(id, q => { const o = [...(q.options ?? [])]; o.splice(i, 1, ...lines); return { ...q, options: o } })
    }
    const removeOption = (id: string, i: number) => mapQuestion(id, q => {
        if ((q.options?.length ?? 0) <= 1) return q
        const r = { ...(q.optionRouting ?? {}) }
        delete r[q.options![i]]
        return { ...q, options: q.options!.filter((_, k) => k !== i), optionRouting: r }
    })
    const reorderOption = (id: string, i: number, dir: "up" | "down") => mapQuestion(id, q => {
        const o = [...(q.options ?? [])], j = dir === "up" ? i - 1 : i + 1
        if (j < 0 || j >= o.length) return q
        ;[o[i], o[j]] = [o[j], o[i]]
        return { ...q, options: o }
    })
    /** Tap on a palette item (no drag): add to the selected section, or the last one. */
    const quickAdd = (qtype: QuestionType | "section") => {
        if (qtype === "section") { const s = newSection(); setSections(prev => [...prev, s]); setSelection({ kind: "section", key: s.key }); return }
        const q = newQuestion(qtype)
        const key = selection?.kind === "section" ? selection.key : selection?.kind === "question" ? sectionOf(selection.id)?.key : undefined
        setSections(prev => prev.map(s => (s.key === (key ?? prev[prev.length - 1].key) ? { ...s, questions: [...s.questions, q] } : s)))
        setSelection({ kind: "question", id: q.id })
    }

    // ── drag and drop ──
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )
    const collide: CollisionDetection = args => {
        const type = args.active.data.current?.type as string
        const qtype = args.active.data.current?.qtype as string | undefined
        const of = (types: string[]) => args.droppableContainers.filter(c => types.includes(c.data.current?.type))
        if (type === "section") return closestCenter({ ...args, droppableContainers: of(["section"]) })
        if (qtype === "section") { const w = pointerWithin({ ...args, droppableContainers: of(["gap"]) }); return w.length ? w : closestCenter({ ...args, droppableContainers: of(["gap"]) }) }
        const rank: Record<string, number> = { question: 0, container: 1, gap: 2 }
        const typeOf = (id: string | number) => args.droppableContainers.find(c => c.id === id)?.data.current?.type as string
        return pointerWithin({ ...args, droppableContainers: of(["question", "container", "gap"]) }).sort((a, b) => rank[typeOf(a.id)] - rank[typeOf(b.id)])
    }
    const onDragStart = ({ active: a }: DragStartEvent) => {
        const d = a.data.current
        setActive(d?.type === "palette" ? { kind: "palette", qtype: d.qtype } : d?.type === "question" ? { kind: "question", id: d.id } : d?.type === "section" ? { kind: "section", key: d.key } : null)
    }
    // Moving a question into another section while dragging
    const onDragOver = ({ active: a, over }: DragOverEvent) => {
        if (!over || a.data.current?.type !== "question") return
        const qid = a.data.current.id as string
        const o = over.data.current
        const to = o?.type === "question" ? (o.section as string) : o?.type === "container" ? (o.key as string) : null
        const from = sectionOf(qid)?.key
        if (!to || !from || to === from) return
        setSections(prev => {
            const q = prev.find(s => s.key === from)?.questions.find(x => x.id === qid)
            if (!q) return prev
            return prev.map(s => {
                if (s.key === from) return { ...s, questions: s.questions.filter(x => x.id !== qid) }
                if (s.key !== to) return s
                const at = o?.type === "question" ? s.questions.findIndex(x => x.id === o.id) : s.questions.length
                const qs = [...s.questions]; qs.splice(at < 0 ? qs.length : at, 0, q)
                return { ...s, questions: qs }
            })
        })
    }
    const onDragEnd = ({ active: a, over }: DragEndEvent) => {
        setActive(null)
        const d = a.data.current, o = over?.data.current
        if (!d || !o) return
        if (d.type === "section" && o.type === "section" && d.key !== o.key) {
            setSections(prev => arrayMove(prev, prev.findIndex(s => s.key === d.key), prev.findIndex(s => s.key === o.key)))
            return
        }
        if (d.type === "question") {
            if (o.type === "gap") {
                const q = findQ(d.id)
                if (!q) return
                const s = newSection([q])
                setSections(prev => { const without = prev.map(x => ({ ...x, questions: x.questions.filter(y => y.id !== d.id) })); return [...without.slice(0, o.index), s, ...without.slice(o.index)] })
                return
            }
            if (o.type === "question" && o.id !== d.id) {
                setSections(prev => prev.map(s => {
                    const from = s.questions.findIndex(x => x.id === d.id), to = s.questions.findIndex(x => x.id === o.id)
                    return from >= 0 && to >= 0 ? { ...s, questions: arrayMove(s.questions, from, to) } : s
                }))
            }
            return
        }
        if (d.type === "palette") {
            if (d.qtype === "section") {
                if (o.type !== "gap") return
                const s = newSection()
                setSections(prev => [...prev.slice(0, o.index), s, ...prev.slice(o.index)])
                setSelection({ kind: "section", key: s.key })
                return
            }
            const q = newQuestion(d.qtype)
            if (o.type === "gap") {
                const s = newSection([q])
                setSections(prev => [...prev.slice(0, o.index), s, ...prev.slice(o.index)])
            } else {
                const key = o.type === "question" ? o.section : o.key
                setSections(prev => prev.map(s => {
                    if (s.key !== key) return s
                    const at = o.type === "question" ? s.questions.findIndex(x => x.id === o.id) + 1 : s.questions.length
                    const qs = [...s.questions]; qs.splice(at, 0, q)
                    return { ...s, questions: qs }
                }))
            }
            setSelection({ kind: "question", id: q.id })
        }
    }

    // ── connect by dragging a knob ──
    const canvas = useRef<HTMLDivElement>(null)
    const [wire, setWire] = useState<{ from: WireFrom; x1: number; y1: number; x2: number; y2: number } | null>(null)
    const [wireTarget, setWireTarget] = useState<string | null>(null)
    const wireFrom = useRef<WireFrom | null>(null)
    const startWire = (from: WireFrom, e: React.PointerEvent) => {
        e.preventDefault(); e.stopPropagation()
        const base = canvas.current!.getBoundingClientRect(), r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const x1 = r.left + r.width / 2 - base.left, y1 = r.top + r.height / 2 - base.top
        wireFrom.current = from
        setWire({ from, x1, y1, x2: x1, y2: y1 })
    }
    const wiring = !!wire
    const finishWire = useRef<(key: string | null) => void>(() => {})
    const onWireDrop = (key: string | null) => {
        const from = wireFrom.current
        wireFrom.current = null
        if (!from || !key || key === START_NODE) return
        if (key !== SUBMIT_NODE && !sections.find(s => s.key === key)?.header) return void toast.error("Start questions can't be jumped back to")
        const target = key === SUBMIT_NODE ? SUBMIT : key
        if (from.kind === "exit") {
            if (key === from.key) return
            setNext(from.key, target)
            toast.success(`${nameOfKey(from.key)} → ${nameOfKey(key)}`)
        } else {
            setRoute(from.qid, from.option, target)
            toast.success(`“${from.option}” → ${nameOfKey(key)}`)
        }
    }
    useLayoutEffect(() => { finishWire.current = onWireDrop })
    useEffect(() => {
        if (!wiring) return
        const nodeAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-node]")?.dataset.node ?? null
        const move = (e: PointerEvent) => {
            const base = canvas.current!.getBoundingClientRect()
            setWire(w => w && { ...w, x2: e.clientX - base.left, y2: e.clientY - base.top })
            setWireTarget(nodeAt(e.clientX, e.clientY))
        }
        const up = (e: PointerEvent) => {
            const key = nodeAt(e.clientX, e.clientY)
            setWire(null); setWireTarget(null)
            finishWire.current(key)
        }
        window.addEventListener("pointermove", move)
        window.addEventListener("pointerup", up, { once: true })
        return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up) }
    }, [wiring])

    const selQ = selection?.kind === "question" ? findQ(selection.id) : undefined
    const selSIndex = selection?.kind === "section" ? sections.findIndex(s => s.key === selection.key) : -1
    const headers = sections.filter(s => s.header).map(s => s.header!)
    const questionCount = sections.reduce((n, s) => n + s.questions.length, 0)
    const branchColor = useMemo(() => {
        const m = new Map<string, string>()
        sections.flatMap(s => s.questions).filter(q => q.type === "select").forEach((q, i) => m.set(q.id, BRANCH_COLORS[i % BRANCH_COLORS.length]))
        return m
    }, [sections])
    const lastNext = sections[sections.length - 1].next

    return (
        <div className="space-y-3">
            <DndContext sensors={sensors} collisionDetection={collide} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
                {/* Top: palette + status */}
                <div className="sticky top-14 z-30 -mx-1 space-y-2 rounded-2xl border border-white/10 bg-zinc-950/95 p-2 backdrop-blur md:top-2">
                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                        <span className="hidden shrink-0 px-1 text-[11px] font-medium text-gray-500 sm:block">Drag onto the flow →</span>
                        <PaletteItem qtype="section" label="Section" icon={Layers} color="#f59e0b" bg="rgba(245,158,11,0.12)" onTap={() => quickAdd("section")} />
                        {FIELD_TYPES.filter(t => t.type !== "section").map(t => <PaletteItem key={t.type} qtype={t.type} label={t.label} icon={t.icon} color={t.color} bg={t.bg} onTap={() => quickAdd(t.type)} />)}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                            <span><b className="text-white">{sections.length}</b> sections · <b className="text-white">{questionCount}</b> questions</span>
                            {emptyTitles > 0 ? <span className="inline-flex items-center gap-1 text-amber-400"><CircleAlert className="h-3.5 w-3.5" /> {emptyTitles} without a title (not saved)</span>
                                : status === "saving" ? <span className="inline-flex items-center gap-1 text-amber-300"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span>
                                    : status === "saved" ? <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>
                                        : status === "error" ? <span className="text-rose-400">Auto-save failed</span> : null}
                            {(flow.unreachable.length > 0 || flow.loops.size > 0) && <span className="inline-flex items-center gap-1 text-rose-300"><TriangleAlert className="h-3.5 w-3.5" /> Check the flow</span>}
                        </div>
                        <div className="flex items-center gap-2">
                            <Link href={`/forms/${formId}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5"><ExternalLink className="h-3.5 w-3.5" /> Preview</Link>
                            <button onClick={saveAndExit} disabled={exiting} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400 disabled:opacity-50">
                                {exiting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save & exit
                            </button>
                        </div>
                    </div>
                </div>

                {/* Canvas: Start → sections → Submit */}
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[radial-gradient(circle,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:20px_20px]">
                    <div ref={canvas} className="relative inline-flex min-w-full items-start px-4 pb-32 pt-24">
                        <Wires sections={sections} canvas={canvas} hover={hover} wire={wire} branchColor={branchColor} active={!!active} />

                        <div data-node={START_NODE} className="mt-3 flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300"><Play className="h-3.5 w-3.5" /> Start</div>
                        <SortableContext items={sections.map(s => `s:${s.key}`)} strategy={horizontalListSortingStrategy}>
                            {sections.map((s, i) => (
                                <div key={s.key} className="flex items-start">
                                    <Gap index={i} showArrow={i === 0 || sections[i - 1].next === NEXT} dragging={active?.kind === "palette" || active?.kind === "question"} />
                                    <SectionCard s={s} i={i} sections={sections} flow={flow} selection={selection} hover={hover} branchColor={branchColor}
                                        wireTarget={wireTarget} answerCounts={answerCounts}
                                        onSelectSection={() => setSelection({ kind: "section", key: s.key })}
                                        onSelectQuestion={id => setSelection({ kind: "question", id })}
                                        onHover={setHover} onExitKnob={e => startWire({ kind: "exit", key: s.key }, e)}
                                        onOptionKnob={(qid, option, e) => startWire({ kind: "option", qid, option }, e)}
                                        onClearRoute={(qid, option) => setRoute(qid, option, null)} />
                                </div>
                            ))}
                        </SortableContext>
                        <Gap index={sections.length} showArrow={lastNext === NEXT || lastNext === SUBMIT} dragging={active?.kind === "palette" || active?.kind === "question"} />
                        <div data-node={SUBMIT_NODE} className={`mt-3 flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold ${wireTarget === SUBMIT_NODE ? "border-emerald-300 bg-emerald-500/25 text-white" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}><Flag className="h-3.5 w-3.5" /> Submit</div>
                    </div>
                </div>

                <DragOverlay dropAnimation={null}>
                    {active?.kind === "palette" && <Chip label={active.qtype === "section" ? "New section" : getFieldMeta(active.qtype).label} qtype={active.qtype === "section" ? null : active.qtype} />}
                    {active?.kind === "question" && <Chip label={findQ(active.id)?.label || "Question"} qtype={findQ(active.id)?.type ?? "text"} />}
                    {active?.kind === "section" && <div className="w-[260px] rounded-2xl border border-amber-500/50 bg-zinc-900/95 p-3 text-sm font-semibold text-white shadow-2xl">{nameOfKey(active.key)}</div>}
                </DragOverlay>
            </DndContext>

            <p className="px-1 text-[11px] leading-relaxed text-gray-500">
                <span className="mr-3 inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-zinc-500" /> next</span>
                <span className="mr-3 inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-amber-500" /> section jumps to</span>
                <span className="mr-3 inline-flex items-center gap-1"><span className="h-0 w-4 border-t-2 border-dashed border-violet-400" /> answer leads to</span>
                Drag the <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 align-middle" /> knob on a section&apos;s right edge, or the coloured knob next to a dropdown answer, onto where it should go.
            </p>

            {/* Logic summary */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
                <button onClick={() => setShowLogic(v => !v)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-white">
                    <span className="flex items-center gap-2"><ListTree className="h-4 w-4 text-amber-400" /> Logic in plain words</span>
                    <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${showLogic ? "rotate-180" : ""}`} />
                </button>
                {showLogic && (
                    <ol className="space-y-3 border-t border-white/5 px-4 py-3 text-sm">
                        {sections.map((s, i) => {
                            const t = resolveTarget(sections, i, s.next)
                            const routes = optionRoutes(s)
                            return (
                                <li key={s.key} className="flex gap-3">
                                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/10 text-[10px] font-bold text-gray-300">{i + 1}</span>
                                    <div className="min-w-0 space-y-1">
                                        <p className="text-white">
                                            <button onClick={() => setSelection({ kind: "section", key: s.key })} className="font-medium hover:text-amber-300">{sectionName(s, i)}</button>
                                            <span className="text-gray-500"> · {s.questions.length} question{s.questions.length === 1 ? "" : "s"}</span>
                                            {flow.unreachable.includes(i) && <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-300">nobody reaches this</span>}
                                            {flow.loops.has(i) && <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300">loops, never submits</span>}
                                        </p>
                                        {routes.map(r => {
                                            const k = resolveTarget(sections, i, r.target)
                                            return (
                                                <p key={r.questionId + r.option} className="text-gray-400">
                                                    <GitBranch className="mr-1 inline h-3.5 w-3.5" style={{ color: branchColor.get(r.questionId) }} />
                                                    If <span className="text-gray-200">“{r.question}”</span> is <span className="font-medium" style={{ color: branchColor.get(r.questionId) }}>“{r.option}”</span> → <span className="text-white">{k === -1 ? "Submit" : sectionName(sections[k], k)}</span>
                                                </p>
                                            )
                                        })}
                                        <p className="text-gray-400">{routes.length ? "Otherwise" : "Then"} → <span className="text-white">{t === -1 ? "Submit" : sectionName(sections[t], t)}</span></p>
                                    </div>
                                </li>
                            )
                        })}
                    </ol>
                )}
            </div>

            {/* Side panel (bottom sheet on phones) */}
            {(selQ || selSIndex >= 0) && (
                <div style={{ "--pw": `${panel.width}px`, "--ph": `${panel.height}dvh` } as React.CSSProperties}
                    className={`fixed inset-x-0 bottom-0 z-50 h-[var(--ph)] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-zinc-950 p-4 pt-6 shadow-2xl md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:h-auto md:w-[var(--pw)] md:rounded-3xl md:border md:pl-6 md:pt-4 ${panel.resizing ? "select-none" : ""}`}>
                    {/* Resize: drag the left edge (desktop) or the top bar (phone); double-click to reset */}
                    <div onPointerDown={panel.startWidth} onDoubleClick={panel.reset} title="Drag to resize · double-click to reset" aria-label="Resize panel"
                        className="group absolute inset-y-0 left-0 z-10 hidden w-3 cursor-col-resize touch-none items-center justify-center md:flex">
                        <span className={`h-12 w-1 rounded-full transition-colors ${panel.resizing ? "bg-amber-400" : "bg-white/15 group-hover:bg-amber-400/70"}`} />
                    </div>
                    <div onPointerDown={panel.startHeight} onDoubleClick={panel.reset} title="Drag to resize · double-click to reset" aria-label="Resize panel"
                        className="absolute inset-x-0 top-0 z-10 flex h-6 cursor-row-resize touch-none items-center justify-center md:hidden">
                        <span className={`h-1 w-12 rounded-full ${panel.resizing ? "bg-amber-400" : "bg-white/25"}`} />
                    </div>
                    <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">{selQ ? "Edit question" : "Edit section"}</p>
                        <button onClick={() => setSelection(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
                    </div>
                    {selQ && (
                        <FieldCard field={selQ} index={0} sectionFields={headers}
                            updateField={updateField} removeField={removeQuestion} addOption={addOption} updateOption={updateOption}
                            handleOptionPaste={handleOptionPaste} removeOption={removeOption} reorderOption={reorderOption}
                            updateOptionRouting={(id, option, target) => setRoute(id, option, target)}
                            footer={(answerCounts[selQ.id] ?? 0) > 0 ? <p className="text-xs text-gray-500">{answerCounts[selQ.id]} answers collected</p> : undefined} />
                    )}
                    {selSIndex >= 0 && (() => {
                        const s = sections[selSIndex]
                        return (
                            <div className="space-y-3">
                                <input value={s.header?.label ?? ""} onChange={e => setTitle(s, e.target.value)} placeholder={s.header ? "Section title" : "Add a heading (optional)"}
                                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-lg font-semibold text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none" />
                                {s.header && <textarea value={s.header.description ?? ""} rows={2} onChange={e => patchSection(s.key, { header: { ...s.header!, description: e.target.value } })} placeholder="Description shown under the title (optional)"
                                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none" />}
                                <label className="block space-y-1.5 text-sm">
                                    <span className="text-xs text-gray-400">When this section is done</span>
                                    <select value={s.next} onChange={e => setNext(s.key, e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 text-white">
                                        {selSIndex < sections.length - 1 && <option value={NEXT}>Continue to {sectionName(sections[selSIndex + 1], selSIndex + 1)}</option>}
                                        {sections.map((x, k) => (k !== selSIndex && k !== selSIndex + 1 && x.header ? <option key={x.key} value={x.key}>Go to {sectionName(x, k)}</option> : null))}
                                        <option value={SUBMIT}>Submit form</option>
                                    </select>
                                </label>
                                {sections.length > 1 && (
                                    <button onClick={() => setPending({ kind: "section", index: selSIndex })} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:bg-rose-500/10 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /> Remove section (keeps its questions)</button>
                                )}
                            </div>
                        )
                    })()}
                </div>
            )}

            <Dialog open={!!pending} onOpenChange={o => { if (!o) setPending(null) }}>
                <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md border-white/10 bg-zinc-950 text-white">
                    {pending?.kind === "question" && (
                        <>
                            <DialogHeader className="text-left">
                                <DialogTitle className="flex items-center gap-2"><TriangleAlert className="h-5 w-5 text-rose-400" /> Delete this question?</DialogTitle>
                                <DialogDescription className="text-gray-400">&quot;{pending.label}&quot; already has <b className="text-rose-300">{pending.answers} answers</b>. They are deleted when the form saves.</DialogDescription>
                            </DialogHeader>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setPending(null)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-200 hover:bg-white/5">Keep it</button>
                                <button onClick={() => { removeQuestionNow(pending.id); setPending(null) }} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500">Delete question and answers</button>
                            </div>
                        </>
                    )}
                    {pending?.kind === "section" && (
                        <>
                            <DialogHeader className="text-left">
                                <DialogTitle>Remove {sectionName(sections[pending.index], pending.index)}?</DialogTitle>
                                <DialogDescription className="text-gray-400">Only the heading goes. Its questions join the section {pending.index === 0 ? "after" : "before"} it, and arrows pointing to it continue to the next section.</DialogDescription>
                            </DialogHeader>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setPending(null)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-200 hover:bg-white/5">Cancel</button>
                                <button onClick={() => { removeSection(pending.index); setPending(null) }} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500">Remove section</button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ============================================================
// Pieces
// ============================================================

const PANEL_KEY = "form-builder-panel"
const PANEL_DEFAULT = { width: 440, height: 78 }

/**
 * Size of the edit panel, set by dragging: width in px on desktop (left edge),
 * height in % of the screen on phones (top bar). Remembered in this browser.
 */
function usePanelSize() {
    // The panel only renders after a click, so reading storage up front can't mismatch the server HTML
    const [size, setSize] = useState<typeof PANEL_DEFAULT>(() => {
        if (typeof window === "undefined") return PANEL_DEFAULT
        try {
            const saved = JSON.parse(localStorage.getItem(PANEL_KEY) ?? "null")
            return saved && typeof saved.width === "number" && typeof saved.height === "number" ? saved : PANEL_DEFAULT
        } catch { return PANEL_DEFAULT }
    })
    const [resizing, setResizing] = useState(false)
    const save = (next: typeof PANEL_DEFAULT) => { try { localStorage.setItem(PANEL_KEY, JSON.stringify(next)) } catch { /* ignore */ } }
    const drag = (e: React.PointerEvent, calc: (ev: PointerEvent) => Partial<typeof PANEL_DEFAULT>) => {
        e.preventDefault()
        setResizing(true)
        let latest = size
        const move = (ev: PointerEvent) => { latest = { ...latest, ...calc(ev) }; setSize(latest) }
        const up = () => {
            setResizing(false); save(latest)
            window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up)
        }
        window.addEventListener("pointermove", move)
        window.addEventListener("pointerup", up)
    }
    const clamp = (v: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, v)))
    return {
        ...size,
        resizing,
        // panel sits 16px from the right edge
        startWidth: (e: React.PointerEvent) => drag(e, ev => ({ width: clamp(window.innerWidth - ev.clientX - 16, 340, Math.min(1000, window.innerWidth - 120)) })),
        startHeight: (e: React.PointerEvent) => drag(e, ev => ({ height: clamp(((window.innerHeight - ev.clientY) / window.innerHeight) * 100, 30, 95) })),
        reset: () => { setSize(PANEL_DEFAULT); save(PANEL_DEFAULT) },
    }
}

function PaletteItem({ qtype, label, icon: Icon, color, bg, onTap }: { qtype: QuestionType | "section"; label: string; icon: any; color: string; bg: string; onTap: () => void }) {
    const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `p:${qtype}`, data: { type: "palette", qtype } })
    return (
        <button ref={setNodeRef} {...attributes} {...listeners} type="button" onClick={onTap} title="Drag onto the flow (or tap to add)"
            className={`flex shrink-0 touch-none items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-gray-200 transition-colors hover:border-white/25 active:cursor-grabbing ${isDragging ? "opacity-40" : "cursor-grab"}`}>
            <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: bg }}><Icon className="h-3.5 w-3.5" style={{ color }} /></span>
            {label}
        </button>
    )
}

function Chip({ label, qtype }: { label: string; qtype: QuestionType | null }) {
    const meta = qtype ? getFieldMeta(qtype) : null
    const Icon = meta?.icon ?? Layers
    return (
        <div className="flex w-[230px] items-center gap-2 rounded-xl border border-amber-500/60 bg-zinc-900 px-3 py-2 text-sm text-white shadow-2xl">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: meta?.bg ?? "rgba(245,158,11,0.12)" }}><Icon className="h-3.5 w-3.5" style={{ color: meta?.color ?? "#f59e0b" }} /></span>
            <span className="truncate">{label}</span>
        </div>
    )
}

/** Drop zone between sections: drop a question or "Section" here to start a new section. */
function Gap({ index, showArrow, dragging }: { index: number; showArrow: boolean; dragging: boolean }) {
    const { setNodeRef, isOver } = useDroppable({ id: `g:${index}`, data: { type: "gap", index } })
    return (
        <div ref={setNodeRef} className={`relative mt-3 flex shrink-0 items-start justify-center self-stretch transition-all ${dragging ? "w-24" : "w-14"}`}>
            {dragging ? (
                <div className={`flex h-24 w-20 items-center justify-center rounded-xl border-2 border-dashed text-center text-[10px] leading-tight ${isOver ? "border-amber-400 bg-amber-500/15 text-amber-200" : "border-white/15 text-gray-500"}`}>New section here</div>
            ) : showArrow ? (
                <div className="absolute top-[15px] flex w-full items-center px-1"><div className="h-0.5 flex-1 bg-zinc-500" /><div className="h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-zinc-500" /></div>
            ) : (
                <div className="absolute top-[18px] w-full border-t border-dashed border-white/10" />
            )}
        </div>
    )
}

function SectionCard({ s, i, sections, flow, selection, hover, branchColor, wireTarget, answerCounts, onSelectSection, onSelectQuestion, onHover, onExitKnob, onOptionKnob, onClearRoute }: {
    s: FlowSection; i: number; sections: FlowSection[]; flow: ReturnType<typeof analyzeFlow>; selection: Selection; hover: string | null
    branchColor: Map<string, string>; wireTarget: string | null; answerCounts: Record<string, number>
    onSelectSection: () => void; onSelectQuestion: (id: string) => void; onHover: (k: string | null) => void
    onExitKnob: (e: React.PointerEvent) => void; onOptionKnob: (qid: string, option: string, e: React.PointerEvent) => void; onClearRoute: (qid: string, option: string) => void
}) {
    const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: `s:${s.key}`, data: { type: "section", key: s.key } })
    const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `c:${s.key}`, data: { type: "container", key: s.key } })
    const selected = selection?.kind === "section" && selection.key === s.key
    const target = resolveTarget(sections, i, s.next)
    const targetName = target === -1 ? "Submit" : sectionName(sections[target], target)
    const warn = flow.unreachable.includes(i) ? "Nobody reaches this section" : flow.loops.has(i) ? "Loops back, never submits" : null
    return (
        <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} data-node={s.key}
            className={`relative w-[270px] shrink-0 rounded-2xl border bg-zinc-950/95 shadow-lg transition-colors ${isDragging ? "opacity-40" : ""} ${wireTarget === s.key ? "border-amber-300 ring-2 ring-amber-400/40" : selected ? "border-amber-500/60" : warn ? "border-rose-500/30" : "border-white/10"}`}
            onMouseEnter={() => onHover(s.key)} onMouseLeave={() => onHover(null)}>
            <div className="flex items-center gap-1.5 border-b border-white/5 px-2 py-2">
                <span {...attributes} {...listeners} className="cursor-grab touch-none rounded p-1 text-gray-600 hover:bg-white/5 hover:text-gray-300 active:cursor-grabbing" aria-label="Drag section"><GripVertical className="h-4 w-4" /></span>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-500/15 text-[10px] font-bold text-amber-300">{i + 1}</span>
                <button onClick={onSelectSection} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-white hover:text-amber-300">{sectionName(s, i)}</button>
            </div>
            <span data-exit={s.key} onPointerDown={onExitKnob} title={`Then → ${targetName}. Drag onto another section to change.`}
                className="absolute -right-2.5 top-[13px] z-20 h-5 w-5 cursor-crosshair touch-none rounded-full border-[3px] border-zinc-950 bg-amber-500 shadow hover:scale-110" />
            <div ref={setDropRef} className={`min-h-[64px] space-y-1.5 p-2 transition-colors ${isOver ? "bg-amber-500/5" : ""}`}>
                <SortableContext items={s.questions.map(q => `q:${q.id}`)} strategy={verticalListSortingStrategy}>
                    {s.questions.map(q => (
                        <QuestionChip key={q.id} q={q} sectionKey={s.key} sections={sections} sectionIndex={i} color={branchColor.get(q.id)}
                            selected={selection?.kind === "question" && selection.id === q.id} dim={!!hover && hover !== q.id && hover !== s.key}
                            answers={answerCounts[q.id] ?? 0}
                            onSelect={() => onSelectQuestion(q.id)} onHover={onHover} onOptionKnob={onOptionKnob} onClearRoute={onClearRoute} />
                    ))}
                </SortableContext>
                {s.questions.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-gray-500">Drop questions here</p>}
            </div>
            <div className="border-t border-white/5 px-3 py-2 text-[11px]">
                {warn && <p className="mb-1 font-medium text-rose-300">{warn}</p>}
                <p className="text-gray-500">{optionRoutes(s).length ? "Otherwise" : "Then"} → <span className={s.next === NEXT ? "text-gray-300" : "font-medium text-amber-300"}>{targetName}</span></p>
            </div>
        </div>
    )
}

function QuestionChip({ q, sectionKey, sections, sectionIndex, color, selected, dim, answers, onSelect, onHover, onOptionKnob, onClearRoute }: {
    q: RegistrationField; sectionKey: string; sections: FlowSection[]; sectionIndex: number; color?: string; selected: boolean; dim: boolean; answers: number
    onSelect: () => void; onHover: (k: string | null) => void; onOptionKnob: (qid: string, option: string, e: React.PointerEvent) => void; onClearRoute: (qid: string, option: string) => void
}) {
    const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: `q:${q.id}`, data: { type: "question", id: q.id, section: sectionKey } })
    const meta = getFieldMeta(q.type)
    const Icon = meta.icon
    const branching = q.type === "select" && (q.options?.length ?? 0) > 0
    return (
        <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
            className={`rounded-xl border bg-zinc-900/80 transition-opacity ${isDragging ? "opacity-30" : dim ? "opacity-50" : ""} ${selected ? "border-amber-500/60" : "border-white/5 hover:border-white/15"}`}
            onMouseEnter={e => { e.stopPropagation(); onHover(q.id) }} onMouseLeave={() => onHover(sectionKey)}>
            <div {...attributes} {...listeners} onClick={onSelect} className="flex cursor-grab touch-none items-center gap-2 px-2 py-1.5 active:cursor-grabbing">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: meta.bg }}><Icon className="h-3.5 w-3.5" style={{ color: meta.color }} /></span>
                <span className={`min-w-0 flex-1 truncate text-xs ${q.label.trim() ? "text-gray-100" : "italic text-amber-400"}`}>{q.label.trim() || "Untitled question"}</span>
                {q.required && <span className="text-[10px] text-rose-400" title="Required">*</span>}
                {answers > 0 && <span className="text-[9px] text-gray-500" title="Answers collected">{answers}</span>}
            </div>
            {branching && (
                <div className="space-y-0.5 border-t border-white/5 px-2 py-1.5">
                    {q.options!.map(opt => {
                        const routed = q.optionRouting?.[opt]
                        const t = routed ? resolveTarget(sections, sectionIndex, routed) : null
                        return (
                            <div key={opt} className="relative flex items-center gap-1.5 pr-4 text-[10px]">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: routed ? color : "#3f3f46" }} />
                                <span className="min-w-0 flex-1 truncate text-gray-400">{opt}</span>
                                {routed && t !== null && (
                                    <button onClick={() => onClearRoute(q.id, opt)} title="Remove this branch" className="max-w-[90px] truncate rounded px-1 font-medium hover:bg-white/5" style={{ color }}>→ {t === -1 ? "Submit" : sectionName(sections[t], t)}</button>
                                )}
                                <span data-port={`${q.id}|${opt}`} onPointerDown={e => onOptionKnob(q.id, opt, e)} title={`Drag onto a section: people who pick “${opt}” go there`}
                                    className="absolute -right-3.5 top-1/2 z-20 h-3.5 w-3.5 -translate-y-1/2 cursor-crosshair touch-none rounded-full border-2 border-zinc-950 shadow hover:scale-125" style={{ backgroundColor: color ?? "#a78bfa" }} />
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

/** Arrows for section jumps (above the boxes) and answer branches (below), plus the wire being dragged. */
function Wires({ sections, canvas, hover, wire, branchColor, active }: {
    sections: FlowSection[]; canvas: React.RefObject<HTMLDivElement | null>; hover: string | null
    wire: { x1: number; y1: number; x2: number; y2: number } | null; branchColor: Map<string, string>; active: boolean
}) {
    const [geo, setGeo] = useState<{ nodes: Record<string, DOMRect>; exits: Record<string, DOMRect>; ports: Record<string, DOMRect>; base: DOMRect } | null>(null)
    const measure = useCallback(() => {
        const root = canvas.current
        if (!root) return
        const pick = (sel: string, attr: string) => Object.fromEntries([...root.querySelectorAll<HTMLElement>(sel)].map(el => [el.dataset[attr]!, el.getBoundingClientRect()]))
        setGeo({ nodes: pick("[data-node]", "node"), exits: pick("[data-exit]", "exit"), ports: pick("[data-port]", "port"), base: root.getBoundingClientRect() })
    }, [canvas])
    useLayoutEffect(() => {
        measure()
        const until = performance.now() + 400
        let raf = 0
        const tick = () => { measure(); if (active || performance.now() < until) raf = requestAnimationFrame(tick) }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [sections, active, measure])
    useEffect(() => {
        const ro = new ResizeObserver(measure)
        if (canvas.current) ro.observe(canvas.current)
        window.addEventListener("resize", measure)
        return () => { ro.disconnect(); window.removeEventListener("resize", measure) }
    }, [canvas, measure])

    if (!geo) return null
    const { base } = geo
    const rel = (r: DOMRect) => ({ l: r.left - base.left, r: r.right - base.left, t: r.top - base.top, b: r.bottom - base.top, cx: r.left + r.width / 2 - base.left, cy: r.top + r.height / 2 - base.top })
    const nodeBox = (key: string) => (geo.nodes[key] ? rel(geo.nodes[key]) : null)
    const paths: { d: string; color: string; dashed?: boolean; label: string; lx: number; ly: number; owner: string; key: string }[] = []
    let up = 0, down = 0
    sections.forEach((s, i) => {
        const j = resolveTarget(sections, i, s.next)
        const sequential = s.next === NEXT || (j === -1 && i === sections.length - 1)
        const exit = geo.exits[s.key] ? rel(geo.exits[s.key]) : null
        const to = nodeBox(j === -1 ? SUBMIT_NODE : sections[j].key)
        if (!sequential && exit && to) {
            const lift = 26 + (up++ % 4) * 16
            const top = Math.min(exit.t, to.t) - lift
            const x2 = to.cx
            paths.push({ key: `e${i}`, owner: s.key, color: "#f59e0b", d: `M ${exit.r - 2} ${exit.cy} C ${exit.r + 40} ${exit.cy}, ${exit.r + 40} ${top}, ${(exit.r + x2) / 2} ${top} S ${x2} ${top}, ${x2} ${to.t - 6}`, label: `then → ${j === -1 ? "Submit" : sectionName(sections[j], j)}`, lx: (exit.r + x2) / 2, ly: top - 6 })
        }
        for (const r of optionRoutes(s)) {
            const pk = `${r.questionId}|${r.option}`
            const port = geo.ports[pk] ? rel(geo.ports[pk]) : null
            const k = resolveTarget(sections, i, r.target)
            const dest = nodeBox(k === -1 ? SUBMIT_NODE : sections[k].key)
            const card = nodeBox(s.key)
            if (!port || !dest || !card) continue
            const n = down++
            const bottom = Math.max(card.b, dest.b) + 22 + (n % 5) * 14
            const x2 = dest.cx + ((n % 3) - 1) * 18
            paths.push({ key: `o${pk}`, owner: r.questionId, dashed: true, color: branchColor.get(r.questionId) ?? "#a78bfa",
                d: `M ${port.r - 2} ${port.cy} C ${port.r + 30} ${port.cy}, ${port.r + 30} ${bottom}, ${(port.r + x2) / 2} ${bottom} S ${x2} ${bottom}, ${x2} ${dest.b + 6}`,
                label: `“${r.option.length > 18 ? r.option.slice(0, 17) + "…" : r.option}”`, lx: (port.r + x2) / 2, ly: bottom + 12 })
        }
    })
    const lit = (owner: string) => !hover || hover === owner || sections.some(s => s.key === hover && (owner === s.key || s.questions.some(q => q.id === owner)))
    return (
        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible" aria-hidden>
            <defs>
                {[...new Set(["#f59e0b", "#fbbf24", ...BRANCH_COLORS])].map(c => (
                    <marker key={c} id={`fa-${c.slice(1)}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={c} /></marker>
                ))}
            </defs>
            {paths.map(p => (
                <g key={p.key} style={{ opacity: lit(p.owner) ? 1 : 0.15, transition: "opacity 150ms" }}>
                    <path d={p.d} fill="none" stroke={p.color} strokeWidth={lit(p.owner) && hover ? 2.4 : 1.7} strokeDasharray={p.dashed ? "5 4" : undefined} markerEnd={`url(#fa-${p.color.slice(1)})`} />
                    <text x={p.lx} y={p.ly} textAnchor="middle" fontSize="10" fontWeight={600} fill={p.color} style={{ paintOrder: "stroke", stroke: "#09090b", strokeWidth: 3 }}>{p.label}</text>
                </g>
            ))}
            {wire && <path d={`M ${wire.x1} ${wire.y1} L ${wire.x2} ${wire.y2}`} stroke="#fbbf24" strokeWidth={2} strokeDasharray="6 4" fill="none" markerEnd="url(#fa-fbbf24)" />}
        </svg>
    )
}
