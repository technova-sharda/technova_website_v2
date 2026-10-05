import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { Overview } from "./overview"

export const metadata: Metadata = { title: "Overview" }

export default async function AdminDashboardPage() {
    // Own guard: the admin layout's check runs in parallel with this page, not before it
    const session = await auth()
    if (!session) redirect("/login")
    if (session.user.role !== "super_admin") return null
    return <Overview name={session.user.name ?? null} />
}
