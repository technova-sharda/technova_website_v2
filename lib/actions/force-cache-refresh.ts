'use server'

import { revalidateTag } from 'next/cache'
import { auth } from '@/lib/auth'

/**
 * Force revalidate all leaderboard caches
 * Use this after manual database updates
 */
export async function forceRevalidateLeaderboard() {
    // `getServerSession` (NextAuth v4) doesn't exist in Auth.js v5, so this button
    // used to crash on every click. `auth()` is the v5 equivalent.
    const session = await auth()

    // Only allow admins to force revalidation
    if (session?.user?.role !== 'super_admin' && session?.user?.role !== 'admin') {
        return { success: false, message: 'Unauthorized' }
    }

    try {
        // Every leaderboard cache entry, including each user's rank, carries the
        // 'leaderboard' tag, so one call expires all of them (no need to load every user).
        revalidateTag('leaderboard', { expire: 0 })

        return {
            success: true,
            message: 'Leaderboard cache cleared successfully'
        }
    } catch (error) {
        console.error('Cache revalidation error:', error)
        return { success: false, message: 'Failed to clear cache' }
    }
}
