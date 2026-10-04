import { auth } from "@/lib/auth"
import { getLeaderboardData, getTopThreeUsers, getUserRank } from "@/lib/actions/leaderboard"
import { Leaderboard } from "@/components/dashboard/leaderboard"
import { MyRankWidget } from "@/components/dashboard/my-rank-widget"

export default async function DashboardPage() {
    const session = await auth()

    // Fetch all data in parallel
    const [leaderboardData, topThree, userRank] = await Promise.all([
        getLeaderboardData(1, 10),
        getTopThreeUsers(),
        session?.user?.id ? getUserRank(session.user.id) : null
    ])

    return (
        <div className="min-h-screen bg-black px-3 py-4 pt-20 sm:px-4 sm:py-6 md:p-8 md:pt-24 space-y-6 sm:space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{session?.user?.name}</span>
                    </h1>
                    <p className="text-gray-400 mt-1">Here&apos;s your activity overview and ranking.</p>
                </div>
                <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 backdrop-blur-md">
                    Season 2025-2026
                </div>
            </div>

            {/* My Rank Widget */}
            <MyRankWidget rankInfo={userRank} userName={session?.user?.name || undefined} />

            {/* Leaderboard Section */}
            <Leaderboard initialData={leaderboardData} topThree={topThree} />

            {/* Background Decorative Elements */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-[-1] overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px]" />
            </div>
        </div>
    )
}
