import { describe, expect, it } from "vitest"
import { istDateKey, istDaySpan, spansMultipleIstDays } from "@/lib/dates/ist"

describe("IST dates", () => {
    it("uses the IST calendar date, not UTC (00:00–05:30 IST is the previous UTC day)", () => {
        expect(istDateKey("2026-10-03T20:00:00Z")).toBe("2026-10-04") // 01:30 IST on the 4th
        expect(istDateKey("2026-10-03T18:29:59Z")).toBe("2026-10-03") // 23:59 IST
    })
    it("counts the IST days an event touches", () => {
        expect(istDaySpan("2026-10-03T14:30:00Z", "2026-10-04T17:30:00Z")).toBe(2) // AI KickStart
        expect(istDaySpan("2026-10-03T14:30:00Z", "2026-10-03T17:30:00Z")).toBe(1)
    })
    it("detects multi-day events by IST date", () => {
        expect(spansMultipleIstDays("2026-10-03T14:30:00Z", "2026-10-03T18:00:00Z")).toBe(false)
        expect(spansMultipleIstDays("2026-10-03T14:30:00Z", "2026-10-03T19:00:00Z")).toBe(true) // ends 00:30 IST
    })
})
