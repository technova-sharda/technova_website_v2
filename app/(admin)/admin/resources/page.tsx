import { getAllResourcesAdmin } from "@/lib/actions/resources"
import { BookOpen } from "lucide-react"
import { ResourceTable } from "@/components/admin/ResourceTable"
import { PageHeader } from "@/components/admin/ui"

export const metadata = {
    title: "Resources",
}

export default async function AdminResourcesPage() {
    const resources = await getAllResourcesAdmin()

    return (
        <div className="space-y-6">
            <PageHeader icon={BookOpen} title="Resources" description="Review and approve academic resources uploaded by students." />

            <ResourceTable resources={resources} />
        </div>
    )
}
