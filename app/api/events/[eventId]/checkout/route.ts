import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { revalidateTag } from 'next/cache'
import { istDateKey } from '@/lib/dates/ist'
import { incrementUserXp } from '@/lib/xp/increment'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Check-out API for removing attendees who leave early
 * This reverses a check-in: sets attended=false and removes the daily_checkin record for today
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    // Security: Verify only admins can checkout
    const session = await auth()
    if (!session || !session.user || !['admin', 'super_admin'].includes(session.user.role)) {
        return NextResponse.json({ success: false, message: 'Unauthorized - Admin access required' }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = checkRateLimit(
        getClientIdentifier(req, session.user.id),
        { limit: 60, windowSeconds: 60, bucket: 'checkout' }
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

        if (!registration.attended) {
            return NextResponse.json({ success: false, message: 'Attendee is not checked in' }, { status: 400 })
        }

        // 2. Remove today's daily_checkin record. Check-ins are keyed by IST date,
        //    so "today" must be the IST date too (the server runs in UTC).
        const today = istDateKey(new Date())
        const { data: removedCheckins, error: removeError } = await supabase
            .from('daily_checkins')
            .delete()
            .eq('user_id', registration.user_id)
            .eq('event_id', eventId)
            .eq('checkin_date', today)
            .select('xp_awarded')

        if (removeError) {
            console.error('Checkout: failed to remove check-in:', removeError.message)
            return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
        }

        // 3. Check if there are any remaining daily_checkin records
        const { data: remainingCheckins } = await supabase
            .from('daily_checkins')
            .select('id')
            .eq('user_id', registration.user_id)
            .eq('event_id', eventId)

        // 4. If no remaining check-ins, set attended to false
        if (!remainingCheckins || remainingCheckins.length === 0) {
            await supabase
                .from('registrations')
                .update({ attended: false })
                .eq('id', registration.id)
        }

        // 5. Take back the XP that today's check-in awarded.
        //    (This used to target tables that don't exist — xp_transactions and
        //    user_profiles — so XP was never deducted, and re-scanning the student
        //    awarded the same day's XP a second time.)
        const xpToRemove = (removedCheckins || []).reduce((sum, c) => sum + (c.xp_awarded || 0), 0)
        if (xpToRemove > 0) {
            const xp = await incrementUserXp(supabase, registration.user_id, -xpToRemove)
            if (!xp.ok) {
                console.error('Checkout: XP deduction failed:', xp.error)
            }
            revalidateTag('leaderboard', { expire: 0 })
            revalidateTag(`user-${registration.user_id}`, { expire: 0 })
        }

        // 6. Get user name for response
        const { data: user } = await supabase
            .schema('next_auth' as unknown as 'public')
            .from('users')
            .select('name')
            .eq('id', registration.user_id)
            .single()

        return NextResponse.json({
            success: true,
            message: `${user?.name || 'Attendee'} has been checked out successfully`,
            userName: user?.name || 'Attendee'
        })

    } catch (err) {
        console.error('Checkout Error:', err)
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
    }
}
