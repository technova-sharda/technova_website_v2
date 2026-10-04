import type { Metadata } from "next"
import { getCachedClubs } from "@/lib/data/public-cache"
import { ClubsClient } from "./clubs-client"

export const metadata: Metadata = {
    title: "Clubs",
    description: "Technova's technical clubs at Sharda University: AI & Robotics, CyberPirates, GDG on Campus, GitHub Club and more.",
}

// Pre-built and served from the CDN; rebuilt in the background at most once a minute.
export const revalidate = 60

export default async function ClubsPage() {
    const clubs = await getCachedClubs()
    return <ClubsClient clubs={clubs} />
}
