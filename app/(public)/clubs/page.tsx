import type { Metadata } from "next"
import { getCachedClubs } from "@/lib/data/public-cache"
import { ClubsClient } from "./clubs-client"

export const metadata: Metadata = {
    title: "Clubs",
    description: "Technova's technical clubs at Sharda University: AI & Robotics, CyberPirates, GDG on Campus, GitHub Club and more.",
}

export default async function ClubsPage() {
    const clubs = await getCachedClubs()
    return <ClubsClient clubs={clubs} />
}
