/**
 * Shared (not per-student) part of an event page: the event row, its club, the
 * registration count and the point-of-contact details. Cached for 30 seconds and
 * cleared immediately when someone registers/cancels ("event-detail") or an admin
 * edits events ("public-events"). Per-student data (meeting link access,
 * registration, QR) is never cached here.
 */
import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"

export const EVENT_DETAIL_TAG = "event-detail"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SELECT = `*, club:clubs!events_club_id_fkey(name, logo_url)`

export const getCachedEventDetail = unstable_cache(
    async (slugOrId: string) => {
        const sb = createAdminClient()
        let { data: event } = await sb.from("events").select(SELECT).eq("slug", slugOrId).maybeSingle()
        if (!event && UUID.test(slugOrId)) {
            ({ data: event } = await sb.from("events").select(SELECT).eq("id", slugOrId).maybeSingle())
        }
        if (!event) return null

        const [{ count }, poc] = await Promise.all([
            sb.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id),
            event.poc_name && event.club_id
                ? sb.from("club_members").select("email, phone, role").eq("club_id", event.club_id).eq("name", event.poc_name).maybeSingle().then(({ data }) => data ?? null)
                : Promise.resolve(null),
        ])
        return { event, registeredCount: count || 0, poc }
    },
    ["event-detail-v1"],
    { revalidate: 30, tags: [EVENT_DETAIL_TAG, "public-events"] }
)
