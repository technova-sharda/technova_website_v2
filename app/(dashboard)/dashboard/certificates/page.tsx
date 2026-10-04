import { Suspense } from "react"
import Link from "next/link"
import { Award, Download, ExternalLink, Calendar, Building2, Linkedin } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getUserCertificates } from "@/lib/actions/certificates"
import { formatDateShort } from "@/lib/utils"

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.technovashardauniversity.in").replace(/\/$/, "")

/** LinkedIn "Add licence or certification" pre-filled form, pointing at the public verify page. */
function linkedInAddUrl(cert: any): string {
    const issued = new Date(cert.issued_at || cert.event?.start_time || Date.now())
    const params = new URLSearchParams({
        startTask: "CERTIFICATION_NAME",
        name: [cert.role_title, cert.event?.title].filter(Boolean).join(" – ") || "Technova Certificate",
        organizationName: "Technova, Sharda University",
        issueYear: String(issued.getFullYear()),
        issueMonth: String(issued.getMonth() + 1),
        certUrl: `${SITE_URL}/verify/${cert.certificate_id}`,
        certId: cert.certificate_id,
    })
    return `https://www.linkedin.com/profile/add?${params.toString()}`
}

// Helper to extract club name from Supabase join (can be array or object)
function getClubName(club: any): string | null {
    if (!club) return null
    if (Array.isArray(club)) return club[0]?.name || null
    return club.name || null
}

export const metadata = {
    title: "My Certificates | Technova",
    description: "View and download your Technova event certificates.",
}

async function CertificatesList() {
    const session = await auth()
    if (!session) {
        redirect('/login')
    }

    const certificates = await getUserCertificates()

    if (certificates.length === 0) {
        return (
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-6 bg-violet-500/20 rounded-full flex items-center justify-center">
                    <Award className="w-8 h-8 text-violet-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">No Certificates Yet</h2>
                <p className="text-gray-400 max-w-md mx-auto">
                    You haven&apos;t received any certificates yet. Attend events and complete them to earn certificates!
                </p>
                <Link
                    href="/events"
                    className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
                >
                    Browse Events
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {certificates.map((cert: any) => (
                <div
                    key={cert.id}
                    className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-violet-500/30 transition-colors group"
                >
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        {/* Certificate Icon */}
                        <div className="w-14 h-14 bg-gradient-to-br from-violet-500/20 to-purple-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Award className="w-7 h-7 text-violet-400" />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-white truncate group-hover:text-violet-300 transition-colors">
                                {cert.event?.title || 'Unknown Event'}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-400">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {cert.event?.start_time ? formatDateShort(cert.event.start_time) : 'Unknown Date'}
                                </span>
                                {getClubName(cert.event?.club) && (
                                    <span className="flex items-center gap-1">
                                        <Building2 className="w-4 h-4" />
                                        {getClubName(cert.event?.club)}
                                    </span>
                                )}
                                <span className="text-violet-400 font-mono text-xs">
                                    ID: {cert.certificate_id}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0">
                            <a
                                href={`/api/certificate?id=${cert.certificate_id}`}
                                target="_blank"
                                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Download
                            </a>
                            <Link
                                href={`/verify/${cert.certificate_id}`}
                                target="_blank"
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Verify
                            </Link>
                            <a
                                href={linkedInAddUrl(cert)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-[#0A66C2] hover:bg-[#004182] text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <Linkedin className="w-4 h-4" />
                                Add to LinkedIn
                            </a>
                        </div>
                    </div>

                    {/* Issue Date */}
                    <div className="mt-3 pt-3 border-t border-gray-800/50 flex items-center justify-between text-xs text-gray-500">
                        <span>Issued on {formatDateShort(cert.issued_at)}</span>
                        <span className="text-emerald-400 flex items-center gap-1">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                            Valid
                        </span>
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function CertificatesPage() {
    return (
        <div className="min-h-screen bg-black">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-violet-500/20 rounded-xl">
                            <Award className="w-8 h-8 text-violet-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-white">My Certificates</h1>
                            <p className="text-gray-400">View and download your event certificates</p>
                        </div>
                    </div>
                </div>

                {/* Certificates List */}
                <Suspense fallback={
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 animate-pulse">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-gray-800 rounded-xl"></div>
                                    <div className="flex-1">
                                        <div className="h-5 bg-gray-800 rounded w-2/3 mb-2"></div>
                                        <div className="h-4 bg-gray-800 rounded w-1/3"></div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="h-9 w-24 bg-gray-800 rounded-lg"></div>
                                        <div className="h-9 w-20 bg-gray-800 rounded-lg"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                }>
                    <CertificatesList />
                </Suspense>

                {/* Info Card */}
                <div className="mt-8 p-4 bg-gray-900/30 border border-gray-800 rounded-xl">
                    <h3 className="text-white font-medium mb-2">How Certificate Verification Works</h3>
                    <p className="text-sm text-gray-400">
                        Each certificate contains a unique QR code that links to our verification page.
                        Recruiters, institutions, or anyone can scan the QR code or enter the certificate ID
                        to instantly verify its authenticity. Your certificates remain verifiable indefinitely.
                    </p>
                </div>
            </div>
        </div>
    )
}
