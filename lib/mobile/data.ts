/**
 * Data for the phone app. Small, app-shaped JSON. Shared lists (events, clubs,
 * team) are cached for a minute and refreshed the moment something changes
 * (same cache tags as the website); only the per-student part is read live.
 * Server-only.
 */
import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { fetchAllRows } from "@/lib/supabase/fetch-all"
import { eventPhase, type EventPhase } from "@/lib/events/phase"
import { CLUB_LOGO_FILES } from "@/lib/constants/club-slugs"
import { getMemberPhotoPath } from "@/lib/constants/team-photos"
import { MENTORS, TEAM_IMAGE_OVERRIDES, applyPinnedPositions } from "@/lib/constants/leadership"
import { CLUBS_TAG, PUBLIC_EVENTS_TAG, getCachedClubMembersByName, getCachedClubWithMembers } from "@/lib/data/public-cache"
import { siteUrl } from "./api"

/** Technova's official inbox (same as the website footer). */
const TECHNOVA_EMAIL = "technova@sharda.ac.in"

export type AppEvent = {
    id: string; slug: string | null; title: string; banner: string | null
    club: { name: string; logo: string | null } | null
    start: string; end: string | null; venue: string | null; isVirtual: boolean
    phase: EventPhase; capacity: number | null; registered: number; price: number
    registrationsClosed: boolean; webUrl: string
    my: { status: "registered" | "payment_pending" | null; attended: boolean }
}

const EVENT_COLS = "id, slug, title, banner, start_time, end_time, venue, is_virtual, status, is_past_event, capacity, price, registrations_closed, club_id, co_host_club_id, club:clubs!events_club_id_fkey(name, logo_url)"
const EVENT_TAGS = [PUBLIC_EVENTS_TAG, "event-detail"]

/** The app can't load site-relative paths, so every image URL is made absolute. */
const absolute = (url: string | null | undefined) => (!url ? null : url.startsWith("/") ? `${siteUrl()}${encodeURI(url)}` : url)

function logoFor(club: { name?: string; logo_url?: string | null } | null) {
    if (!club?.name) return null
    return absolute(club.logo_url || CLUB_LOGO_FILES[club.name])
}

type Mine = Map<string, { status: string; attended: boolean }>

function shape(e: any, counts: Record<string, number>, mine: Mine, now: number): AppEvent {
    const club = Array.isArray(e.club) ? e.club[0] : e.club
    const m = mine.get(e.id)
    return {
        id: e.id, slug: e.slug, title: e.title, banner: absolute(e.banner),
        club: club?.name ? { name: club.name, logo: logoFor(club) } : null,
        start: e.start_time, end: e.end_time, venue: e.venue, isVirtual: !!e.is_virtual,
        phase: eventPhase(e, now), capacity: e.capacity ?? null, registered: counts[e.id] ?? 0, price: Number(e.price) || 0,
        registrationsClosed: !!e.registrations_closed, webUrl: `${siteUrl()}/events/${e.slug || e.id}`,
        my: { status: m ? (m.status === "pending" ? "payment_pending" : "registered") : null, attended: !!m?.attended },
    }
}

/** Registrations per event (shared, cached). */
async function countsFor(eventIds: string[]) {
    const counts: Record<string, number> = {}
    if (!eventIds.length) return counts
    const sb = createAdminClient()
    const { data } = await fetchAllRows<{ event_id: string }>((f, t) => sb.from("registrations").select("id, event_id").in("event_id", eventIds).order("id").range(f, t))
    for (const r of data) counts[r.event_id] = (counts[r.event_id] ?? 0) + 1
    return counts
}

/** This student's registrations (always live). */
async function mineFor(userId: string): Promise<Mine> {
    const { data } = await createAdminClient().from("registrations").select("event_id, payment_status, attended").eq("user_id", userId)
    return new Map((data ?? []).map((r: any) => [r.event_id as string, { status: r.payment_status as string, attended: !!r.attended }]))
}

const cachedEventList = unstable_cache(async (scope: "upcoming" | "past", query: string, nowBucket: number) => {
    const sb = createAdminClient()
    const now = new Date(nowBucket).toISOString()
    let q = sb.from("events").select(EVENT_COLS).in("status", ["live", "completed"])
    q = scope === "upcoming"
        ? q.eq("is_past_event", false).gte("end_time", now).order("start_time", { ascending: true }).limit(40)
        : q.lt("end_time", now).order("start_time", { ascending: false }).limit(40)
    if (query.trim()) q = q.ilike("title", `%${query.trim().replace(/[%_,()]/g, " ")}%`)
    const { data } = await q
    const events = data ?? []
    return { events, counts: await countsFor(events.map((e: any) => e.id)) }
}, ["mobile-event-list-v1"], { revalidate: 60, tags: EVENT_TAGS })

export async function listEvents(userId: string, scope: "upcoming" | "past", query = "") {
    const now = Date.now()
    const [{ events, counts }, mine] = await Promise.all([cachedEventList(scope, query, Math.floor(now / 60_000) * 60_000), mineFor(userId)])
    return events.map((e: any) => shape(e, counts, mine, now))
}

export async function eventDetail(userId: string, idOrSlug: string) {
    const sb = createAdminClient()
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug)
    const { data: e } = await sb.from("events")
        .select(`${EVENT_COLS}, description, meeting_link, registration_fields, poc_name, is_multi_day, feedback_enabled, certificates_released`)
        .eq(isUuid ? "id" : "slug", idOrSlug).maybeSingle()
    if (!e) return null
    const [counts, mine, { data: reg }, { data: cert }] = await Promise.all([
        countsFor([e.id]),
        mineFor(userId),
        sb.from("registrations").select("id, qr_token_id, payment_status, attended").eq("event_id", e.id).eq("user_id", userId).maybeSingle(),
        sb.from("certificates").select("certificate_id").eq("event_id", e.id).eq("user_id", userId).eq("status", "valid").maybeSingle(),
    ])
    const base = shape(e, counts, mine, Date.now())
    const fields = Array.isArray(e.registration_fields) ? e.registration_fields : []
    const user = reg?.qr_token_id ? await ticketUser(userId) : null
    return {
        ...base,
        description: e.description ?? "",
        poc: e.poc_name ?? null,
        isMultiDay: !!e.is_multi_day,
        // The app registers natively only for free events without extra questions
        canRegisterInApp: base.price === 0 && fields.length === 0,
        meetingLink: reg && e.is_virtual ? e.meeting_link ?? null : null,
        ticket: reg && user && reg.payment_status !== "pending" && !e.is_virtual ? ticketPayload(user, userId, e.id, reg.qr_token_id!) : null,
        certificateId: cert?.certificate_id ?? null,
    }
}

type TicketUser = { name: string | null; system_id: string | null; year: number | null; course: string | null; section: string | null; email: string | null }
async function ticketUser(userId: string): Promise<TicketUser | null> {
    const { data } = await createAdminClient().schema("next_auth").from("users").select("name, system_id, year, course, section, email").eq("id", userId).maybeSingle()
    return data as TicketUser | null
}

/** Same JSON the emailed QR code holds, so the scanner accepts it. */
function ticketPayload(u: TicketUser, userId: string, eventId: string, token: string) {
    return JSON.stringify({ t: token, u: userId, e: eventId, n: u.name ?? "", sid: u.system_id ?? "", y: u.year?.toString() ?? "", c: u.course ?? "", s: u.section ?? "", em: u.email ?? "", d: new Date().toISOString() })
}

export async function myTickets(userId: string) {
    const sb = createAdminClient()
    const [{ data }, user] = await Promise.all([
        sb.from("registrations").select(`id, qr_token_id, payment_status, attended, event:events!inner(${EVENT_COLS}, meeting_link)`).eq("user_id", userId),
        ticketUser(userId),
    ])
    const now = Date.now()
    const rows = (data ?? []).map((r: any) => ({ r, e: Array.isArray(r.event) ? r.event[0] : r.event }))
        .filter(({ e }) => e && eventPhase(e, now) !== "ended" && e.status !== "draft")
        .sort((a, b) => a.e.start_time.localeCompare(b.e.start_time))
    const counts = await countsFor(rows.map(x => x.e.id))
    const mine: Mine = new Map(rows.map(({ r, e }) => [e.id, { status: r.payment_status, attended: !!r.attended }]))
    return rows.map(({ r, e }) => ({
        event: shape(e, counts, mine, now),
        paymentPending: r.payment_status === "pending",
        attended: !!r.attended,
        qr: r.payment_status !== "pending" && r.qr_token_id && !e.is_virtual && user ? ticketPayload(user, userId, e.id, r.qr_token_id) : null,
        meetingLink: e.is_virtual ? e.meeting_link ?? null : null,
    }))
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

// ── Clubs and team ──

type Person = { id: string; name: string; role: string | null; photo: string | null; email: string | null; phone: string | null; linkedin: string | null }
const person = (m: any): Person => ({
    id: m.id, name: m.name, role: m.role ?? null,
    photo: absolute(m.photo_url || TEAM_IMAGE_OVERRIDES[m.name] || getMemberPhotoPath(m.name) || null),
    email: m.email ?? null, phone: m.phone ?? null,
    linkedin: m.linkedin_id ? (/^https?:\/\//.test(m.linkedin_id) ? m.linkedin_id : `https://${m.linkedin_id}`) : null,
})

const cachedClubs = unstable_cache(async () => {
    const sb = createAdminClient()
    const [{ data: clubs }, { data: members }, { data: events }] = await Promise.all([
        sb.from("clubs").select("id, name, description, logo_url").order("name"),
        sb.from("club_members").select("club_id"),
        sb.from("events").select("club_id, end_time, status").in("status", ["live", "completed"]),
    ])
    const now = new Date().toISOString()
    return (clubs ?? []).filter(c => !/^technova/i.test(c.name)).map(c => ({
        id: c.id, name: c.name, description: c.description ?? "", logo: logoFor(c),
        members: (members ?? []).filter(m => m.club_id === c.id).length,
        upcoming: (events ?? []).filter(e => e.club_id === c.id && e.end_time >= now).length,
        totalEvents: (events ?? []).filter(e => e.club_id === c.id).length,
    }))
}, ["mobile-clubs-v1"], { revalidate: 300, tags: [CLUBS_TAG, PUBLIC_EVENTS_TAG] })

export const listClubs = () => cachedClubs()

export async function clubDetail(userId: string, id: string) {
    const sb = createAdminClient()
    const { data: c } = await sb.from("clubs").select("id, name").eq("id", id).maybeSingle()
    if (!c) return null
    const [full, { data: evs }, mine] = await Promise.all([
        getCachedClubWithMembers(c.name),
        sb.from("events").select(EVENT_COLS).or(`club_id.eq.${c.id},co_host_club_id.eq.${c.id}`).in("status", ["live", "completed"]).order("start_time", { ascending: false }).limit(40),
        mineFor(userId),
    ])
    if (!full) return null
    const now = Date.now()
    const counts = await countsFor((evs ?? []).map((e: any) => e.id))
    const events = (evs ?? []).map((e: any) => shape(e, counts, mine, now))
    const club = (full as { club: any }).club ?? {}
    const link = (u: string | null | undefined) => (!u ? null : /^https?:\/\//.test(u) ? u : `https://${u}`)
    return {
        id: c.id, name: c.name, description: club.description ?? "", logo: logoFor(club),
        links: { linkedin: link(club.linkedin_url), instagram: link(club.instagram_url), email: club.contact_email ?? null, web: `${siteUrl()}/clubs` },
        members: ((full as { members: any[] }).members ?? []).map(person),
        upcoming: events.filter(e => e.phase !== "ended").sort((a, b) => a.start.localeCompare(b.start)),
        past: events.filter(e => e.phase === "ended"),
    }
}

export async function team() {
    const executives = applyPinnedPositions(await getCachedClubMembersByName("Technova Executives") as any[])
    return {
        mentors: MENTORS.map(m => ({ name: m.name, role: m.role, quote: (m as { quote?: string }).quote ?? null, photo: absolute(m.imagePath) })),
        executives: executives.map(person),
        contact: { email: TECHNOVA_EMAIL, reportUrl: `${siteUrl()}/report-bug`, website: siteUrl() },
    }
}
