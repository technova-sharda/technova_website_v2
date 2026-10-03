'use server'

import { createClient as createServerClient } from "@supabase/supabase-js"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { fetchAllRows, fetchInChunks } from "@/lib/supabase/fetch-all"

async function getSupabase() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

/**
 * Profile links are rendered as clickable links on public pages, so only plain
 * http(s) URLs are accepted. "github.com/name" (no scheme) gets https:// added,
 * since without it browsers treat the value as a relative link.
 */
function cleanProfileUrl(value: FormDataEntryValue | null): { url: string | null } | { invalid: true } {
    const raw = typeof value === "string" ? value.trim() : ""
    if (!raw) return { url: null }
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
    try {
        const parsed = new URL(withScheme)
        if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || !parsed.hostname.includes(".")) {
            return { invalid: true }
        }
        return { url: withScheme.slice(0, 500) }
    } catch {
        return { invalid: true }
    }
}

const PROFILE_LINK_FIELDS = [
    ["github_url", "GitHub"],
    ["linkedin_url", "LinkedIn"],
    ["portfolio_url", "Portfolio"],
    ["kaggle_url", "Kaggle"],
    ["leetcode_url", "LeetCode"],
    ["codeforces_url", "Codeforces"],
    ["codechef_url", "CodeChef"],
    ["gfg_url", "GeeksforGeeks"],
    ["hackerrank_url", "HackerRank"],
] as const

export async function updateProfile(formData: FormData) {
    const session = await auth()
    if (!session || !session.user || !session.user.id) {
        throw new Error("Not authenticated")
    }

    const supabase = await getSupabase()
    const userId = session.user.id

    const section = (formData.get("section") as string) || null
    const system_id = (formData.get("system_id") as string) || null
    const yearStr = formData.get("year") as string
    const year = yearStr ? parseInt(yearStr) : null
    const course = (formData.get("course") as string) || null
    const mobile = (formData.get("mobile") as string) || null
    const skills = ((formData.get("skills") as string) || "").split(',').map(s => s.trim()).filter(s => s.length > 0)

    // Social Links (validated: only http/https links)
    const links: Record<string, string | null> = {}
    for (const [field, label] of PROFILE_LINK_FIELDS) {
        const cleaned = cleanProfileUrl(formData.get(field))
        if ("invalid" in cleaned) {
            return { error: `${label} link must be a valid web address, like https://${field === "github_url" ? "github.com/your-name" : "example.com/your-profile"}` }
        }
        links[field] = cleaned.url
    }
    const { github_url, linkedin_url, portfolio_url, kaggle_url, leetcode_url, codeforces_url, codechef_url, gfg_url, hackerrank_url } = links

    // 1. Update User Details (next_auth.users)
    const { error: userError } = await supabase.schema('next_auth').from('users').update({
        section,
        system_id,
        year,
        course,
        mobile
    }).eq('id', userId)

    if (userError) {
        console.error("User Update Error:", userError)
        return { error: "Failed to update basic info" }
    }

    // 2. Update Profile Details (public.profiles)
    // Check if profile exists first
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', userId).single()

    if (!profile) {
        await supabase.from('profiles').insert({
            id: userId,
            skills,
            github_url,
            linkedin_url,
            portfolio_url,
            kaggle_url,
            leetcode_url,
            codeforces_url,
            codechef_url,
            gfg_url,
            hackerrank_url
        })
    } else {
        await supabase.from('profiles').update({
            skills,
            github_url,
            linkedin_url,
            portfolio_url,
            kaggle_url,
            leetcode_url,
            codeforces_url,
            codechef_url,
            gfg_url,
            hackerrank_url
        }).eq('id', userId)
    }

    revalidatePath("/profile/edit")
    revalidatePath("/buddy-finder")
    return { success: true }
}

export async function getProfileData() {
    const session = await auth()
    if (!session || !session.user) return null

    const supabase = await getSupabase()
    const userId = session.user.id

    // Fetch User Data
    const { data: user } = await supabase.schema('next_auth').from('users').select('*').eq('id', userId).single()

    // Fetch Profile Data
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()

    return {
        ...user,
        skills: profile?.skills || [],
        github_url: profile?.github_url || null,
        linkedin_url: profile?.linkedin_url || null,
        portfolio_url: profile?.portfolio_url || null,
        kaggle_url: profile?.kaggle_url || null,
        leetcode_url: profile?.leetcode_url || null,
        codeforces_url: profile?.codeforces_url || null,
        codechef_url: profile?.codechef_url || null,
        gfg_url: profile?.gfg_url || null,
        hackerrank_url: profile?.hackerrank_url || null
    }
}

export async function searchBuddies(query?: string, skill?: string) {
    // Results include students' emails (for the "contact" button), so only
    // signed-in users can search. Anyone could call this before and download
    // every student's name, email, course and year.
    const session = await auth()
    if (!session?.user?.id) return null  // the page shows a "Sign in" prompt

    const supabase = await getSupabase()

    // Use query as the unified search term (skill param kept for backwards compatibility)
    const searchTerm = (query || skill || '').toLowerCase().trim()

    // Get all profiles (paged: there are more than 1000 profiles, and a single
    // response stops at 1000, so ~150 students never appeared in results)
    const { data: profiles, error: profilesError } = await fetchAllRows<{ id: string; skills: string[] | null }>((from, to) =>
        supabase
            .from('profiles')
            .select('id, skills')
            .order('id', { ascending: true })
            .range(from, to)
    )

    if (profilesError) {
        console.error("Search Buddies Error:", profilesError)
        return []
    }

    if (profiles.length === 0) {
        return []
    }

    // Get user IDs from profiles
    const userIds = profiles.map(p => p.id)

    // Fetch user details from next_auth.users in chunks to avoid URL length limits
    const { data: allUsers, error: usersError } = await fetchInChunks<any>(userIds, chunk =>
        supabase
            .schema('next_auth')
            .from('users')
            .select('id, name, image, role, course, year, email')
            .in('id', chunk)
    , 100)

    if (usersError) {
        console.error("Search Users Error:", usersError)
        return []
    }

    // Create a map of profiles by id for quick lookup
    const profilesMap = new Map(profiles.map(p => [p.id, p.skills]))

    // Combine users with their skills
    let buddies = allUsers.map((user: any) => ({
        id: user.id,
        name: user.name,
        image: user.image,
        role: user.role,
        course: user.course,
        year: user.year,
        email: user.email,
        skills: profilesMap.get(user.id) || []
    }))

    // Filter by search term (case-insensitive) - matches name OR skills
    if (searchTerm !== '') {
        buddies = buddies.filter(b => {
            // Check if name matches (partial, case-insensitive)
            const nameMatch = b.name ? b.name.toLowerCase().includes(searchTerm) : false

            // Check if any skill matches (partial, case-insensitive)
            let skillMatch = false
            if (b.skills && Array.isArray(b.skills) && b.skills.length > 0) {
                skillMatch = b.skills.some((s: string) =>
                    s && typeof s === 'string' && s.toLowerCase().includes(searchTerm)
                )
            }

            return nameMatch || skillMatch
        })
    }

    return buddies
}
