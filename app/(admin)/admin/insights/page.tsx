import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { aiConfigured } from "@/lib/ai/nvidia"
import { AskTechnova } from "./ask-technova"

export const metadata = { title: "Ask Technova" }

export default async function InsightsPage() {
    const session = await auth()
    if (session?.user?.role !== "super_admin") redirect("/admin/dashboard")
    return <AskTechnova configured={aiConfigured()} />
}
