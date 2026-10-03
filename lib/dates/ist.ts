// India Standard Time is always UTC+5:30 (no daylight saving), so a fixed offset is exact.
const IST_OFFSET_MS = 330 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Calendar date in IST as `YYYY-MM-DD`.
 *
 * `date.toISOString().split('T')[0]` and `toDateString()` use UTC on the server,
 * so anything between 00:00 and 05:30 IST lands on the previous day.
 */
export function istDateKey(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date
    return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** Number of IST calendar days an interval touches (minimum 1). */
export function istDaySpan(start: Date | string, end: Date | string): number {
    const startDay = Date.parse(`${istDateKey(start)}T00:00:00Z`)
    const endDay = Date.parse(`${istDateKey(end)}T00:00:00Z`)
    return Math.max(1, Math.round((endDay - startDay) / DAY_MS) + 1)
}

/** True when start and end fall on different IST calendar dates. */
export function spansMultipleIstDays(start: Date | string, end: Date | string): boolean {
    return istDateKey(start) !== istDateKey(end)
}
