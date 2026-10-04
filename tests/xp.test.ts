import { describe, expect, it } from "vitest"
import { calculateEventXP, canCalculateXP } from "@/lib/xp/calculator"

describe("XP calculator", () => {
    it("needs start and end times", () => {
        expect(canCalculateXP({ start_time: "", end_time: "" })).toBe(false)
        expect(canCalculateXP({ start_time: "2026-10-03T14:30:00Z", end_time: "2026-10-03T17:30:00Z" })).toBe(true)
    })
    it("splits multi-day XP across days without losing any to rounding", () => {
        const r = calculateEventXP({ start_time: "2026-10-03T14:30:00Z", end_time: "2026-10-04T17:30:00Z", is_multi_day: true })
        expect(r.eventDays).toBe(2)
        expect(r.dailyXP * r.eventDays).toBeLessThanOrEqual(r.finalXP)
        expect(r.finalXP - r.dailyXP * r.eventDays).toBeLessThan(r.eventDays)
    })
})

import { monthlyTrend } from "@/lib/analytics/metrics"

describe("analytics monthly trend", () => {
    it("fills months with no activity with zeros", () => {
        const ds: any = {
            registrations: [
                { event_id: "e", user_id: "a", attended: false, created_at: "2026-01-10T10:00:00Z", paid: false, pending: false },
                { event_id: "e", user_id: "b", attended: false, created_at: "2026-04-02T10:00:00Z", paid: false, pending: false },
            ],
            checkins: [],
        }
        expect(monthlyTrend(ds).map(m => [m.month, m.registrations])).toEqual([["2026-01", 1], ["2026-02", 0], ["2026-03", 0], ["2026-04", 1]])
    })
})
