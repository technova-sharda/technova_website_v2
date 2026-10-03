import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { render } from "@react-email/render"
import ReminderEmail from "@/emails/reminder-email"
import { formatDate, formatTime } from "@/lib/utils"
import { getRegisteredParticipants, type Participant } from "@/lib/email/participants"
import { sendEmailBatch } from "@/lib/email/send"

// Server-only module (no 'use server'): this used to be an exported server action,
// which let anyone trigger reminder emails to every participant. It's now only
// reachable through the CRON_SECRET-protected route /api/cron/event-reminders.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://technovashardauniversity.in'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

interface EventWithParticipants {
    id: string
    title: string
    slug: string
    start_time: string
    venue: string
    participants: Participant[]
}

/**
 * Get events starting in approximately 3 hours that haven't sent reminders yet
 */
async function getEventsForReminder(): Promise<EventWithParticipants[]> {
    const supabase = getSupabase()

    // Calculate time window: events starting between 2.5 and 3.5 hours from now
    const now = new Date()
    const minTime = new Date(now.getTime() + 2.5 * 60 * 60 * 1000)
    const maxTime = new Date(now.getTime() + 3.5 * 60 * 60 * 1000)

    const { data: events, error } = await supabase
        .from('events')
        .select('id, title, slug, start_time, venue, reminder_sent_at')
        .gte('start_time', minTime.toISOString())
        .lte('start_time', maxTime.toISOString())
        .is('reminder_sent_at', null) // Only events that haven't had reminders sent
        .neq('status', 'cancelled')

    if (error || !events || events.length === 0) {
        return []
    }

    const eventsWithParticipants: EventWithParticipants[] = await Promise.all(
        events.map(async (event) => ({
            ...event,
            participants: await getRegisteredParticipants(supabase, event.id)
        }))
    )

    return eventsWithParticipants.filter(e => e.participants.length > 0)
}

/**
 * Send reminder emails for events starting in ~3 hours.
 * Called by the cron route only.
 */
export async function sendEventReminders(): Promise<{ success: boolean; eventsSent: number; emailsSent: number; emailsFailed: number }> {
    const supabase = getSupabase()
    const events = await getEventsForReminder()

    let totalEmailsSent = 0
    let totalEmailsFailed = 0
    let eventsSent = 0

    for (const event of events) {
        const eventUrl = `${BASE_URL}/events/${event.slug || event.id}`
        const eventDate = formatDate(event.start_time)
        const eventTime = formatTime(event.start_time)

        const hoursUntilEvent = Math.round(
            (new Date(event.start_time).getTime() - Date.now()) / (1000 * 60 * 60)
        )

        const emails = await Promise.all(event.participants.map(async participant => ({
            from: 'Technova <noreply@technovashardauniversity.in>',
            to: participant.email,
            subject: `⏰ Reminder: ${event.title} starts in ${hoursUntilEvent} hours!`,
            html: await render(ReminderEmail({
                eventName: event.title,
                userName: participant.name,
                eventDate,
                eventTime,
                venue: event.venue || 'TBA',
                eventUrl,
                hoursUntilEvent
            }))
        })))

        const result = await sendEmailBatch(new Resend(process.env.RESEND_API_KEY), emails)
        totalEmailsSent += result.sentIndexes.length
        totalEmailsFailed += result.failed.length
        if (result.failed.length > 0) {
            console.error(`[Reminders] ${event.title}: ${result.failed.length} failed, e.g. ${result.failed[0].message}`)
        }

        // Mark as sent once anything went out. If every email failed (outage, bad key),
        // leave it unmarked so the next cron run inside the window can retry.
        if (result.sentIndexes.length > 0) {
            eventsSent++
            await supabase
                .from('events')
                .update({ reminder_sent_at: new Date().toISOString() })
                .eq('id', event.id)
        }
    }

    return {
        success: true,
        eventsSent,
        emailsSent: totalEmailsSent,
        emailsFailed: totalEmailsFailed
    }
}
