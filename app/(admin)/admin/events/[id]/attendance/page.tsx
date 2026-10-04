import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getAttendanceRoster } from "@/lib/actions/attendance"
import { AttendanceManager } from "./attendance-manager"

export const metadata = { title: "Bulk Attendance" }
// Marking a few hundred students runs inside this page's server action
export const maxDuration = 60

export default async function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await auth()
    if (!session || !["admin", "super_admin"].includes(session.user.role)) redirect("/login")

    let data
    try {
        data = await getAttendanceRoster(id)
    } catch {
        redirect("/admin/events")
    }

    return (
        <div className="min-h-screen bg-black">
            <div className="max-w-6xl mx-auto px-4 py-8">
                <Link href={`/admin/events/${id}`} className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Event
                </Link>
                <AttendanceManager data={data} />
            </div>
        </div>
    )
}
