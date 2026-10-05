import { requireUser, fail, json } from "@/lib/mobile/api"
import { getUserRank } from "@/lib/actions/leaderboard"

/** GET /api/mobile/v1/me: the signed-in student's profile and standing. */
export async function GET() {
    const session = await requireUser()
    if (!session) return fail(401, "Sign in again")
    const u = session.user as any
    const rank = await getUserRank(u.id).catch(() => null)
    return json({
        id: u.id, name: u.name, email: u.email, image: u.image, role: u.role ?? "student",
        systemId: u.system_id ?? null, course: u.course ?? null, year: u.year ?? null, section: u.section ?? null,
        xp: u.xp_points ?? rank?.xp_points ?? 0, rank: rank?.rank ?? null, totalUsers: rank?.totalUsers ?? null, eventsAttended: rank?.eventsAttended ?? 0,
        needsOnboarding: (u.role ?? "student") === "student" && !u.system_id,
        isStaff: ["admin", "super_admin"].includes(u.role),
    })
}
