import { describe, expect, it } from "vitest"
import { matchAttendance } from "@/lib/attendance/match"

const base = { userId: "u", name: "x", attended: false }
const roster = [
    { ...base, registrationId: "r1", email: "2023001111@ug.sharda.ac.in", systemId: "2023001111", paymentPending: false, checkedInDays: [] },
    { ...base, registrationId: "r2", email: "Alice.K@gmail.com", systemId: null, paymentPending: false, checkedInDays: ["2026-10-03"] },
    { ...base, registrationId: "r3", email: "x@ug.sharda.ac.in", systemId: "2023003333", paymentPending: true, checkedInDays: [] },
    { ...base, registrationId: "r4", email: "bob@ug.sharda.ac.in", systemId: "2023004444", paymentPending: false, checkedInDays: [] },
]
const csv = `Full Name,Email,Duration
Some One,2023001111@UG.SHARDA.AC.IN,45 min
Alice K,alice.k@gmail.com,60 min
Stranger,stranger@gmail.com,10 min
Unpaid,x@ug.sharda.ac.in,30
Bob by id only,2023004444,20`

describe("bulk attendance matching", () => {
    const m = matchAttendance(csv, roster, "2026-10-03")
    it("matches emails case-insensitively and system IDs on their own", () => {
        expect(m.toMark.map(r => r.registrationId).sort()).toEqual(["r1", "r4"])
    })
    it("leaves people already checked in for that day alone", () => {
        expect(m.already.map(r => r.registrationId)).toEqual(["r2"])
    })
    it("skips unpaid registrations and lists unknown emails", () => {
        expect(m.pending.map(r => r.registrationId)).toEqual(["r3"])
        expect(m.notRegistered).toEqual(["stranger@gmail.com"])
    })
    it("never matches by name", () => {
        expect(matchAttendance("Bob by id only", roster, "2026-10-03").toMark).toEqual([])
    })
})
