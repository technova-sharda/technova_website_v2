"use client"

import { toast } from "sonner"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { submitFormResponse } from "@/lib/actions/forms"
import confetti from "canvas-confetti"
import {
    CheckCircle2, Loader2, Copy, Check, ArrowRight, ArrowLeft,
    ExternalLink, Sparkles, Clock, FileText, Shield
} from "lucide-react"

type FormState = "landing" | "filling" | "submitted" | "deadline"

export function DynamicForm({ form, existingResponse, systemId, referrerId }: any) {
    const [answers, setAnswers] = useState<Record<string, any>>(
        existingResponse?.answers?.reduce((acc: any, curr: any) => ({
            ...acc,
            [curr.field_id]: curr.answer_text || curr.answer_json || ""
        }), {}) || {}
    )
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [copied, setCopied] = useState(false)
    const [currentSection, setCurrentSection] = useState(0)
    const [sectionHistory, setSectionHistory] = useState<number[]>([])

    const isDeadlinePassed = form.deadline && new Date(form.deadline) < new Date()
    const hasExistingAndNoEdit = !!existingResponse && !form.allow_edit

    // Determine initial state
    const getInitialState = (): FormState => {
        if (isDeadlinePassed && !existingResponse) return "deadline"
        if (hasExistingAndNoEdit) return "submitted"
        if (existingResponse && form.allow_edit && !isDeadlinePassed) return "filling"
        return "landing"
    }

    const [formState, setFormState] = useState<FormState>(getInitialState())

    const sections = groupFieldsIntoSections(form.fields)
    const totalSections = sections.length
    const questionCount = form.fields.filter((f: any) => f.type !== "section").length

    // Auto-detect if user selected a PR/Public Relations role
    const isPRCandidate = (() => {
        const roleFields = form.fields.filter((f: any) =>
            (f.type === 'select' || f.type === 'checkbox') &&
            /role|position|designation/i.test(f.label)
        )
        for (const rf of roleFields) {
            const val = answers[rf.id]
            if (typeof val === 'string' && /\bpr\b|public\s*relation/i.test(val)) return true
            if (Array.isArray(val) && val.some((v: string) => /\bpr\b|public\s*relation/i.test(v))) return true
        }
        return false
    })()

    // Conditional routing
    const getNextSectionIndex = () => {
        const currentSectionObj = sections[currentSection]
        const currentFields = currentSectionObj?.fields || []
        
        // 1. Check option-based routing first
        for (const field of currentFields) {
            if (field.type === 'select' && field.validation?.optionRouting) {
                const selectedValue = answers[field.id]
                const routing = field.validation.optionRouting
                if (selectedValue && routing[selectedValue]) {
                    const targetSectionId = routing[selectedValue]
                    if (targetSectionId === '__submit__') return totalSections
                    const targetIdx = sections.findIndex((s: any) => s.header?.id === targetSectionId)
                    if (targetIdx !== -1) return targetIdx
                }
            }
        }

        // 2. Check section-level routing fallback
        const afterSection = currentSectionObj?.nextRouting
        if (afterSection && afterSection !== '__next__') {
            if (afterSection === '__submit__') return totalSections
            const targetIdx = sections.findIndex((s: any) => s.header?.id === afterSection)
            if (targetIdx !== -1) return targetIdx
        }

        // 3. Sequential fallback
        return currentSection + 1
    }

    const goToNextSection = (nextIdx: number) => {
        setSectionHistory(prev => [...prev, currentSection])
        setCurrentSection(nextIdx)
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    const goToPrevSection = () => {
        if (sectionHistory.length > 0) {
            const prevSection = sectionHistory[sectionHistory.length - 1]
            setSectionHistory(prev => prev.slice(0, -1))
            setCurrentSection(prevSection)
            window.scrollTo({ top: 0, behavior: "smooth" })
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const nextIdx = getNextSectionIndex()
        if (nextIdx < totalSections && currentSection < totalSections - 1) {
            goToNextSection(nextIdx)
            return
        }
        setIsSubmitting(true)
        try {
            const formattedAnswers = Object.keys(answers).map(fieldId => {
                const field = form.fields.find((f: any) => f.id === fieldId)
                const isJson = field?.type === 'checkbox'
                return {
                    field_id: fieldId,
                    answer_text: isJson ? null : answers[fieldId],
                    answer_json: isJson ? answers[fieldId] : null
                }
            })
            await submitFormResponse(form.id, formattedAnswers, referrerId)
            setFormState("submitted")
            triggerConfetti()
        } catch (error: any) {
            toast.error(error.message || "Failed to submit form. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const triggerConfetti = () => {
        const end = Date.now() + 3 * 1000
        const colors = ['#a78bfa', '#3b82f6', '#ec4899', '#14b8a6', '#f59e0b']
        
        ;(function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: colors
            })
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: colors
            })

            if (Date.now() < end) {
                requestAnimationFrame(frame)
            }
        }())
    }

    const handleChange = (fieldId: string, value: any) => {
        setAnswers(prev => ({ ...prev, [fieldId]: value }))
    }

    const copyReferralLink = async () => {
        const url = `${window.location.origin}/forms/${form.id}?ref=${systemId}`
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(url)
            } else {
                const ta = document.createElement('textarea')
                ta.value = url; ta.style.position = 'fixed'; ta.style.left = '-9999px'
                document.body.appendChild(ta); ta.focus(); ta.select()
                document.execCommand('copy'); document.body.removeChild(ta)
            }
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch { window.prompt('Copy this referral link:', url) }
    }

    const containerAnim = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.15 } }
    }
    const itemAnim = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
    }

    // ===== DEADLINE PASSED =====
    if (formState === "deadline") {
        return (
            <FullScreenCard>
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-orange-500 to-rose-500" />
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }}
                    className="w-24 h-24 bg-gradient-to-br from-rose-500/20 to-orange-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-rose-500/20">
                    <Clock className="w-12 h-12 text-rose-400" />
                </motion.div>
                <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="text-4xl font-extrabold text-white mb-4 tracking-tight">Deadline Passed</motion.h2>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                    className="text-zinc-400 text-lg leading-relaxed max-w-md mx-auto">
                    The deadline for <span className="text-white font-semibold">{form.title}</span> was{' '}
                    <span className="text-rose-400">{new Date(form.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>.
                    <br />This form is no longer accepting responses.
                </motion.p>
            </FullScreenCard>
        )
    }

    // ===== LANDING PAGE =====
    if (formState === "landing") {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
                {/* Ambient glow */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/15 blur-[150px] rounded-full pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                    className="relative z-10 max-w-2xl w-full text-center"
                >
                    {/* Logo badge */}
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2, stiffness: 200, damping: 15 }}
                        className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-8 sm:mb-10 shadow-[0_0_60px_rgba(99,102,241,0.3)]">
                        <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </motion.div>

                    {/* Title */}
                    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}
                        className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-4 sm:mb-6 leading-[1.1] px-2">
                        {form.title}
                    </motion.h1>

                    {/* Description */}
                    {form.description && (
                        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                            className="text-base sm:text-xl text-zinc-400 leading-relaxed max-w-lg mx-auto mb-8 sm:mb-12 px-2 whitespace-pre-wrap">
                            {form.description}
                        </motion.p>
                    )}

                    {/* Meta info */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                        className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mb-8 sm:mb-12 text-xs sm:text-sm text-zinc-500">
                        <span className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            {questionCount} question{questionCount !== 1 ? 's' : ''}
                        </span>
                        {totalSections > 1 && (
                            <span className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                {totalSections} sections
                            </span>
                        )}
                        {form.deadline && (
                            <span className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Due {new Date(form.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                        )}
                    </motion.div>

                    {/* CTA button */}
                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, type: "spring" }}
                        whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(99,102,241,0.4)" }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setFormState("filling")}
                        className="inline-flex items-center gap-3 bg-white text-black px-8 sm:px-10 py-4 sm:py-5 rounded-2xl font-bold text-base sm:text-lg tracking-wide shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:bg-zinc-100 transition-colors"
                    >
                        Start Filling
                        <ArrowRight className="w-5 h-5" />
                    </motion.button>

                    {/* Security note */}
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                        className="mt-8 text-xs text-zinc-600 flex items-center justify-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" /> Your responses are secure and encrypted
                    </motion.p>
                </motion.div>
            </div>
        )
    }

    // ===== SUCCESS SCREEN (Premium) =====
    if (formState === "submitted") {
        return (
            <FullScreenCard>
                {/* Animated gradient border */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />

                {/* Confetti-style particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(12)].map((_, i) => (
                        <motion.div key={i}
                            initial={{ opacity: 0, y: 0, x: 0 }}
                            animate={{
                                opacity: [0, 1, 0],
                                y: [0, -120 - Math.random() * 80],
                                x: [(Math.random() - 0.5) * 200]
                            }}
                            transition={{ duration: 1.5, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                            className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full"
                            style={{ backgroundColor: ['#34d399', '#22d3ee', '#818cf8', '#f472b6', '#fbbf24'][i % 5] }}
                        />
                    ))}
                </div>

                {/* Success icon */}
                <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.2 }}
                    className="w-28 h-28 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-emerald-500/20 shadow-[0_0_60px_rgba(52,211,153,0.2)]">
                    <CheckCircle2 className="w-14 h-14 text-emerald-400" />
                </motion.div>

                {/* Celebration title */}
                <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="text-4xl md:text-5xl font-extrabold text-white mb-3 tracking-tight">
                    You&apos;re All Set! 🎉
                </motion.h2>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                    className="space-y-2 mb-10">
                    <p className="text-lg text-zinc-300 leading-relaxed">
                        {form.confirmation_message || (
                            <>Your response for <span className="text-white font-semibold">{form.title}</span> has been recorded successfully.</>
                        )}
                    </p>
                    <p className="text-sm text-zinc-500">
                        A confirmation email has been sent to your inbox.
                    </p>
                </motion.div>

                {/* Status card */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                    className="bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 border border-zinc-700/50 rounded-2xl p-6 mb-8 text-left backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-sm font-semibold text-emerald-400 uppercase tracking-widest">Submission Confirmed</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-zinc-500">Form</p>
                            <p className="text-white font-medium truncate">{form.title}</p>
                        </div>
                        <div>
                            <p className="text-zinc-500">Submitted</p>
                            <p className="text-white font-medium">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </div>
                </motion.div>

                {/* Referral section — only for PR candidates */}
                {form.show_referral && isPRCandidate && (
                    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                        className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/20 rounded-2xl p-6 text-left mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-indigo-400" />
                            <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-widest">PR Challenge</h3>
                        </div>
                        <p className="text-sm text-zinc-500 mb-4">You selected the PR role — show us your outreach skills! Share this link and the more people register through it, the higher you climb on the leaderboard.</p>
                        <button onClick={copyReferralLink}
                            className="w-full flex items-center justify-between bg-zinc-900/80 hover:bg-zinc-800 transition-colors p-4 rounded-xl border border-zinc-700/50 active:scale-[0.98]">
                            <span className="text-zinc-300 font-mono text-xs truncate mr-4">
                                {typeof window !== 'undefined' ? `${window.location.host}/forms/${form.id.slice(0, 8)}...` : 'Loading...'}
                            </span>
                            <span className="shrink-0 w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                            </span>
                        </button>
                    </motion.div>
                )}

                {/* Edit button */}
                {form.allow_edit && !isDeadlinePassed && (
                    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                        onClick={() => { setFormState("filling"); setCurrentSection(0) }}
                        className="text-sm text-zinc-500 hover:text-white transition-colors underline underline-offset-4">
                        Edit your submission
                    </motion.button>
                )}
            </FullScreenCard>
        )
    }

    // ===== FORM FILLING =====
    const currentFields = sections[currentSection]?.fields || []
    const currentSectionHeader = sections[currentSection]?.header

    return (
        <div className="min-h-screen py-10 sm:py-20 px-4 sm:px-6 lg:px-8 relative">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear_gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

            <div className="max-w-3xl mx-auto relative z-10">
                {/* Form title + progress */}
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }} className="mb-8 sm:mb-12">
                    <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tighter text-white mb-3 sm:mb-4">{form.title}</h1>
                    {form.description && <p className="text-base sm:text-xl text-zinc-400 leading-relaxed max-w-2xl whitespace-pre-line">{form.description}</p>}

                    {totalSections > 1 && (
                        <div className="mt-8 space-y-3">
                            <div className="flex items-center justify-between text-xs text-zinc-500">
                                <span>Section {currentSection + 1} of {totalSections}</span>
                                <span>{Math.round(((currentSection + 1) / totalSections) * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <motion.div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                    initial={{ width: 0 }} animate={{ width: `${((currentSection + 1) / totalSections) * 100}%` }}
                                    transition={{ type: "spring", stiffness: 100, damping: 20 }} />
                            </div>
                        </div>
                    )}
                </motion.div>

                <form onSubmit={handleSubmit}>
                    <AnimatePresence mode="wait">
                        <motion.div key={currentSection} variants={containerAnim} initial="hidden" animate="show"
                            exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }} className="space-y-8">
                            {currentSectionHeader && (
                                <motion.div variants={itemAnim} className="mb-8 pb-6 border-b border-zinc-800/50">
                                    <h2 className="text-2xl font-bold text-white tracking-tight mb-2">{currentSectionHeader.label}</h2>
                                    {currentSectionHeader.description && <p className="text-zinc-400 whitespace-pre-line">{currentSectionHeader.description}</p>}
                                </motion.div>
                            )}
                            {currentFields.map((field: any) => (
                                <motion.div key={field.id} variants={itemAnim} className="group">
                                    <label className="block text-sm font-medium text-zinc-300 mb-3 ml-1 whitespace-pre-line">
                                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                                    </label>
                                    {renderField(field, answers, handleChange)}
                                </motion.div>
                            ))}
                            <motion.div variants={itemAnim} className="flex gap-4 pt-8">
                                {sectionHistory.length > 0 && (
                                    <button type="button" onClick={goToPrevSection}
                                        className="flex-1 group relative flex justify-center items-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-5 rounded-2xl font-bold text-lg transition-all active:scale-[0.98]">
                                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back
                                    </button>
                                )}
                                <button type="submit" disabled={isSubmitting}
                                    className="flex-1 group relative flex justify-center items-center gap-3 bg-white hover:bg-zinc-200 text-black px-8 py-5 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-70">
                                    {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : currentSection < totalSections - 1 ? (
                                        <>Next <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                                    ) : (
                                        <>Submit Response <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                                    )}
                                </button>
                            </motion.div>
                        </motion.div>
                    </AnimatePresence>
                </form>
            </div>
        </div>
    )
}

// ============================================================
// Full-screen card wrapper
// ============================================================

function FullScreenCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none" />
            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", bounce: 0.3, duration: 0.8 }}
                className="relative z-10 max-w-xl w-full bg-zinc-900/90 backdrop-blur-2xl border border-zinc-800/50 p-10 md:p-12 rounded-[2rem] shadow-2xl text-center overflow-hidden">
                {children}
            </motion.div>
        </div>
    )
}

// ============================================================
// Group fields into sections
// ============================================================

function groupFieldsIntoSections(fields: any[]) {
    const sections: { header: any | null; fields: any[]; nextRouting?: string }[] = []
    let currentSection: { header: any | null; fields: any[]; nextRouting?: string } = { header: null, fields: [] }
    for (const field of fields) {
        if (field.type === "section") {
            currentSection.nextRouting = field.validation?.afterSection || "__next__"
            if (currentSection.fields.length > 0 || currentSection.header) sections.push(currentSection)
            currentSection = { header: field, fields: [] }
        } else { currentSection.fields.push(field) }
    }
    currentSection.nextRouting = "__submit__"
    if (currentSection.fields.length > 0 || currentSection.header) sections.push(currentSection)
    if (sections.length === 0) return [{ header: null, fields, nextRouting: "__submit__" }]
    return sections
}

// ============================================================
// Render individual field
// ============================================================

function renderField(field: any, answers: Record<string, any>, handleChange: (id: string, v: any) => void) {
    const baseInputClass = "w-full bg-zinc-900/50 border border-zinc-800 focus:border-indigo-500 rounded-2xl px-6 py-4 text-white placeholder-zinc-600 transition-all duration-300 ease-out focus:bg-zinc-900 focus:ring-4 focus:ring-indigo-500/10 outline-none hover:border-zinc-700 text-lg"

    const v = field.validation || {}
    const minLen = v.minLength; const maxLen = v.maxLength
    const minVal = v.minValue; const maxVal = v.maxValue

    const charHint = (() => {
        if (minLen && maxLen) {
            if (minLen === maxLen) return `Exactly ${minLen} characters`
            return `${minLen}–${maxLen} characters`
        }
        if (minLen) return `Min ${minLen} characters`
        if (maxLen) return `Max ${maxLen} characters`
        return null
    })()

    const valueHint = (() => {
        if (minVal != null && maxVal != null) return `Range: ${minVal}–${maxVal}`
        if (minVal != null) return `Min: ${minVal}`
        if (maxVal != null) return `Max: ${maxVal}`
        return null
    })()

    switch (field.type) {
        case "text": case "email": case "phone":
            return (
                <div>
                    <input type={field.type === "phone" ? "tel" : field.type} required={field.required}
                        value={answers[field.id] || ""}
                        onChange={(e) => {
                            if (field.type === "phone") {
                                handleChange(field.id, e.target.value.replace(/[^\d+\-\s()]/g, '').slice(0, maxLen || 15))
                            } else {
                                handleChange(field.id, maxLen ? e.target.value.slice(0, maxLen) : e.target.value)
                            }
                        }}
                        minLength={minLen} maxLength={maxLen} className={baseInputClass}
                        placeholder={field.type === "phone" ? "Enter phone number" : `Enter your ${field.label.toLowerCase()}`} />
                    {charHint && <p className="text-xs text-zinc-600 mt-2 ml-2">{charHint}{answers[field.id] ? ` · ${(answers[field.id] || '').length} entered` : ''}</p>}
                </div>
            )
        case "number": {
            const isStrictLength = minLen != null || maxLen != null;
            return (
                <div>
                    <input 
                        type={isStrictLength ? "text" : "number"} 
                        inputMode={isStrictLength ? "numeric" : undefined}
                        pattern={isStrictLength ? "\\d*" : undefined}
                        required={field.required} 
                        value={answers[field.id] || ""}
                        onChange={(e) => {
                            let val = e.target.value;
                            if (isStrictLength) {
                                val = val.replace(/[^\d]/g, ''); // strip non-digits if strictly length-based (like ID)
                            }
                            if (maxLen && val.length > maxLen) {
                                val = val.slice(0, maxLen);
                            }
                            handleChange(field.id, val);
                        }}
                        minLength={minLen}
                        maxLength={maxLen}
                        min={minVal} 
                        max={maxVal} 
                        className={baseInputClass} 
                        placeholder={`Enter ${field.label.toLowerCase()}`} 
                    />
                    {(valueHint || charHint) && (
                        <p className="text-xs text-zinc-600 mt-2 ml-2">
                            {[valueHint, charHint].filter(Boolean).join(" · ")}
                            {answers[field.id] && charHint ? ` · ${(answers[field.id] || '').length} entered` : ''}
                        </p>
                    )}
                </div>
            )
        }
        case "textarea":
            return (
                <div>
                    <textarea required={field.required} value={answers[field.id] || ""}
                        onChange={(e) => handleChange(field.id, maxLen ? e.target.value.slice(0, maxLen) : e.target.value)}
                        minLength={minLen} maxLength={maxLen} rows={4} className={`${baseInputClass} resize-none`}
                        placeholder={`Write your ${field.label.toLowerCase()} here...`} />
                    {charHint && <p className="text-xs text-zinc-600 mt-2 ml-2">{charHint}{answers[field.id] ? ` · ${(answers[field.id] || '').length} entered` : ''}</p>}
                </div>
            )
        case "url":
            return (
                <div className="relative">
                    <input type="url" required={field.required} value={answers[field.id] || ""}
                        onChange={(e) => handleChange(field.id, maxLen ? e.target.value.slice(0, maxLen) : e.target.value)}
                        maxLength={maxLen} className={`${baseInputClass} pr-12`} placeholder="Paste your link here (e.g. Google Drive link)" />
                    {answers[field.id] && (
                        <a href={answers[field.id]} target="_blank" rel="noopener noreferrer" className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-indigo-400 transition-colors">
                            <ExternalLink className="w-5 h-5" />
                        </a>
                    )}
                </div>
            )
        case "select": {
            const allowOther = v.allowOther
            const currentVal = answers[field.id] || ""
            const isOtherSelected = allowOther && currentVal.startsWith("Other:")
            return (
                <div className="space-y-3">
                    <div className="relative">
                        <select required={field.required}
                            value={isOtherSelected ? "__other__" : currentVal}
                            onChange={(e) => {
                                if (e.target.value === "__other__") {
                                    handleChange(field.id, "Other: ")
                                } else {
                                    handleChange(field.id, e.target.value)
                                }
                            }}
                            className={`${baseInputClass} appearance-none cursor-pointer`}>
                            <option value="" disabled className="text-zinc-500">Select an option...</option>
                            {field.options?.map((opt: string) => <option key={opt} value={opt} className="bg-zinc-900 text-white">{opt}</option>)}
                            {allowOther && <option value="__other__" className="bg-zinc-900 text-white italic">Other...</option>}
                        </select>
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500"><ArrowRight className="w-5 h-5 rotate-90" /></div>
                    </div>
                    {isOtherSelected && (
                        <input type="text" placeholder="Please specify..."
                            value={currentVal.replace(/^Other:\s*/, "")}
                            onChange={(e) => handleChange(field.id, `Other: ${e.target.value}`)}
                            className={baseInputClass} autoFocus />
                    )}
                </div>
            )
        }
        case "checkbox": {
            const cbAllowOther = v.allowOther
            const sel = Array.isArray(answers[field.id]) ? answers[field.id] : []
            const otherEntry = sel.find((s: string) => s.startsWith("Other:"))
            const isOtherChecked = !!otherEntry
            return (
                <div className="space-y-3 p-4 bg-zinc-900/30 rounded-2xl border border-zinc-800/50">
                    {field.options?.map((opt: string) => {
                        const isChecked = sel.includes(opt)
                        return (
                            <label key={opt} className="flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-800/50 cursor-pointer transition-colors group/check">
                                <div className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${isChecked ? 'bg-indigo-500 border-indigo-500' : 'bg-transparent border-zinc-600 group-hover/check:border-zinc-400'}`}>
                                    {isChecked && <Check className="w-4 h-4 text-white" />}
                                </div>
                                <input type="checkbox" className="hidden" checked={isChecked}
                                    onChange={(e) => handleChange(field.id, e.target.checked ? [...sel, opt] : sel.filter((v: string) => v !== opt))} />
                                <span className="text-zinc-300 select-none text-lg">{opt}</span>
                            </label>
                        )
                    })}
                    {cbAllowOther && (
                        <>
                            <label className="flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-800/50 cursor-pointer transition-colors group/check">
                                <div className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${isOtherChecked ? 'bg-indigo-500 border-indigo-500' : 'bg-transparent border-zinc-600 group-hover/check:border-zinc-400'}`}>
                                    {isOtherChecked && <Check className="w-4 h-4 text-white" />}
                                </div>
                                <input type="checkbox" className="hidden" checked={isOtherChecked}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            handleChange(field.id, [...sel, "Other: "])
                                        } else {
                                            handleChange(field.id, sel.filter((s: string) => !s.startsWith("Other:")))
                                        }
                                    }} />
                                <span className="text-zinc-300 select-none text-lg italic">Other...</span>
                            </label>
                            {isOtherChecked && (
                                <input type="text" placeholder="Please specify..."
                                    value={otherEntry?.replace(/^Other:\s*/, "") || ""}
                                    onChange={(e) => {
                                        const filtered = sel.filter((s: string) => !s.startsWith("Other:"))
                                        handleChange(field.id, [...filtered, `Other: ${e.target.value}`])
                                    }}
                                    className={`${baseInputClass} ml-10`} autoFocus />
                            )}
                        </>
                    )}
                </div>
            )
        }
        default: return null
    }
}
