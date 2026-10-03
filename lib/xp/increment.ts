import type { SupabaseClient } from "@supabase/supabase-js"

export type XpIncrementResult =
    | { ok: true; newXp: number }
    | { ok: false; error: string }

/**
 * Adds `delta` XP to a user's total without losing concurrent updates.
 *
 * The old pattern (read xp_points, add, write back) loses an award whenever two
 * awards for the same user overlap: both read the same value and the second write
 * overwrites the first. This uses compare-and-swap instead: the write only applies
 * if xp_points still holds the value that was read; otherwise it re-reads and retries.
 */
export async function incrementUserXp(
    supabase: SupabaseClient<any, any, any>,
    userId: string,
    delta: number,
    maxAttempts = 5
): Promise<XpIncrementResult> {
    if (!Number.isFinite(delta)) return { ok: false, error: "Invalid XP amount" }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { data: row, error: readError } = await supabase
            .schema("next_auth")
            .from("users")
            .select("xp_points")
            .eq("id", userId)
            .maybeSingle()

        if (readError) return { ok: false, error: readError.message }
        if (!row) return { ok: false, error: "User not found" }

        const current: number | null = row.xp_points ?? null
        const next = (current ?? 0) + delta

        let update = supabase
            .schema("next_auth")
            .from("users")
            .update({ xp_points: next })
            .eq("id", userId)
        update = current === null ? update.is("xp_points", null) : update.eq("xp_points", current)

        const { data: updated, error: updateError } = await update.select("id")
        if (updateError) return { ok: false, error: updateError.message }
        if (updated && updated.length === 1) return { ok: true, newXp: next }
        // Another award changed xp_points between the read and the write; try again.
    }

    return { ok: false, error: "XP update kept conflicting with other updates" }
}
