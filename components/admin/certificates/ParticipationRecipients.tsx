"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Search, Send, Trophy, CheckCircle, Users } from "lucide-react"
import { getEventStudents, type EventStudent } from "@/lib/actions/certificates"

interface ParticipationRecipientsProps {
    eventId: string
    refreshKey?: number
    canSend: boolean
    isSending: boolean
    onSend: (userIds: string[]) => Promise<void>
}

type RowState = 'eligible' | 'position' | 'sent'

const PAGE_SIZE = 60

function getRowState(student: EventStudent): { state: RowState, label?: string } {
    const position = student.certificates.find(c => c.position_id)
    if (position) return { state: 'position', label: position.position_title || 'Position' }
    if (student.certificates.some(c => !c.position_id && c.status !== 'pending')) return { state: 'sent' }
    return { state: 'eligible' }
}

/**
 * Every registered student, ready for the bulk participation send. Students holding a
 * position are taken out automatically; already-sent students are shown but locked.
 */
export function ParticipationRecipients({ eventId, refreshKey, canSend, isSending, onSend }: ParticipationRecipientsProps) {
    const [students, setStudents] = useState<EventStudent[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [query, setQuery] = useState('')
    const [onlyAttended, setOnlyAttended] = useState(false)
    const [excluded, setExcluded] = useState<Set<string>>(new Set())
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

    useEffect(() => {
        let cancelled = false
        getEventStudents(eventId)
            .then(data => { if (!cancelled) setStudents(data.students) })
            .catch(error => console.error('Failed to load students:', error))
            .finally(() => { if (!cancelled) setIsLoading(false) })
        return () => { cancelled = true }
    }, [eventId, refreshKey])

    const rows = useMemo(() => students.map(s => ({ student: s, ...getRowState(s) })), [students])

    const isSelected = (row: typeof rows[number]) =>
        row.state === 'eligible' && !excluded.has(row.student.user_id) && (!onlyAttended || row.student.attended)

    const selectedIds = rows.filter(isSelected).map(r => r.student.user_id)
    const eligibleCount = rows.filter(r => r.state === 'eligible').length
    const positionCount = rows.filter(r => r.state === 'position').length
    const sentCount = rows.filter(r => r.state === 'sent').length

    const filtered = useMemo(() => {
        const term = query.trim().toLowerCase()
        return rows.filter(r =>
            (!onlyAttended || r.student.attended) &&
            (!term || (r.student.name || '').toLowerCase().includes(term) || (r.student.email || '').toLowerCase().includes(term))
        )
    }, [rows, query, onlyAttended])

    const filteredEligible = filtered.filter(r => r.state === 'eligible')
    const allFilteredSelected = filteredEligible.length > 0 && filteredEligible.every(r => !excluded.has(r.student.user_id))

    const toggle = (userId: string) => {
        setExcluded(prev => {
            const next = new Set(prev)
            if (next.has(userId)) next.delete(userId)
            else next.add(userId)
            return next
        })
    }

    const toggleAllFiltered = () => {
        setExcluded(prev => {
            const next = new Set(prev)
            filteredEligible.forEach(r => allFilteredSelected ? next.add(r.student.user_id) : next.delete(r.student.user_id))
            return next
        })
    }

    if (isLoading) {
        return (
            <div className="bg-gray-900 rounded-xl p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
            </div>
        )
    }

    return (
        <div className="bg-gray-900 rounded-xl">
            <div className="p-4 border-b border-gray-800 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <Users className="w-5 h-5 text-violet-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                            <p className="text-white font-medium">Send participation certificates</p>
                            <p className="text-gray-500">
                                {students.length} registered · {eligibleCount} eligible
                                {positionCount > 0 && ` · ${positionCount} removed (have a position)`}
                                {sentCount > 0 && ` · ${sentCount} already sent`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => onSend(selectedIds)}
                        disabled={!canSend || isSending || selectedIds.length === 0}
                        title={canSend ? undefined : 'Upload and save a template first'}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {isSending ? 'Sending...' : `Send to ${selectedIds.length} student${selectedIds.length === 1 ? '' : 's'}`}
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus-within:border-violet-500">
                        <Search className="w-4 h-4 text-gray-500" />
                        <input
                            value={query}
                            onChange={e => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE) }}
                            placeholder="Search by name or email"
                            className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 focus:outline-none"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-300 px-1 cursor-pointer whitespace-nowrap">
                        <input
                            type="checkbox"
                            checked={onlyAttended}
                            onChange={e => setOnlyAttended(e.target.checked)}
                            className="accent-violet-600"
                        />
                        Only students marked attended
                    </label>
                </div>
            </div>

            {filtered.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-500">
                    {students.length === 0 ? 'No students registered for this event yet' : 'No students match'}
                </p>
            ) : (
                <>
                    <div className="max-h-[420px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-800 z-10">
                                <tr>
                                    <th className="w-10 px-4 py-2 text-left">
                                        <input
                                            type="checkbox"
                                            checked={allFilteredSelected}
                                            onChange={toggleAllFiltered}
                                            disabled={filteredEligible.length === 0}
                                            className="accent-violet-600"
                                            title="Select all shown"
                                        />
                                    </th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Student</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {filtered.slice(0, visibleCount).map(row => {
                                    const locked = row.state !== 'eligible'
                                    return (
                                        <tr
                                            key={row.student.user_id}
                                            onClick={() => !locked && toggle(row.student.user_id)}
                                            className={locked ? 'opacity-60' : 'cursor-pointer hover:bg-gray-800/50'}
                                        >
                                            <td className="px-4 py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected(row)}
                                                    disabled={locked}
                                                    onChange={() => toggle(row.student.user_id)}
                                                    onClick={e => e.stopPropagation()}
                                                    className="accent-violet-600"
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <p className={`font-medium ${locked ? 'text-gray-400' : 'text-white'}`}>{row.student.name || 'Unknown'}</p>
                                                <p className="text-xs text-gray-500">{row.student.email}</p>
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                {row.state === 'position' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-full text-xs">
                                                        <Trophy className="w-3 h-3" /> {row.label}
                                                    </span>
                                                ) : row.state === 'sent' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full text-xs">
                                                        <CheckCircle className="w-3 h-3" /> Sent
                                                    </span>
                                                ) : row.student.attended ? (
                                                    <span className="text-xs text-emerald-400">Attended</span>
                                                ) : (
                                                    <span className="text-xs text-gray-500">Registered</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length > visibleCount && (
                        <button
                            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                            className="w-full py-2.5 text-sm text-violet-400 hover:text-violet-300 border-t border-gray-800"
                        >
                            Show more ({filtered.length - visibleCount} remaining)
                        </button>
                    )}
                </>
            )}
        </div>
    )
}
