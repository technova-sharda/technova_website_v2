'use server'

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/server"

/**
 * Admin roles page (super admins only).
 *
 * Sessions are stored in the database, so every request reads the user's row
 * from next_auth.users. Changing `role` there takes effect on the person's next
 * page load; nobody has to sign out.
 *
 * What each role can do today:
 *   super_admin: the whole admin panel
 *   admin:       the event QR scanner only
 *   student:     the normal site
 */
export type ManagedRole = "student" | "admin" | "super_admin"
const MANAGED_ROLES: ManagedRole[] = ["student", "admin", "super_admin"]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type RoleUser = { id: string; name: string | null; email: string | null; image: string | null; role: string | null }
export type RoleChange = {
    id: string
    user_name: string | null
    user_email: string | null
    old_role: string | null
    new_role: string
    changed_by_email: string | null
    changed_at: string
}

async function requireSuperAdmin() {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "super_admin") {
        throw new Error("Only super admins can manage roles")
    }
    return session
}

/** Everyone who isn't a plain student, highest role first. */
export async function getRoleHolders(): Promise<RoleUser[]> {
    await requireSuperAdmin()
    const { data, error } = await createAdminClient()
        .schema("next_auth")
        .from("users")
        .select("id, name, email, image, role")
        .not("role", "is", null)
        .neq("role", "student")
        .order("name", { ascending: true })
        .limit(500)
    if (error) throw new Error(error.message)
    const rank = (r: string | null) => (r === "super_admin" ? 0 : r === "admin" ? 1 : 2)
    return (data ?? []).sort((a, b) => rank(a.role) - rank(b.role))
}

/** Name/email search for the "add someone" box. */
export async function searchUsersForRole(query: string): Promise<RoleUser[]> {
    await requireSuperAdmin()
    // Characters that would break the PostgREST or() filter or act as wildcards.
    const q = query.replace(/[%_,()*\\]/g, " ").trim().slice(0, 80)
    if (q.length < 2) return []
    const { data, error } = await createAdminClient()
        .schema("next_auth")
        .from("users")
        .select("id, name, email, image, role")
        .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
        .order("name", { ascending: true })
        .limit(12)
    if (error) throw new Error(error.message)
    return data ?? []
}

export async function setUserRole(userId: string, role: ManagedRole): Promise<{ success: true } | { error: string }> {
    const session = await requireSuperAdmin()
    if (!MANAGED_ROLES.includes(role)) return { error: "Unknown role" }
    if (!UUID.test(userId)) return { error: "Unknown user" }
    if (userId === session.user.id) return { error: "You can't change your own role. Ask another super admin." }

    const supabase = createAdminClient()
    const users = () => supabase.schema("next_auth").from("users")

    const { data: target, error: readError } = await users()
        .select("id, name, email, role")
        .eq("id", userId)
        .maybeSingle()
    if (readError) return { error: readError.message }
    if (!target) return { error: "User not found" }
    if (target.role === role) return { success: true }

    if (target.role === "super_admin") {
        const { count } = await users().select("id", { count: "exact", head: true }).eq("role", "super_admin")
        if ((count ?? 0) <= 1) return { error: "There must always be at least one super admin." }
    }

    // Only applies if nobody changed this person's role since we read it.
    let update = users().update({ role }).eq("id", userId)
    update = target.role === null ? update.is("role", null) : update.eq("role", target.role)
    const { data: updated, error: updateError } = await update.select("id")
    if (updateError) return { error: updateError.message }
    if (!updated?.length) return { error: "Someone else just changed this role. Refresh and try again." }

    // History is best-effort: the role change itself has already succeeded.
    const { error: logError } = await supabase.from("role_changes").insert({
        user_id: target.id,
        user_name: target.name,
        user_email: target.email,
        old_role: target.role,
        new_role: role,
        changed_by: session.user.id,
        changed_by_email: session.user.email ?? null,
    })
    if (logError) console.warn("[roles] could not record role change:", logError.message)

    revalidatePath("/admin/roles")
    return { success: true }
}

export async function getRecentRoleChanges(): Promise<RoleChange[]> {
    await requireSuperAdmin()
    const { data, error } = await createAdminClient()
        .from("role_changes")
        .select("id, user_name, user_email, old_role, new_role, changed_by_email, changed_at")
        .order("changed_at", { ascending: false })
        .limit(30)
    if (error) return [] // table not created yet
    return data ?? []
}
