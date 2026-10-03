import { NextResponse, NextRequest } from "next/server"
import { getHackathonSettings, getSchedule, getPublicShortlistedTeams } from "@/lib/actions/hackathon"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"

export const revalidate = 10

export async function GET(req: NextRequest) {
    // Rate limit: 20 requests per minute
    const rateLimit = checkRateLimit(getClientIdentifier(req), { limit: 20, windowSeconds: 60, bucket: 'hackathon-live' })
    if (!rateLimit.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const [settings, schedule, shortlistedTeams] = await Promise.all([
        getHackathonSettings(),
        getSchedule(),
        getPublicShortlistedTeams()
    ])

    return NextResponse.json({ settings, schedule, shortlistedTeams })
}
