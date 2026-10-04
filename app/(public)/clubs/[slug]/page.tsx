import type { Metadata } from "next"
import { CLUB_SLUG_TO_DB_NAME } from "@/lib/constants/club-slugs"
import { getCachedClubPastEvents, getCachedClubWithMembers } from "@/lib/data/public-cache"
import { ClubDetailsClient } from "./club-client"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const name = CLUB_SLUG_TO_DB_NAME[slug]
    return name ? { title: name, description: `${name} at Technova, Sharda University: team, contacts and past events.` } : {}
}

// Every club page is pre-built and served from the CDN, refreshed at most every 5 minutes.
export const revalidate = 300
export function generateStaticParams() {
    return Object.keys(CLUB_SLUG_TO_DB_NAME).map(slug => ({ slug }))
}

export default async function ClubDetailsPage({ params }: Props) {
    const { slug } = await params
    const dbName = CLUB_SLUG_TO_DB_NAME[slug]
    const [clubData, pastEvents] = dbName
        ? await Promise.all([getCachedClubWithMembers(dbName), getCachedClubPastEvents(slug)])
        : [null, []]
    return <ClubDetailsClient slug={slug} clubData={clubData} pastEvents={pastEvents} />
}
