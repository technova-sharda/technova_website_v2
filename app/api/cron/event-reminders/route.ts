import { NextRequest, NextResponse } from 'next/server'

// Sending can take a while for big events
export const maxDuration = 60
import { sendEventReminders } from '@/lib/server/event-reminders'

/**
 * Cron endpoint for sending event reminders
 * Called every 30 minutes by Vercel Cron
 * 
 * Security: Uses CRON_SECRET to verify legitimate cron calls
 */
export async function POST(request: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret) {
            console.error('CRON_SECRET not configured')
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        }

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Send reminders
        const result = await sendEventReminders()

        console.log(`[Cron] Event reminders: ${result.eventsSent} events, ${result.emailsSent} emails sent, ${result.emailsFailed} failed`)

        return NextResponse.json(result)
    } catch (error) {
        console.error('[Cron] Event reminders error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// Also support GET for manual testing (still requires auth)
export async function GET(request: NextRequest) {
    return POST(request)
}
