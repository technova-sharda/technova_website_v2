import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getRecentRoleChanges, getRoleHolders } from "@/lib/actions/roles"
import { RolesManager } from "./roles-manager"

export const metadata: Metadata = { title: "Admin Roles" }

export default async function RolesPage() {
    const session = await auth()
    // The admin layout already limits /admin to super admins; this page checks again on its own.
    if (session?.user?.role !== "super_admin") redirect("/admin/dashboard")

    const [holders, changes] = await Promise.all([getRoleHolders(), getRecentRoleChanges()])
    return <RolesManager holders={holders} changes={changes} currentUserId={session.user.id} />
}
