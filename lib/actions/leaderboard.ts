'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { unstable_cache } from 'next/cache'
import { fetchAllRows, fetchInChunks } from '@/lib/supabase/fetch-all'

export type LeaderboardUser = {
    id: string
    name: string
    email: string
    image?: string | null
    xp_points: number
    system_id?: string
    role?: string
}

export interface LeaderboardResponse {
    users: LeaderboardUser[]
    totalCount: number
    page: number
    pageSize: number
    totalPages: number
    timeFilter: TimeFilter
}

export type TimeFilter = 'all-time' | 'weekly' | 'monthly' | 'yearly'

/**
 * Get date range based on time filter
 */
/**
 * XP earned since `startDate`, per user, from every place XP is recorded:
 *  - daily_checkins: event attendance (by far the largest source)
 *  - xp_awards: feedback and other awards
 *  - referrals
 * Previously only xp_awards and referrals were counted, so the weekly, monthly and
 * yearly boards ignored attendance XP (about 97% of all XP). Each query is paged
 * past Supabase's 1000-row cap.
 */
async function aggregatePeriodXp(
    supabase: ReturnType<typeof createAdminClient>,
    startDate: string
): Promise<{ userXpMap: Map<string, number>; error: string | null }> {
    const userXpMap = new Map<string, number>()
    const add = (userId: string | null | undefined, amount: number | null | undefined) => {
        if (userId && amount) userXpMap.set(userId, (userXpMap.get(userId) || 0) + amount)
    }

    const [checkins, awards, referrals] = await Promise.all([
        fetchAllRows<{ user_id: string; xp_awarded: number }>((from, to) =>
            supabase.from('daily_checkins').select('user_id, xp_awarded')
                .gte('created_at', startDate).order('id', { ascending: true }).range(from, to)),
        fetchAllRows<{ user_id: string; xp_amount: number }>((from, to) =>
            supabase.from('xp_awards').select('user_id, xp_amount')
                .gte('awarded_at', startDate).order('id', { ascending: true }).range(from, to)),
        fetchAllRows<{ referrer_id: string; xp_awarded: number }>((from, to) =>
            supabase.from('referrals').select('referrer_id, xp_awarded')
                .gte('created_at', startDate).order('id', { ascending: true }).range(from, to)),
    ])

    if (awards.error) return { userXpMap, error: awards.error }
    if (checkins.error) console.error('Error fetching check-in XP:', checkins.error)
    if (referrals.error) console.error('Error fetching referral XP:', referrals.error)

    checkins.data.forEach(c => add(c.user_id, c.xp_awarded))
    awards.data.forEach(a => add(a.user_id, a.xp_amount))
    referrals.data.forEach(r => add(r.referrer_id, r.xp_awarded))

    return { userXpMap, error: null }
}

function getDateRange(filter: TimeFilter): { startDate: string | null } {
    const now = new Date()

    switch (filter) {
        case 'weekly': {
            const weekAgo = new Date(now)
            weekAgo.setDate(weekAgo.getDate() - 7)
            return { startDate: weekAgo.toISOString() }
        }
        case 'monthly': {
            const monthAgo = new Date(now)
            monthAgo.setMonth(monthAgo.getMonth() - 1)
            return { startDate: monthAgo.toISOString() }
        }
        case 'yearly': {
            const startOfYear = new Date(now.getFullYear(), 0, 1)
            return { startDate: startOfYear.toISOString() }
        }
        case 'all-time':
        default:
            return { startDate: null }
    }
}

/**
 * Internal function to fetch leaderboard data from database
 * For time-filtered views, aggregates XP from xp_awards table
 */
async function fetchLeaderboardFromDB(
    page: number,
    pageSize: number,
    search?: string,
    timeFilter: TimeFilter = 'all-time'
): Promise<LeaderboardResponse> {
    const supabase = createAdminClient()
    const offset = (page - 1) * pageSize

    // For all-time, use the optimized direct query on users table
    if (timeFilter === 'all-time') {
        let query = supabase
            .schema('next_auth')
            .from('users')
            .select('id, name, email, image, xp_points, role', { count: 'exact' })
            .order('xp_points', { ascending: false })

        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`
            query = query.or(`name.ilike.${searchTerm},email.ilike.${searchTerm}`)
        }

        query = query.range(offset, offset + pageSize - 1)

        const { data: users, error, count } = await query

        if (error) {
            console.error('Error fetching leaderboard:', error)
            return { users: [], totalCount: 0, page, pageSize, totalPages: 0, timeFilter }
        }

        return {
            users: users as LeaderboardUser[],
            totalCount: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize),
            timeFilter
        }
    }

    // For time-filtered views, aggregate XP earned in the period from every source
    const { startDate } = getDateRange(timeFilter)
    const { userXpMap, error: awardsError } = await aggregatePeriodXp(supabase, startDate!)

    if (awardsError) {
        console.error('Error fetching XP awards:', awardsError)
        return { users: [], totalCount: 0, page, pageSize, totalPages: 0, timeFilter }
    }

    // Get user details for users with XP in this period
    const userIds = Array.from(userXpMap.keys())

    if (userIds.length === 0) {
        return { users: [], totalCount: 0, page, pageSize, totalPages: 0, timeFilter }
    }

    // Chunked: everyone with XP in the period can be hundreds of ids, too long for one request URL
    const searchTerm = search && search.trim() ? `%${search.trim()}%` : null
    const { data: users, error: usersError } = await fetchInChunks<any>(userIds, chunk => {
        let usersQuery = supabase
            .schema('next_auth')
            .from('users')
            .select('id, name, email, image, role')
            .in('id', chunk)
        if (searchTerm) {
            usersQuery = usersQuery.or(`name.ilike.${searchTerm},email.ilike.${searchTerm}`)
        }
        return usersQuery
    })

    if (usersError) {
        console.error('Error fetching users:', usersError)
        return { users: [], totalCount: 0, page, pageSize, totalPages: 0, timeFilter }
    }

    // Combine user data with aggregated XP and sort
    const rankedUsers: LeaderboardUser[] = users
        .map(user => ({
            ...user,
            xp_points: userXpMap.get(user.id) || 0
        }))
        .sort((a, b) => b.xp_points - a.xp_points)

    // Apply pagination
    const paginatedUsers = rankedUsers.slice(offset, offset + pageSize)
    const totalCount = rankedUsers.length

    return {
        users: paginatedUsers,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        timeFilter
    }
}

/**
 * Get paginated leaderboard data with optional search and time filter
 * Cached for 60 seconds to reduce database hits
 */
export async function getLeaderboardData(
    page: number = 1,
    pageSize: number = 10,
    search?: string,
    timeFilter: TimeFilter = 'all-time'
): Promise<LeaderboardResponse> {
    const cacheKey = `leaderboard-${page}-${pageSize}-${search || 'all'}-${timeFilter}`

    const getCachedData = unstable_cache(
        async () => fetchLeaderboardFromDB(page, pageSize, search, timeFilter),
        [cacheKey],
        {
            revalidate: 60,
            tags: ['leaderboard']
        }
    )

    return getCachedData()
}

/**
 * Internal function to fetch top 3 users from database
 */
async function fetchTopThreeFromDB(timeFilter: TimeFilter = 'all-time'): Promise<LeaderboardUser[]> {
    const supabase = createAdminClient()

    if (timeFilter === 'all-time') {
        const { data: users, error } = await supabase
            .schema('next_auth')
            .from('users')
            .select('id, name, email, image, xp_points, role')
            .order('xp_points', { ascending: false })
            .limit(3)

        if (error) {
            console.error('Error fetching top 3:', error)
            return []
        }
        return users as LeaderboardUser[]
    }

    // For time-filtered, aggregate XP earned in the period from every source and get top 3
    const { startDate } = getDateRange(timeFilter)
    const { userXpMap, error } = await aggregatePeriodXp(supabase, startDate!)

    if (error) {
        console.error('Error fetching top 3 awards:', error)
        return []
    }

    const sortedUsers = Array.from(userXpMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)

    if (sortedUsers.length === 0) return []

    const userIds = sortedUsers.map(u => u[0])

    const { data: users } = await supabase
        .schema('next_auth')
        .from('users')
        .select('id, name, email, image, role')
        .in('id', userIds)

    if (!users) return []

    // Combine with XP and sort
    return users
        .map(user => ({
            ...user,
            xp_points: userXpMap.get(user.id) || 0
        }))
        .sort((a, b) => b.xp_points - a.xp_points) as LeaderboardUser[]
}

/**
 * Get top 3 users for podium display
 * Cached for 60 seconds
 */
export async function getTopThreeUsers(timeFilter: TimeFilter = 'all-time'): Promise<LeaderboardUser[]> {
    const getCachedTopThree = unstable_cache(
        () => fetchTopThreeFromDB(timeFilter),
        [`leaderboard-top-three-${timeFilter}`],
        {
            revalidate: 60,
            tags: ['leaderboard']
        }
    )

    return getCachedTopThree()
}

// ==========================================
// User Rank Lookup
// ==========================================

export interface UserRankInfo {
    rank: number
    xp_points: number
    totalUsers: number
    percentile: number
    isTopTen: boolean
    eventsAttended: number
}

/**
 * Get a specific user's rank efficiently (all-time only)
 */
async function fetchUserRankFromDB(userId: string): Promise<UserRankInfo | null> {
    const supabase = createAdminClient()

    const { data: user, error: userError } = await supabase
        .schema('next_auth')
        .from('users')
        .select('xp_points')
        .eq('id', userId)
        .single()

    if (userError || !user) {
        console.error('Error fetching user XP:', userError)
        return null
    }

    const { count: higherCount, error: countError } = await supabase
        .schema('next_auth')
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gt('xp_points', user.xp_points)

    if (countError) {
        console.error('Error counting higher ranked users:', countError)
        return null
    }

    const { count: totalCount, error: totalError } = await supabase
        .schema('next_auth')
        .from('users')
        .select('*', { count: 'exact', head: true })

    if (totalError) {
        console.error('Error counting total users:', totalError)
        return null
    }

    const rank = (higherCount || 0) + 1
    const totalUsers = totalCount || 1
    const percentile = Math.round(((totalUsers - rank) / totalUsers) * 100)

    // Get events attended count from registrations table
    const { count: eventsCount } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('attended', true)

    return {
        rank,
        xp_points: user.xp_points,
        totalUsers,
        percentile,
        isTopTen: rank <= 10,
        eventsAttended: eventsCount || 0
    }
}

/**
 * Get user rank with caching (60s)
 */
export async function getUserRank(userId: string): Promise<UserRankInfo | null> {
    const getCachedRank = unstable_cache(
        () => fetchUserRankFromDB(userId),
        [`user-rank-${userId}`],
        {
            revalidate: 60,
            tags: ['leaderboard', `user-${userId}`]
        }
    )

    return getCachedRank()
}
