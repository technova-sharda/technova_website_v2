import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAllRows, fetchInChunks } from "@/lib/supabase/fetch-all"

export interface Participant {
    email: string
    name: string
}

/**
 * All registered participants of an event that have an email address.
 * Paged and chunked so large events aren't cut off at Supabase's 1000-row cap.
 */
export async function getRegisteredParticipants(
    supabase: SupabaseClient<any, any, any>,
    eventId: string
): Promise<Participant[]> {
    const { data: registrations, error } = await fetchAllRows<{ user_id: string }>((from, to) =>
        supabase
            .from("registrations")
            .select("user_id")
            .eq("event_id", eventId)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to)
    )

    if (error || registrations.length === 0) {
        if (error) console.error("Failed to load participants:", error)
        return []
    }

    const userIds = Array.from(new Set(registrations.map(r => r.user_id)))
    const { data: users, error: userError } = await fetchInChunks<{ id: string; email: string | null; name: string | null }>(
        userIds,
        chunk => supabase.schema("next_auth").from("users").select("id, email, name").in("id", chunk)
    )
    if (userError) console.error("Failed to load participant details:", userError)

    return users
        .filter(u => u.email)
        .map(u => ({
            email: u.email!,
            name: u.name || "Participant"
        }))
}
