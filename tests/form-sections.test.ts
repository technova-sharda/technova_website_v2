import { describe, expect, it } from "vitest"
import { analyzeFlow, NEXT, SUBMIT, START, toFields, toSections } from "@/lib/forms/sections"

const q = (id: string, extra: any = {}) => ({ id, type: "text" as const, label: id, required: true, ...extra })
const sec = (id: string, afterSection?: string) => ({ id, type: "section" as const, label: id, required: false, validation: afterSection ? { afterSection } : {} })

/** The public form's grouping (copied from dynamic-form.tsx) to prove nothing changes for respondents. */
function publicGroups(fields: any[]) {
    const sections: any[] = []
    let cur: any = { header: null, fields: [] }
    for (const f of fields) {
        if (f.type === "section") {
            cur.nextRouting = f.validation?.afterSection || "__next__"
            if (cur.fields.length > 0 || cur.header) sections.push(cur)
            cur = { header: f, fields: [] }
        } else cur.fields.push(f)
    }
    cur.nextRouting = "__submit__"
    if (cur.fields.length > 0 || cur.header) sections.push(cur)
    return sections.map(s => ({ header: s.header?.id ?? null, fields: s.fields.map((f: any) => f.id), next: s.nextRouting }))
}

describe("form sections", () => {
    it("reads a flat form: start questions, then sections with their jumps", () => {
        const fields = [q("a"), sec("S1", "S3"), q("b"), sec("S2"), q("c"), sec("S3", SUBMIT), q("d")]
        const s = toSections(fields as any)
        expect(s.map(x => [x.key, x.questions.map(y => y.id), x.next])).toEqual([
            // a divider's afterSection belongs to the section before it
            [START, ["a"], "S3"], ["S1", ["b"], NEXT], ["S2", ["c"], SUBMIT], ["S3", ["d"], SUBMIT],
        ])
    })

    it("round-trips without changing what the public form does", () => {
        const forms = [
            [q("a"), sec("S1", "S3"), q("b"), sec("S2"), q("c"), sec("S3", SUBMIT), q("d")],
            [sec("S1"), q("a"), sec("S2", "S1"), q("b")],
            [q("a"), q("b")],
            [],
        ]
        for (const f of forms) {
            const back = toFields(toSections(f as any))
            expect(publicGroups(back)).toEqual(publicGroups(f))
        }
    })

    it("gives a moved heading-less section a heading so it still exists", () => {
        const s = toSections([q("a"), sec("S1"), q("b")] as any)
        const swapped = [s[1], s[0]]
        const fields = toFields(swapped, () => "NEW")
        expect(fields.map(f => f.id)).toEqual(["S1", "b", "NEW", "a"])
    })

    it("finds unreachable sections and loops", () => {
        const s = toSections([q("a"), sec("S1"), q("b"), sec("S2", SUBMIT), q("c")] as any)
        expect(analyzeFlow(s).unreachable).toEqual([2]) // start → S1 → submit, S2 never reached
        expect(analyzeFlow(s).loops.size).toBe(0)
        const loop = toSections([q("a"), sec("S1"), q("b"), sec("S2", "S1"), q("c")] as any) // S1 → S1 forever
        expect([...analyzeFlow(loop).loops]).toContain(1)
    })

    it("option routes count toward reachability", () => {
        const s = toSections([{ ...q("a"), type: "select", options: ["Yes", "No"], optionRouting: { Yes: "S2" } }, sec("S1"), q("b"), sec("S2", SUBMIT), q("c")] as any)
        expect(analyzeFlow(s).unreachable).toEqual([])
    })
})
