import type { Metadata } from "next"
import { getCachedPublicEvents } from "@/lib/data/public-cache"
import { PublicEventsClient } from "./events-client"

export const metadata: Metadata = {
    title: "Events & Workshops",
    description: "Upcoming and past Technova workshops, hackathons and tech talks at Sharda University.",
}

export default async function PublicEventsPage() {
    const events = await getCachedPublicEvents()
    return <PublicEventsClient events={events} />
}
