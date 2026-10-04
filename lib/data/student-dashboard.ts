/**
 * Data for the student dashboard: the signed-in student's own registrations and
 * certificates. Read-only. Server-only module (not 'use server'), called from the
 * dashboard page with the session's user id.
 */
import { createAdminClient } from "@/lib/supabase/server"

export type MyEvent = {
    registrationId: string
    attended: boolean
    paymentStatus: string | null
    event: {
        id: string
        slug: string | null
        title: string
        banner: string | null
        venue: string | null
        is_virtual: boolean | null
        start_time: string
        end_time: string
        is_multi_day: boolean | null
        daily_start_time: string | null
        daily_end_time: string | null
        description: string | null
    }
    certificateId: string | null
}

export async function getMyEvents(userId: string): Promise<MyEvent[]> {
    const supabase = createAdminClient()
    const [{ data: regs, error }, { data: certs }, { data: checkins }] = await Promise.all([
        supabase
            .from("registrations")
            .select("id, attended, payment_status, event:events!inner(id, slug, title, banner, venue, is_virtual, start_time, end_time, is_multi_day, daily_start_time, daily_end_time, description)")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(200),
        supabase.from("certificates").select("event_id, certificate_id").eq("user_id", userId).eq("status", "valid"),
        supabase.from("daily_checkins").select("event_id").eq("user_id", userId).limit(1000),
    ])
    if (error) {
        console.error("[dashboard] registrations:", error.message)
        return []
    }

    const certByEvent = new Map((certs ?? []).map(c => [c.event_id, c.certificate_id as string]))
    const checkedIn = new Set((checkins ?? []).map(c => c.event_id))

    return (regs ?? []).map((r: any) => {
        const event = Array.isArray(r.event) ? r.event[0] : r.event
        return {
            registrationId: r.id,
            attended: !!r.attended || checkedIn.has(event.id),
            paymentStatus: r.payment_status,
            event,
            certificateId: certByEvent.get(event.id) ?? null,
        }
    })
}

/** Splits the student's events into upcoming (soonest first) and past (latest first), and picks open events they haven't joined. */
export function splitMyEvents(myEvents: MyEvent[], publicEvents: any[], suggestionCount = 3) {
    const now = Date.now()
    const upcoming = myEvents
        .filter(m => new Date(m.event.end_time).getTime() > now)
        .sort((a, b) => new Date(a.event.start_time).getTime() - new Date(b.event.start_time).getTime())
    const past = myEvents
        .filter(m => new Date(m.event.end_time).getTime() <= now)
        .sort((a, b) => new Date(b.event.start_time).getTime() - new Date(a.event.start_time).getTime())
    const registeredIds = new Set(myEvents.map(m => m.event.id))
    const suggestions = publicEvents
        .filter((e: any) => !e.is_past_event && e.status === "live" && new Date(e.start_time).getTime() > now && !registeredIds.has(e.id))
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, suggestionCount)
    return { upcoming, past, suggestions }
}
