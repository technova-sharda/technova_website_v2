import { describe, expect, it } from "vitest"
import { googleCalendarUrl, icsContent, toCalendarEntry } from "@/lib/calendar/event-calendar"

const kickstart = {
    id: "1bed3562-6184-47de-a241-197655162dd4",
    slug: "ai-kickstart-1bed3562",
    title: "AI KickStart",
    description: "Python, data, ML; Kaggle",
    is_virtual: true,
    start_time: "2026-10-03T14:30:00Z",
    end_time: "2026-10-04T17:30:00Z",
    is_multi_day: true,
    daily_start_time: "20:00:00",
    daily_end_time: "23:00:00",
}

describe("add to calendar", () => {
    it("turns a multi-day event into a daily slot at its daily hours", () => {
        const e = toCalendarEntry(kickstart)
        expect(e.start.toISOString()).toBe("2026-10-03T14:30:00.000Z") // 20:00 IST
        expect(e.end.toISOString()).toBe("2026-10-03T17:30:00.000Z") // 23:00 IST
        expect(e.days).toBe(2)
        expect(e.location).toBe("Online")
    })
    it("writes a valid .ics with a daily repeat and escaped text", () => {
        const ics = icsContent(toCalendarEntry(kickstart))
        expect(ics).toContain("DTSTART:20261003T143000Z")
        expect(ics).toContain("RRULE:FREQ=DAILY;COUNT=2")
        expect(ics).toContain(String.raw`Python\, data\, ML\; Kaggle`)
        expect(ics.split("\r\n").every(l => Buffer.byteLength(l) <= 75)).toBe(true)
    })
    it("builds a Google Calendar link", () => {
        const url = new URL(googleCalendarUrl(toCalendarEntry(kickstart)))
        expect(url.searchParams.get("dates")).toBe("20261003T143000Z/20261003T173000Z")
        expect(url.searchParams.get("recur")).toBe("RRULE:FREQ=DAILY;COUNT=2")
    })
    it("handles a single-day event with an end before its start", () => {
        const e = toCalendarEntry({ ...kickstart, is_multi_day: false, end_time: "2026-10-03T14:00:00Z" })
        expect(e.days).toBe(1)
        expect(e.end.getTime() - e.start.getTime()).toBe(60 * 60 * 1000)
    })
})
