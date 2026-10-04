import { getCachedPublicEvents, getCachedSiteStats } from "@/lib/data/public-cache"
import { LandingClient, type LandingEvent, type LandingStat } from "@/components/landing/landing-client"

/** Up to 3 cards: live/upcoming first (soonest first), topped up with the latest past events. Decided on the server so the HTML and the browser agree. */
function pickLandingEvents(events: any[]): LandingEvent[] {
    const now = Date.now()
    const toCard = (e: any, state: LandingEvent["state"]): LandingEvent => ({
        id: e.id, slug: e.slug, title: e.title, banner: e.banner, start_time: e.start_time, end_time: e.end_time,
        is_virtual: e.is_virtual, venue: e.venue, clubName: e.club?.name ?? null, state,
    })
    const current = events
        .filter((e: any) => !e.is_past_event && e.status === "live" && new Date(e.end_time).getTime() > now)
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 3)
        .map((e: any) => toCard(e, new Date(e.start_time).getTime() <= now ? "live" : "upcoming"))
    const recent = events
        .filter((e: any) => new Date(e.end_time).getTime() <= now || e.is_past_event || e.status === "completed")
        .sort((a: any, b: any) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        .map((e: any) => toCard(e, "past"))
    return [...current, ...recent].slice(0, 3)
}

/** 1,378 → 1,300 (+). Small numbers stay exact. */
function roundDown(n: number) {
    if (n >= 1000) return Math.floor(n / 100) * 100
    if (n >= 100) return Math.floor(n / 50) * 50
    return n
}

// Pre-built and served from the CDN; rebuilt in the background at most once a minute.
export const revalidate = 60

export default async function LandingPage() {
    const [stats, events] = await Promise.all([
        getCachedSiteStats().catch(() => null),
        getCachedPublicEvents().catch(() => [] as any[]),
    ])

    const statCards: LandingStat[] = stats
        ? [
            { value: stats.clubs, suffix: "", label: "Specialized Clubs" },
            { value: roundDown(stats.students), suffix: "+", label: "Students on Technova" },
            { value: roundDown(stats.registrations), suffix: "+", label: "Event Registrations" },
            { value: stats.events, suffix: "", label: "Events Hosted" },
        ]
        : [
            { value: 7, suffix: "", label: "Specialized Clubs" },
            { value: 1000, suffix: "+", label: "Students on Technova" },
            { value: 1000, suffix: "+", label: "Event Registrations" },
            { value: 15, suffix: "+", label: "Events Hosted" },
        ]

    const upNext = pickLandingEvents(events)

    return <LandingClient stats={statCards} events={upNext} />
}
