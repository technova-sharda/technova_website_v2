import type { Metadata } from "next"
import { getCachedClubMembersByName } from "@/lib/data/public-cache"
import { LeadershipClient } from "./leadership-client"

export const metadata: Metadata = {
    title: "Leadership",
    description: "Meet the faculty mentors and student executives who lead Technova at Sharda University.",
}

export default async function LeadershipPage() {
    const members = await getCachedClubMembersByName("Technova Executives")
    return <LeadershipClient members={members} />
}
