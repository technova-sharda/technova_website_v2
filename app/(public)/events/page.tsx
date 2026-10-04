import type { Metadata } from "next"
import { getCachedPublicEvents } from "@/lib/data/public-cache"
import { PublicEventsClient } from "./events-client"

export const metadata: Metadata = {
    title: "Events & Workshops",
    description: "Upcoming and past Technova workshops, hackathons and tech talks at Sharda University.",
}

// Pre-built and served from the CDN; rebuilt in the background at most once a minute.
export const revalidate = 60

export default async function PublicEventsPage() {
    const events = await getCachedPublicEvents()
    return <PublicEventsClient events={events} />
}
