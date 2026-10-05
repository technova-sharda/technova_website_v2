import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { awardDailyXP } from '@/lib/xp'
import { auth } from '@/lib/auth'
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { spansMultipleIstDays } from '@/lib/dates/ist'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Manual check-in API for offline events
 * This allows admins to check-in participants without requiring QR code scanning
 * Useful when QR scanning fails or for managing offline event attendance
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    // Security: Verify only admins can mark attendance
    const session = await auth()
    if (!session || !session.user || !['admin', 'super_admin'].includes(session.user.role)) {
        return NextResponse.json({ success: false, message: 'Unauthorized - Admin access required' }, { status: 401 })
    }

    // Rate limiting: 60 check-ins per minute per user
    const rateLimit = checkRateLimit(
        getClientIdentifier(req, session.user.id),
        { limit: 60, windowSeconds: 60, bucket: 'checkin' }
    )
    if (!rateLimit.success) {
        return NextResponse.json({
            success: false,
            message: 'Too many requests. Please slow down.'
        }, { status: 429 })
    }

    try {
        const { eventId } = await params
        const body = await req.json()
        const { registrationId } = body

        if (!registrationId) {
            return NextResponse.json({ success: false, message: 'Registration ID is required' }, { status: 400 })
        }

        // 1. Find Registration
        const { data: registration, error: regError } = await supabase
            .from('registrations')
            .select('*, events(*)')
            .eq('id', registrationId)
            .eq('event_id', eventId)
            .single()

        if (regError || !registration) {
            return NextResponse.json({ success: false, message: 'Registration not found' }, { status: 404 })
        }

        // Unpaid registrations (paid event, payment not captured) can't be checked in
        if (registration.payment_status === 'pending') {
            return NextResponse.json({ success: false, message: 'Payment not completed for this registration' }, { status: 402 })
        }

        // 2. Determine if this is a multi-day event (IST calendar days; the server runs in UTC)
        const eventStart = registration.events?.start_time ? new Date(registration.events.start_time) : null
        const eventEnd = registration.events?.end_time ? new Date(registration.events.end_time) : null
        const isMultiDay = registration.events?.is_multi_day ||
            (eventStart && eventEnd && spansMultipleIstDays(eventStart, eventEnd))

        // 3-6. Name, XP (per-day dedup) and attended flag, all at once.
        // Marking attended is right either way: the student is here.
        const nameQuery = supabase
            .schema('next_auth' as unknown as 'public')
            .from('users')
            .select('name')
            .eq('id', registration.user_id)
            .maybeSingle()

        // Single-day events: block if already attended (multi-day allows one check-in per day)
        if (!isMultiDay && registration.attended) {
            const { data: existingUser } = await nameQuery
            return NextResponse.json({
                success: false,
                message: 'Already checked in',
                userName: (existingUser as { name?: string } | null)?.name || 'Attendee'
            }, { status: 400 })
        }

        // Early arrivals are recorded as Day 1
        let checkinDate = new Date()
        if (eventStart && checkinDate < eventStart) {
            checkinDate = new Date(eventStart)
        }

        const [xpResult, attendedUpdate, { data: user }] = await Promise.all([
            awardDailyXP(registration.user_id, eventId, {
                event_type: registration.events?.event_type,
                difficulty_level: registration.events?.difficulty_level,
                start_time: registration.events?.start_time,
                end_time: registration.events?.end_time,
                is_multi_day: isMultiDay
            }, checkinDate),
            registration.attended ? Promise.resolve({ error: null }) : supabase.from('registrations').update({ attended: true }).eq('id', registration.id),
            nameQuery,
        ])
        if (attendedUpdate.error) console.error('Attendance update error:', attendedUpdate.error)
        const userName = (user as { name?: string } | null)?.name || 'Attendee'

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
                : 'Manual check-in successful',
            userName,
            userId: registration.user_id,
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
        console.error('Manual Check-in Error:', err)
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
    }
}
