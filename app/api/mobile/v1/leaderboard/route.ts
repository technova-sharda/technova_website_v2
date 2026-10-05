import { NextRequest } from "next/server"
import { requireUser, fail, json } from "@/lib/mobile/api"
import { getLeaderboardData, getUserRank, type TimeFilter } from "@/lib/actions/leaderboard"

/** GET /api/mobile/v1/leaderboard?period=all-time|monthly|weekly&page=1 (no emails) */
export async function GET(req: NextRequest) {
    const session = await requireUser()
    if (!session) return fail(401, "Sign in again")
    const p = req.nextUrl.searchParams.get("period")
    const period: TimeFilter = p === "weekly" || p === "monthly" || p === "yearly" ? p : "all-time"
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1)
    const [board, me] = await Promise.all([getLeaderboardData(page, 30, undefined, period), getUserRank(session.user.id!).catch(() => null)])
    return json({
        period, page: board.page, totalPages: board.totalPages,
        users: board.users.map((u, i) => ({ id: u.id, name: u.name, image: u.image ?? null, xp: u.xp_points, rank: (board.page - 1) * board.pageSize + i + 1, isMe: u.id === session.user.id })),
        me: me ? { rank: me.rank, xp: me.xp_points, totalUsers: me.totalUsers } : null,
    })
}
