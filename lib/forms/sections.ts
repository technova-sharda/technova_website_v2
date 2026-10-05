/**
 * Form sections for the flow builder.
 *
 * Storage stays the same flat list the public form reads (components/public/
 * dynamic-form.tsx): questions, with "section" items as dividers. Where a
 * section goes next is stored on the divider of the section after it
 * (validation.afterSection), and dropdown answers can jump via
 * validation.optionRouting. The builder edits sections instead, and these
 * functions convert both ways without changing what respondents see.
 */
import type { RegistrationField } from "@/components/admin/form-builder"

export const START = "__start__"
export const NEXT = "__next__"
export const SUBMIT = "__submit__"

export type FlowSection = {
    /** Divider id, or START for questions before the first divider. */
    key: string
    header: RegistrationField | null
    questions: RegistrationField[]
    /** NEXT, SUBMIT, or the key of the section to jump to. */
    next: string
}

export function toSections(fields: RegistrationField[]): FlowSection[] {
    const out: FlowSection[] = []
    let cur: FlowSection = { key: START, header: null, questions: [], next: NEXT }
    for (const f of fields) {
        if (f.type === "section") {
            // Same rule as the public form: an empty section without a heading doesn't exist
            if (cur.header || cur.questions.length) {
                out.push(cur)
                cur.next = f.validation?.afterSection || NEXT
            }
            cur = { key: f.id, header: f, questions: [], next: NEXT }
        } else cur.questions.push(f)
    }
    if (cur.header || cur.questions.length || out.length === 0) out.push(cur)
    return normalize(out)
}

/** Last section always submits; unknown targets and "jump to the very next one" become NEXT. */
export function normalize(sections: FlowSection[]): FlowSection[] {
    const keys = new Set(sections.filter(s => s.header).map(s => s.key))
    return sections.map((s, i) => {
        let next = s.next
        if (i === sections.length - 1 && next === NEXT) next = SUBMIT
        if (next !== NEXT && next !== SUBMIT && (!keys.has(next) || sections[i + 1]?.key === next)) next = NEXT
        if (i === sections.length - 1 && next === NEXT) next = SUBMIT
        return next === s.next ? s : { ...s, next }
    })
}

export function toFields(sections: FlowSection[], newId: () => string = () => crypto.randomUUID()): RegistrationField[] {
    const list = normalize(sections)
    const out: RegistrationField[] = []
    list.forEach((s, i) => {
        // Only the first section may be heading-less; any other needs a divider to exist
        const header = s.header ?? (i > 0 ? { id: newId(), type: "section" as const, label: "Untitled section", description: "", required: false } : null)
        if (header) {
            const validation = { ...(header.validation ?? {}) }
            const prev = i > 0 ? list[i - 1].next : NEXT
            // The public form only reads afterSection between sections; the last section always submits
            if (i > 0 && prev !== NEXT) validation.afterSection = prev
            else delete validation.afterSection
            out.push({ ...header, validation })
        }
        out.push(...s.questions)
    })
    return out
}

/** Index of the section a route leads to, or -1 for submit. */
export function resolveTarget(sections: FlowSection[], i: number, target: string) {
    if (target === SUBMIT) return -1
    if (target === NEXT) return i + 1 < sections.length ? i + 1 : -1
    const j = sections.findIndex(s => s.key === target)
    return j === -1 ? (i + 1 < sections.length ? i + 1 : -1) : j
}

export type OptionRoute = { questionId: string; question: string; option: string; target: string }

export function optionRoutes(s: FlowSection): OptionRoute[] {
    return s.questions.flatMap(q => q.type === "select" && q.optionRouting
        ? Object.entries(q.optionRouting).filter(([opt, t]) => t && (q.options ?? []).includes(opt)).map(([option, target]) => ({ questionId: q.id, question: q.label, option, target }))
        : [])
}

/** Sections nobody can reach, and sections that loop back without a way to submit. */
export function analyzeFlow(sections: FlowSection[]) {
    const reach = new Set<number>([0])
    const queue = [0]
    while (queue.length) {
        const i = queue.shift()!
        const targets = [sections[i].next, ...optionRoutes(sections[i]).map(r => r.target)].map(t => resolveTarget(sections, i, t))
        for (const j of targets) if (j >= 0 && !reach.has(j)) { reach.add(j); queue.push(j) }
    }
    // Following only the default arrows, does a section ever reach Submit?
    const loops = new Set<number>()
    sections.forEach((_, start) => {
        const seen = new Set<number>()
        let i = start
        while (i >= 0 && !seen.has(i)) { seen.add(i); i = resolveTarget(sections, i, sections[i].next) }
        if (i >= 0) loops.add(start)
    })
    return { unreachable: sections.map((_, i) => i).filter(i => !reach.has(i)), loops }
}
