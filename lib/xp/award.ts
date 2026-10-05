/**
 * XP Module - Awards and tracks XP for event attendance
 */

import { createClient } from '@supabase/supabase-js'
import { calculateEventXP, canCalculateXP, type EventXPData } from './calculator'
import { revalidateTag } from 'next/cache'
import { istDateKey } from '@/lib/dates/ist'
import { incrementUserXp } from './increment'

// ==========================================
// Types
// ==========================================

export interface XPAwardResult {
    success: boolean
    xpAwarded: number
    message: string
    breakdown?: string
}

// ==========================================
// Helper - Get Supabase client
// ==========================================

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// ==========================================
// Check if XP already awarded
// ==========================================

export async function hasXPBeenAwarded(
    userId: string,
    eventId: string
): Promise<boolean> {
    const supabase = getSupabase()

    const { data } = await supabase
        .from('xp_awards')
        .select('id')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .single()

    return !!data
}

// ==========================================
// Award XP for event attendance
// ==========================================

export async function awardXPForAttendance(
    userId: string,
    eventId: string,
    eventData: EventXPData
): Promise<XPAwardResult> {
    const supabase = getSupabase()

    // 1. Check if XP already awarded (prevent double XP)
    const alreadyAwarded = await hasXPBeenAwarded(userId, eventId)
    if (alreadyAwarded) {
        return {
            success: false,
            xpAwarded: 0,
            message: 'XP already awarded for this event'
        }
    }

    // 2. Validate event data for XP calculation
    if (!canCalculateXP(eventData)) {
        return {
            success: false,
            xpAwarded: 0,
            message: 'Event missing required fields for XP calculation'
        }
    }

    // 3. Calculate XP
    const { finalXP, breakdown } = calculateEventXP(eventData)

    // 4. Record XP award (prevents future duplicates)
    const { error: awardError } = await supabase
        .from('xp_awards')
        .insert({
            user_id: userId,
            event_id: eventId,
            xp_amount: finalXP
        })

    if (awardError) {
        // Handle unique constraint violation (double award attempt)
        if (awardError.code === '23505') {
            return {
                success: false,
                xpAwarded: 0,
                message: 'XP already awarded for this event'
            }
        }
        console.error('XP Award Error:', awardError)
        return {
            success: false,
            xpAwarded: 0,
            message: 'Failed to record XP award'
        }
    }

    // 5. Update user's total XP points (atomic, so concurrent awards aren't lost)
    const xpUpdate = await incrementUserXp(supabase, userId, finalXP)
    if (!xpUpdate.ok) {
        console.error('XP Update Error:', xpUpdate.error)
        // XP was recorded in xp_awards, so we don't fail completely
        // but the user's total may not be updated
    }

    // 6. Expire leaderboard caches so rankings update immediately
    revalidateTag('leaderboard', { expire: 0 })
    revalidateTag(`user-${userId}`, { expire: 0 })

    return {
        success: true,
        xpAwarded: finalXP,
        message: `Awarded ${finalXP} XP`,
        breakdown
    }
}

/**
 * Get total XP awarded to a user across all events
 */
export async function getUserTotalAwardedXP(userId: string): Promise<number> {
    const supabase = getSupabase()

    const { data, error } = await supabase
        .from('xp_awards')
        .select('xp_amount')
        .eq('user_id', userId)

    if (error || !data) {
        return 0
    }

    return data.reduce((sum, award) => sum + award.xp_amount, 0)
}

/**
 * Get XP awards for a specific event
 */
export async function getEventXPAwards(eventId: string): Promise<{ userId: string; amount: number }[]> {
    const supabase = getSupabase()

    const { data, error } = await supabase
        .from('xp_awards')
        .select('user_id, xp_amount')
        .eq('event_id', eventId)

    if (error || !data) {
        return []
    }

    return data.map(award => ({
        userId: award.user_id,
        amount: award.xp_amount
    }))
}

// ==========================================
// Daily XP Distribution Functions
// ==========================================

/**
 * Check if user already checked in for a specific date
 */
export async function hasDailyCheckin(
    userId: string,
    eventId: string,
    checkinDate: Date
): Promise<boolean> {
    const supabase = getSupabase()

    // IST calendar date as YYYY-MM-DD (the server runs in UTC)
    const dateStr = istDateKey(checkinDate)

    const { data } = await supabase
        .from('daily_checkins')
        .select('id')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .eq('checkin_date', dateStr)
        .single()

    return !!data
}

/**
 * Get all daily check-ins for a user and event
 */
export async function getUserDailyCheckinsForEvent(
    userId: string,
    eventId: string
): Promise<{ date: string; xpAwarded: number }[]> {
    const supabase = getSupabase()

    const { data, error } = await supabase
        .from('daily_checkins')
        .select('checkin_date, xp_awarded')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .order('checkin_date', { ascending: true })

    if (error || !data) {
        return []
    }

    return data.map(checkin => ({
        date: checkin.checkin_date,
        xpAwarded: checkin.xp_awarded
    }))
}

/**
 * Extended result for daily XP award
 */
export interface DailyXPAwardResult extends XPAwardResult {
    dailyXP: number
    eventDays: number
    totalXP: number
    daysCheckedIn: number
    remainingDays: number
}

/**
 * Award daily XP chunk for a specific day's check-in
 * 
 * This function:
 * 1. Calculates total event XP using the standard formula
 * 2. Divides it by the number of event days
 * 3. Awards one daily chunk per check-in
 * 4. Handles remainder XP on the last valid check-in day
 */
export async function awardDailyXP(
    userId: string,
    eventId: string,
    eventData: EventXPData,
    checkinDate: Date = new Date()
): Promise<DailyXPAwardResult> {
    const supabase = getSupabase()

    // 1. Validate event data
    if (!canCalculateXP(eventData)) {
        return {
            success: false,
            xpAwarded: 0,
            dailyXP: 0,
            eventDays: 0,
            totalXP: 0,
            daysCheckedIn: 0,
            remainingDays: 0,
            message: 'Event missing required fields for XP calculation'
        }
    }

    // 2. Calculate total XP and daily distribution
    const { finalXP, dailyXP, eventDays, breakdown } = calculateEventXP(eventData)

    // 3. Format check-in date (IST calendar date; the server runs in UTC)
    const dateStr = istDateKey(checkinDate)

    // 4. One read answers both "already checked in today?" and "how many days so far?"
    const existingCheckins = await getUserDailyCheckinsForEvent(userId, eventId)
    if (existingCheckins.some(c => c.date === dateStr)) {
        return {
            success: false,
            xpAwarded: 0,
            dailyXP,
            eventDays,
            totalXP: finalXP,
            daysCheckedIn: existingCheckins.length,
            remainingDays: eventDays - existingCheckins.length,
            message: 'Already checked in today'
        }
    }

    // 5. Existing check-ins decide if this is the last day
    const daysCheckedIn = existingCheckins.length
    const totalAwarded = existingCheckins.reduce((sum, c) => sum + c.xpAwarded, 0)

    // Calculate XP to award this check-in
    // On the last possible check-in, award remaining XP to avoid rounding loss
    let xpToAward = dailyXP
    const isLastPossibleDay = daysCheckedIn + 1 >= eventDays
    if (isLastPossibleDay) {
        // Award all remaining XP on last day
        xpToAward = finalXP - totalAwarded
    }

    // 6. Record daily check-in
    const { error: checkinError } = await supabase
        .from('daily_checkins')
        .insert({
            user_id: userId,
            event_id: eventId,
            checkin_date: dateStr,
            xp_awarded: xpToAward
        })

    if (checkinError) {
        // Handle unique constraint violation (race condition)
        if (checkinError.code === '23505') {
            return {
                success: false,
                xpAwarded: 0,
                dailyXP,
                eventDays,
                totalXP: finalXP,
                daysCheckedIn,
                remainingDays: eventDays - daysCheckedIn,
                message: 'Already checked in today'
            }
        }
        console.error('Daily Check-in Error:', checkinError)
        return {
            success: false,
            xpAwarded: 0,
            dailyXP,
            eventDays,
            totalXP: finalXP,
            daysCheckedIn,
            remainingDays: eventDays - daysCheckedIn,
            message: 'Failed to record daily check-in'
        }
    }

    // 7. Update user's total XP points (atomic, so concurrent awards aren't lost)
    const xpUpdate = await incrementUserXp(supabase, userId, xpToAward)
    if (!xpUpdate.ok) {
        console.error('XP Update Error:', xpUpdate.error)
        // Check-in was recorded, so we continue even if user XP update fails
    }

    // 8. Expire leaderboard caches so rankings update immediately
    revalidateTag('leaderboard', { expire: 0 })
    revalidateTag(`user-${userId}`, { expire: 0 })

    const newDaysCheckedIn = daysCheckedIn + 1
    const remainingDays = Math.max(0, eventDays - newDaysCheckedIn)

    return {
        success: true,
        xpAwarded: xpToAward,
        dailyXP,
        eventDays,
        totalXP: finalXP,
        daysCheckedIn: newDaysCheckedIn,
        remainingDays,
        message: `Awarded ${xpToAward} XP (Day ${newDaysCheckedIn}/${eventDays})`,
        breakdown
    }
}
