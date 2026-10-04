import Link from "next/link"
import { ArrowLeft, Award } from "lucide-react"
import { getEventById } from "@/lib/actions/events"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { CertificatesWorkspace } from "@/components/admin/certificates/CertificatesWorkspace"

// Sending certificates to a whole event runs inside this page's server actions
export const maxDuration = 60

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function CertificatesPage({ params }: PageProps) {
    const { id } = await params
    const session = await auth()

    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        redirect('/login')
    }

    const event = await getEventById(id)

    if (!event) {
        redirect('/admin/events')
    }

    return (
        <div className="min-h-screen bg-black">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href={`/admin/events/${id}`}
                        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Event
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-violet-500/20 rounded-xl">
                            <Award className="w-8 h-8 text-violet-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Certificate Management</h1>
                            <p className="text-gray-400">{event.title}</p>
                        </div>
                    </div>
                </div>

                <CertificatesWorkspace eventId={id} eventTitle={event.title} />
            </div>
        </div>
    )
}
