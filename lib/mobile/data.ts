/**
 * Data for the phone app. Small, app-shaped JSON; no other students' emails or
 * phone numbers. Server-only.
 */
import { createAdminClient } from "@/lib/supabase/server"
import { fetchAllRows } from "@/lib/supabase/fetch-all"
import { eventPhase, type EventPhase } from "@/lib/events/phase"
import { CLUB_LOGO_FILES } from "@/lib/constants/club-slugs"
import { siteUrl } from "./api"

export type AppEvent = {
    id: string; slug: string | null; title: string; banner: string | null
    club: { name: string; logo: string | null } | null
    start: string; end: string | null; venue: string | null; isVirtual: boolean
    phase: EventPhase; capacity: number | null; registered: number; price: number
    registrationsClosed: boolean; webUrl: string
    my: { status: "registered" | "payment_pending" | null; attended: boolean }
}

const EVENT_COLS = "id, slug, title, banner, start_time, end_time, venue, is_virtual, status, is_past_event, capacity, price, registrations_closed, club:clubs!events_club_id_fkey(name, logo_url)"

/** The app can't load site-relative paths, so every image URL is made absolute. */
const absolute = (url: string | null | undefined) => (!url ? null : url.startsWith("/") ? `${siteUrl()}${encodeURI(url)}` : url)

function logoFor(club: { name?: string; logo_url?: string | null } | null) {
    if (!club?.name) return null
    return absolute(club.logo_url || CLUB_LOGO_FILES[club.name])
}

function shape(e: any, counts: Map<string, number>, mine: Map<string, { status: string; attended: boolean }>, now: number): AppEvent {
    const club = Array.isArray(e.club) ? e.club[0] : e.club
    const m = mine.get(e.id)
    return {
        id: e.id, slug: e.slug, title: e.title, banner: absolute(e.banner),
        club: club?.name ? { name: club.name, logo: logoFor(club) } : null,
        start: e.start_time, end: e.end_time, venue: e.venue, isVirtual: !!e.is_virtual,
        phase: eventPhase(e, now), capacity: e.capacity ?? null, registered: counts.get(e.id) ?? 0, price: Number(e.price) || 0,
        registrationsClosed: !!e.registrations_closed, webUrl: `${siteUrl()}/events/${e.slug || e.id}`,
        my: { status: m ? (m.status === "pending" ? "payment_pending" : "registered") : null, attended: !!m?.attended },
    }
}

async function countsAndMine(eventIds: string[], userId: string) {
    const sb = createAdminClient()
    const [regs, mine] = await Promise.all([
        eventIds.length
            ? fetchAllRows<{ event_id: string }>((f, t) => sb.from("registrations").select("id, event_id").in("event_id", eventIds).order("id").range(f, t))
            : Promise.resolve({ data: [] as { event_id: string }[], error: null }),
        sb.from("registrations").select("event_id, payment_status, attended").eq("user_id", userId),
    ])
    const counts = new Map<string, number>()
    for (const r of regs.data) counts.set(r.event_id, (counts.get(r.event_id) ?? 0) + 1)
    const my = new Map((mine.data ?? []).map((r: any) => [r.event_id as string, { status: r.payment_status as string, attended: !!r.attended }]))
    return { counts, my }
}

export async function listEvents(userId: string, scope: "upcoming" | "past", query = "") {
    const sb = createAdminClient()
    const now = Date.now()
    let q = sb.from("events").select(EVENT_COLS).in("status", ["live", "completed"])
    q = scope === "upcoming"
        ? q.eq("is_past_event", false).gte("end_time", new Date(now).toISOString()).order("start_time", { ascending: true }).limit(40)
        : q.lt("end_time", new Date(now).toISOString()).order("start_time", { ascending: false }).limit(40)
    if (query.trim()) q = q.ilike("title", `%${query.trim().replace(/[%_,()]/g, " ")}%`)
    const { data } = await q
    const events = data ?? []
    const { counts, my } = await countsAndMine(events.map((e: any) => e.id), userId)
    return events.map((e: any) => shape(e, counts, my, now))
}

export async function eventDetail(userId: string, idOrSlug: string) {
    const sb = createAdminClient()
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug)
    const { data: e } = await sb.from("events")
        .select(`${EVENT_COLS}, description, meeting_link, registration_fields, poc_name, is_multi_day, feedback_enabled, certificates_released`)
        .eq(isUuid ? "id" : "slug", idOrSlug).maybeSingle()
    if (!e) return null
    const [{ counts, my }, { data: reg }, { data: cert }] = await Promise.all([
        countsAndMine([e.id], userId),
        sb.from("registrations").select("id, qr_token_id, payment_status, attended").eq("event_id", e.id).eq("user_id", userId).maybeSingle(),
        sb.from("certificates").select("certificate_id").eq("event_id", e.id).eq("user_id", userId).eq("status", "valid").maybeSingle(),
    ])
    const base = shape(e, counts, my, Date.now())
    const fields = Array.isArray(e.registration_fields) ? e.registration_fields : []
    return {
        ...base,
        description: e.description ?? "",
        poc: e.poc_name ?? null,
        isMultiDay: !!e.is_multi_day,
        // The app registers natively only for free events without extra questions
        canRegisterInApp: base.price === 0 && fields.length === 0,
        meetingLink: reg && e.is_virtual ? e.meeting_link ?? null : null,
        ticket: reg && reg.payment_status !== "pending" && reg.qr_token_id && !e.is_virtual ? await ticketPayload(userId, e.id, reg.qr_token_id) : null,
        certificateId: cert?.certificate_id ?? null,
    }
}

/** Same JSON the emailed QR code holds, so the scanner accepts it. */
export async function ticketPayload(userId: string, eventId: string, token: string) {
    const { data: u } = await createAdminClient().schema("next_auth").from("users").select("name, system_id, year, course, section, email").eq("id", userId).maybeSingle()
    return JSON.stringify({ t: token, u: userId, e: eventId, n: u?.name ?? "", sid: u?.system_id ?? "", y: u?.year?.toString() ?? "", c: u?.course ?? "", s: u?.section ?? "", em: u?.email ?? "", d: new Date().toISOString() })
}

export async function myTickets(userId: string) {
    const sb = createAdminClient()
    const { data } = await sb.from("registrations")
        .select(`id, qr_token_id, payment_status, attended, event:events!inner(${EVENT_COLS}, meeting_link)`)
        .eq("user_id", userId)
    const now = Date.now()
    const rows = (data ?? []).map((r: any) => ({ r, e: Array.isArray(r.event) ? r.event[0] : r.event }))
        .filter(({ e }) => e && eventPhase(e, now) !== "ended" && e.status !== "draft")
        .sort((a, b) => a.e.start_time.localeCompare(b.e.start_time))
    const { counts, my } = await countsAndMine(rows.map(x => x.e.id), userId)
    return Promise.all(rows.map(async ({ r, e }) => ({
        event: shape(e, counts, my, now),
        paymentPending: r.payment_status === "pending",
        attended: !!r.attended,
        qr: r.payment_status !== "pending" && r.qr_token_id && !e.is_virtual ? await ticketPayload(userId, e.id, r.qr_token_id) : null,
        meetingLink: e.is_virtual ? e.meeting_link ?? null : null,
    })))
}

export async function myCertificates(userId: string) {
    const { data } = await createAdminClient().from("certificates")
        .select("certificate_id, certificate_type, issued_at, event:events!inner(id, title, start_time, club:clubs!events_club_id_fkey(name))")
        .eq("user_id", userId).eq("status", "valid").order("issued_at", { ascending: false })
    return (data ?? []).map((c: any) => {
        const e = Array.isArray(c.event) ? c.event[0] : c.event
        const club = Array.isArray(e?.club) ? e.club[0] : e?.club
        return {
            id: c.certificate_id, type: c.certificate_type ?? "participation", issuedAt: c.issued_at,
            event: { id: e?.id, title: e?.title, date: e?.start_time, club: club?.name ?? null },
            verifyUrl: `${siteUrl()}/verify/${c.certificate_id}`,
            downloadPath: `/api/certificate?id=${encodeURIComponent(c.certificate_id)}`,
        }
    })
}
