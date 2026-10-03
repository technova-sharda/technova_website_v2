"use client"

import { useState, useEffect, useMemo } from "react"
import { Award, Download, RefreshCw, Ban, CheckCircle, Loader2, Mail, Trophy, Search, Users, Clock, Plus } from "lucide-react"
import { Toast, useToast } from "@/components/ui/toast"
import {
    getEventStudents,
    getCertificateStats,
    revokeCertificate,
    reinstateCertificate,
    resendCertificateEmail,
    addPositionRecipient,
    type EventStudent,
    type EventStudentCertificate,
} from "@/lib/actions/certificates"

interface CertificateManagerProps {
    eventId: string
    eventTitle: string
    refreshKey?: number
    onChange?: () => void
}

interface Stats {
    total: number
    valid: number
    revoked: number
    downloads: number
    positions: number
    participation: number
}

type Filter = 'all' | 'attended' | 'sent' | 'not_sent' | 'positions'

const FILTERS: { value: Filter, label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'attended', label: 'Attended' },
    { value: 'sent', label: 'Certificate sent' },
    { value: 'not_sent', label: 'No certificate' },
    { value: 'positions', label: 'Positions' },
]

const PAGE_SIZE = 50

/** All registered students for the event and the certificates each one holds. */
export function CertificateManager({ eventId, refreshKey, onChange }: CertificateManagerProps) {
    const [students, setStudents] = useState<EventStudent[]>([])
    const [positions, setPositions] = useState<{ id: string, title: string }[]>([])
    const [stats, setStats] = useState<Stats>({ total: 0, valid: 0, revoked: 0, downloads: 0, positions: 0, participation: 0 })
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState<Filter>('all')
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [revokeModal, setRevokeModal] = useState<{ certificateId: string; name: string } | null>(null)
    const [revokeReason, setRevokeReason] = useState("")

    const { toast, showToast, hideToast } = useToast()

    const loadData = async () => {
        setIsLoading(true)
        setLoadError(null)
        try {
            const [studentData, statsData] = await Promise.all([
                getEventStudents(eventId),
                getCertificateStats(eventId)
            ])
            setStudents(studentData.students)
            setPositions(studentData.positions)
            setStats(statsData)
        } catch (error: any) {
            console.error('Load error:', error)
            setLoadError(error.message || 'Failed to load students')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [eventId, refreshKey])

    const runAction = async (key: string, action: () => Promise<unknown>, success: string) => {
        setActionLoading(key)
        try {
            await action()
            showToast(success, 'success')
            await loadData()
            onChange?.()
        } catch (error: any) {
            showToast(error.message || 'Something went wrong', 'error')
        } finally {
            setActionLoading(null)
        }
    }

    const handleRevoke = async () => {
        if (!revokeModal || !revokeReason.trim()) return
        await runAction(revokeModal.certificateId, () => revokeCertificate(revokeModal.certificateId, revokeReason), 'Certificate revoked')
        setRevokeModal(null)
        setRevokeReason("")
    }

    const filtered = useMemo(() => {
        const term = query.trim().toLowerCase()
        return students.filter(s => {
            if (term && !(s.name || '').toLowerCase().includes(term) && !(s.email || '').toLowerCase().includes(term)) return false
            const issued = s.certificates.filter(c => c.status !== 'pending')
            switch (filter) {
                case 'attended': return s.attended
                case 'sent': return issued.length > 0
                case 'not_sent': return issued.length === 0
                case 'positions': return s.certificates.some(c => c.position_id)
                default: return true
            }
        })
    }, [students, query, filter])

    const attendedCount = students.filter(s => s.attended).length

    if (isLoading && students.length === 0) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<Users className="w-5 h-5 text-violet-400" />} tint="bg-violet-500/20" value={`${attendedCount}/${students.length}`} label="Attended / Registered" />
                <StatCard icon={<CheckCircle className="w-5 h-5 text-emerald-400" />} tint="bg-emerald-500/20" value={stats.valid} label={`Sent (${stats.participation} participation · ${stats.positions} position)`} />
                <StatCard icon={<Ban className="w-5 h-5 text-red-400" />} tint="bg-red-500/20" value={stats.revoked} label="Revoked" />
                <StatCard icon={<Download className="w-5 h-5 text-blue-400" />} tint="bg-blue-500/20" value={stats.downloads} label="Downloads" />
            </div>

            {/* Search + filters */}
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg focus-within:border-violet-500">
                    <Search className="w-4 h-4 text-gray-500" />
                    <input
                        value={query}
                        onChange={e => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE) }}
                        placeholder="Search students by name or email"
                        className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 focus:outline-none"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {stats.total > 0 && (
                        <a
                            href={`/api/certificate/bulk?eventId=${eventId}`}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download All (ZIP)
                        </a>
                    )}
                    <button
                        onClick={loadData}
                        disabled={isLoading}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit max-w-full overflow-x-auto">
                {FILTERS.map(f => (
                    <button
                        key={f.value}
                        onClick={() => { setFilter(f.value); setVisibleCount(PAGE_SIZE) }}
                        className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${filter === f.value ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {loadError ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
                    {loadError}
                </div>
            ) : filtered.length > 0 ? (
                <div className="bg-gray-900 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-800">
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Student</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Attendance</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Certificates</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {filtered.slice(0, visibleCount).map(student => (
                                    <StudentRow
                                        key={student.user_id}
                                        student={student}
                                        positions={positions}
                                        actionLoading={actionLoading}
                                        onResend={cert => runAction(cert.certificate_id, () => resendCertificateEmail(cert.certificate_id), 'Email sent')}
                                        onRevoke={cert => setRevokeModal({ certificateId: cert.certificate_id, name: student.name || 'this student' })}
                                        onReinstate={cert => runAction(cert.certificate_id, () => reinstateCertificate(cert.certificate_id), 'Certificate reinstated')}
                                        onAddToPosition={position => runAction(
                                            `add-${student.user_id}`,
                                            () => addPositionRecipient(position.id, student.user_id),
                                            `Added to ${position.title}. Upload their certificate in Position Certificates.`
                                        )}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length > visibleCount && (
                        <button
                            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                            className="w-full py-3 text-sm text-violet-400 hover:text-violet-300 hover:bg-gray-800/50"
                        >
                            Show more ({filtered.length - visibleCount} remaining)
                        </button>
                    )}
                </div>
            ) : (
                <div className="bg-gray-900 rounded-xl p-12 text-center">
                    <Users className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400">
                        {students.length === 0 ? 'No students registered for this event yet' : 'No students match this search'}
                    </p>
                </div>
            )}

            {/* Revoke Modal */}
            {revokeModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-white mb-2">Revoke Certificate</h3>
                        <p className="text-gray-400 text-sm mb-4">
                            You are about to revoke the certificate for <strong className="text-white">{revokeModal.name}</strong>.
                            This action can be undone later.
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm text-gray-400 mb-2">Reason for revocation *</label>
                            <textarea
                                value={revokeReason}
                                onChange={(e) => setRevokeReason(e.target.value)}
                                placeholder="Enter the reason for revoking this certificate..."
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                                rows={3}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setRevokeModal(null); setRevokeReason("") }}
                                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRevoke}
                                disabled={!revokeReason.trim() || actionLoading === revokeModal.certificateId}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {actionLoading === revokeModal.certificateId ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Revoke'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function StatCard({ icon, tint, value, label }: { icon: React.ReactNode, tint: string, value: number | string, label: string }) {
    return (
        <div className="bg-gray-900 rounded-xl p-4">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${tint}`}>{icon}</div>
                <div className="min-w-0">
                    <p className="text-2xl font-bold text-white">{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                </div>
            </div>
        </div>
    )
}

interface StudentRowProps {
    student: EventStudent
    positions: { id: string, title: string }[]
    actionLoading: string | null
    onResend: (cert: EventStudentCertificate) => void
    onRevoke: (cert: EventStudentCertificate) => void
    onReinstate: (cert: EventStudentCertificate) => void
    onAddToPosition: (position: { id: string, title: string }) => void
}

function StudentRow({ student, positions, actionLoading, onResend, onRevoke, onReinstate, onAddToPosition }: StudentRowProps) {
    const availablePositions = positions.filter(p => !student.certificates.some(c => c.position_id === p.id))

    return (
        <tr className="hover:bg-gray-800/50 align-top">
            <td className="px-4 py-3">
                <p className="text-white font-medium">{student.name || 'Unknown'}</p>
                <p className="text-xs text-gray-500">{student.email}</p>
            </td>
            <td className="px-4 py-3">
                {student.attended ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">Attended</span>
                ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-400">Registered</span>
                )}
            </td>
            <td className="px-4 py-3">
                {student.certificates.length === 0 ? (
                    <span className="text-sm text-gray-500">—</span>
                ) : (
                    <div className="space-y-2">
                        {student.certificates.map(cert => (
                            <div key={cert.id} className="flex items-center gap-2 flex-wrap">
                                <CertificateBadge cert={cert} />
                                {cert.status !== 'pending' && (
                                    <code className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded text-xs">{cert.certificate_id}</code>
                                )}
                                {cert.status === 'valid' && !cert.email_sent_at && (
                                    <span className="text-xs text-amber-400">email not sent</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </td>
            <td className="px-4 py-3">
                <div className="flex flex-col items-end gap-2">
                    {student.certificates.filter(c => c.status !== 'pending').map(cert => (
                        <div key={cert.id} className="flex items-center gap-1">
                            <a
                                href={`/api/certificate?id=${cert.certificate_id}`}
                                target="_blank"
                                className="p-1.5 text-gray-400 hover:text-white"
                                title="Download"
                            >
                                <Download className="w-4 h-4" />
                            </a>
                            {cert.status === 'valid' ? (
                                <>
                                    <button
                                        onClick={() => onResend(cert)}
                                        disabled={actionLoading === cert.certificate_id}
                                        className="p-1.5 text-gray-400 hover:text-white"
                                        title={cert.email_sent_at ? 'Resend email' : 'Send email'}
                                    >
                                        {actionLoading === cert.certificate_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => onRevoke(cert)} className="p-1.5 text-red-400 hover:text-red-300" title="Revoke">
                                        <Ban className="w-4 h-4" />
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => onReinstate(cert)}
                                    disabled={actionLoading === cert.certificate_id}
                                    className="p-1.5 text-emerald-400 hover:text-emerald-300"
                                    title="Reinstate"
                                >
                                    {actionLoading === cert.certificate_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                    ))}
                    {availablePositions.length > 0 && (
                        <div className="relative">
                            {actionLoading === `add-${student.user_id}` ? (
                                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                            ) : (
                                <label className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 cursor-pointer">
                                    <Plus className="w-3 h-3" />
                                    Give position
                                    <select
                                        value=""
                                        onChange={e => {
                                            const position = availablePositions.find(p => p.id === e.target.value)
                                            if (position) onAddToPosition(position)
                                        }}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    >
                                        <option value="" disabled>Give position</option>
                                        {availablePositions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                    </select>
                                </label>
                            )}
                        </div>
                    )}
                </div>
            </td>
        </tr>
    )
}

function CertificateBadge({ cert }: { cert: EventStudentCertificate }) {
    const label = cert.position_title || 'Participation'
    if (cert.status === 'pending') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-300 rounded-full text-xs">
                <Clock className="w-3 h-3" /> {label} · not sent
            </span>
        )
    }
    if (cert.status === 'revoked') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 rounded-full text-xs">
                <Ban className="w-3 h-3" /> {label} · revoked
            </span>
        )
    }
    return cert.position_id ? (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-400 rounded-full text-xs">
            <Trophy className="w-3 h-3" /> {label}
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs">
            <Award className="w-3 h-3" /> {label}
        </span>
    )
}
