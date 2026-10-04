import { redirect } from "next/navigation"
import { ShieldAlert } from "lucide-react"
import { auth } from "@/lib/auth"
import { getClubForManagement, getManageableClubs } from "@/lib/actions/club-management"
import { ClubManager } from "./club-manager"

export const metadata = { title: "Club Management" }

export default async function ClubManagementPage({ searchParams }: { searchParams: Promise<{ club?: string }> }) {
    const session = await auth()
    if (!session?.user) redirect("/login?callbackUrl=/club-management")

    const clubs = await getManageableClubs()
    if (clubs.length === 0) {
        return (
            <div className="max-w-xl mx-auto mt-16 text-center rounded-2xl border border-white/10 bg-white/[0.02] p-8">
                <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto mb-4" />
                <h1 className="text-xl font-bold text-white">Club Management</h1>
                <p className="text-gray-400 mt-2 text-sm">Only a club&apos;s Lead, and Technova&apos;s President, Vice President and Tech Lead can manage clubs. Your email isn&apos;t listed as one of these.</p>
            </div>
        )
    }

    const { club } = await searchParams
    const selected = clubs.find(c => c.id === club) ?? clubs[0]
    const detail = await getClubForManagement(selected.id)
    return <ClubManager clubs={clubs} detail={detail} />
}
