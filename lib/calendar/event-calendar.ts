import { istDateKey, istDaySpan } from "@/lib/dates/ist"

/**
 * "Add to calendar" for events: a Google Calendar link and an .ics file
 * (Apple Calendar, Outlook, and Google on phones).
 *
 * Multi-day events with daily hours ("20:00–23:00 daily") become one slot per
 * day (a daily repeat), not a single block running through the nights.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.technovashardauniversity.in").replace(/\/$/, "")

export type CalendarSourceEvent = {
    id: string
    slug?: string | null
    title: string
    description?: string | null
    venue?: string | null
    is_virtual?: boolean | null
    start_time: string
    end_time: string
    is_multi_day?: boolean | null
    daily_start_time?: string | null // "HH:MM[:SS]" in IST
    daily_end_time?: string | null
}

export type CalendarEntry = {
    uid: string
    title: string
    details: string
    location: string
    url: string
    start: Date
    end: Date
    /** Number of daily occurrences (1 = no repeat). */
    days: number
}

/** IST wall-clock time on an IST calendar date → UTC instant. */
function istInstant(dateKey: string, time: string): Date {
    const [h = "0", m = "0", s = "0"] = time.split(":")
    return new Date(`${dateKey}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.slice(0, 2).padStart(2, "0")}+05:30`)
}

export function eventPageUrl(event: Pick<CalendarSourceEvent, "id" | "slug">) {
    return `${SITE_URL}/events/${event.slug || event.id}`
}

export function toCalendarEntry(event: CalendarSourceEvent): CalendarEntry {
    const url = eventPageUrl(event)
    const base = {
        uid: `${event.id}@technovashardauniversity.in`,
        title: event.title,
        details: [(event.description || "").trim().slice(0, 1500), `Event page: ${url}`].filter(Boolean).join("\n\n"),
        location: event.is_virtual ? "Online" : (event.venue || ""),
        url,
    }

    if (event.is_multi_day && event.daily_start_time && event.daily_end_time) {
        const firstDay = istDateKey(event.start_time)
        const start = istInstant(firstDay, event.daily_start_time)
        let end = istInstant(firstDay, event.daily_end_time)
        if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000) // runs past midnight
        return { ...base, start, end, days: istDaySpan(event.start_time, event.end_time) }
    }

    const start = new Date(event.start_time)
    let end = new Date(event.end_time)
    if (!(end > start)) end = new Date(start.getTime() + 60 * 60 * 1000)
    return { ...base, start, end, days: 1 }
}

/** 20261004T143000Z */
function utcStamp(d: Date) {
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

export function googleCalendarUrl(entry: CalendarEntry): string {
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: entry.title,
        dates: `${utcStamp(entry.start)}/${utcStamp(entry.end)}`,
        details: entry.details,
        location: entry.location,
        ctz: "Asia/Kolkata",
    })
    if (entry.days > 1) params.set("recur", `RRULE:FREQ=DAILY;COUNT=${entry.days}`)
    return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function icsEscape(text: string) {
    return text.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1")
}

/** RFC 5545 line folding: lines longer than 75 octets continue on the next line after a space. */
function fold(line: string) {
    const bytes = Buffer.from(line, "utf8")
    if (bytes.length <= 75) return line
    const parts: string[] = []
    let current = ""
    for (const ch of line) {
        const limit = parts.length === 0 ? 75 : 74
        if (Buffer.byteLength(current + ch, "utf8") > limit) {
            parts.push(current)
            current = ch
        } else {
            current += ch
        }
    }
    parts.push(current)
    return parts.join("\r\n ")
}

export function icsContent(entry: CalendarEntry): string {
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Technova Sharda University//Events//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:${entry.uid}`,
        `DTSTAMP:${utcStamp(new Date())}`,
        `DTSTART:${utcStamp(entry.start)}`,
        `DTEND:${utcStamp(entry.end)}`,
        ...(entry.days > 1 ? [`RRULE:FREQ=DAILY;COUNT=${entry.days}`] : []),
        `SUMMARY:${icsEscape(entry.title)}`,
        `DESCRIPTION:${icsEscape(entry.details)}`,
        ...(entry.location ? [`LOCATION:${icsEscape(entry.location)}`] : []),
        `URL:${entry.url}`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${icsEscape(entry.title)}`,
        "TRIGGER:-PT1H",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return lines.map(fold).join("\r\n") + "\r\n"
}
