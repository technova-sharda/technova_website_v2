/**
 * Who may manage which club (Club Management). Derived from club_members, so
 * no extra table is needed:
 * - Technova President, Vice President and Tech Lead (club "Technova Executives")
 *   can manage every club.
 * - A club's Lead ("Club Lead", "Lead", "Club Lead (Organizer)") can manage that
 *   club only. Co-Leads, domain heads ("Technical Head", "Editorial Lead") and
 *   coordinators can't (decided 4 Oct 2026).
 * Matching is by the email on the member row = the Google login email.
 */
import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"

export const EXECUTIVES_CLUB = "Technova Executives"
const GLOBAL_ROLES = /^(president|vice president|tech lead)$/i

/**
 * True for a club's main lead role, which grants Club Management access.
 * Not Co-Leads, and not domain leads like "Editorial Lead" or "AIML & Robotics Lead".
 */
export function isClubLeadRole(role: string | null | undefined) {
    return /^(club\s+)?lead(\s*\(.*\))?$/i.test(String(role ?? "").trim())
}

export type ClubAccess = { global: boolean; clubIds: string[] }

/**
 * Cached per email for 5 minutes, so the dashboard card and every Club
 * Management action don't add a database round trip. Any change made through
 * Club Management clears it instantly (revalidateTag("clubs")).
 */
export async function getClubAccess(email: string | null | undefined): Promise<ClubAccess> {
    if (!email) return { global: false, clubIds: [] }
    return cachedAccess(email.trim().toLowerCase())
}

const cachedAccess = unstable_cache(async (email: string): Promise<ClubAccess> => loadAccess(email), ["club-access-v1"], { revalidate: 300, tags: ["clubs"] })

async function loadAccess(email: string): Promise<ClubAccess> {
    const { data } = await createAdminClient()
        .from("club_members")
        .select("club_id, role, club:clubs!inner(name)")
        .ilike("email", email)
    const rows = (data ?? []).map((r: any) => ({ clubId: r.club_id as string, role: r.role as string, club: (Array.isArray(r.club) ? r.club[0] : r.club)?.name as string }))
    const global = rows.some(r => r.club === EXECUTIVES_CLUB && GLOBAL_ROLES.test(String(r.role).trim()))
    return { global, clubIds: Array.from(new Set(rows.filter(r => isClubLeadRole(r.role)).map(r => r.clubId))) }
}

export function canManage(access: ClubAccess, clubId: string, clubName?: string) {
    if (access.global) return true
    if (clubName === EXECUTIVES_CLUB) return false // the executive team is managed by the three executives only
    return access.clubIds.includes(clubId)
}
