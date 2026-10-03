'use server'

import { createClient as createServerClient } from "@supabase/supabase-js"
import { auth } from "@/lib/auth"
import { Resend } from "resend"
import { render } from "@react-email/render"
import BlastEmail from "@/emails/blast-email"
import { getRegisteredParticipants } from "@/lib/email/participants"
import { sendEmailBatch } from "@/lib/email/send"

// Event reminders moved to lib/server/event-reminders.ts: as an export of this
// 'use server' file, anyone could call it and trigger emails to every participant.

// ==========================================
// Setup
// ==========================================

const resend = new Resend(process.env.RESEND_API_KEY)

function getSupabase() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://technovashardauniversity.in'

/**
 * Send a blast email to all registered participants for an event
 * Admin only
 */
export async function sendBlastEmail(
    eventId: string,
    subject: string,
    message: string
): Promise<{ success: boolean; emailsSent: number; emailsFailed?: number; error?: string }> {
    // Verify admin authorization
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        return { success: false, emailsSent: 0, error: 'Unauthorized' }
    }

    const supabase = getSupabase()

    // Get event details
    const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, title, slug')
        .eq('id', eventId)
        .single()

    if (eventError || !event) {
        return { success: false, emailsSent: 0, error: 'Event not found' }
    }

    // Get participants
    const participants = await getRegisteredParticipants(supabase, eventId)

    if (participants.length === 0) {
        return { success: false, emailsSent: 0, error: 'No registered participants' }
    }

    const eventUrl = `${BASE_URL}/events/${event.slug || event.id}`

    const emails = await Promise.all(participants.map(async participant => ({
        from: 'Technova <noreply@technovashardauniversity.in>',
        to: participant.email,
        subject: `📢 ${subject} - ${event.title}`,
        html: await render(BlastEmail({
            eventName: event.title,
            userName: participant.name,
            subject,
            message,
            eventUrl
        }))
    })))

    // Batch API: ~2 requests for 171 students instead of 171 requests at 600 ms each,
    // and every result is checked (Resend reports failures without throwing).
    const result = await sendEmailBatch(resend, emails)
    const emailsSent = result.sentIndexes.length
    const emailsFailed = result.failed.length

    if (emailsFailed > 0) {
        console.error(`[Blast] ${emailsFailed} of ${emails.length} failed, e.g. ${result.failed[0].message}`)
    }

    // Log the blast email (ignore if table doesn't exist)
    try {
        await supabase.from('email_logs').insert({
            event_id: eventId,
            type: 'blast',
            subject,
            message,
            recipients_count: emailsSent,
            sent_by: session.user.id,
            sent_at: new Date().toISOString()
        })
    } catch {
        // Ignore - email_logs table may not exist
    }

    if (emailsSent === 0) {
        return { success: false, emailsSent: 0, emailsFailed, error: 'No emails could be sent. Please try again later.' }
    }

    return { success: true, emailsSent, emailsFailed }
}

/**
 * Get blast email history for an event
 */
export async function getBlastHistory(eventId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        return []
    }

    const supabase = getSupabase()

    const { data } = await supabase
        .from('email_logs')
        .select('*')
        .eq('event_id', eventId)
        .eq('type', 'blast')
        .order('sent_at', { ascending: false })
        .limit(10)

    return data || []
}
