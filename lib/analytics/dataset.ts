/**
 * Analytics dataset: one read-only snapshot of the numbers behind the Analytics
 * dashboard, the event report PDF and the Ask Technova assistant.
 *
 * Privacy by construction: it holds NO names, emails, phone numbers, system IDs or
 * free-text answers. Students are anonymous ids with course/year/section only, and
 * feedback is reduced to numeric ratings.
 *
 * Server-only module (not 'use server', so nothing here is callable from the browser).
 * Cached for 5 minutes; it's a handful of paged SELECTs.
 */
import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { fetchAllRows } from "@/lib/supabase/fetch-all"

export type DsEvent = {
    id: string; title: string; slug: string | null; club: string | null; start_time: string; end_time: string
    status: string; is_past_event: boolean; is_virtual: boolean; capacity: number | null; event_type: string | null
    difficulty_level: string | null; price: number
}
export type DsRegistration = { event_id: string; user_id: string; attended: boolean; created_at: string; paid: boolean; pending: boolean }
export type DsStudent = { id: string; year: number | null; course: string | null; branch: string | null; section: string | null; /** Not stored in the DB (emailVerified is always empty); use first registration instead. */ joined_at: string | null; xp: number; role: string | null }
export type DsCheckin = { event_id: string; user_id: string; date: string }
export type DsRating = { event_id: string; rating: number; submitted_at: string }
export type DsFeedbackResponse = { event_id: string; submitted_at: string }
export type DsCertificate = { event_id: string; status: string; type: string | null; emailed: boolean; downloads: number; issued_at: string; position: boolean }

export type AnalyticsDataset = {
    generatedAt: string
    events: DsEvent[]
    registrations: DsRegistration[]
    students: DsStudent[]
    checkins: DsCheckin[]
    ratings: DsRating[]
    feedbackResponses: DsFeedbackResponse[]
    certificates: DsCertificate[]
}

const page = <T,>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) =>
    fetchAllRows<T>(build).then(r => {
        if (r.error) throw new Error(r.error)
        return r.data
    })

async function load(): Promise<AnalyticsDataset> {
    const sb = createAdminClient()
    const [events, clubs, regs, users, checkins, forms, questions, responses, certs] = await Promise.all([
        page<any>((f, t) => sb.from("events").select("id, title, slug, club_id, start_time, end_time, status, is_past_event, is_virtual, capacity, event_type, difficulty_level, price").order("id").range(f, t)),
        page<any>((f, t) => sb.from("clubs").select("id, name").order("id").range(f, t)),
        page<any>((f, t) => sb.from("registrations").select("id, event_id, user_id, attended, created_at, payment_status").order("id").range(f, t)),
        page<any>((f, t) => sb.schema("next_auth").from("users").select("id, year, course, branch, section, xp_points, role").order("id").range(f, t)),
        page<any>((f, t) => sb.from("daily_checkins").select("id, event_id, user_id, checkin_date").order("id").range(f, t)),
        page<any>((f, t) => sb.from("event_feedback_forms").select("id, event_id").order("id").range(f, t)),
        page<any>((f, t) => sb.from("feedback_questions").select("id, form_id, question_type").eq("question_type", "rating").order("id").range(f, t)),
        page<any>((f, t) => sb.from("feedback_responses").select("id, form_id, answers, submitted_at").order("id").range(f, t)),
        page<any>((f, t) => sb.from("certificates").select("id, event_id, status, certificate_type, email_sent_at, downloaded_count, issued_at, position_id").order("id").range(f, t)),
    ])

    const clubName = new Map(clubs.map((c: any) => [c.id, c.name as string]))
    const formEvent = new Map(forms.map((f: any) => [f.id, f.event_id as string]))
    const ratingQuestions = new Set(questions.map((q: any) => q.id as string))

    const ratings: DsRating[] = []
    const feedbackResponses: DsFeedbackResponse[] = []
    for (const r of responses) {
        const eventId = formEvent.get(r.form_id)
        if (!eventId) continue
        feedbackResponses.push({ event_id: eventId, submitted_at: r.submitted_at })
        // Only numeric ratings leave this function; text answers (which can contain names) never do.
        for (const [qid, value] of Object.entries(r.answers ?? {})) {
            const n = typeof value === "number" ? value : Number(value)
            if (ratingQuestions.has(qid) && Number.isFinite(n) && n >= 1 && n <= 5) {
                ratings.push({ event_id: eventId, rating: n, submitted_at: r.submitted_at })
            }
        }
    }

    return {
        generatedAt: new Date().toISOString(),
        events: events.map((e: any) => ({
            id: e.id, title: e.title, slug: e.slug, club: clubName.get(e.club_id) ?? null, start_time: e.start_time, end_time: e.end_time,
            status: e.status, is_past_event: !!e.is_past_event, is_virtual: !!e.is_virtual, capacity: e.capacity ?? null,
            event_type: e.event_type ?? null, difficulty_level: e.difficulty_level ?? null, price: Number(e.price) || 0,
        })),
        registrations: regs.map((r: any) => ({
            event_id: r.event_id, user_id: r.user_id, attended: !!r.attended, created_at: r.created_at,
            paid: r.payment_status === "paid" || r.payment_status === "captured", pending: r.payment_status === "pending",
        })),
        students: users.map((u: any) => ({
            id: u.id, year: u.year ?? null, course: u.course ?? null, branch: u.branch ?? null, section: u.section ?? null,
            joined_at: null, xp: u.xp_points ?? 0, role: u.role ?? null,
        })),
        checkins: checkins.map((c: any) => ({ event_id: c.event_id, user_id: c.user_id, date: String(c.checkin_date).slice(0, 10) })),
        ratings,
        feedbackResponses,
        certificates: certs.map((c: any) => ({
            event_id: c.event_id, status: c.status, type: c.certificate_type ?? null, emailed: !!c.email_sent_at,
            downloads: c.downloaded_count ?? 0, issued_at: c.issued_at, position: !!c.position_id,
        })),
    }
}

/** Uncached loader, for scripts/tests outside a Next request. */
export const loadAnalyticsDatasetUncached = load

export const getAnalyticsDataset = unstable_cache(load, ["analytics-dataset-v1"], { revalidate: 300, tags: ["analytics"] })
