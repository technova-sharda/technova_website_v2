'use client'

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Download, Search, CheckCircle, XCircle, Clock, Loader2, X, Award, Send, Mail, ChevronLeft, ChevronRight } from "lucide-react"
import { Toast, useToast } from "@/components/ui/toast"
import { togglePastEvent } from "@/lib/actions/events"
import { formatDate } from "@/lib/utils"
import { FeedbackFormManager } from "@/components/admin/FeedbackFormManager"

export function AdminEventClient({ event, registrations }: { event: any, registrations: any[] }) {
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const PAGE_SIZE = 25
    const [isToggling, setIsToggling] = useState(false)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [isPastEvent, setIsPastEvent] = useState(event.is_past_event || false)
    const { toast, showToast, hideToast } = useToast()

    // Blast email state
    const [showBlastModal, setShowBlastModal] = useState(false)
    const [blastSubject, setBlastSubject] = useState("")
    const [blastMessage, setBlastMessage] = useState("")
    const [isSendingBlast, setIsSendingBlast] = useState(false)

    // Check if event is completed (end_time has passed)
    const isCompleted = new Date(event.end_time) < new Date()
    // Can add to past only if completed and not already past
    // Can remove from past anytime if it's marked as past
    const canToggle = isCompleted || isPastEvent

    const handleTogglePastEvent = async () => {
        setShowConfirmModal(false)
        setIsToggling(true)
        try {
            const result = await togglePastEvent(event.id)
            setIsPastEvent(result.isPastEvent)
            if (result.isPastEvent) {
                showToast("Event added to past events timeline!", "success")
            } else {
                showToast("Event removed from past events timeline!", "success")
            }
        } catch (error: any) {
            showToast(error.message || "Failed to update event", "error")
        } finally {
            setIsToggling(false)
        }
    }

    const handleSendBlast = async () => {
        if (!blastSubject.trim() || !blastMessage.trim()) {
            showToast("Please enter both subject and message", "error")
            return
        }

        setIsSendingBlast(true)
        try {
            const res = await fetch('/api/admin/blast-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: event.id,
                    subject: blastSubject,
                    message: blastMessage
                })
            })

            const data = await res.json()

            if (res.ok) {
                showToast(data.message || "Blast email sent successfully!", "success")
                setShowBlastModal(false)
                setBlastSubject("")
                setBlastMessage("")
            } else {
                showToast(data.error || "Failed to send blast email", "error")
            }
        } catch (err: any) {
            showToast(err.message || "Failed to send blast email", "error")
        } finally {
            setIsSendingBlast(false)
        }
    }

    // Filter
    const filtered = registrations.filter(r =>
        r.user.name?.toLowerCase().includes(search.toLowerCase()) ||
        r.user.email?.toLowerCase().includes(search.toLowerCase()) ||
        r.user.system_id?.toLowerCase().includes(search.toLowerCase())
    )

    // Pagination
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    // Stats
    const total = registrations.length
    const attended = registrations.filter(r => r.attended).length
    const revenue = registrations.reduce((acc, r) => acc + (r.payment_status === 'paid' ? event.price : 0), 0)

    // Download CSV
    const downloadCSV = (onlyAttended = false) => {
        const dataToExport = onlyAttended ? registrations.filter(r => r.attended) : registrations

        if (dataToExport.length === 0) {
            alert("No data to export")
            return
        }

        // Get custom fields
        const customFields = typeof event.registration_fields === 'string'
            ? JSON.parse(event.registration_fields)
            : (event.registration_fields || [])

        const customHeaders = customFields.map((f: any) => f.label)

        const headers = ["Name", "Email", "System ID", "Year", "Course", "Section", "Payment Status", "Checked In", "Registration Date", ...customHeaders]

        const csvContent = [
            headers.join(","),
            ...dataToExport.map(r => {
                const answers = r.answers || {}
                const customValues = customFields.map((f: any) => {
                    const val = answers[f.id]
                    return `"${val !== undefined && val !== null ? val : ''}"`
                })

                return [
                    `"${r.user.name || ''}"`,
                    `"${r.user.email || ''}"`,
                    `"${r.user.system_id || ''}"`,
                    `"${r.user.year || ''}"`,
                    `"${r.user.course || ''}"`,
                    `"${r.user.section || ''}"`,
                    `"${r.payment_status || ''}"`,
                    `"${r.attended ? 'Yes' : 'No'}"`,
                    `"${new Date(r.created_at).toLocaleString()}"`,
                    ...customValues
                ].join(",")
            })
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = `${event.title.replace(/\s+/g, '_')}_${onlyAttended ? 'CHECKED_IN' : 'ALL'}_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
    }

    // Get custom fields for column headers
    const customFields = typeof event.registration_fields === 'string'
        ? JSON.parse(event.registration_fields)
        : (event.registration_fields || [])

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/admin/events" className="p-2 hover:bg-gray-100 rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">{event.title}</h1>
                        <div className="flex gap-4 text-sm text-gray-500 mt-1">
                            <span>{formatDate(event.start_time)}</span>
                            <span>•</span>
                            <span className={event.status === 'live' ? 'text-green-600 font-medium' : 'text-gray-600'}>
                                {event.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {canToggle && (
                        <button
                            onClick={() => setShowConfirmModal(true)}
                            disabled={isToggling}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${isPastEvent
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'bg-purple-600 text-white hover:bg-purple-700'
                                }`}
                        >
                            {isToggling ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isPastEvent ? (
                                <X className="w-4 h-4" />
                            ) : (
                                <Clock className="w-4 h-4" />
                            )}
                            {isPastEvent ? 'Remove from Timeline' : 'Add to Past Events'}
                        </button>
                    )}
                    <button
                        onClick={() => downloadCSV(false)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm font-medium"
                    >
                        <Download className="w-4 h-4" /> Export All
                    </button>
                    <button
                        onClick={() => downloadCSV(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                        <CheckCircle className="w-4 h-4" /> Export Checked-In
                    </button>
                    <Link
                        href={`/admin/events/${event.id}/certificates`}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium"
                    >
                        <Award className="w-4 h-4" /> Certificates
                    </Link>
                    <button
                        onClick={() => setShowBlastModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                    >
                        <Mail className="w-4 h-4" /> Send Blast Email
                    </button>
                </div >
            </div >

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">Total Registrations</p>
                    <p className="text-3xl font-bold text-gray-900">{total}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">Checked In (Attended)</p>
                    <p className="text-3xl font-bold text-green-600">{attended}</p>
                    <p className="text-xs text-gray-400 mt-2">{((attended / (total || 1)) * 100).toFixed(1)}% Turnout</p>
                </div>
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">Estimated Revenue</p>
                    <p className="text-3xl font-bold text-gray-900">₹{revenue.toLocaleString()}</p>
                </div>
            </div>

            {/* Table */}
            < div className="bg-white rounded-xl border shadow-sm overflow-hidden" >
                <div className="p-4 border-b flex items-center gap-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, email, or system ID..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="flex-1 outline-none text-sm text-gray-900 bg-transparent placeholder:text-gray-400"
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b text-gray-500">
                            <tr>
                                <th className="p-4 font-medium sticky left-0 bg-gray-50 z-10">Student</th>
                                <th className="p-4 font-medium">System ID</th>
                                <th className="p-4 font-medium">Class</th>
                                <th className="p-4 font-medium">Payment</th>
                                <th className="p-4 font-medium">Check-In</th>
                                <th className="p-4 font-medium">Date</th>
                                {/* Custom Fields Headers */}
                                {customFields.map((field: any) => (
                                    <th key={field.id} className="p-4 font-medium min-w-[200px]">{field.label}</th>
                                ))}
                                <th className="p-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {paged.length === 0 ? (
                                <tr>
                                    <td colSpan={7 + customFields.length} className="p-8 text-center text-gray-500">
                                        No registrations found matching "{search}"
                                    </td>
                                </tr>
                            ) : (
                                paged.map((reg) => (
                                    <tr key={reg.id} className="hover:bg-gray-50 group">
                                        <td className="p-4 sticky left-0 bg-white group-hover:bg-gray-50 z-10 box-border border-r border-transparent group-hover:border-gray-100">
                                            <div className="font-medium text-gray-900">{reg.user.name}</div>
                                            <div className="text-gray-500 text-xs">{reg.user.email}</div>
                                        </td>
                                        <td className="p-4 font-mono text-xs text-gray-600">{reg.user.system_id || '-'}</td>
                                        <td className="p-4 text-gray-900">
                                            {reg.user.course} {reg.user.year && `- ${reg.user.year}Yr`} {reg.user.section && `(${reg.user.section})`}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${reg.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                                                reg.payment_status === 'free' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {reg.payment_status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {reg.attended ? (
                                                <div className="flex items-center gap-1 text-green-600 font-medium">
                                                    <CheckCircle className="w-4 h-4" /> Yes
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-gray-400">
                                                    <XCircle className="w-4 h-4" /> No
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-gray-500">{formatDate(reg.created_at)}</td>

                                        {/* Custom Answers Cells */}
                                        {customFields.map((field: any) => {
                                            const val = reg.answers?.[field.id]
                                            return (
                                                <td key={field.id} className="p-4 text-gray-600 truncate max-w-[200px]" title={val}>
                                                    {val || '-'}
                                                </td>
                                            )
                                        })}

                                        <td className="p-4 text-right">
                                            <button
                                                onClick={async () => {
                                                    if (confirm("Are you sure you want to cancel this registration?")) {
                                                        const { cancelRegistration } = await import("@/lib/actions/registrations")
                                                        await cancelRegistration(reg.id)
                                                    }
                                                }}
                                                className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1 rounded hover:bg-red-50"
                                            >
                                                Cancel
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                        Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} registrations
                    </p>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-3 h-3" /> Previous
                            </button>
                            <span className="text-xs text-gray-500 px-1">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Next <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>
            </div >

            {/* Feedback Management Section */}
            < div className="bg-white p-6 rounded-xl border shadow-sm" >
                <FeedbackFormManager
                    eventId={event.id}
                    isMultiDay={event.is_multi_day || false}
                    isVirtual={event.is_virtual || false}
                    requiresFeedback={event.requires_feedback_for_attendance || false}
                />
            </div >

            {/* Confirmation Modal */}
            {
                showConfirmModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl p-6 max-w-md mx-4 shadow-2xl">
                            <h3 className="text-xl font-bold text-gray-900 mb-3">
                                {isPastEvent ? 'Remove from Timeline?' : 'Add to Past Events?'}
                            </h3>
                            <p className="text-gray-600 mb-6">
                                {isPastEvent
                                    ? `This will remove "${event.title}" from the club's past events timeline.`
                                    : `This will add "${event.title}" to the club's past events timeline. The event will be visible in the club page history section.`
                                }
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleTogglePastEvent}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${isPastEvent
                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                        : 'bg-purple-600 text-white hover:bg-purple-700'
                                        }`}
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Blast Email Modal */}
            {
                showBlastModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                                    <Mail className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">Send Blast Email</h3>
                                    <p className="text-gray-500 text-sm">Message all {registrations.length} registered participants</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                                    <input
                                        type="text"
                                        value={blastSubject}
                                        onChange={(e) => setBlastSubject(e.target.value)}
                                        placeholder="e.g., Important Update about the Event"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder:text-gray-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
                                    <textarea
                                        value={blastMessage}
                                        onChange={(e) => setBlastMessage(e.target.value)}
                                        placeholder="Write your message here..."
                                        rows={5}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none text-gray-900 bg-white placeholder:text-gray-400"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end mt-6">
                                <button
                                    onClick={() => {
                                        setShowBlastModal(false)
                                        setBlastSubject("")
                                        setBlastMessage("")
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                                    disabled={isSendingBlast}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSendBlast}
                                    disabled={isSendingBlast || !blastSubject.trim() || !blastMessage.trim()}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSendingBlast ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Send to All
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Toast Notification */}
            {
                toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={hideToast}
                    />
                )
            }
        </div >
    )
}
