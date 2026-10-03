import { NextRequest, NextResponse } from 'next/server'
import { sendBlastEmail } from '@/lib/actions/notifications'

// Rendering and sending to a few hundred participants needs more than the default time
export const maxDuration = 60

/**
 * API endpoint for sending blast emails to event participants
 * Admin only - authorization handled in sendBlastEmail
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { eventId, subject, message } = body

        if (!eventId || !subject || !message) {
            return NextResponse.json(
                { error: 'Missing required fields: eventId, subject, message' },
                { status: 400 }
            )
        }

        const result = await sendBlastEmail(eventId, subject, message)

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Failed to send blast email' },
                { status: result.error === 'Unauthorized' ? 401 : 400 }
            )
        }

        return NextResponse.json({
            success: true,
            message: result.emailsFailed
                ? `Blast email sent to ${result.emailsSent} participants (${result.emailsFailed} failed)`
                : `Blast email sent to ${result.emailsSent} participants`
        })
    } catch (error) {
        console.error('[Blast Email] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
