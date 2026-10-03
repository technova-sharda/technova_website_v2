/**
 * XP Module - Feedback Awards
 * Awards XP for feedback submissions
 */

import { createClient } from '@supabase/supabase-js'
import { FEEDBACK_XP_REWARD } from '@/lib/constants/feedback'
import { incrementUserXp } from './increment'

// ==========================================
// Types
// ==========================================

export interface FeedbackXPResult {
    success: boolean
    xpAwarded: number
    message: string
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
// Award XP for feedback submission
// ==========================================

/**
 * Award XP for submitting feedback
 * Uses feedback_responses table to track if XP was awarded (xp_awarded column)
 * and directly updates user's XP points
 */
export async function awardXPForFeedback(
    userId: string,
    formId: string,
    eventId: string
): Promise<FeedbackXPResult> {
    const supabase = getSupabase()

    // Check if XP already awarded for this feedback form
    // Using the feedback_responses table's xp_awarded column
    const { data: response } = await supabase
        .from('feedback_responses')
        .select('id, xp_awarded')
        .eq('form_id', formId)
        .eq('user_id', userId)
        .single()

    if (!response) {
        return {
            success: false,
            xpAwarded: 0,
            message: 'No feedback submission found'
        }
    }

    if (response.xp_awarded) {
        return {
            success: false,
            xpAwarded: 0,
            message: 'XP already awarded for this feedback'
        }
    }

    // Claim the award first, atomically: only one request can flip xp_awarded
    // from false/null to true. Previously the flag was set after awarding, so
    // two quick submissions could both pass the check above and award twice.
    const { data: claimed, error: claimError } = await supabase
        .from('feedback_responses')
        .update({ xp_awarded: true })
        .eq('id', response.id)
        .or('xp_awarded.is.null,xp_awarded.eq.false')
        .select('id')

    if (claimError) {
        console.error('[Feedback] Failed to claim XP award:', claimError.message)
        return { success: false, xpAwarded: 0, message: 'Failed to update XP' }
    }
    if (!claimed || claimed.length === 0) {
        return { success: false, xpAwarded: 0, message: 'XP already awarded for this feedback' }
    }

    // Update user's total XP points (atomic, so concurrent awards aren't lost)
    const xpUpdate = await incrementUserXp(supabase, userId, FEEDBACK_XP_REWARD)
    if (!xpUpdate.ok) {
        console.error('Feedback XP Update Error:', xpUpdate.error)
        // Release the claim so the award can be retried
        await supabase.from('feedback_responses').update({ xp_awarded: false }).eq('id', response.id)
        return {
            success: false,
            xpAwarded: 0,
            message: 'Failed to update XP'
        }
    }

    // Record this in xp_awards history so it shows up on profile.
    // (xp_awards has only user_id, event_id, xp_amount, awarded_at: the old first
    // attempt also sent source/description, which don't exist, so it always failed
    // before falling back to this insert.)
    const { error: xpInsertError } = await supabase.from('xp_awards').insert({
        user_id: userId,
        event_id: eventId,
        xp_amount: FEEDBACK_XP_REWARD
    })

    if (xpInsertError) {
        // 23505: xp_awards allows one row per (user, event), e.g. a second day's feedback
        // form for a multi-day event. The XP total above still includes it.
        console.error('[XP Awards] Insert Error:', xpInsertError.message, xpInsertError.code)
    }

    return {
        success: true,
        xpAwarded: FEEDBACK_XP_REWARD,
        message: `Earned +${FEEDBACK_XP_REWARD} XP for feedback!`
    }
}

/**
 * Check if user has been awarded XP for feedback on a form
 */
export async function hasFeedbackXPBeenAwarded(
    userId: string,
    formId: string
): Promise<boolean> {
    const supabase = getSupabase()

    const { data } = await supabase
        .from('feedback_responses')
        .select('xp_awarded')
        .eq('form_id', formId)
        .eq('user_id', userId)
        .single()

    return data?.xp_awarded || false
}
