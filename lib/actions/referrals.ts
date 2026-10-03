'use server'

import { createClient as createServerClient } from "@supabase/supabase-js"
import { auth } from "@/lib/auth"

async function getSupabase() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

/**
 * Generate a unique referral code for a user
 * Format: First 8 chars of user ID + random suffix
 * Note: This is a private helper, not exported as 'use server' requires async exports
 */
function generateReferralCode(userId: string): string {
    const userPrefix = userId.slice(0, 8)
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `${userPrefix}-${randomSuffix}`
}

/**
 * Get or create a referral code for a user
 */
export async function getUserReferralCode(userId: string): Promise<string> {
    const supabase = await getSupabase()

    // Check if user already has a referral code in their profile
    const { data: existingCode } = await supabase
        .from('referrals')
        .select('referral_code')
        .eq('referrer_id', userId)
        .limit(1)
        .maybeSingle()

    if (existingCode?.referral_code) {
        return existingCode.referral_code
    }

    // Generate new code
    return generateReferralCode(userId)
}

/**
 * Get the referral link for an event
 */
export async function getReferralLink(eventSlugOrId: string): Promise<{
    link: string
    code: string
} | null> {
    const session = await auth()
    if (!session?.user?.id) return null

    const code = await getUserReferralCode(session.user.id)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.technovashardauniversity.in'

    return {
        link: `${baseUrl}/events/${eventSlugOrId}?ref=${code}`,
        code
    }
}

/**
 * Get referral statistics for a user
 */
export async function getUserReferralStats(userId?: string): Promise<{
    totalReferrals: number
    totalXPEarned: number
    recentReferrals: Array<{
        eventTitle: string
        refereeName: string
        xpAwarded: number
        createdAt: string
    }>
}> {
    const session = await auth()
    const targetUserId = userId || session?.user?.id

    if (!targetUserId) {
        return { totalReferrals: 0, totalXPEarned: 0, recentReferrals: [] }
    }

    const supabase = await getSupabase()

    // Get all referrals for this user
    const { data: referrals, error } = await supabase
        .from('referrals')
        .select(`
            id,
            xp_awarded,
            created_at,
            event_id,
            referee_id
        `)
        .eq('referrer_id', targetUserId)
        .order('created_at', { ascending: false })

    if (error || !referrals) {
        return { totalReferrals: 0, totalXPEarned: 0, recentReferrals: [] }
    }

    // Get event titles
    const eventIds = [...new Set(referrals.map(r => r.event_id))]
    const { data: events } = await supabase
        .from('events')
        .select('id, title')
        .in('id', eventIds)

    // Get referee names
    const refereeIds = [...new Set(referrals.map(r => r.referee_id))]
    const { data: referees } = await supabase
        .schema('next_auth' as unknown as 'public')
        .from('users')
        .select('id, name')
        .in('id', refereeIds)

    const eventMap = new Map(events?.map(e => [e.id, e.title]) || [])
    const refereeMap = new Map(referees?.map(u => [u.id, u.name]) || [])

    const totalXPEarned = referrals.reduce((sum, r) => sum + (r.xp_awarded || 0), 0)

    const recentReferrals = referrals.slice(0, 5).map(r => ({
        eventTitle: eventMap.get(r.event_id) || 'Unknown Event',
        refereeName: refereeMap.get(r.referee_id) || 'Unknown User',
        xpAwarded: r.xp_awarded || 0,
        createdAt: r.created_at
    }))

    return {
        totalReferrals: referrals.length,
        totalXPEarned,
        recentReferrals
    }
}

/**
 * Get referral leaderboard - top referrers
 */
export async function getReferralLeaderboard(limit: number = 10): Promise<Array<{
    userId: string
    userName: string
    userImage: string | null
    totalReferrals: number
    totalXP: number
}>> {
    const supabase = await getSupabase()

    // Get aggregated referral stats
    const { data: referralStats, error } = await supabase
        .from('referrals')
        .select('referrer_id, xp_awarded')

    if (error || !referralStats) return []

    // Aggregate by referrer
    const aggregated = new Map<string, { count: number; xp: number }>()
    for (const ref of referralStats) {
        const existing = aggregated.get(ref.referrer_id) || { count: 0, xp: 0 }
        aggregated.set(ref.referrer_id, {
            count: existing.count + 1,
            xp: existing.xp + (ref.xp_awarded || 0)
        })
    }

    // Sort by count and take top N
    const sorted = Array.from(aggregated.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit)

    if (sorted.length === 0) return []

    // Get user details
    const userIds = sorted.map(([id]) => id)
    const { data: users } = await supabase
        .schema('next_auth' as unknown as 'public')
        .from('users')
        .select('id, name, image')
        .in('id', userIds)

    const userMap = new Map(users?.map(u => [u.id, { name: u.name, image: u.image }]) || [])

    return sorted.map(([userId, stats]) => ({
        userId,
        userName: userMap.get(userId)?.name || 'Unknown',
        userImage: userMap.get(userId)?.image || null,
        totalReferrals: stats.count,
        totalXP: stats.xp
    }))
}
