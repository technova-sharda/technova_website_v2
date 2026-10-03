'use server'

import { createClient as createServerClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"

async function getSupabase() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// Finance records: same access as the admin panel itself (super_admin only).
// These are 'use server' exports, i.e. public endpoints, so each one checks.
async function isSuperAdmin() {
    const session = await auth()
    return session?.user?.role === 'super_admin'
}

export async function addSponsorship(formData: FormData) {
    if (!(await isSuperAdmin())) throw new Error("Unauthorized")

    const supabase = await getSupabase()
    const source = ((formData.get("source") as string) || "").trim()
    const amount = parseFloat(formData.get("amount") as string)
    const date = formData.get("date") as string || new Date().toISOString()

    if (!source || !Number.isFinite(amount)) {
        throw new Error("Enter a source and a valid amount")
    }

    const { error } = await supabase.from('sponsorships').insert({
        source,
        amount,
        received_at: date
    })

    if (error) {
        console.error("Add Sponsorship Error:", error)
        throw new Error("Failed to add sponsorship")
    }

    revalidatePath("/admin/dashboard")
    revalidatePath("/admin/settings")
}

export async function getSponsorships() {
    if (!(await isSuperAdmin())) return []

    const supabase = await getSupabase()
    const { data } = await supabase.from('sponsorships').select('*').order('received_at', { ascending: false })
    return data || []
}

export async function deleteSponsorship(id: string) {
    if (!(await isSuperAdmin())) throw new Error("Unauthorized")

    const supabase = await getSupabase()
    await supabase.from('sponsorships').delete().eq('id', id)
    revalidatePath("/admin/dashboard")
    revalidatePath("/admin/settings")
}
