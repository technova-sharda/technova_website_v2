import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { awardDailyXP } from '@/lib/xp'
import { hasSubmittedEventFeedback } from '@/lib/actions/feedback'
import { auth } from '@/lib/auth'
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { spansMultipleIstDays } from '@/lib/dates/ist'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    // Security: Verify only admins can mark attendance
    const session = await auth()
    if (!session || !session.user || !['admin', 'super_admin'].includes(session.user.role)) {
        return NextResponse.json({ success: false, message: 'Unauthorized - Admin access required' }, { status: 401 })
    }

    // Rate limiting: 60 scans per minute per user (entry rushes can exceed one scan every 2s)
    const rateLimit = checkRateLimit(
        getClientIdentifier(req, session.user.id),
        { limit: 60, windowSeconds: 60, bucket: 'scan' }
    )
    if (!rateLimit.success) {
        return NextResponse.json({
            success: false,
            message: 'Too many requests. Please slow down.'
        }, { status: 429 })
    }

    try {
        const body = await req.json()

        // Handle both legacy (long keys) and new (short keys) formats
        const token = body.token || body.t
        const userId = body.userId || body.u
        const eventId = body.eventId || body.e

        if (!token || !userId || !eventId) {
            return NextResponse.json({ success: false, message: 'Invalid QR data' }, { status: 400 })
        }

        // 1. Registration (by QR token) and the student's name, read together
        const [{ data: registration, error: regError }, { data: nameRow }] = await Promise.all([
            supabase
                .from('registrations')
                .select('id, attended, payment_status, events(start_time, end_time, is_multi_day, is_virtual, requires_feedback_for_attendance, event_type, difficulty_level)')
                .eq('qr_token_id', token)
                .eq('user_id', userId)
                .eq('event_id', eventId)
                .single(),
            supabase
                .schema('next_auth' as unknown as 'public')
                .from('users')
                .select('name')
                .eq('id', userId)
                .maybeSingle(),
        ])
        const userName = (nameRow as { name?: string } | null)?.name || 'Attendee'
        const ev = (Array.isArray((registration as any)?.events) ? (registration as any).events[0] : (registration as any)?.events) as Record<string, any> | null

        if (regError || !registration) {
            return NextResponse.json({ success: false, message: 'Registration not found' }, { status: 404 })
        }

        // Unpaid registrations (paid event, payment not captured) can't be checked in
        if (registration.payment_status === 'pending') {
            return NextResponse.json({ success: false, message: 'Payment not completed for this registration' }, { status: 402 })
        }

        // 2. Determine if this is a multi-day event (IST calendar days; the server runs in UTC)
        const eventStart = ev?.start_time ? new Date(ev.start_time) : null
        const eventEnd = ev?.end_time ? new Date(ev.end_time) : null
        const isMultiDay = ev?.is_multi_day ||
            (eventStart && eventEnd && spansMultipleIstDays(eventStart, eventEnd))

        // 3. For single-day events: block if already attended
        // For multi-day events: allow re-scans (awardDailyXP handles per-day deduplication)
        if (!isMultiDay && registration.attended) {
            return NextResponse.json({ success: false, message: 'Already checked in', userName }, { status: 400 })
        }

        // 4. For online events requiring feedback, check if feedback submitted
        if (ev?.is_virtual && ev?.requires_feedback_for_attendance) {
            const feedbackSubmitted = await hasSubmittedEventFeedback(userId, eventId)
            if (!feedbackSubmitted) {
                return NextResponse.json({
                    success: false,
                    message: 'Please submit event feedback before checking in',
                    requiresFeedback: true
                }, { status: 400 })
            }
        }

        // 5. Determine Check-in Date
        // If checking in before event starts (e.g. early arrival), record as Day 1
        let checkinDate = new Date()
        if (eventStart && checkinDate < eventStart) {
            checkinDate = new Date(eventStart)
        }

        // 6. Award daily XP (per-day dedup) and mark attended, at the same time.
        // Marking attended is right either way: the student is here.
        const [xpResult, attendedUpdate] = await Promise.all([
            awardDailyXP(userId, eventId, {
                event_type: ev?.event_type,
                difficulty_level: ev?.difficulty_level,
                start_time: ev?.start_time,
                end_time: ev?.end_time,
                is_multi_day: isMultiDay
            }, checkinDate),
            registration.attended ? Promise.resolve({ error: null }) : supabase.from('registrations').update({ attended: true }).eq('id', registration.id),
        ])
        if (attendedUpdate.error) console.error('Attendance update error:', attendedUpdate.error)

        // Already checked in today (multi-day events)
        if (!xpResult.success && xpResult.message?.includes('Already checked in')) {
            return NextResponse.json({
                success: false,
                message: isMultiDay ? 'Already checked in today' : 'Already checked in',
                userName,
                daysCheckedIn: xpResult.daysCheckedIn,
                remainingDays: xpResult.remainingDays,
                eventDays: xpResult.eventDays
            }, { status: 400 })
        }

        return NextResponse.json({
            success: true,
            message: isMultiDay
                ? `Day ${xpResult.daysCheckedIn} check-in successful!`
                : 'Check-in successful',
            userName,
            userId,
            registrationId: registration.id,
            xpAwarded: xpResult.xpAwarded,
            xpMessage: xpResult.message,
            // Daily XP distribution info
            dailyXP: xpResult.dailyXP,
            eventDays: xpResult.eventDays,
            daysCheckedIn: xpResult.daysCheckedIn,
            remainingDays: xpResult.remainingDays,
            isMultiDay
        })

    } catch (err) {
        console.error('Scan Error:', err)
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
    }
}
