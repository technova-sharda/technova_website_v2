import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getAnalyticsDataset } from "@/lib/analytics/dataset"
import { audience, clubStats, eventSummaries, monthlyTrend, overview, ratingDistribution, repeatParticipation, xpDistribution } from "@/lib/analytics/metrics"
import { AnalyticsDashboard } from "./analytics-dashboard"

export const metadata = { title: "Analytics" }

export default async function AnalyticsPage() {
    const session = await auth()
    if (session?.user?.role !== "super_admin") redirect("/admin/dashboard")

    const ds = await getAnalyticsDataset()
    return (
        <AnalyticsDashboard
            generatedAt={ds.generatedAt}
            kpis={overview(ds)}
            monthly={monthlyTrend(ds)}
            events={eventSummaries(ds)}
            byYear={audience(ds, "year")}
            byCourse={audience(ds, "course").slice(0, 8)}
            clubs={clubStats(ds)}
            ratings={ratingDistribution(ds)}
            repeat={repeatParticipation(ds)}
            xp={xpDistribution(ds)}
        />
    )
}
