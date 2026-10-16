import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => ({}) }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
const { isClubLeadRole } = await import("@/lib/clubs/permissions")

describe("club lead role (Club Management access)", () => {
    it.each(["Club Lead", "Lead", "club lead", "Club Lead (Organizer)", "Organizer", "Organiser", " organizer ", "Club Organizer", "Organizer (GDG)"])("%s manages the club", role => {
        expect(isClubLeadRole(role)).toBe(true)
    })
    it.each(["Club Co-Lead", "Co-Lead", "Co-Organizer", "Event Organizer", "Student Overall Organizer", "Editorial Lead", "Technical Head", "Coordinator", "", null])("%s doesn't", role => {
        expect(isClubLeadRole(role)).toBe(false)
    })
})
