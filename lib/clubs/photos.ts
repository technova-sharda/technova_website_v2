/**
 * Coordinator photos and club logos uploaded through Club Management.
 * Stored in the public "events" storage bucket under clubs/ (no new table):
 *   clubs/members/<memberId>__<timestamp>.webp   (latest one wins)
 *   clubs/logos/<clubId>__<timestamp>.webp        (URL saved in clubs.logo_url)
 * Old files are never deleted.
 */
import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"

export const CLUB_MEDIA_BUCKET = "events"
export const MEMBER_PHOTO_DIR = "clubs/members"
export const CLUB_LOGO_DIR = "clubs/logos"

async function listMemberPhotos(): Promise<Record<string, string>> {
    const sb = createAdminClient()
    const { data, error } = await sb.storage.from(CLUB_MEDIA_BUCKET).list(MEMBER_PHOTO_DIR, { limit: 1000, sortBy: { column: "name", order: "asc" } })
    if (error || !data) return {}
    const latest: Record<string, string> = {}
    for (const f of data) {
        const [memberId, stamp] = f.name.split("__")
        if (!memberId || !stamp) continue
        if (!latest[memberId] || f.name > latest[memberId]) latest[memberId] = f.name
    }
    const out: Record<string, string> = {}
    for (const [memberId, name] of Object.entries(latest)) {
        out[memberId] = sb.storage.from(CLUB_MEDIA_BUCKET).getPublicUrl(`${MEMBER_PHOTO_DIR}/${name}`).data.publicUrl
    }
    return out
}

/** memberId → uploaded photo URL. Cached; cleared by revalidateTag("clubs") on every upload. */
export const getUploadedMemberPhotos = unstable_cache(listMemberPhotos, ["club-member-photos-v1"], { revalidate: 300, tags: ["clubs"] })

/** Adds photo_url (uploaded photo, if any) to member rows. */
export async function withUploadedPhotos<T extends { id: string }>(members: T[]): Promise<(T & { photo_url: string | null })[]> {
    const photos = await getUploadedMemberPhotos().catch(() => ({} as Record<string, string>))
    return members.map(m => ({ ...m, photo_url: photos[m.id] ?? null }))
}
