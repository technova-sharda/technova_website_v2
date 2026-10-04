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

export default async function ClubDetailsPage({ params }: Props) {
    const { slug } = await params
    const dbName = CLUB_SLUG_TO_DB_NAME[slug]
    const [clubData, pastEvents] = dbName
        ? await Promise.all([getCachedClubWithMembers(dbName), getCachedClubPastEvents(slug)])
        : [null, []]
    return <ClubDetailsClient slug={slug} clubData={clubData} pastEvents={pastEvents} />
}
