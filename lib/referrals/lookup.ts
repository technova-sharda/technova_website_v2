import type { SupabaseClient } from "@supabase/supabase-js"

const PREFIX_PATTERN = /^[0-9a-f]{8}$/

/** Referral codes look like `<first 8 hex chars of the referrer's user id>-<random>`. */
export function referralCodePrefix(code: string | null | undefined): string | null {
    const prefix = (code || "").trim().split("-")[0]?.toLowerCase()
    return prefix && PREFIX_PATTERN.test(prefix) ? prefix : null
}

/**
 * Finds the referrer for a referral code with an ID-range query.
 *
 * The previous version downloaded every user and matched the prefix in JavaScript,
 * which silently missed everyone after the first 1000 rows (Supabase's response cap).
 * UUIDs compare byte-wise, so every id starting with the 8-character prefix lies
 * between `<prefix>-0000-…` and `<prefix>-ffff-…`.
 */
export async function findReferrerIdByCode(
    supabase: SupabaseClient<any, any, any>,
    code: string
): Promise<{ id: string } | { error: string }> {
    const prefix = referralCodePrefix(code)
    if (!prefix) return { error: "Invalid referral code format" }

    const { data, error } = await supabase
        .schema("next_auth")
        .from("users")
        .select("id")
        .gte("id", `${prefix}-0000-0000-0000-000000000000`)
        .lte("id", `${prefix}-ffff-ffff-ffff-ffffffffffff`)
        .limit(2)

    if (error) return { error: `Database error: ${error.message}` }
    if (!data || data.length === 0) return { error: "Referrer not found" }
    // Two users sharing the first 8 characters would make the code ambiguous; award nobody.
    if (data.length > 1) return { error: "Ambiguous referral code" }
    return { id: data[0].id }
}
