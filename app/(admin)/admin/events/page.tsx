import type { Metadata } from "next"
import Link from "next/link"
import { Calendar, History, Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { PageHeader, buttonCls } from "@/components/admin/ui"
import { EventsManager } from "./events-manager"
import { loadAdminEventRows } from "./events-data"

export const metadata: Metadata = { title: "Events" }

export default async function AdminEventsPage() {
    const session = await auth()
    if (session?.user?.role !== "super_admin") return null // the admin layout shows the access message

    const rows = await loadAdminEventRows()
    const active = rows.filter(r => r.phase === "live" || r.phase === "upcoming").length
    const past = rows.filter(r => r.phase === "ended").length

    return (
        <div className="space-y-6">
            <PageHeader
                icon={Calendar}
                title="Events"
                tone="blue"
                description={`${active} live or upcoming · ${past} ended · ${rows.length} in total`}
                actions={<>
                    <Link href="/admin/events/past/new" className={buttonCls.secondary}><History className="h-4 w-4" /> Add past event</Link>
                    <Link href="/admin/events/new" className={buttonCls.primary}><Plus className="h-4 w-4" /> Create event</Link>
                </>}
            />
            <EventsManager rows={rows} />
        </div>
    )
}
