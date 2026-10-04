/**
 * Cached readers for the public pages.
 *
 * These pages used to load their data in the browser after the page appeared
 * (spinner first, then a POST server-action call that nothing could cache).
 * Now the server fetches the data while rendering, through Next's data cache, so
 * the HTML arrives filled in and most visits never reach the database.
 *
 * Read-only queries only. Not a 'use server' module, so nothing here is callable
 * from the browser.
 */
import { unstable_cache } from "next/cache"
import { getPublicEvents } from "@/lib/actions/events"
import { getClubs, getClubMembersByName, getClubWithMembers } from "@/lib/actions/clubs"
import { getPastEvents } from "@/lib/actions/club-events"
import { createAdminClient } from "@/lib/supabase/server"
import { withUploadedPhotos } from "@/lib/clubs/photos"

/** Admin event changes call revalidateTag(PUBLIC_EVENTS_TAG); the timer is a backstop. */
export const PUBLIC_EVENTS_TAG = "public-events"
/** Club Management changes call revalidateTag(CLUBS_TAG); the timer is a backstop for edits made directly in Supabase. */
export const CLUBS_TAG = "clubs"

export const getCachedPublicEvents = unstable_cache(
    async () => getPublicEvents(),
    ["public-events-v1"],
    { revalidate: 60, tags: [PUBLIC_EVENTS_TAG] }
)

export const getCachedClubs = unstable_cache(
    async () => getClubs(),
    ["clubs-v1"],
    { revalidate: 300, tags: [CLUBS_TAG] }
)

export const getCachedClubMembersByName = unstable_cache(
    async (clubName: string) => withUploadedPhotos(await getClubMembersByName(clubName)),
    ["club-members-by-name-v2"],
    { revalidate: 300, tags: [CLUBS_TAG] }
)

export const getCachedClubWithMembers = unstable_cache(
    async (clubName: string) => {
        const data = await getClubWithMembers(clubName)
        return data ? { ...data, members: await withUploadedPhotos(data.members) } : null
    },
    ["club-with-members-v2"],
    { revalidate: 300, tags: [CLUBS_TAG] }
)

/** Same rows as getResources() (verified only); the admin client avoids reading cookies inside the cache. */
export const getCachedResources = unstable_cache(
    async (semester: string, subject: string) => {
        let query = createAdminClient()
            .from("resources")
            .select("*")
            .eq("is_verified", true)
            .order("created_at", { ascending: false })
        if (semester && semester !== "all") query = query.eq("semester", semester)
        if (subject) query = query.ilike("subject", `%${subject}%`)
        const { data, error } = await query
        if (error) {
            console.error("Error fetching resources:", error)
            return []
        }
        return data ?? []
    },
    ["resources-v1"],
    { revalidate: 120, tags: ["resources"] }
)

export const getCachedClubPastEvents = unstable_cache(
    async (slug: string) => getPastEvents(slug),
    ["club-past-events-v1"],
    { revalidate: 300, tags: [CLUBS_TAG, PUBLIC_EVENTS_TAG] }
)

export type SiteStats = { students: number; registrations: number; events: number; clubs: number }

/** Real numbers for the landing page (it used to show hard-coded "2500+ members"). Hourly is plenty. */
export const getCachedSiteStats = unstable_cache(
    async (): Promise<SiteStats> => {
        const supabase = createAdminClient()
        const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0
        const [students, registrations, events, clubs] = await Promise.all([
            count(supabase.schema("next_auth").from("users").select("id", { count: "exact", head: true })),
            count(supabase.from("registrations").select("id", { count: "exact", head: true })),
            count(supabase.from("events").select("id", { count: "exact", head: true }).in("status", ["live", "completed"])),
            // Real clubs only: "Technova Main" / "Technova Executives" are the society itself
            supabase.from("clubs").select("name").then(({ data }) => (data ?? []).filter(c => !/^technova/i.test(c.name)).length),
        ])
        return { students, registrations, events, clubs }
    },
    ["site-stats-v1"],
    { revalidate: 3600, tags: [PUBLIC_EVENTS_TAG] }
)
