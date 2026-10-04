import { CalendarPlus } from "lucide-react"
import { googleCalendarUrl, toCalendarEntry, type CalendarSourceEvent } from "@/lib/calendar/event-calendar"

/** Google Calendar link + .ics download. Server component: plain links, no JS. */
export function AddToCalendar({ event }: { event: CalendarSourceEvent }) {
    const entry = toCalendarEntry(event)
    const btn = "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="w-full sm:w-auto flex items-center gap-1.5 text-sm text-gray-500 mr-1">
                <CalendarPlus className="w-4 h-4" /> Add to calendar:
            </span>
            <a href={googleCalendarUrl(entry)} target="_blank" rel="noopener noreferrer" className={btn}>
                Google
            </a>
            <a href={`/api/events/${event.slug || event.id}/calendar`} className={btn}>
                Apple / Outlook
            </a>
        </div>
    )
}
