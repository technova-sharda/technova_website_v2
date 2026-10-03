'use server'

import { createClient as createServerClient } from "@supabase/supabase-js"
import { auth } from "@/lib/auth"
import { findReferrerIdByCode } from "@/lib/referrals/lookup"
import { REFERRAL_XP_REWARD } from "@/lib/referrals/process"
import { incrementUserXp } from "@/lib/xp/increment"
import { fetchAllRows } from "@/lib/supabase/fetch-all"

async function getSupabase() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

/**
 * Process all missed referrals from the registrations table
 * This finds registrations with referred_by set but no matching entry in referrals table
 * and creates the referral records + awards XP
 *
 * Super admin only. Exported functions in 'use server' files are public endpoints,
 * so the check lives here as well as in the API route that calls it.
 */
export async function processMissedReferrals(): Promise<{
    processed: number
    errors: string[]
    details: Array<{ registrationId: string; referrerId: string; status: string }>
}> {
    const session = await auth()
    if (session?.user?.role !== 'super_admin') {
        return { processed: 0, errors: ['Unauthorized'], details: [] }
    }

    const supabase = await getSupabase()
    const errors: string[] = []
    const details: Array<{ registrationId: string; referrerId: string; status: string }> = []

    // 1. Get all registrations with a referred_by value (paged past the 1000-row cap)
    const { data: registrations, error: regError } = await fetchAllRows<{
        id: string
        user_id: string
        event_id: string
        referred_by: string
    }>((from, to) =>
        supabase
            .from('registrations')
            .select('id, user_id, event_id, referred_by')
            .not('referred_by', 'is', null)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to)
    )

    if (regError) {
        return { processed: 0, errors: [`Failed to fetch registrations: ${regError}`], details: [] }
    }

    if (registrations.length === 0) {
        return { processed: 0, errors: [], details: [] }
    }

    let processed = 0

    for (const reg of registrations) {
        const referralCode = reg.referred_by
        const refereeId = reg.user_id
        const eventId = reg.event_id

        // Find the referrer by the user-id prefix in the code
        const referrer = await findReferrerIdByCode(supabase, referralCode)
        if ('error' in referrer) {
            errors.push(`${referrer.error}: ${referralCode}`)
            const status = referrer.error === 'Invalid referral code format' ? 'invalid_code'
                : referrer.error === 'Referrer not found' ? 'referrer_not_found'
                : referrer.error === 'Ambiguous referral code' ? 'ambiguous_code'
                : 'db_error'
            details.push({ registrationId: reg.id, referrerId: 'unknown', status })
            continue
        }
        const referrerId = referrer.id

        // Skip self-referrals
        if (referrerId === refereeId) {
            details.push({ registrationId: reg.id, referrerId, status: 'self_referral' })
            continue
        }

        // Check if referral already exists
        const { data: existingReferral } = await supabase
            .from('referrals')
            .select('id')
            .eq('referrer_id', referrerId)
            .eq('referee_id', refereeId)
            .eq('event_id', eventId)
            .maybeSingle()

        if (existingReferral) {
            details.push({ registrationId: reg.id, referrerId, status: 'already_processed' })
            continue
        }

        // Insert the referral record
        const { error: insertError } = await supabase
            .from('referrals')
            .insert({
                referrer_id: referrerId,
                referee_id: refereeId,
                event_id: eventId,
                referral_code: referralCode,
                xp_awarded: REFERRAL_XP_REWARD
            })

        if (insertError) {
            if (insertError.code === '23505') {
                details.push({ registrationId: reg.id, referrerId, status: 'already_processed' })
                continue
            }
            errors.push(`Failed to insert referral for ${reg.id}: ${insertError.message}`)
            details.push({ registrationId: reg.id, referrerId, status: `insert_error: ${insertError.message}` })
            continue
        }

        // Award XP to the referrer (atomic, so concurrent awards aren't lost)
        const xp = await incrementUserXp(supabase, referrerId, REFERRAL_XP_REWARD)
        if (!xp.ok) {
            errors.push(`Failed to update XP for ${referrerId}: ${xp.error}`)
            details.push({ registrationId: reg.id, referrerId, status: `xp_update_error: ${xp.error}` })
            continue
        }

        processed++
        details.push({ registrationId: reg.id, referrerId, status: 'success' })
    }

    return { processed, errors, details }
}
