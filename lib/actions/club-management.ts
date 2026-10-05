'use server'

import { revalidatePath, revalidateTag } from "next/cache"
import sharp from "sharp"
import { auth } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { canManage, getClubAccess, isClubLeadRole, type ClubAccess } from "@/lib/clubs/permissions"
import { CLUB_LOGO_DIR, CLUB_MEDIA_BUCKET, MEMBER_PHOTO_DIR, withUploadedPhotos } from "@/lib/clubs/photos"
import { getMemberPhotoPath } from "@/lib/constants/team-photos"

/**
 * Club Management: club leads edit their own club; Technova's President, Vice
 * President and Tech Lead edit every club. Every action re-checks access here
 * (server actions are callable from the browser).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export type ManagedClub = { id: string; name: string; logo_url: string | null; memberCount: number }
export type ManagedMember = {
    id: string; name: string; role: string | null; email: string | null; phone: string | null; linkedin_id: string | null
    photo_url: string | null; fallback_photo: string | null; isLead: boolean
}
export type ClubDetail = {
    club: { id: string; name: string; description: string | null; logo_url: string | null; linkedin_url: string | null; instagram_url: string | null; contact_email: string | null }
    members: ManagedMember[]
    canEditLeads: boolean
}
type Result = { success: true } | { error: string }

async function session() {
    const s = await auth()
    if (!s?.user?.email) throw new Error("Please sign in")
    return { s, access: await getClubAccess(s.user.email) }
}

async function requireClub(clubId: string): Promise<{ access: ClubAccess; clubName: string }> {
    if (!UUID.test(clubId)) throw new Error("Club not found")
    const { access } = await session()
    const { data: club } = await createAdminClient().from("clubs").select("id, name").eq("id", clubId).maybeSingle()
    if (!club || !canManage(access, club.id, club.name)) throw new Error("You can't manage this club")
    return { access, clubName: club.name }
}

async function requireMember(memberId: string) {
    if (!UUID.test(memberId)) throw new Error("Member not found")
    const { data: member } = await createAdminClient().from("club_members").select("id, club_id, role, email").eq("id", memberId).maybeSingle()
    if (!member) throw new Error("Member not found")
    const { access } = await requireClub(member.club_id)
    return { member, access }
}

function refresh() {
    revalidateTag("clubs", { expire: 0 })
    revalidatePath("/leadership")
    revalidatePath("/clubs")
}

const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "") || null
const validUrl = (v: string | null) => (!v || /^https?:\/\//i.test(v) ? v : `https://${v}`)

export async function getManageableClubs(): Promise<ManagedClub[]> {
    const { access } = await session()
    const sb = createAdminClient()
    const { data: clubs } = await sb.from("clubs").select("id, name, logo_url").order("name")
    const { data: counts } = await sb.from("club_members").select("club_id")
    const count = (id: string) => (counts ?? []).filter(c => c.club_id === id).length
    return (clubs ?? [])
        .filter(c => c.name !== "Technova Main" && canManage(access, c.id, c.name))
        .map(c => ({ id: c.id, name: c.name, logo_url: c.logo_url, memberCount: count(c.id) }))
}

export async function getClubForManagement(clubId: string): Promise<ClubDetail> {
    const { access } = await requireClub(clubId)
    const sb = createAdminClient()
    const [{ data: club }, { data: members }] = await Promise.all([
        sb.from("clubs").select("id, name, description, logo_url, linkedin_url, instagram_url, contact_email").eq("id", clubId).single(),
        sb.from("club_members").select("id, name, role, email, phone, linkedin_id").eq("club_id", clubId).order("created_at"),
    ])
    const withPhotos = await withUploadedPhotos(members ?? [])
    return {
        club: club!,
        members: withPhotos.map(m => ({ ...m, fallback_photo: getMemberPhotoPath(m.name) ?? null, isLead: isClubLeadRole(m.role) })),
        canEditLeads: access.global,
    }
}

export async function updateClubDetails(clubId: string, input: { description?: string; linkedin_url?: string; instagram_url?: string; contact_email?: string }): Promise<Result> {
    try {
        await requireClub(clubId)
        const { error } = await createAdminClient().from("clubs").update({
            description: clean(input.description, 2000),
            linkedin_url: validUrl(clean(input.linkedin_url, 300)),
            instagram_url: validUrl(clean(input.instagram_url, 300)),
            contact_email: clean(input.contact_email, 200),
        }).eq("id", clubId)
        if (error) return { error: error.message }
        refresh()
        return { success: true }
    } catch (e: any) { return { error: e.message } }
}

async function toWebp(file: File, size: number, square: boolean) {
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose an image")
    if (file.size > MAX_IMAGE_BYTES) throw new Error("Image is larger than 8 MB")
    const input = Buffer.from(await file.arrayBuffer())
    try {
        return await sharp(input, { failOn: "none" }).rotate()
            .resize(square ? { width: size, height: size, fit: "cover", position: "attention" } : { width: size, height: size, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 84 }).toBuffer()
    } catch {
        // e.g. HEIC/HEIF photos from phone cameras, which sharp can't decode
        throw new Error("This photo format isn't supported. Please upload a JPG, PNG or WebP image.")
    }
}

export async function uploadClubLogo(clubId: string, formData: FormData): Promise<Result & { url?: string }> {
    try {
        await requireClub(clubId)
        const body = await toWebp(formData.get("file") as File, 512, false)
        const sb = createAdminClient()
        const path = `${CLUB_LOGO_DIR}/${clubId}__${Date.now()}.webp`
        const { error } = await sb.storage.from(CLUB_MEDIA_BUCKET).upload(path, body, { contentType: "image/webp", cacheControl: "31536000", upsert: false })
        if (error) return { error: error.message }
        const url = sb.storage.from(CLUB_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
        const { error: dbError } = await sb.from("clubs").update({ logo_url: url }).eq("id", clubId)
        if (dbError) return { error: dbError.message }
        refresh()
        return { success: true, url }
    } catch (e: any) { return { error: e.message } }
}

export async function uploadMemberPhoto(memberId: string, formData: FormData): Promise<Result & { url?: string }> {
    try {
        await requireMember(memberId)
        const body = await toWebp(formData.get("file") as File, 640, true)
        const sb = createAdminClient()
        const path = `${MEMBER_PHOTO_DIR}/${memberId}__${Date.now()}.webp`
        const { error } = await sb.storage.from(CLUB_MEDIA_BUCKET).upload(path, body, { contentType: "image/webp", cacheControl: "31536000", upsert: false })
        if (error) return { error: error.message }
        refresh()
        return { success: true, url: sb.storage.from(CLUB_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl }
    } catch (e: any) { return { error: e.message } }
}

type MemberInput = { name?: string; role?: string; email?: string; phone?: string; linkedin_id?: string }

export async function addMember(clubId: string, input: MemberInput): Promise<Result> {
    try {
        const { access } = await requireClub(clubId)
        const name = clean(input.name, 120)
        if (!name) return { error: "Name is required" }
        const role = clean(input.role, 80) || "Core Team"
        if (isClubLeadRole(role) && !access.global) return { error: "Only the President, Vice President or Tech Lead can add a Club Lead." }
        const { error } = await createAdminClient().from("club_members").insert({
            club_id: clubId, name, role, email: clean(input.email, 200)?.toLowerCase() ?? null, phone: clean(input.phone, 30), linkedin_id: clean(input.linkedin_id, 300),
        })
        if (error) return { error: error.message }
        refresh()
        return { success: true }
    } catch (e: any) { return { error: e.message } }
}

export async function updateMember(memberId: string, input: MemberInput): Promise<Result> {
    try {
        const { member, access } = await requireMember(memberId)
        const name = clean(input.name, 120)
        if (!name) return { error: "Name is required" }
        const role = clean(input.role, 80) || "Core Team"
        const email = clean(input.email, 200)?.toLowerCase() ?? null
        if (!access.global) {
            // Lead access comes from role + email, so only the executives may change who holds it
            if (isClubLeadRole(role) !== isClubLeadRole(member.role)) return { error: "Only the President, Vice President or Tech Lead can assign or remove the Club Lead role." }
            if (isClubLeadRole(member.role) && (email ?? "") !== (member.email ?? "").toLowerCase()) return { error: "Only the President, Vice President or Tech Lead can change a Club Lead's email." }
        }
        const { error } = await createAdminClient().from("club_members").update({
            name, role, email, phone: clean(input.phone, 30), linkedin_id: clean(input.linkedin_id, 300),
        }).eq("id", memberId)
        if (error) return { error: error.message }
        refresh()
        return { success: true }
    } catch (e: any) { return { error: e.message } }
}

export async function removeMember(memberId: string): Promise<Result> {
    try {
        const { member, access } = await requireMember(memberId)
        if (isClubLeadRole(member.role) && !access.global) return { error: "Only the President, Vice President or Tech Lead can remove a Club Lead." }
        const { error } = await createAdminClient().from("club_members").delete().eq("id", memberId)
        if (error) return { error: error.message }
        refresh()
        return { success: true }
    } catch (e: any) { return { error: e.message } }
}
