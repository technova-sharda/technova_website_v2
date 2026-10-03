'use server'

import { createClient as createServerClient } from "@supabase/supabase-js"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import type { CertificateTemplate, Certificate, CertificateType, CertificatePosition, QRRegion, TextRegion } from "@/types/custom"
import { getSignedCertificateUrl } from "@/lib/certificates/storage"
import { Resend, type CreateEmailOptions } from 'resend'
import { sendEmailBatch } from "@/lib/email/send"
import { fetchInChunks } from "@/lib/supabase/fetch-all"
import { render } from '@react-email/render'
import CertificateNotificationEmail from "@/emails/certificate-notification"
import { formatDateShort } from "@/lib/utils"

const resend = new Resend(process.env.RESEND_API_KEY)

// Helper to get authenticated client
async function getSupabase() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// ==========================================
// Template Management (Admin)
// ==========================================

export async function createCertificateTemplate(
    eventId: string,
    templateUrl: string,
    qrRegion: QRRegion,
    textRegions: TextRegion[]
) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    // Check if template already exists for this event
    const { data: existing } = await supabase
        .from('certificate_templates')
        .select('id')
        .eq('event_id', eventId)
        .single()

    if (existing) {
        // Update existing template
        const { data, error } = await supabase
            .from('certificate_templates')
            .update({
                template_url: templateUrl,
                qr_region: qrRegion,
                text_regions: textRegions,
                updated_at: new Date().toISOString()
            })
            .eq('event_id', eventId)
            .select()
            .single()

        if (error) {
            console.error("Update Template Error:", error)
            throw new Error("Failed to update certificate template")
        }

        revalidatePath(`/admin/events/${eventId}`)
        return { success: true, template: data, updated: true }
    }

    // Create new template
    const { data, error } = await supabase
        .from('certificate_templates')
        .insert({
            event_id: eventId,
            template_url: templateUrl,
            qr_region: qrRegion,
            text_regions: textRegions
        })
        .select()
        .single()

    if (error) {
        console.error("Create Template Error:", error)
        throw new Error("Failed to create certificate template")
    }

    revalidatePath(`/admin/events/${eventId}`)
    return { success: true, template: data, updated: false }
}

export async function updateCertificateTemplate(
    templateId: string,
    qrRegion: QRRegion,
    textRegions: TextRegion[]
) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    const { data, error } = await supabase
        .from('certificate_templates')
        .update({
            qr_region: qrRegion,
            text_regions: textRegions,
            updated_at: new Date().toISOString()
        })
        .eq('id', templateId)
        .select()
        .single()

    if (error) {
        console.error("Update Template Error:", error)
        throw new Error("Failed to update certificate template")
    }

    revalidatePath(`/admin/events`)
    return { success: true, template: data }
}

export async function getCertificateTemplate(eventId: string): Promise<(CertificateTemplate & { signedUrl?: string }) | null> {
    const supabase = await getSupabase()

    const { data, error } = await supabase
        .from('certificate_templates')
        .select('*')
        .eq('event_id', eventId)
        .single()

    if (error || !data) return null

    // Generate signed URL for template preview
    const signedUrl = data.template_url ? await getSignedCertificateUrl(data.template_url) : undefined

    return { ...(data as CertificateTemplate), signedUrl }
}

export async function deleteCertificateTemplate(eventId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    const { error } = await supabase
        .from('certificate_templates')
        .delete()
        .eq('event_id', eventId)

    if (error) {
        console.error("Delete Template Error:", error)
        throw new Error("Failed to delete certificate template")
    }

    revalidatePath(`/admin/events/${eventId}`)
    return { success: true }
}

// ==========================================
// Certificate Issuance (Admin)
// ==========================================

async function requireAdmin() {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }
    return session
}

type SupabaseClient = Awaited<ReturnType<typeof getSupabase>>

async function getEventEmailContext(supabase: SupabaseClient, eventId: string) {
    const { data: event } = await supabase
        .from('events')
        .select('title, start_time, end_time, club_id, club:clubs!events_club_id_fkey(name)')
        .eq('id', eventId)
        .single()

    const clubData = event?.club as { name: string }[] | { name: string } | null
    const clubName = Array.isArray(clubData) ? clubData[0]?.name : clubData?.name

    return {
        eventName: event?.title || 'Event',
        eventDate: formatEventDateRange(event?.start_time, event?.end_time),
        organizerName: clubName || 'Technova'
    }
}

/** "19 Sep 2026", "19 – 20 Sep 2026", "28 Sep – 2 Oct 2026" or full dates across years. */
function formatEventDateRange(start?: string | null, end?: string | null): string {
    const s = formatDateShort(start || new Date().toISOString())
    if (!end) return s
    const e = formatDateShort(end)
    if (s === e) return s
    const [sd, sm, sy] = s.split(' ')
    const [ed, em, ey] = e.split(' ')
    if (sy !== ey) return `${s} – ${e}`
    if (sm !== em) return `${sd} ${sm} – ${ed} ${em} ${ey}`
    return `${sd} – ${ed} ${em} ${ey}`
}

async function getUsersByIds(supabase: SupabaseClient, userIds: string[]) {
    type UserRow = { id: string, name: string | null, email: string | null }
    if (userIds.length === 0) return new Map<string, UserRow>()
    // Chunked: one `in (...)` list with hundreds of ids makes the request URL too long
    const { data: users } = await fetchInChunks<UserRow>(Array.from(new Set(userIds)), chunk =>
        supabase
            .schema('next_auth')
            .from('users')
            .select('id, name, email')
            .in('id', chunk)
    )
    return new Map(users.map(u => [u.id, u]))
}

interface CertificateEmailTarget {
    id: string
    certificate_id: string
    user_id: string
    certificate_type: CertificateType
    role_title?: string | null
}

/** Emails each certificate holder and stamps email_sent_at. Returns how many were sent. */
async function sendCertificateEmails(
    supabase: SupabaseClient,
    eventId: string,
    certs: CertificateEmailTarget[]
): Promise<number> {
    if (certs.length === 0) return 0

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.technovashardauniversity.in'
    const ctx = await getEventEmailContext(supabase, eventId)
    const userMap = await getUsersByIds(supabase, certs.map(c => c.user_id))

    // Render every email, then send through Resend's batch endpoint (100 per request).
    // Sending one by one hit Resend's 2 requests/second limit, and Resend reports
    // failures without throwing, so failed emails used to be counted (and stamped) as sent.
    const emails: CreateEmailOptions[] = []
    const emailCerts: CertificateEmailTarget[] = []
    for (const cert of certs) {
        const user = userMap.get(cert.user_id)
        if (!user?.email) continue

        const emailHtml = await render(CertificateNotificationEmail({
            userName: user.name || 'Student',
            eventName: ctx.eventName,
            eventDate: ctx.eventDate,
            organizerName: ctx.organizerName,
            certificateType: cert.certificate_type,
            roleTitle: cert.role_title || undefined,
            certificateId: cert.certificate_id,
            issuedAt: new Date().toISOString(),
            downloadUrl: `${baseUrl}/api/certificate?id=${cert.certificate_id}`,
            verifyUrl: `${baseUrl}/verify/${cert.certificate_id}`
        }))

        emails.push({
            from: 'Technova <noreply@technovashardauniversity.in>',
            to: user.email,
            subject: cert.role_title && cert.certificate_type !== 'participation'
                ? `🏆 Congratulations! You secured ${cert.role_title} at ${ctx.eventName}`
                : `Your participation certificate for ${ctx.eventName}`,
            html: emailHtml
        })
        emailCerts.push(cert)
    }

    if (emails.length === 0) return 0

    const result = await sendEmailBatch(resend, emails)
    if (result.failed.length > 0) {
        console.error(`[Certificates] ${result.failed.length} of ${emails.length} emails failed, e.g. ${result.failed[0].message}`)
    }

    // Stamp email_sent_at only on certificates whose email Resend accepted
    const sentIds = result.sentIndexes.map(i => emailCerts[i].id)
    const sentAt = new Date().toISOString()
    for (let i = 0; i < sentIds.length; i += 150) {
        await supabase
            .from('certificates')
            .update({ email_sent_at: sentAt })
            .in('id', sentIds.slice(i, i + 150))
    }

    return sentIds.length
}

function revalidateCertificatePages(eventId: string) {
    revalidatePath(`/admin/events/${eventId}`)
    revalidatePath(`/admin/events/${eventId}/certificates`)
}

export interface ReleaseCertificatesOptions {
    eventId: string
    userIds?: string[]      // students picked in the participation list; defaults to all registered
    sendEmails?: boolean
}

export async function releaseCertificates(options: ReleaseCertificatesOptions | string) {
    // Support both old (string) and new (object) signatures
    const opts: ReleaseCertificatesOptions = typeof options === 'string'
        ? { eventId: options }
        : options

    const { eventId, userIds, sendEmails = true } = opts

    await requireAdmin()
    const supabase = await getSupabase()

    // 1. Check if template exists
    const { data: template } = await supabase
        .from('certificate_templates')
        .select('id')
        .eq('event_id', eventId)
        .single()

    if (!template) {
        throw new Error("Participation template not configured for this event")
    }

    // 2. Registered students (only those selected, when a selection is given)
    const { data: allRegistrations, error: regError } = await supabase
        .from('registrations')
        .select('user_id')
        .eq('event_id', eventId)

    if (regError) {
        console.error("Fetch Registrations Error:", regError)
        throw new Error("Failed to fetch registrations")
    }

    const selected = userIds ? new Set(userIds) : null
    const registrations = (allRegistrations || []).filter(r => !selected || selected.has(r.user_id))

    if (registrations.length === 0) {
        throw new Error("No students selected")
    }

    // 3. Skip students who already have a participation certificate or hold a position
    const { data: existingCerts } = await supabase
        .from('certificates')
        .select('user_id, position_id')
        .eq('event_id', eventId)

    const skipUserIds = new Set(existingCerts?.map(c => c.user_id) || [])
    const newParticipants = registrations.filter(r => !skipUserIds.has(r.user_id))

    if (newParticipants.length === 0) {
        await supabase.from('events').update({
            certificates_released: true,
            certificates_released_at: new Date().toISOString()
        }).eq('id', eventId)

        return { success: true, issued: 0, emailsSent: 0, message: "Everyone eligible already has a certificate" }
    }

    // 4. Create participation certificates
    const { data: insertedCerts, error: insertError } = await supabase
        .from('certificates')
        .insert(newParticipants.map(reg => ({
            event_id: eventId,
            user_id: reg.user_id,
            template_id: template.id,
            status: 'valid',
            certificate_type: 'participation' as CertificateType
        })))
        .select('id, certificate_id, user_id, certificate_type, role_title')

    if (insertError) {
        console.error("Insert Certificates Error:", insertError)
        throw new Error("Failed to issue certificates")
    }

    // 5. Mark event as certificates released
    await supabase.from('events').update({
        certificates_released: true,
        certificates_released_at: new Date().toISOString()
    }).eq('id', eventId)

    // 6. Email
    const emailsSent = sendEmails ? await sendCertificateEmails(supabase, eventId, insertedCerts || []) : 0

    revalidateCertificatePages(eventId)

    return {
        success: true,
        issued: insertedCerts?.length || 0,
        emailsSent,
        message: `Issued ${insertedCerts?.length || 0} participation certificates. ${emailsSent} emails sent.`
    }
}

export async function resendCertificateEmail(certificateId: string) {
    await requireAdmin()
    const supabase = await getSupabase()

    const { data: cert } = await supabase
        .from('certificates')
        .select('id, certificate_id, user_id, event_id, certificate_type, role_title, status')
        .eq('certificate_id', certificateId)
        .single()

    if (!cert) throw new Error("Certificate not found")
    if (cert.status !== 'valid') throw new Error("Only valid certificates can be emailed")

    const sent = await sendCertificateEmails(supabase, cert.event_id, [cert])
    if (sent === 0) throw new Error("Failed to send email")

    revalidateCertificatePages(cert.event_id)
    return { success: true }
}

// ==========================================
// Positions (Top 1 / Top 2 / ...) - ready-made certificates
// ==========================================

const DEFAULT_POSITION_QR: QRRegion = { x: 84, y: 7, width: 11, height: 11 }

export interface PositionRecipient {
    id: string
    certificate_id: string
    user_id: string
    status: Certificate['status']
    file_url: string | null
    file_preview_url: string | null
    qr_region: QRRegion | null
    email_sent_at: string | null
    user: { name: string | null, email: string | null }
}

export interface PositionWithRecipients extends CertificatePosition {
    recipients: PositionRecipient[]
}

export async function getCertificatePositions(eventId: string): Promise<PositionWithRecipients[]> {
    await requireAdmin()
    const supabase = await getSupabase()

    const { data: positions, error } = await supabase
        .from('certificate_positions')
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

    if (error) {
        console.error("Fetch Positions Error:", error)
        throw new Error("Failed to fetch positions")
    }
    if (!positions || positions.length === 0) return []

    const { data: certs } = await supabase
        .from('certificates')
        .select('id, certificate_id, user_id, status, file_url, qr_region, email_sent_at, position_id, issued_at')
        .in('position_id', positions.map(p => p.id))
        .order('issued_at', { ascending: true })

    const userMap = await getUsersByIds(supabase, (certs || []).map(c => c.user_id))

    const recipients = await Promise.all((certs || []).map(async cert => ({
        ...cert,
        file_preview_url: cert.file_url ? await getSignedCertificateUrl(cert.file_url) : null,
        user: userMap.get(cert.user_id) || { name: 'Unknown', email: null }
    })))

    return positions.map(position => ({
        ...(position as CertificatePosition),
        recipients: recipients.filter(r => r.position_id === position.id) as PositionRecipient[]
    }))
}

export async function createCertificatePosition(eventId: string, title: string) {
    await requireAdmin()
    const supabase = await getSupabase()

    const trimmed = title.trim()
    if (!trimmed) throw new Error("Position title is required")

    // New positions inherit the QR placement of the most recent one, so it's set once for all
    const { data: existing } = await supabase
        .from('certificate_positions')
        .select('sort_order, qr_region')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: false })
        .limit(1)

    const last = existing?.[0]

    const { data, error } = await supabase
        .from('certificate_positions')
        .insert({
            event_id: eventId,
            title: trimmed,
            sort_order: (last?.sort_order ?? -1) + 1,
            qr_region: last?.qr_region || DEFAULT_POSITION_QR
        })
        .select()
        .single()

    if (error) {
        console.error("Create Position Error:", error)
        throw new Error("Failed to create position")
    }

    revalidateCertificatePages(eventId)
    return data as CertificatePosition
}

export async function updateCertificatePosition(
    positionId: string,
    updates: { title?: string, qr_region?: QRRegion }
) {
    await requireAdmin()
    const supabase = await getSupabase()

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (updates.title !== undefined) {
        const trimmed = updates.title.trim()
        if (!trimmed) throw new Error("Position title is required")
        patch.title = trimmed
    }
    if (updates.qr_region) patch.qr_region = updates.qr_region

    const { data, error } = await supabase
        .from('certificate_positions')
        .update(patch)
        .eq('id', positionId)
        .select()
        .single()

    if (error || !data) {
        console.error("Update Position Error:", error)
        throw new Error("Failed to update position")
    }

    // Keep the title shown on certificates/emails in sync
    if (patch.title) {
        await supabase.from('certificates').update({ role_title: patch.title }).eq('position_id', positionId)
    }

    revalidateCertificatePages(data.event_id)
    return data as CertificatePosition
}

/** Applies one QR placement to every position in the event and clears per-certificate overrides. */
export async function applyQrToAllPositions(eventId: string, qrRegion: QRRegion) {
    await requireAdmin()
    const supabase = await getSupabase()

    const { data: positions } = await supabase
        .from('certificate_positions')
        .update({ qr_region: qrRegion, updated_at: new Date().toISOString() })
        .eq('event_id', eventId)
        .select('id')

    const ids = (positions || []).map(p => p.id)
    if (ids.length > 0) {
        await supabase.from('certificates').update({ qr_region: null }).in('position_id', ids).eq('status', 'pending')
    }

    revalidateCertificatePages(eventId)
    return { success: true }
}

/**
 * Deletes a position and its certificates. Sent certificates are only deleted with
 * `force`, because their emailed download/verify links stop working.
 */
export async function deleteCertificatePosition(positionId: string, force = false) {
    await requireAdmin()
    const supabase = await getSupabase()

    const { data: position } = await supabase
        .from('certificate_positions')
        .select('id, event_id')
        .eq('id', positionId)
        .single()
    if (!position) throw new Error("Position not found")

    const { count } = await supabase
        .from('certificates')
        .select('id', { count: 'exact', head: true })
        .eq('position_id', positionId)
        .neq('status', 'pending')

    if (count && count > 0 && !force) {
        throw new Error("This position has sent certificates. Confirm to delete them too.")
    }

    // Certificates cascade with the position (and their analytics with them)
    const { error } = await supabase.from('certificate_positions').delete().eq('id', positionId)
    if (error) {
        console.error("Delete Position Error:", error)
        throw new Error("Failed to delete position")
    }

    revalidateCertificatePages(position.event_id)
    return { success: true }
}

export interface ParticipantSearchResult {
    id: string
    name: string | null
    email: string | null
    attended: boolean
}

/** Searches students registered for this event by email or name. */
export async function searchEventParticipants(eventId: string, query: string): Promise<ParticipantSearchResult[]> {
    await requireAdmin()
    const supabase = await getSupabase()

    const term = query.trim().replace(/[%,()]/g, '')
    if (term.length < 2) return []

    const { data: registrations } = await supabase
        .from('registrations')
        .select('user_id, attended')
        .eq('event_id', eventId)

    if (!registrations || registrations.length === 0) return []

    const attendedMap = new Map(registrations.map(r => [r.user_id, !!r.attended]))
    const matches: ParticipantSearchResult[] = []

    // Chunk to keep the .in() filter within URL limits on large events
    const ids = registrations.map(r => r.user_id)
    for (let i = 0; i < ids.length && matches.length < 10; i += 200) {
        const { data: users } = await supabase
            .schema('next_auth')
            .from('users')
            .select('id, name, email')
            .in('id', ids.slice(i, i + 200))
            .or(`email.ilike.%${term}%,name.ilike.%${term}%`)
            .limit(10)

        for (const u of users || []) {
            matches.push({ ...u, attended: attendedMap.get(u.id) || false })
        }
    }

    return matches.slice(0, 10)
}

export async function addPositionRecipient(positionId: string, userId: string) {
    await requireAdmin()
    const supabase = await getSupabase()

    const { data: position } = await supabase
        .from('certificate_positions')
        .select('id, event_id, title')
        .eq('id', positionId)
        .single()
    if (!position) throw new Error("Position not found")

    // Only students registered for this event can receive a position certificate
    const { data: registration } = await supabase
        .from('registrations')
        .select('id')
        .eq('event_id', position.event_id)
        .eq('user_id', userId)
        .maybeSingle()
    if (!registration) throw new Error("This student is not registered for the event")

    const { data, error } = await supabase
        .from('certificates')
        .insert({
            event_id: position.event_id,
            user_id: userId,
            position_id: positionId,
            status: 'pending',
            certificate_type: 'winner' as CertificateType,
            role_title: position.title
        })
        .select('id')
        .single()

    if (error) {
        if (error.code === '23505') throw new Error("This student is already in this position")
        console.error("Add Recipient Error:", error)
        throw new Error("Failed to add student")
    }

    revalidateCertificatePages(position.event_id)
    return data
}

export async function removePositionRecipient(certificateUuid: string, force = false) {
    await requireAdmin()
    const supabase = await getSupabase()

    const { data: cert } = await supabase
        .from('certificates')
        .select('id, event_id, status, position_id')
        .eq('id', certificateUuid)
        .single()

    if (!cert || !cert.position_id) throw new Error("Certificate not found")
    if (cert.status !== 'pending' && !force) throw new Error("This certificate was already sent. Confirm to delete it.")

    const { error } = await supabase.from('certificates').delete().eq('id', certificateUuid)
    if (error) {
        console.error("Remove Recipient Error:", error)
        throw new Error("Failed to remove student")
    }

    revalidateCertificatePages(cert.event_id)
    return { success: true }
}

/** Uploads the ready-made certificate image for one position recipient. */
export async function uploadPositionCertificateFile(formData: FormData) {
    await requireAdmin()
    const supabase = await getSupabase()

    const certificateUuid = formData.get('certificateId') as string
    const file = formData.get('file') as File | null
    if (!certificateUuid || !file) throw new Error("Missing file")

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
        throw new Error("Upload a PNG or JPG image")
    }
    if (file.size > 10 * 1024 * 1024) throw new Error("File must be under 10MB")

    const { data: cert } = await supabase
        .from('certificates')
        .select('id, event_id, position_id, status')
        .eq('id', certificateUuid)
        .single()

    if (!cert || !cert.position_id) throw new Error("Certificate not found")

    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const filePath = `${cert.event_id}/positions/${cert.id}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(filePath, file, { upsert: true, contentType: file.type })

    if (uploadError) {
        console.error("Upload Error:", uploadError)
        throw new Error("Failed to upload certificate")
    }

    const { data: { publicUrl } } = supabase.storage.from('certificates').getPublicUrl(filePath)

    await supabase.from('certificates').update({ file_url: publicUrl }).eq('id', cert.id)

    revalidateCertificatePages(cert.event_id)
    return { fileUrl: publicUrl, previewUrl: await getSignedCertificateUrl(publicUrl) }
}

/** Sets (or clears, with null) the QR placement for a single position certificate. */
export async function setCertificateQrOverride(certificateUuid: string, qrRegion: QRRegion | null) {
    await requireAdmin()
    const supabase = await getSupabase()

    const { data, error } = await supabase
        .from('certificates')
        .update({ qr_region: qrRegion })
        .eq('id', certificateUuid)
        .select('event_id')
        .single()

    if (error || !data) throw new Error("Failed to save QR placement")

    revalidateCertificatePages(data.event_id)
    return { success: true }
}

/** Issues every pending position certificate that has a file, and emails each student. */
export async function sendPositionCertificates(eventId: string) {
    await requireAdmin()
    const supabase = await getSupabase()

    const { data: pending } = await supabase
        .from('certificates')
        .select('id, file_url')
        .eq('event_id', eventId)
        .eq('status', 'pending')
        .not('position_id', 'is', null)

    const ready = (pending || []).filter(c => c.file_url)
    const missingFiles = (pending || []).length - ready.length

    if (ready.length === 0) {
        throw new Error(missingFiles > 0
            ? `Upload certificates first (${missingFiles} student${missingFiles === 1 ? '' : 's'} missing a file)`
            : "No pending position certificates to send")
    }

    const { data: issued, error } = await supabase
        .from('certificates')
        .update({ status: 'valid', issued_at: new Date().toISOString() })
        .in('id', ready.map(c => c.id))
        .select('id, certificate_id, user_id, certificate_type, role_title')

    if (error) {
        console.error("Issue Position Certificates Error:", error)
        throw new Error("Failed to issue position certificates")
    }

    const emailsSent = await sendCertificateEmails(supabase, eventId, issued || [])

    revalidateCertificatePages(eventId)

    return {
        success: true,
        issued: issued?.length || 0,
        emailsSent,
        message: `Sent ${issued?.length || 0} position certificates. ${emailsSent} emails delivered.`
            + (missingFiles > 0 ? ` ${missingFiles} skipped (no file uploaded).` : '')
    }
}

// ==========================================
// Custom Fonts
// ==========================================

export async function uploadCertificateFont(formData: FormData) {
    await requireAdmin()
    const supabase = await getSupabase()

    const eventId = formData.get('eventId') as string
    const file = formData.get('file') as File | null
    if (!eventId || !file) throw new Error("Missing font file")

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['ttf', 'otf'].includes(ext)) throw new Error("Upload a .ttf or .otf font")
    if (file.size > 5 * 1024 * 1024) throw new Error("Font must be under 5MB")

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fontPath = `${eventId}/fonts/${Date.now()}-${safeName}`

    const { error } = await supabase.storage
        .from('certificates')
        .upload(fontPath, file, { upsert: true, contentType: 'font/' + ext })

    if (error) {
        console.error("Font Upload Error:", error)
        throw new Error("Failed to upload font")
    }

    return { path: fontPath, url: await getSignedCertificateUrl(fontPath), name: file.name }
}

export async function getCertificateFontUrl(fontPath: string) {
    await requireAdmin()
    return await getSignedCertificateUrl(fontPath)
}

export async function revokeCertificate(certificateId: string, reason: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    const { data, error } = await supabase
        .from('certificates')
        .update({
            status: 'revoked',
            revoked_at: new Date().toISOString(),
            revoked_reason: reason
        })
        .eq('certificate_id', certificateId)
        .select()
        .single()

    if (error) {
        console.error("Revoke Certificate Error:", error)
        throw new Error("Failed to revoke certificate")
    }

    revalidatePath(`/admin/events/${data.event_id}/certificates`)
    return { success: true, certificate: data }
}

export async function reinstateCertificate(certificateId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    const { data, error } = await supabase
        .from('certificates')
        .update({
            status: 'valid',
            revoked_at: null,
            revoked_reason: null
        })
        .eq('certificate_id', certificateId)
        .select()
        .single()

    if (error) {
        console.error("Reinstate Certificate Error:", error)
        throw new Error("Failed to reinstate certificate")
    }

    revalidatePath(`/admin/events/${data.event_id}/certificates`)
    return { success: true, certificate: data }
}

// ==========================================
// Certificate Retrieval (Admin)
// ==========================================

export interface EventStudentCertificate {
    id: string
    certificate_id: string
    status: Certificate['status']
    position_id: string | null
    position_title: string | null
    email_sent_at: string | null
    downloaded_count: number
    file_url: string | null
}

export interface EventStudent {
    user_id: string
    name: string | null
    email: string | null
    attended: boolean
    certificates: EventStudentCertificate[]
}

/** Every registered student for the event with the certificates they hold (including pending). */
export async function getEventStudents(eventId: string): Promise<{ students: EventStudent[], positions: { id: string, title: string }[] }> {
    await requireAdmin()
    const supabase = await getSupabase()

    const [{ data: registrations, error }, { data: certs }, { data: positions }] = await Promise.all([
        supabase.from('registrations').select('user_id, attended').eq('event_id', eventId),
        supabase
            .from('certificates')
            .select('id, certificate_id, user_id, status, position_id, email_sent_at, downloaded_count, file_url')
            .eq('event_id', eventId),
        supabase.from('certificate_positions').select('id, title').eq('event_id', eventId).order('sort_order')
    ])

    if (error) {
        console.error("Fetch Students Error:", error)
        throw new Error("Failed to fetch students")
    }

    // Fetch users in chunks to keep .in() within URL limits
    const userIds = Array.from(new Set([...(registrations || []).map(r => r.user_id), ...(certs || []).map(c => c.user_id)]))
    const userMap = new Map<string, { id: string, name: string | null, email: string | null }>()
    for (let i = 0; i < userIds.length; i += 200) {
        const chunk = await getUsersByIds(supabase, userIds.slice(i, i + 200))
        chunk.forEach((u, id) => userMap.set(id, u))
    }

    const positionTitles = new Map((positions || []).map(p => [p.id, p.title]))
    const attendedMap = new Map((registrations || []).map(r => [r.user_id, !!r.attended]))

    const students = userIds.map(userId => {
        const user = userMap.get(userId)
        return {
            user_id: userId,
            name: user?.name || null,
            email: user?.email || null,
            attended: attendedMap.get(userId) || false,
            certificates: (certs || [])
                .filter(c => c.user_id === userId)
                .map(c => ({
                    ...c,
                    position_title: c.position_id ? positionTitles.get(c.position_id) || 'Position' : null
                }))
        }
    }).sort((a, b) => Number(b.attended) - Number(a.attended) || (a.name || '').localeCompare(b.name || ''))

    return { students, positions: positions || [] }
}

export async function getEventCertificates(eventId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    // 1. Get certificates
    const { data: certificates, error } = await supabase
        .from('certificates')
        .select('*, position:certificate_positions(title, sort_order)')
        .eq('event_id', eventId)
        .neq('status', 'pending')
        .order('issued_at', { ascending: false })

    if (error) {
        console.error("Fetch Certificates Error:", error)
        throw new Error("Failed to fetch certificates")
    }

    if (!certificates || certificates.length === 0) return []

    // 2. Get user details
    const userIds = certificates.map(c => c.user_id)
    const { data: users } = await supabase
        .schema('next_auth')
        .from('users')
        .select('id, name, email')
        .in('id', userIds)

    // 3. Merge data
    return certificates.map(cert => ({
        ...cert,
        user: users?.find(u => u.id === cert.user_id) || { name: 'Unknown', email: 'Unknown' }
    }))
}

export async function getCertificateStats(eventId: string) {
    const supabase = await getSupabase()

    const { data } = await supabase
        .from('certificates')
        .select('status, downloaded_count, position_id')
        .eq('event_id', eventId)
        .neq('status', 'pending')

    const certs = data || []
    return {
        total: certs.length,
        valid: certs.filter(c => c.status === 'valid').length,
        revoked: certs.filter(c => c.status === 'revoked').length,
        downloads: certs.reduce((sum, c) => sum + (c.downloaded_count || 0), 0),
        positions: certs.filter(c => c.position_id).length,
        participation: certs.filter(c => !c.position_id).length
    }
}

// ==========================================
// User Certificate Access
// ==========================================

export async function getUserCertificates() {
    const session = await auth()
    if (!session) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    const { data: certificates, error } = await supabase
        .from('certificates')
        .select(`
            *,
            event:events!inner(title, start_time, club_id, club:clubs!events_club_id_fkey(name))
        `)
        .eq('user_id', session.user.id)
        .eq('status', 'valid')
        .order('issued_at', { ascending: false })

    if (error) {
        console.error("Fetch User Certificates Error:", error)
        return []
    }

    return certificates || []
}

export async function getUserCertificateForEvent(eventId: string): Promise<Certificate | null> {
    const session = await auth()
    if (!session) return null

    const supabase = await getSupabase()

    const { data, error } = await supabase
        .from('certificates')
        .select(`
            *,
            event:events!inner(title, start_time, club_id, club:clubs!events_club_id_fkey(name))
        `)
        .eq('user_id', session.user.id)
        .eq('event_id', eventId)
        .eq('status', 'valid')
        .order('issued_at', { ascending: true })
        .limit(1)
        .maybeSingle()

    if (error || !data) return null
    return data as Certificate
}

// ==========================================
// Public Verification
// ==========================================

export async function verifyCertificate(certificateId: string) {
    const supabase = await getSupabase()

    // 1. Get certificate with event and user details
    const { data: certificate, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('certificate_id', certificateId)
        .single()

    if (error || !certificate || certificate.status === 'pending') {
        return { valid: false, error: 'Certificate not found' }
    }

    // 2. Get event details
    const { data: event } = await supabase
        .from('events')
        .select('title, start_time, club_id, club:clubs!events_club_id_fkey(name)')
        .eq('id', certificate.event_id)
        .single()

    // 3. Get user name
    const { data: user } = await supabase
        .schema('next_auth')
        .from('users')
        .select('name')
        .eq('id', certificate.user_id)
        .single()

    return {
        valid: certificate.status === 'valid',
        certificate: {
            ...certificate,
            event,
            user
        }
    }
}

// Helper function to upload template to storage
export async function uploadCertificateTemplate(file: File, eventId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    const fileName = `${eventId}/${Date.now()}-${file.name}`

    const { data, error } = await supabase.storage
        .from('certificates')
        .upload(fileName, file, {
            upsert: true
        })

    if (error) {
        console.error("Upload Error:", error)
        throw new Error("Failed to upload template")
    }

    const { data: { publicUrl } } = supabase.storage
        .from('certificates')
        .getPublicUrl(data.path)

    return publicUrl
}
