'use server'

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { fetchAllRows, fetchInChunks } from "@/lib/supabase/fetch-all"
import { awardDailyXP } from "@/lib/xp"
import { istDateKey, istDaySpan, spansMultipleIstDays } from "@/lib/dates/ist"

/**
 * Bulk attendance (admin): mark many registrations as attended at once, e.g. from
 * a Google Meet / Zoom attendance export for online events.
 *
 * Each student goes through awardDailyXP, the same function the QR scanner and
 * manual check-in use, so XP and per-day check-ins behave identically and nobody
 * is awarded twice for the same day.
 */

export type RosterEntry = {
    registrationId: string
    userId: string
    name: string | null
    email: string | null
    systemId: string | null
    attended: boolean
    paymentPending: boolean
    /** IST dates (YYYY-MM-DD) this student is already checked in for. */
    checkedInDays: string[]
}

export type AttendanceRoster = {
    event: { id: string; title: string; start_time: string; end_time: string; isMultiDay: boolean }
    days: { key: string; label: string }[]
    roster: RosterEntry[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EVENT_COLUMNS = "id, title, start_time, end_time, is_multi_day, event_type, difficulty_level"

async function requireAdmin() {
    const session = await auth()
    if (!session?.user?.id || !["admin", "super_admin"].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }
    return session
}

function eventDays(event: { start_time: string; end_time: string }) {
    const first = istDateKey(event.start_time)
    const count = istDaySpan(event.start_time, event.end_time)
    return Array.from({ length: count }, (_, i) => {
        const key = istDateKey(new Date(Date.parse(`${first}T12:00:00+05:30`) + i * 86_400_000))
        const label = new Date(`${key}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })
        return { key, label: count > 1 ? `Day ${i + 1} (${label})` : label }
    })
}

export async function getAttendanceRoster(eventId: string): Promise<AttendanceRoster> {
    await requireAdmin()
    if (!UUID.test(eventId)) throw new Error("Event not found")
    const supabase = createAdminClient()

    const { data: event } = await supabase.from("events").select(EVENT_COLUMNS).eq("id", eventId).maybeSingle()
    if (!event) throw new Error("Event not found")

    const [{ data: regs, error: regError }, { data: checkins, error: checkinError }] = await Promise.all([
        fetchAllRows<any>((from, to) =>
            supabase.from("registrations").select("id, user_id, attended, payment_status")
                .eq("event_id", eventId).order("created_at").order("id").range(from, to)
        ),
        fetchAllRows<any>((from, to) =>
            supabase.from("daily_checkins").select("id, user_id, checkin_date")
                .eq("event_id", eventId).order("id").range(from, to)
        ),
    ])
    if (regError) throw new Error(regError)
    if (checkinError) throw new Error(checkinError)

    const { data: users, error: userError } = await fetchInChunks<any>(
        Array.from(new Set(regs.map(r => r.user_id))),
        chunk => supabase.schema("next_auth").from("users").select("id, name, email, system_id").in("id", chunk)
    )
    if (userError) throw new Error(userError)

    const userById = new Map(users.map(u => [u.id, u]))
    const daysByUser = new Map<string, string[]>()
    for (const c of checkins) {
        const list = daysByUser.get(c.user_id) ?? []
        list.push(String(c.checkin_date).slice(0, 10))
        daysByUser.set(c.user_id, list)
    }

    const roster: RosterEntry[] = regs.map(r => {
        const u = userById.get(r.user_id)
        return {
            registrationId: r.id,
            userId: r.user_id,
            name: u?.name ?? null,
            email: u?.email ?? null,
            systemId: u?.system_id ?? null,
            attended: !!r.attended,
            paymentPending: r.payment_status === "pending",
            checkedInDays: daysByUser.get(r.user_id) ?? [],
        }
    }).sort((a, b) => (a.name || "").localeCompare(b.name || ""))

    const isMultiDay = !!event.is_multi_day || spansMultipleIstDays(event.start_time, event.end_time)
    return {
        event: { id: event.id, title: event.title, start_time: event.start_time, end_time: event.end_time, isMultiDay },
        days: eventDays(event),
        roster,
    }
}

export type BulkAttendanceResult = { marked: number; alreadyDone: number; skipped: number; failed: { registrationId: string; reason: string }[] }

export async function markAttendanceBulk(eventId: string, registrationIds: string[], dayKey: string): Promise<BulkAttendanceResult> {
    await requireAdmin()
    if (!UUID.test(eventId)) throw new Error("Event not found")
    const ids = Array.from(new Set(registrationIds)).filter(id => UUID.test(id))
    if (ids.length === 0) return { marked: 0, alreadyDone: 0, skipped: 0, failed: [] }
    if (ids.length > 1000) throw new Error("Mark at most 1,000 students at a time")

    const supabase = createAdminClient()
    const { data: event } = await supabase.from("events").select(EVENT_COLUMNS).eq("id", eventId).maybeSingle()
    if (!event) throw new Error("Event not found")
    if (!eventDays(event).some(d => d.key === dayKey)) throw new Error("That day isn't part of this event")

    // Only registrations that really belong to this event
    const { data: regs, error } = await fetchInChunks<any>(ids, chunk =>
        supabase.from("registrations").select("id, user_id, attended, payment_status").eq("event_id", eventId).in("id", chunk)
    )
    if (error) throw new Error(error)

    const isMultiDay = !!event.is_multi_day || spansMultipleIstDays(event.start_time, event.end_time)
    const xpData = {
        event_type: event.event_type,
        difficulty_level: event.difficulty_level,
        start_time: event.start_time,
        end_time: event.end_time,
        is_multi_day: isMultiDay,
    }
    const checkinDate = new Date(`${dayKey}T12:00:00+05:30`)
    const result: BulkAttendanceResult = { marked: 0, alreadyDone: 0, skipped: ids.length - regs.length, failed: [] }

    // Small batches: each student is a handful of queries.
    for (let i = 0; i < regs.length; i += 8) {
        await Promise.all(regs.slice(i, i + 8).map(async (reg: any) => {
            if (reg.payment_status === "pending") {
                result.failed.push({ registrationId: reg.id, reason: "Payment not completed" })
                return
            }
            const xp = await awardDailyXP(reg.user_id, eventId, xpData, checkinDate)
            const already = !xp.success && /already checked in/i.test(xp.message || "")
            // Same as the scanner: an event without XP settings still records attendance, just no XP.
            const noXpSettings = !xp.success && /missing required fields/i.test(xp.message || "")
            if (!xp.success && !already && !noXpSettings) {
                result.failed.push({ registrationId: reg.id, reason: xp.message || "Could not record check-in" })
                return
            }
            if (!reg.attended) {
                const { error: updateError } = await supabase.from("registrations").update({ attended: true }).eq("id", reg.id)
                if (updateError) {
                    result.failed.push({ registrationId: reg.id, reason: updateError.message })
                    return
                }
            }
            if (already) result.alreadyDone++
            else result.marked++
        }))
    }

    revalidatePath(`/admin/events/${eventId}`)
    revalidatePath(`/admin/events/${eventId}/attendance`)
    return result
}
