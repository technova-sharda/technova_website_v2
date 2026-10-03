'use client'

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useTransform } from "framer-motion"
import {
    ArrowLeft, Download, Search, CheckCircle, XCircle, Clock, Loader2, X, Award, Send, Mail,
    ChevronLeft, ChevronRight, Users, UserCheck, IndianRupee, CalendarDays, MessageSquare,
    Lock, LockOpen,
} from "lucide-react"
import { Toast, useToast } from "@/components/ui/toast"
import { togglePastEvent, setRegistrationsClosed as setEventRegistrationsClosed } from "@/lib/actions/events"
import { formatDate } from "@/lib/utils"
import { FeedbackFormManager } from "@/components/admin/FeedbackFormManager"

type CheckInFilter = 'all' | 'checked_in' | 'not_checked_in'

const PAGE_SIZE = 25
const EASE_OUT = [0.23, 1, 0.32, 1] as const

const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    show: (i: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.06, ease: EASE_OUT } }),
}

export function AdminEventClient({ event, registrations }: { event: any, registrations: any[] }) {
    const router = useRouter()
    const [search, setSearch] = useState("")
    const [checkInFilter, setCheckInFilter] = useState<CheckInFilter>('all')
    const [page, setPage] = useState(1)
    const [isToggling, setIsToggling] = useState(false)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [isPastEvent, setIsPastEvent] = useState(event.is_past_event || false)
    const [cancelTarget, setCancelTarget] = useState<any | null>(null)
    const [isCancelling, setIsCancelling] = useState(false)
    const [registrationsClosed, setRegistrationsClosed] = useState<boolean>(!!event.registrations_closed)
    const [showRegistrationsModal, setShowRegistrationsModal] = useState(false)
    const [isUpdatingRegistrations, setIsUpdatingRegistrations] = useState(false)
    const { toast, showToast, hideToast } = useToast()

    // Blast email state
    const [showBlastModal, setShowBlastModal] = useState(false)
    const [blastSubject, setBlastSubject] = useState("")
    const [blastMessage, setBlastMessage] = useState("")
    const [isSendingBlast, setIsSendingBlast] = useState(false)

    // Can add to past only once the event has ended; can always remove
    const isCompleted = new Date(event.end_time) < new Date()
    const canToggle = isCompleted || isPastEvent

    const customFields: any[] = useMemo(() => (
        typeof event.registration_fields === 'string'
            ? JSON.parse(event.registration_fields)
            : (event.registration_fields || [])
    ), [event.registration_fields])

    const handleTogglePastEvent = async () => {
        setShowConfirmModal(false)
        setIsToggling(true)
        try {
            const result = await togglePastEvent(event.id)
            setIsPastEvent(result.isPastEvent)
            showToast(result.isPastEvent ? "Event added to past events timeline!" : "Event removed from past events timeline!", "success")
        } catch (error: any) {
            showToast(error.message || "Failed to update event", "error")
        } finally {
            setIsToggling(false)
        }
    }

    const handleToggleRegistrations = async () => {
        setIsUpdatingRegistrations(true)
        try {
            const result = await setEventRegistrationsClosed(event.id, !registrationsClosed)
            setRegistrationsClosed(result.registrationsClosed)
            setShowRegistrationsModal(false)
            showToast(
                result.registrationsClosed
                    ? "Registrations stopped. New sign-ups are now blocked."
                    : "Registrations reopened.",
                "success"
            )
            router.refresh()
        } catch (error: any) {
            showToast(error.message || "Failed to update registrations", "error")
        } finally {
            setIsUpdatingRegistrations(false)
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
                body: JSON.stringify({ eventId: event.id, subject: blastSubject, message: blastMessage })
            })
            const data = await res.json()

            if (res.ok) {
                showToast(data.message || "Blast email sent successfully!", "success")
                closeBlastModal()
            } else {
                showToast(data.error || "Failed to send blast email", "error")
            }
        } catch (err: any) {
            showToast(err.message || "Failed to send blast email", "error")
        } finally {
            setIsSendingBlast(false)
        }
    }

    const closeBlastModal = () => {
        setShowBlastModal(false)
        setBlastSubject("")
        setBlastMessage("")
    }

    const handleCancelRegistration = async () => {
        if (!cancelTarget) return
        setIsCancelling(true)
        try {
            const { cancelRegistration } = await import("@/lib/actions/registrations")
            await cancelRegistration(cancelTarget.id)
            showToast(`Cancelled ${cancelTarget.user.name || 'registration'}`, "success")
            setCancelTarget(null)
            router.refresh()
        } catch (error: any) {
            showToast(error.message || "Failed to cancel registration", "error")
        } finally {
            setIsCancelling(false)
        }
    }

    // Filter
    const filtered = useMemo(() => {
        const term = search.toLowerCase()
        return registrations.filter(r => {
            if (checkInFilter === 'checked_in' && !r.attended) return false
            if (checkInFilter === 'not_checked_in' && r.attended) return false
            return !term ||
                r.user.name?.toLowerCase().includes(term) ||
                r.user.email?.toLowerCase().includes(term) ||
                r.user.system_id?.toLowerCase().includes(term)
        })
    }, [registrations, search, checkInFilter])

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    // Stats
    const total = registrations.length
    const attended = registrations.filter(r => r.attended).length
    const turnout = total ? (attended / total) * 100 : 0
    const revenue = registrations.reduce((acc, r) => acc + (r.payment_status === 'paid' ? event.price : 0), 0)

    const downloadCSV = (onlyAttended = false) => {
        const dataToExport = onlyAttended ? registrations.filter(r => r.attended) : registrations

        if (dataToExport.length === 0) {
            showToast(onlyAttended ? "No one has checked in yet" : "No registrations to export", "error")
            return
        }

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

    const isLive = event.status === 'live'

    return (
        <MotionConfig reducedMotion="user">
            <div className="space-y-6 text-white">
                {/* Header */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    className="flex flex-col xl:flex-row xl:items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-4 min-w-0">
                        <Link
                            href="/admin/events"
                            className="p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-gray-400 hover:text-white hover:bg-zinc-800 transition-colors flex-shrink-0"
                            aria-label="Back to events"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="min-w-0">
                            <h1 className="text-2xl font-bold truncate">{event.title}</h1>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400 mt-1">
                                <span className="inline-flex items-center gap-1.5">
                                    <CalendarDays className="w-4 h-4" />
                                    {formatDate(event.start_time)}
                                </span>
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${isLive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-gray-400'}`}>
                                    {isLive && (
                                        <span className="relative flex h-2 w-2">
                                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                                        </span>
                                    )}
                                    {event.status.toUpperCase()}
                                </span>
                                {registrationsClosed && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400">
                                        <Lock className="w-3 h-3" /> Registrations closed
                                    </span>
                                )}
                                {isPastEvent && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-300">On timeline</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link
                            href={`/admin/events/${event.id}/certificates`}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 text-sm font-medium transition-colors"
                        >
                            <Award className="w-4 h-4" /> Certificates
                        </Link>
                        <button
                            onClick={() => setShowBlastModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/10 text-white rounded-lg hover:bg-zinc-800 text-sm font-medium transition-colors"
                        >
                            <Mail className="w-4 h-4" /> Send Blast Email
                        </button>
                        <button
                            onClick={() => setShowRegistrationsModal(true)}
                            disabled={isUpdatingRegistrations}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-50 transition-colors ${registrationsClosed
                                ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                                : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                }`}
                        >
                            {isUpdatingRegistrations
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : registrationsClosed ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            {registrationsClosed ? 'Reopen Registrations' : 'Stop Registrations'}
                        </button>
                        <div className="flex rounded-lg border border-white/10 overflow-hidden">
                            <button
                                onClick={() => downloadCSV(false)}
                                className="flex items-center gap-2 px-3.5 py-2 bg-zinc-900 text-gray-200 hover:bg-zinc-800 text-sm font-medium transition-colors"
                            >
                                <Download className="w-4 h-4" /> Export All
                            </button>
                            <button
                                onClick={() => downloadCSV(true)}
                                className="flex items-center gap-2 px-3.5 py-2 bg-zinc-900 text-gray-200 hover:bg-zinc-800 text-sm font-medium border-l border-white/10 transition-colors"
                            >
                                <CheckCircle className="w-4 h-4" /> Checked-In
                            </button>
                        </div>
                        {canToggle && (
                            <button
                                onClick={() => setShowConfirmModal(true)}
                                disabled={isToggling}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-50 transition-colors ${isPastEvent
                                    ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                    : 'border-white/10 bg-zinc-900 text-gray-200 hover:bg-zinc-800'
                                    }`}
                            >
                                {isToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : isPastEvent ? <X className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                {isPastEvent ? 'Remove from Timeline' : 'Add to Past Events'}
                            </button>
                        )}
                    </div>
                </motion.div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard index={1} icon={<Users className="w-5 h-5 text-violet-300" />} tint="bg-violet-500/15" label="Total Registrations">
                        <AnimatedNumber value={total} />
                        {event.capacity ? <span className="text-base font-medium text-gray-500"> / {event.capacity}</span> : null}
                    </StatCard>
                    <StatCard
                        index={2}
                        icon={<UserCheck className="w-5 h-5 text-emerald-300" />}
                        tint="bg-emerald-500/15"
                        label="Checked In"
                        footer={
                            <div className="mt-3">
                                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                    <motion.div
                                        className="h-full rounded-full bg-emerald-400"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${turnout}%` }}
                                        transition={{ duration: 0.9, delay: 0.3, ease: EASE_OUT }}
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1.5">{turnout.toFixed(1)}% turnout</p>
                            </div>
                        }
                    >
                        <span className="text-emerald-400"><AnimatedNumber value={attended} /></span>
                    </StatCard>
                    <StatCard index={3} icon={<IndianRupee className="w-5 h-5 text-amber-300" />} tint="bg-amber-500/15" label="Estimated Revenue">
                        ₹<AnimatedNumber value={revenue} />
                    </StatCard>
                </div>

                {/* Registrations */}
                <motion.div
                    variants={fadeUp}
                    custom={4}
                    initial="hidden"
                    animate="show"
                    className="bg-zinc-900/70 rounded-2xl border border-white/10 overflow-hidden"
                >
                    <div className="p-4 border-b border-white/10 flex flex-col lg:flex-row lg:items-center gap-3">
                        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40 border border-white/10 focus-within:border-violet-500/60 transition-colors">
                            <Search className="w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search by name, email, or system ID..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                                className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-gray-500"
                            />
                            {search && (
                                <button onClick={() => { setSearch(""); setPage(1) }} className="text-gray-500 hover:text-white" aria-label="Clear search">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div className="relative flex p-1 rounded-lg bg-black/40 border border-white/10 w-fit">
                            {([
                                ['all', `All (${total})`],
                                ['checked_in', `Checked in (${attended})`],
                                ['not_checked_in', `Not checked in (${total - attended})`],
                            ] as const).map(([value, label]) => (
                                <button
                                    key={value}
                                    onClick={() => { setCheckInFilter(value); setPage(1) }}
                                    className={`relative px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${checkInFilter === value ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    {checkInFilter === value && (
                                        <motion.span
                                            layoutId="checkin-filter"
                                            className="absolute inset-0 rounded-md bg-white/10"
                                            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                                        />
                                    )}
                                    <span className="relative">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="text-gray-400 text-xs uppercase tracking-wider">
                                <tr className="border-b border-white/10">
                                    <th className="px-4 py-3 font-medium sticky left-0 bg-zinc-900 z-10">Student</th>
                                    <th className="px-4 py-3 font-medium">System ID</th>
                                    <th className="px-4 py-3 font-medium">Class</th>
                                    <th className="px-4 py-3 font-medium">Payment</th>
                                    <th className="px-4 py-3 font-medium">Check-In</th>
                                    <th className="px-4 py-3 font-medium">Registered</th>
                                    {customFields.map((field: any) => (
                                        <th key={field.id} className="px-4 py-3 font-medium min-w-[200px]">{field.label}</th>
                                    ))}
                                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.tbody
                                    key={`${page}-${checkInFilter}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="divide-y divide-white/5"
                                >
                                    {paged.length === 0 ? (
                                        <tr>
                                            <td colSpan={7 + customFields.length} className="p-12 text-center text-gray-500">
                                                <Users className="w-10 h-10 mx-auto mb-3 text-gray-700" />
                                                {search ? <>No registrations match &quot;{search}&quot;</> : 'No registrations here yet'}
                                            </td>
                                        </tr>
                                    ) : (
                                        paged.map((reg, i) => (
                                            <motion.tr
                                                key={reg.id}
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.25, delay: Math.min(i, 12) * 0.02, ease: EASE_OUT }}
                                                className="group hover:bg-white/[0.03] transition-colors"
                                            >
                                                <td className="px-4 py-3 sticky left-0 bg-zinc-900 group-hover:bg-zinc-800/95 z-10 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar name={reg.user.name} />
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-white">{reg.user.name || 'Unknown'}</div>
                                                            <div className="text-gray-500 text-xs">{reg.user.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-300">{reg.user.system_id || <span className="text-gray-600">—</span>}</td>
                                                <td className="px-4 py-3 text-gray-300">
                                                    {reg.user.course || reg.user.year || reg.user.section ? (
                                                        <>
                                                            {reg.user.course}
                                                            {reg.user.year && <span className="text-gray-500"> · {reg.user.year} Yr</span>}
                                                            {reg.user.section && <span className="text-gray-500"> · {reg.user.section}</span>}
                                                        </>
                                                    ) : <span className="text-gray-600">—</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${reg.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                                                        reg.payment_status === 'free' ? 'bg-sky-500/10 text-sky-400' :
                                                            'bg-amber-500/10 text-amber-400'
                                                        }`}>
                                                        {reg.payment_status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {reg.attended ? (
                                                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                                                            <CheckCircle className="w-4 h-4" /> Yes
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-gray-500">
                                                            <XCircle className="w-4 h-4" /> No
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-gray-400">{formatDate(reg.created_at)}</td>

                                                {customFields.map((field: any) => {
                                                    const val = reg.answers?.[field.id]
                                                    return (
                                                        <td key={field.id} className="px-4 py-3 text-gray-300 truncate max-w-[200px]" title={val}>
                                                            {val || <span className="text-gray-600">—</span>}
                                                        </td>
                                                    )
                                                })}

                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => setCancelTarget(reg)}
                                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </td>
                                            </motion.tr>
                                        ))
                                    )}
                                </motion.tbody>
                            </AnimatePresence>
                        </table>
                    </div>

                    <div className="px-4 py-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <p className="text-xs text-gray-500">
                            {filtered.length === 0
                                ? 'No results'
                                : `Showing ${((page - 1) * PAGE_SIZE) + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
                        </p>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-white/10 bg-zinc-900 text-gray-200 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-3 h-3" /> Previous
                                </button>
                                <span className="text-xs text-gray-400 px-1 tabular-nums">Page {page} of {totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-white/10 bg-zinc-900 text-gray-200 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Feedback */}
                <motion.div
                    variants={fadeUp}
                    custom={5}
                    initial="hidden"
                    animate="show"
                    className="bg-zinc-900/70 p-6 rounded-2xl border border-white/10"
                >
                    <div className="flex items-center gap-2 mb-4 text-gray-400">
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Feedback</span>
                    </div>
                    <FeedbackFormManager
                        eventId={event.id}
                        isMultiDay={event.is_multi_day || false}
                        isVirtual={event.is_virtual || false}
                        requiresFeedback={event.requires_feedback_for_attendance || false}
                    />
                </motion.div>

                {/* Past events confirmation */}
                <Modal open={showConfirmModal} onClose={() => setShowConfirmModal(false)}>
                    <h3 className="text-xl font-bold text-white mb-3">
                        {isPastEvent ? 'Remove from Timeline?' : 'Add to Past Events?'}
                    </h3>
                    <p className="text-gray-400 mb-6">
                        {isPastEvent
                            ? `This will remove "${event.title}" from the club's past events timeline.`
                            : `This will add "${event.title}" to the club's past events timeline. The event will be visible in the club page history section.`}
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={() => setShowConfirmModal(false)}
                            className="px-4 py-2 text-gray-300 hover:bg-white/5 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleTogglePastEvent}
                            className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${isPastEvent ? 'bg-red-600 hover:bg-red-500' : 'bg-violet-600 hover:bg-violet-500'}`}
                        >
                            Confirm
                        </button>
                    </div>
                </Modal>

                {/* Stop / reopen registrations confirmation */}
                <Modal open={showRegistrationsModal} onClose={() => !isUpdatingRegistrations && setShowRegistrationsModal(false)}>
                    <h3 className="text-xl font-bold text-white mb-3">
                        {registrationsClosed ? 'Reopen registrations?' : 'Stop registrations?'}
                    </h3>
                    <p className="text-gray-400 mb-6">
                        {registrationsClosed
                            ? <>Students will be able to register for <span className="text-white font-medium">{event.title}</span> again, up to the capacity of {event.capacity}.</>
                            : <>New sign-ups for <span className="text-white font-medium">{event.title}</span> will be blocked immediately. The {registrations.length} students already registered keep their registration.</>}
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={() => setShowRegistrationsModal(false)}
                            disabled={isUpdatingRegistrations}
                            className="px-4 py-2 text-gray-300 hover:bg-white/5 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleToggleRegistrations}
                            disabled={isUpdatingRegistrations}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white disabled:opacity-60 transition-colors ${registrationsClosed ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}
                        >
                            {isUpdatingRegistrations && <Loader2 className="w-4 h-4 animate-spin" />}
                            {registrationsClosed ? 'Reopen Registrations' : 'Stop Registrations'}
                        </button>
                    </div>
                </Modal>

                {/* Cancel registration confirmation */}
                <Modal open={!!cancelTarget} onClose={() => !isCancelling && setCancelTarget(null)}>
                    <h3 className="text-xl font-bold text-white mb-3">Cancel registration?</h3>
                    <p className="text-gray-400 mb-6">
                        <span className="text-white font-medium">{cancelTarget?.user.name || 'This student'}</span> will be removed from {event.title}.
                        This can&apos;t be undone.
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={() => setCancelTarget(null)}
                            disabled={isCancelling}
                            className="px-4 py-2 text-gray-300 hover:bg-white/5 rounded-lg font-medium transition-colors"
                        >
                            Keep
                        </button>
                        <button
                            onClick={handleCancelRegistration}
                            disabled={isCancelling}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-colors"
                        >
                            {isCancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                            Cancel registration
                        </button>
                    </div>
                </Modal>

                {/* Blast email */}
                <Modal open={showBlastModal} onClose={() => !isSendingBlast && closeBlastModal()} wide>
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-violet-500/15 rounded-xl flex items-center justify-center">
                            <Mail className="w-5 h-5 text-violet-300" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Send Blast Email</h3>
                            <p className="text-gray-400 text-sm">Message all {registrations.length} registered participants</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">Subject</label>
                            <input
                                type="text"
                                value={blastSubject}
                                onChange={(e) => setBlastSubject(e.target.value)}
                                placeholder="e.g., Important Update about the Event"
                                className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-violet-500/60 focus:border-transparent outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">Message</label>
                            <textarea
                                value={blastMessage}
                                onChange={(e) => setBlastMessage(e.target.value)}
                                placeholder="Write your message here..."
                                rows={5}
                                className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-violet-500/60 focus:border-transparent outline-none resize-none"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end mt-6">
                        <button
                            onClick={closeBlastModal}
                            className="px-4 py-2 text-gray-300 hover:bg-white/5 rounded-lg font-medium transition-colors"
                            disabled={isSendingBlast}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSendBlast}
                            disabled={isSendingBlast || !blastSubject.trim() || !blastMessage.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSendingBlast ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {isSendingBlast ? 'Sending...' : 'Send to All'}
                        </button>
                    </div>
                </Modal>

                {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
            </div>
        </MotionConfig>
    )
}

// ==========================================
// Pieces
// ==========================================

function StatCard({ index, icon, tint, label, children, footer }: {
    index: number
    icon: React.ReactNode
    tint: string
    label: string
    children: React.ReactNode
    footer?: React.ReactNode
}) {
    return (
        <motion.div
            variants={fadeUp}
            custom={index}
            initial="hidden"
            animate="show"
            whileHover={{ y: -2 }}
            className="bg-zinc-900/70 p-5 rounded-2xl border border-white/10 hover:border-white/20 transition-colors"
        >
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${tint}`}>{icon}</div>
                <p className="text-sm text-gray-400">{label}</p>
            </div>
            <p className="text-3xl font-bold text-white tabular-nums">{children}</p>
            {footer}
        </motion.div>
    )
}

/** Counts up from 0 on mount, and animates between values after. */
function AnimatedNumber({ value }: { value: number }) {
    const count = useMotionValue(0)
    const rounded = useTransform(count, v => Math.round(v).toLocaleString('en-IN'))
    const [display, setDisplay] = useState('0')

    useEffect(() => {
        const unsubscribe = rounded.on('change', setDisplay)
        const controls = animate(count, value, { duration: 0.9, ease: EASE_OUT })
        return () => { controls.stop(); unsubscribe() }
    }, [value, count, rounded])

    return <>{display}</>
}

function Avatar({ name }: { name?: string | null }) {
    const initials = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
    return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-sky-500/20 border border-white/10 flex items-center justify-center text-xs font-semibold text-violet-200 flex-shrink-0">
            {initials || '?'}
        </div>
    )
}

function Modal({ open, onClose, wide, children }: { open: boolean, onClose: () => void, wide?: boolean, children: React.ReactNode }) {
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={onClose}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        className={`bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full shadow-2xl ${wide ? 'max-w-lg' : 'max-w-md'}`}
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 4 }}
                        transition={{ duration: 0.2, ease: EASE_OUT }}
                        onClick={e => e.stopPropagation()}
                    >
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
