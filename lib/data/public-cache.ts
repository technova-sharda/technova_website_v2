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

/** Admin event changes call revalidateTag(PUBLIC_EVENTS_TAG); the timer is a backstop. */
export const PUBLIC_EVENTS_TAG = "public-events"
/** Club and member rows are edited in Supabase directly, so only the timer refreshes them. */
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
    async (clubName: string) => getClubMembersByName(clubName),
    ["club-members-by-name-v1"],
    { revalidate: 300, tags: [CLUBS_TAG] }
)

export const getCachedClubWithMembers = unstable_cache(
    async (clubName: string) => getClubWithMembers(clubName),
    ["club-with-members-v1"],
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
