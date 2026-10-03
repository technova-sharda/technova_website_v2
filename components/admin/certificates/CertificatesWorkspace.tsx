"use client"

import { useState } from "react"
import { Award, FileEdit, Trophy } from "lucide-react"
import { CertificateTemplateEditor } from "@/components/admin/CertificateTemplateEditor"
import { CertificateManager } from "@/components/admin/CertificateManager"
import { PositionsManager } from "@/components/admin/certificates/PositionsManager"

interface CertificatesWorkspaceProps {
    eventId: string
    eventTitle: string
}

/** Positions → Participation → Students; a change in any section refreshes the others. */
export function CertificatesWorkspace({ eventId, eventTitle }: CertificatesWorkspaceProps) {
    const [refreshKey, setRefreshKey] = useState(0)
    const refresh = () => setRefreshKey(k => k + 1)

    return (
        <div className="space-y-8">
            <section>
                <div className="flex items-center gap-3 mb-4">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <h2 className="text-xl font-semibold text-white">Position Certificates</h2>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <PositionsManager eventId={eventId} refreshKey={refreshKey} onChange={refresh} />
                </div>
            </section>

            <section>
                <div className="flex items-center gap-3 mb-4">
                    <FileEdit className="w-5 h-5 text-violet-400" />
                    <h2 className="text-xl font-semibold text-white">Participation Certificate</h2>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <CertificateTemplateEditor eventId={eventId} refreshKey={refreshKey} onSent={refresh} />
                </div>
            </section>

            <section>
                <div className="flex items-center gap-3 mb-4">
                    <Award className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-xl font-semibold text-white">Students &amp; Certificates</h2>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <CertificateManager eventId={eventId} eventTitle={eventTitle} refreshKey={refreshKey} onChange={refresh} />
                </div>
            </section>
        </div>
    )
}
