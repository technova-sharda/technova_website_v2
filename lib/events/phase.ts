/** Where an event is in its life, from its status and times. Used by the admin lists and overview. */
export type EventPhase = "draft" | "cancelled" | "live" | "upcoming" | "ended"

export function eventPhase(e: { status?: string | null; is_past_event?: boolean | null; start_time: string; end_time?: string | null }, now = Date.now()): EventPhase {
    if (e.status === "draft") return "draft"
    if (e.status === "cancelled") return "cancelled"
    if (e.is_past_event || e.status === "completed") return "ended"
    const start = new Date(e.start_time).getTime()
    const end = e.end_time ? new Date(e.end_time).getTime() : start + 3 * 3_600_000
    if (now > end) return "ended"
    if (now >= start) return "live"
    return "upcoming"
}

export const PHASE_LABEL: Record<EventPhase, string> = {
    draft: "Draft", cancelled: "Cancelled", live: "Live now", upcoming: "Upcoming", ended: "Ended",
}
