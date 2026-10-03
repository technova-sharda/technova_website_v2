import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { findReferrerIdByCode } from "@/lib/referrals/lookup"
import { incrementUserXp } from "@/lib/xp/increment"

// XP awarded per successful referral
export const REFERRAL_XP_REWARD = 10

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

/**
 * Records a referral and awards XP to the referrer.
 *
 * Deliberately NOT in a 'use server' file: exported functions there are public
 * endpoints, and this one used to accept any referee id from any caller, which
 * allowed unlimited XP farming. It's now only callable from server code
 * (registerForEvent), and it checks the referee really registered for the event.
 */
export async function processReferral(
    referralCode: string,
    eventId: string,
    refereeId: string
): Promise<{ success: boolean; message: string }> {
    const supabase = getSupabase()

    // 1. Find the referrer
    const referrer = await findReferrerIdByCode(supabase, referralCode)
    if ("error" in referrer) {
        return { success: false, message: referrer.error }
    }
    const referrerId = referrer.id

    // 2. Prevent self-referral
    if (referrerId === refereeId) {
        return { success: false, message: "Cannot refer yourself" }
    }

    // 3. The referee must actually be registered for this event
    const { data: registration, error: registrationError } = await supabase
        .from("registrations")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", refereeId)
        .maybeSingle()

    if (registrationError) {
        console.error("Referral registration check failed:", registrationError.message)
        return { success: false, message: "Database error" }
    }
    if (!registration) {
        return { success: false, message: "Referee is not registered for this event" }
    }

    // 4. One referral per (referrer, referee, event)
    const { data: existingReferral, error: existingError } = await supabase
        .from("referrals")
        .select("id")
        .eq("referrer_id", referrerId)
        .eq("referee_id", refereeId)
        .eq("event_id", eventId)
        .maybeSingle()

    if (existingError) {
        console.error("Referral duplicate check failed:", existingError.message)
        return { success: false, message: "Database error" }
    }
    if (existingReferral) {
        return { success: false, message: "Referral already processed" }
    }

    // 5. Record the referral
    const { error: insertError } = await supabase
        .from("referrals")
        .insert({
            referrer_id: referrerId,
            referee_id: refereeId,
            event_id: eventId,
            referral_code: referralCode,
            xp_awarded: REFERRAL_XP_REWARD
        })

    if (insertError) {
        // 23505 = a concurrent request already recorded this exact referral
        if (insertError.code === "23505") {
            return { success: false, message: "Referral already processed" }
        }
        console.error("Referral insert error:", insertError.message)
        return { success: false, message: "Failed to record referral" }
    }

    // 6. Award XP to the referrer (atomic, so concurrent awards aren't lost)
    const xp = await incrementUserXp(supabase, referrerId, REFERRAL_XP_REWARD)
    if (!xp.ok) {
        // The referral row is recorded; the total can be re-synced from history if this fails.
        console.error("Referral XP update failed:", xp.error)
    }

    revalidatePath("/leaderboard")
    revalidatePath("/events")
    revalidatePath("/dashboard")

    return {
        success: true,
        message: `Successfully awarded ${REFERRAL_XP_REWARD} XP to referrer`
    }
}
