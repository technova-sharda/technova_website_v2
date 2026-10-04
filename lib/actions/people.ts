'use server'

import { auth } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/server"

/**
 * People search for the admin panel: look up any student and see their events,
 * attendance, certificates and XP. Read-only. The admin panel is super-admin only,
 * and every action here checks that again.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PersonSummary = {
    id: string
    name: string | null
    email: string | null
    image: string | null
    system_id: string | null
    year: number | null
    course: string | null
    section: string | null
    role: string | null
    xp_points: number | null
}

export type PersonDetail = PersonSummary & {
    mobile: string | null
    registrations: { id: string; created_at: string; attended: boolean; payment_status: string | null; event: { id: string; slug: string | null; title: string; start_time: string } }[]
    checkinDays: { event_id: string; checkin_date: string; xp_awarded: number }[]
    certificates: { certificate_id: string; event_id: string; status: string; issued_at: string; role_title: string | null }[]
    xpAwards: { event_id: string; xp_amount: number; awarded_at: string }[]
}

async function requireSuperAdmin() {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "super_admin") throw new Error("Unauthorized")
}

const SUMMARY = "id, name, email, image, system_id, year, course, section, role, xp_points"

export async function searchPeople(query: string): Promise<PersonSummary[]> {
    await requireSuperAdmin()
    const q = query.replace(/[%_,()*\\]/g, " ").trim().slice(0, 80)
    if (q.length < 2) return []
    const { data, error } = await createAdminClient()
        .schema("next_auth")
        .from("users")
        .select(SUMMARY)
        .or(`name.ilike.%${q}%,email.ilike.%${q}%,system_id.ilike.%${q}%`)
        .order("name", { ascending: true })
        .limit(25)
    if (error) throw new Error(error.message)
    return data ?? []
}

export async function getPerson(userId: string): Promise<PersonDetail | null> {
    await requireSuperAdmin()
    if (!UUID.test(userId)) return null
    const supabase = createAdminClient()

    const [{ data: user }, { data: registrations }, { data: checkinDays }, { data: certificates }, { data: xpAwards }] = await Promise.all([
        supabase.schema("next_auth").from("users").select(`${SUMMARY}, mobile`).eq("id", userId).maybeSingle(),
        supabase.from("registrations")
            .select("id, created_at, attended, payment_status, event:events!inner(id, slug, title, start_time)")
            .eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
        supabase.from("daily_checkins").select("event_id, checkin_date, xp_awarded").eq("user_id", userId).order("checkin_date").limit(1000),
        supabase.from("certificates").select("certificate_id, event_id, status, issued_at, role_title").eq("user_id", userId).order("issued_at", { ascending: false }).limit(200),
        supabase.from("xp_awards").select("event_id, xp_amount, awarded_at").eq("user_id", userId).order("awarded_at", { ascending: false }).limit(500),
    ])
    if (!user) return null

    return {
        ...user,
        registrations: (registrations ?? []).map((r: any) => ({ ...r, event: Array.isArray(r.event) ? r.event[0] : r.event })),
        checkinDays: checkinDays ?? [],
        certificates: certificates ?? [],
        xpAwards: xpAwards ?? [],
    }
}
