import { getAllRegistrations } from "@/lib/actions/registrations"
import { Users } from "lucide-react"
import { RegistrationsTable } from "./registrations-table"
import { PageHeader } from "@/components/admin/ui"

export default async function AdminRegistrationsPage() {
    const registrations = await getAllRegistrations()

    return (
        <div className="space-y-6">
            <PageHeader icon={Users} title="All registrations" tone="emerald" description="Every registration across all events." />
            <RegistrationsTable registrations={registrations} />
        </div>
    )
}
