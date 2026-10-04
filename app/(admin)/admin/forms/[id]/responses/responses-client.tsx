"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Download, Send, X, Loader2, Mail, Users, UserCheck,
    CheckSquare, Square, Search, Trash2, BarChart3, PieChart, Calendar, Lightbulb } from "lucide-react"
import { exportFormResponsesToCSV, sendEmailToRespondents, clearFormResponses, deleteSelectedResponses } from "@/lib/actions/forms"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface ResponsesClientProps {
    formId: string
    formTitle: string
    fields: any[]
    responses: any[]
}

export function ResponsesClient({ formId, formTitle, fields, responses }: ResponsesClientProps) {
    const [isExporting, setIsExporting] = useState(false)
    const [showEmailComposer, setShowEmailComposer] = useState(false)
    const [selectedResponseIds, setSelectedResponseIds] = useState<string[]>([])
    const [search, setSearch] = useState("")
    const [isClearing, setIsClearing] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [activeTab, setActiveTab] = useState<"table" | "charts">("table")
    const router = useRouter()

    const questionFields = useMemo(() => fields.filter((f: any) => f.type !== "section"), [fields])

    const filteredResponses = useMemo(() =>
        responses.filter((r: any) => {
            if (!search) return true
            const s = search.toLowerCase()
            return (r.user?.name?.toLowerCase().includes(s) || r.user?.email?.toLowerCase().includes(s) || r.user?.system_id?.toLowerCase().includes(s))
        }), [responses, search])

    const handleExportCSV = async () => {
        setIsExporting(true)
        try {
            const csv = await exportFormResponsesToCSV(formId)
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = `${formTitle.replace(/[^a-z0-9]/gi, "_")}_responses.csv`
            link.click()
            URL.revokeObjectURL(url)
            toast.success("CSV exported!")
        } catch { toast.error("Failed to export") }
        finally { setIsExporting(false) }
    }

    const handleClearAll = async () => {
        if (!confirm(`Delete ALL ${responses.length} responses permanently? This cannot be undone.`)) return
        setIsClearing(true)
        try {
            await clearFormResponses(formId)
            toast.success("All responses cleared!")
            router.refresh()
        } catch (err: any) { toast.error(err.message || "Failed to clear") }
        finally { setIsClearing(false) }
    }

    const handleDeleteSelected = async () => {
        if (!confirm(`Delete ${selectedResponseIds.length} selected response(s)? This cannot be undone.`)) return
        setIsDeleting(true)
        try {
            await deleteSelectedResponses(formId, selectedResponseIds)
            toast.success(`${selectedResponseIds.length} response(s) deleted!`)
            setSelectedResponseIds([])
            router.refresh()
        } catch (err: any) { toast.error(err.message || "Failed to delete") }
        finally { setIsDeleting(false) }
    }

    const toggleSelect = (responseId: string) => {
        setSelectedResponseIds(prev => prev.includes(responseId) ? prev.filter(id => id !== responseId) : [...prev, responseId])
    }

    const toggleSelectAll = () => {
        setSelectedResponseIds(prev =>
            prev.length === filteredResponses.length ? [] : filteredResponses.map((r: any) => r.id)
        )
    }

    // Stats
    const todayCount = responses.filter((r: any) => new Date(r.created_at).toDateString() === new Date().toDateString()).length
    const completionRate = responses.length > 0 ? Math.round((responses.filter((r: any) => r.answers?.length >= questionFields.length).length / responses.length) * 100) : 0

    return (
        <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Total Responses", value: responses.length, icon: Users, color: "#3b82f6" },
                    { label: "Questions", value: questionFields.length, icon: BarChart3, color: "#8b5cf6" },
                    { label: "Today", value: todayCount, icon: Calendar, color: "#10b981" },
                    { label: "Completion", value: `${completionRate}%`, icon: PieChart, color: "#f59e0b" },
                ].map(card => (
                    <div key={card.label} className="bg-[#141416] border border-[#27272a] rounded-2xl p-5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"
                            style={{ backgroundColor: card.color }} />
                        <div className="flex items-center gap-2 mb-2">
                            <card.icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                            <p className="text-[10px] text-[#52525b] uppercase tracking-widest font-semibold">{card.label}</p>
                        </div>
                        <p className="text-3xl font-bold text-white">{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Tab bar + Actions */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex bg-[#141416] border border-[#27272a] rounded-xl p-1 mr-auto">
                    <button onClick={() => setActiveTab("table")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "table" ? "bg-[#27272a] text-white" : "text-[#71717a] hover:text-white"}`}>
                        <Users className="w-4 h-4" /> Responses
                    </button>
                    <button onClick={() => setActiveTab("charts")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "charts" ? "bg-[#27272a] text-white" : "text-[#71717a] hover:text-white"}`}>
                        <BarChart3 className="w-4 h-4" /> Summary
                    </button>
                </div>

                <button onClick={handleClearAll} disabled={isClearing || responses.length === 0}
                    className="h-10 px-4 rounded-xl bg-[#141416] border border-[#dc2626]/20 hover:border-[#dc2626]/50 text-[#dc2626] text-xs font-medium transition-all flex items-center gap-2 disabled:opacity-40">
                    {isClearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Clear All
                </button>
                <button onClick={handleExportCSV} disabled={isExporting || responses.length === 0}
                    className="h-10 px-4 rounded-xl bg-[#141416] border border-[#27272a] hover:border-[#3f3f46] text-[#e4e4e7] text-xs font-medium transition-all flex items-center gap-2 disabled:opacity-40">
                    {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Export CSV
                </button>
                <button onClick={() => setShowEmailComposer(true)} disabled={responses.length === 0}
                    className="h-10 px-4 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-medium transition-all flex items-center gap-2 disabled:opacity-40 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <Send className="w-3.5 h-3.5" /> Send Email
                </button>
            </div>

            {/* Selection action bar */}
            <AnimatePresence>
                {selectedResponseIds.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-4 px-5 py-3 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20">
                        <span className="text-sm text-[#93c5fd] font-medium">{selectedResponseIds.length} selected</span>
                        <button onClick={handleDeleteSelected} disabled={isDeleting}
                            className="text-sm text-[#ef4444] font-semibold hover:underline flex items-center gap-1.5 disabled:opacity-50">
                            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            Delete Selected
                        </button>
                        <button onClick={() => setShowEmailComposer(true)} className="text-sm text-[#3b82f6] font-semibold hover:underline">Email Selected</button>
                        <button onClick={() => setSelectedResponseIds([])} className="text-sm text-[#71717a] hover:text-white ml-auto">Clear Selection</button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content */}
            <AnimatePresence mode="wait">
                {activeTab === "table" ? (
                    <motion.div key="table" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <div className="relative mb-4">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525b]" />
                            <input type="text" placeholder="Search by name, email, or ID..." value={search} onChange={(e) => setSearch(e.target.value)}
                                className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#141416] border border-[#27272a] text-white text-sm placeholder:text-[#3f3f46] focus:border-[#3b82f6] outline-none transition-all" />
                        </div>
                        <div className="bg-[#141416] border border-[#27272a] rounded-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[#1e1e22]">
                                            <th className="p-4 text-left">
                                                <button onClick={toggleSelectAll} className="text-[#52525b] hover:text-white transition-colors">
                                                    {selectedResponseIds.length === filteredResponses.length && filteredResponses.length > 0
                                                        ? <CheckSquare className="w-4 h-4 text-[#3b82f6]" /> : <Square className="w-4 h-4" />}
                                                </button>
                                            </th>
                                            <th className="p-4 text-left text-[#71717a] font-semibold uppercase tracking-wider text-xs">User</th>
                                            {questionFields.slice(0, 5).map((f: any) => (
                                                <th key={f.id} className="p-4 text-left text-[#71717a] font-semibold uppercase tracking-wider text-xs max-w-[200px] truncate">{f.label}</th>
                                            ))}
                                            <th className="p-4 text-left text-[#71717a] font-semibold uppercase tracking-wider text-xs">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#1e1e22]">
                                        {filteredResponses.map((r: any) => (
                                            <tr key={r.id} className={`hover:bg-[#1e1e22]/50 transition-colors ${selectedResponseIds.includes(r.id) ? 'bg-[#3b82f6]/5' : ''}`}>
                                                <td className="p-4">
                                                    <button onClick={() => toggleSelect(r.id)} className="text-[#52525b] hover:text-white transition-colors">
                                                        {selectedResponseIds.includes(r.id) ? <CheckSquare className="w-4 h-4 text-[#3b82f6]" /> : <Square className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-white font-medium text-sm truncate max-w-[160px]">{r.user?.name || "Unknown"}</p>
                                                    <p className="text-[#52525b] text-xs truncate max-w-[160px]">{r.user?.email || ""}</p>
                                                </td>
                                                {questionFields.slice(0, 5).map((f: any) => {
                                                    const answer = r.answers?.find((a: any) => a.field_id === f.id)
                                                    let val = "—"
                                                    if (answer) {
                                                        if (answer.answer_text) val = answer.answer_text
                                                        if (answer.answer_json) val = Array.isArray(answer.answer_json) ? answer.answer_json.join(", ") : JSON.stringify(answer.answer_json)
                                                    }
                                                    return <td key={f.id} className="p-4 text-[#a1a1aa] max-w-[200px] truncate" title={val}>{val}</td>
                                                })}
                                                <td className="p-4 text-[#52525b] text-xs whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                                            </tr>
                                        ))}
                                        {filteredResponses.length === 0 && (
                                            <tr><td colSpan={questionFields.length + 3} className="text-center py-12 text-[#52525b]">
                                                {responses.length === 0 ? "No responses yet." : "No results match your search."}
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="charts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <ResponseCharts fields={questionFields} responses={responses} />
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showEmailComposer && (
                    <EmailComposer formId={formId} formTitle={formTitle} totalRespondents={responses.length}
                        selectedUserIds={selectedResponseIds.length > 0
                            ? responses.filter((r: any) => selectedResponseIds.includes(r.id)).map((r: any) => r.user_id)
                            : []}
                        onClose={() => setShowEmailComposer(false)} />
                )}
            </AnimatePresence>
        </>
    )
}

// ============================================================
// CHARTS (Google Forms-style)
// ============================================================

const CHART_COLORS = ["#4285f4", "#ea4335", "#fbbc04", "#34a853", "#ff6d01", "#46bdc6", "#7baaf7", "#f07b72", "#fdd663", "#57bb8a", "#f4511e", "#039be5"]

function ResponseCharts({ fields, responses }: { fields: any[]; responses: any[] }) {
    const chartableFields = fields.filter((f: any) => ['select', 'checkbox'].includes(f.type))

    if (responses.length === 0) {
        return (
            <div className="text-center py-16 text-[#52525b]">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No data to visualize yet</p>
                <p className="text-sm mt-1">Charts will appear once you have responses.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Timeline */}
            <div className="bg-[#141416] border border-[#27272a] rounded-2xl p-6">
                <h3 className="text-sm font-bold text-[#e4e4e7] mb-1 flex items-center gap-2"><Calendar className="w-4 h-4 text-[#3b82f6]" /> Submissions Over Time</h3>
                <p className="text-xs text-[#52525b] mb-5">{responses.length} total responses</p>
                <SubmissionsTimeline responses={responses} />
            </div>

            {/* Per-question charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {chartableFields.map((field: any) => {
                    const data = getAnswerCounts(field, responses)
                    const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
                    if (entries.length === 0) return null
                    const total = entries.reduce((s, [, c]) => s + c, 0)

                    return (
                        <div key={field.id} className="bg-[#141416] border border-[#27272a] rounded-2xl p-6">
                            <h3 className="text-sm font-bold text-[#e4e4e7] mb-1 truncate" title={field.label}>{field.label}</h3>
                            <p className="text-xs text-[#52525b] mb-5">{responses.length} response{responses.length !== 1 ? 's' : ''}</p>

                            {/* Donut chart + Legend (Google Forms style) */}
                            <div className="flex items-center gap-6">
                                <DonutChart data={entries} total={total} />
                                <div className="flex-1 space-y-2 min-w-0">
                                    {entries.map(([label, count], i) => (
                                        <div key={label} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                            <span className="text-xs text-[#d4d4d8] truncate flex-1" title={label}>{label}</span>
                                            <span className="text-xs text-[#71717a] font-mono shrink-0">{count} ({Math.round((count / total) * 100)}%)</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                })}

                {/* Text/number summary cards */}
                {fields.filter(f => ['text', 'textarea', 'number', 'email', 'phone', 'url'].includes(f.type)).map((field: any) => {
                    const answersWithUser = responses
                        .map((r: any) => ({
                            user: r.user,
                            text: r.answers?.find((a: any) => a.field_id === field.id)?.answer_text
                        }))
                        .filter((a: any) => Boolean(a.text))

                    if (answersWithUser.length === 0) return null

                    return (
                        <div key={field.id} className="bg-[#141416] border border-[#27272a] rounded-2xl p-6 md:col-span-2">
                            <h3 className="text-sm font-bold text-[#e4e4e7] mb-1 truncate" title={field.label}>{field.label}</h3>
                            <p className="text-xs text-[#52525b] mb-4">{answersWithUser.length} response{answersWithUser.length !== 1 ? 's' : ''}</p>
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                                {answersWithUser.map((ans: any, i: number) => (
                                    <div key={i} className="p-4 bg-[#0a0a0b] border border-[#1e1e22] rounded-xl">
                                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#1e1e22]">
                                            <div className="w-6 h-6 rounded-full bg-[#3b82f6]/20 flex items-center justify-center text-[#3b82f6] font-bold text-[10px]">
                                                {ans.user?.name?.charAt(0) || "U"}
                                            </div>
                                            <div>
                                                <div className="text-xs font-semibold text-[#e4e4e7]">{ans.user?.name || "Unknown User"}</div>
                                                <div className="text-[10px] text-[#71717a] font-mono">{ans.user?.system_id || ans.user?.email || "N/A"}</div>
                                            </div>
                                        </div>
                                        <div className="text-sm text-[#d4d4d8] break-words whitespace-pre-wrap leading-relaxed">
                                            {ans.text}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function getAnswerCounts(field: any, responses: any[]): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const r of responses) {
        const answer = r.answers?.find((a: any) => a.field_id === field.id)
        if (!answer) continue
        if (answer.answer_json && Array.isArray(answer.answer_json)) {
            for (const val of answer.answer_json) counts[val] = (counts[val] || 0) + 1
        } else if (answer.answer_text) {
            counts[answer.answer_text] = (counts[answer.answer_text] || 0) + 1
        }
    }
    return counts
}

// CSS donut chart (SVG-based, like Google Forms)
function DonutChart({ data, total }: { data: [string, number][]; total: number }) {
    const size = 120
    const strokeWidth = 20
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    // Each slice starts where the previous ones end.
    const starts = data.reduce<number[]>((acc, [, count], i) => {
        acc.push(i === 0 ? 0 : acc[i - 1] + (data[i - 1][1] / total) * circumference)
        return acc
    }, [])

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                {data.map(([label, count], i) => {
                    const pct = count / total
                    const dashLength = pct * circumference
                    const dashOffset = -starts[i]
                    return (
                        <circle key={label} cx={size / 2} cy={size / 2} r={radius}
                            fill="none" strokeWidth={strokeWidth}
                            stroke={CHART_COLORS[i % CHART_COLORS.length]}
                            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                            strokeDashoffset={dashOffset}
                            className="transition-all duration-500" />
                    )
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white">{total}</span>
                <span className="text-[10px] text-[#52525b] uppercase tracking-wider">Total</span>
            </div>
        </div>
    )
}

function SubmissionsTimeline({ responses }: { responses: any[] }) {
    const days = 14
    const now = new Date()
    const buckets: { label: string; shortLabel: string; count: number }[] = []

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        
        const count = responses.filter(r => {
            if (!r.created_at) return false
            const d = new Date(r.created_at)
            return d.getFullYear() === date.getFullYear() && 
                   d.getMonth() === date.getMonth() && 
                   d.getDate() === date.getDate()
        }).length

        buckets.push({
            label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            shortLabel: date.getDate().toString(),
            count,
        })
    }

    const max = Math.max(...buckets.map(b => b.count), 1)

    return (
        <div className="flex items-end gap-1 h-36">
            {buckets.map((bucket, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group" title={`${bucket.label}: ${bucket.count}`}>
                    <span className="text-[10px] text-[#71717a] font-mono opacity-0 group-hover:opacity-100 transition-opacity">{bucket.count}</span>
                    <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max((bucket.count / max) * 100, 3)}%` }}
                        transition={{ duration: 0.5, delay: i * 0.03 }}
                        className="w-full bg-gradient-to-t from-[#3b82f6] to-[#818cf8] rounded-t-md hover:from-[#2563eb] hover:to-[#6366f1] transition-colors cursor-default" />
                    <span className="text-[9px] text-[#3f3f46] font-mono">{bucket.shortLabel}</span>
                </div>
            ))}
        </div>
    )
}

// ============================================================
// Email Composer
// ============================================================

function EmailComposer({ formId, formTitle, totalRespondents, selectedUserIds, onClose }: {
    formId: string; formTitle: string; totalRespondents: number; selectedUserIds: string[]; onClose: () => void
}) {
    const [recipientType, setRecipientType] = useState<"all" | "selective">(selectedUserIds.length > 0 ? "selective" : "all")
    const [subject, setSubject] = useState("")
    const [body, setBody] = useState("")
    const [isSending, setIsSending] = useState(false)

    const handleSend = async () => {
        if (!subject.trim() || !body.trim()) { toast.error("Fill in subject and message."); return }
        setIsSending(true)
        try {
            const result = await sendEmailToRespondents(formId, subject, body, recipientType, recipientType === "selective" ? selectedUserIds : undefined)
            toast.success(`Email sent to ${result.sentCount} recipient${result.sentCount !== 1 ? "s" : ""}!`)
            onClose()
        } catch (err: any) { toast.error(err.message || "Failed to send") }
        finally { setIsSending(false) }
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative z-10 w-full max-w-2xl bg-[#141416] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl">
                <div className="h-1 bg-gradient-to-r from-[#3b82f6] via-[#a78bfa] to-[#06b6d4]" />
                <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center"><Mail className="w-5 h-5 text-[#3b82f6]" /></div>
                            <div><h2 className="text-lg font-semibold text-white">Send Email</h2><p className="text-xs text-[#52525b]">to {formTitle} respondents</p></div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl text-[#52525b] hover:text-white hover:bg-[#1e1e22] transition-all"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#71717a] uppercase tracking-widest">Recipients</label>
                        <div className="flex gap-2">
                            <button onClick={() => setRecipientType("all")}
                                className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium transition-all border ${recipientType === "all" ? "bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]" : "bg-[#0a0a0b] border-[#27272a] text-[#71717a]"}`}>
                                <Users className="w-4 h-4" /> All ({totalRespondents})
                            </button>
                            <button onClick={() => setRecipientType("selective")} disabled={selectedUserIds.length === 0}
                                className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium transition-all border disabled:opacity-30 ${recipientType === "selective" ? "bg-[#a78bfa]/10 border-[#a78bfa]/30 text-[#a78bfa]" : "bg-[#0a0a0b] border-[#27272a] text-[#71717a]"}`}>
                                <UserCheck className="w-4 h-4" /> Selected ({selectedUserIds.length})
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#71717a] uppercase tracking-widest">Subject</label>
                        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={`e.g. Important Update: ${formTitle}`}
                            className="w-full h-12 px-4 rounded-xl bg-[#0a0a0b] border border-[#27272a] text-white placeholder:text-[#3f3f46] focus:border-[#3b82f6] outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#71717a] uppercase tracking-widest">Message</label>
                        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
                            placeholder="Type your message here... Use {{name}} to personalize."
                            className="w-full px-4 py-3 rounded-xl bg-[#0a0a0b] border border-[#27272a] text-white placeholder:text-[#3f3f46] focus:border-[#3b82f6] outline-none transition-all resize-none" />
                        <p className="text-xs text-[#52525b] flex items-center gap-1.5 flex-wrap"><Lightbulb className="w-3.5 h-3.5" /> Use <code className="text-[#a78bfa] bg-[#1e1e22] px-1.5 py-0.5 rounded">{"{{name}}"}</code> for personalization.</p>
                    </div>
                    <div className="flex justify-end gap-3 pt-1">
                        <button onClick={onClose} className="h-11 px-6 rounded-xl bg-[#1e1e22] hover:bg-[#27272a] text-[#a1a1aa] text-sm font-medium transition-all">Cancel</button>
                        <button onClick={handleSend} disabled={isSending || !subject.trim() || !body.trim()}
                            className="h-11 px-8 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-40 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {isSending ? "Sending..." : `Send to ${recipientType === "all" ? totalRespondents : selectedUserIds.length}`}
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}
