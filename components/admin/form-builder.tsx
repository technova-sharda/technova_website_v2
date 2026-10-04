"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence, Reorder } from "framer-motion"
import {
    Plus, Trash2, X, Mail, Phone, FileText, Hash,
    CheckSquare, Save, Loader2, List, PlusCircle,
    AlignLeft, SeparatorHorizontal, Link2, GripVertical, ChevronUp, ChevronDown
} from "lucide-react"
import { saveFormFields } from "@/lib/actions/forms"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export type QuestionType = "text" | "textarea" | "number" | "select" | "checkbox" | "email" | "phone" | "url" | "section"

export interface RegistrationField {
    id: string
    type: QuestionType
    label: string
    description?: string
    required: boolean
    options?: string[]
    allowOther?: boolean
    minLength?: number
    maxLength?: number
    minValue?: number
    maxValue?: number
    validation?: {
        rule?: "email" | "phone" | "min_length" | "max_length" | "min_digits" | "max_digits" | "exact_digits"
        value?: number
        afterSection?: string
    }
    // Conditional branching
    goToSection?: string // section field.id to jump to based on selected answer
    optionRouting?: Record<string, string> // { "Option A": sectionId, "Option B": sectionId }
}

const FIELD_TYPES: { type: QuestionType; label: string; icon: any; color: string; bg: string }[] = [
    { type: "text", label: "Short Text", icon: FileText, color: "#60a5fa", bg: "rgba(59,130,246,0.1)" },
    { type: "textarea", label: "Long Text", icon: AlignLeft, color: "#818cf8", bg: "rgba(129,140,248,0.1)" },
    { type: "number", label: "Number", icon: Hash, color: "#34d399", bg: "rgba(52,211,153,0.1)" },
    { type: "email", label: "Email", icon: Mail, color: "#22d3ee", bg: "rgba(34,211,238,0.1)" },
    { type: "phone", label: "Phone", icon: Phone, color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
    { type: "url", label: "Link / URL", icon: Link2, color: "#fb923c", bg: "rgba(251,146,60,0.1)" },
    { type: "select", label: "Dropdown", icon: List, color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
    { type: "checkbox", label: "Checkbox", icon: CheckSquare, color: "#f472b6", bg: "rgba(244,114,182,0.1)" },
    { type: "section", label: "Section", icon: SeparatorHorizontal, color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
]

function getFieldMeta(type: QuestionType) {
    return FIELD_TYPES.find(f => f.type === type) || FIELD_TYPES[0]
}

// Types that support configurable length limits (NOT phone/url/email — they have built-in limits)
function supportsLengthLimits(type: QuestionType) {
    return ["text", "textarea", "number", "phone"].includes(type)
}

function supportsValueLimits(type: QuestionType) {
    return type === "number"
}

// Types that support conditional routing (go to section based on answer)
function supportsRouting(type: QuestionType) {
    return ["select", "checkbox"].includes(type)
}

interface FormBuilderProps {
    initialFields: RegistrationField[]
    formId: string
}

export function FormBuilderWrapper({ initialFields, formId }: FormBuilderProps) {
    const [fields, setFields] = useState<RegistrationField[]>(initialFields)
    const [isSaving, setIsSaving] = useState(false)
    const [showFab, setShowFab] = useState(false)
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
    const router = useRouter()
    const autoSaveTimer = useRef<NodeJS.Timeout | null>(null)
    const isFirstRender = useRef(true)

    // Collect section fields for routing dropdowns
    const sectionFields = fields.filter(f => f.type === "section")

    // ===== AUTO-SAVE (debounced 2s after any change) =====
    const performAutoSave = useCallback(async (currentFields: RegistrationField[]) => {
        // Don't auto-save if there are empty labels
        const hasEmptyLabels = currentFields.some(f => !f.label.trim())
        if (hasEmptyLabels || currentFields.length === 0) return

        setSaveStatus("saving")
        try {
            await saveFormFields(formId, currentFields)
            setSaveStatus("saved")
            setTimeout(() => setSaveStatus("idle"), 2000)
        } catch {
            setSaveStatus("error")
            setTimeout(() => setSaveStatus("idle"), 3000)
        }
    }, [formId])

    useEffect(() => {
        // Skip auto-save on first render (initial load)
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        // Clear previous timer
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)

        // Set new timer
        autoSaveTimer.current = setTimeout(() => {
            performAutoSave(fields)
        }, 2000)

        return () => {
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
        }
    }, [fields, performAutoSave])

    const addField = (type: QuestionType) => {
        const newField: RegistrationField = {
            id: crypto.randomUUID(),
            type,
            label: type === "section" ? "Section Title" : "",
            description: type === "section" ? "" : undefined,
            required: type === "section" ? false : true,
            options: (type === "select" || type === "checkbox") ? ["Option 1"] : undefined,
        }
        setFields(prev => [...prev, newField])
        setShowFab(false)
    }

    const updateField = (id: string, updates: Partial<RegistrationField>) => {
        setFields(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)))
    }

    const removeField = (id: string) => {
        setFields(prev => prev.filter(f => f.id !== id))
    }

    const addOption = (fieldId: string) => {
        const field = fields.find(f => f.id === fieldId)
        if (field?.options) {
            updateField(fieldId, { options: [...field.options, `Option ${field.options.length + 1}`] })
        }
    }

    const updateOption = (fieldId: string, index: number, value: string) => {
        const field = fields.find(f => f.id === fieldId)
        if (field?.options) {
            const newOptions = [...field.options]
            newOptions[index] = value
            updateField(fieldId, { options: newOptions })
        }
    }

    // ===== PASTE HANDLER: split multi-line paste into separate options =====
    const handleOptionPaste = (fieldId: string, index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedText = e.clipboardData.getData("text")
        const lines = pastedText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)

        // If pasting multi-line text, split into separate options
        if (lines.length > 1) {
            e.preventDefault()
            const field = fields.find(f => f.id === fieldId)
            if (!field?.options) return

            const newOptions = [...field.options]
            // Replace current option with first line, insert rest after
            newOptions[index] = lines[0]
            for (let i = 1; i < lines.length; i++) {
                newOptions.splice(index + i, 0, lines[i])
            }
            updateField(fieldId, { options: newOptions })
            toast.success(`Pasted ${lines.length} options`)
        }
    }

    const removeOption = (fieldId: string, index: number) => {
        const field = fields.find(f => f.id === fieldId)
        if (field?.options && field.options.length > 1) {
            updateField(fieldId, { options: field.options.filter((_, i) => i !== index) })
        }
    }

    const reorderOption = (fieldId: string, fromIndex: number, direction: 'up' | 'down') => {
        const field = fields.find(f => f.id === fieldId)
        if (!field?.options) return
        const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
        if (toIndex < 0 || toIndex >= field.options.length) return
        const newOptions = [...field.options]
        const [moved] = newOptions.splice(fromIndex, 1)
        newOptions.splice(toIndex, 0, moved)
        updateField(fieldId, { options: newOptions })
    }

    const updateOptionRouting = (fieldId: string, option: string, sectionId: string) => {
        const field = fields.find(f => f.id === fieldId)
        const routing = { ...(field?.optionRouting || {}) }
        if (sectionId === "__none__") {
            delete routing[option]
        } else {
            routing[option] = sectionId
        }
        updateField(fieldId, { optionRouting: routing })
    }

    const handleSave = async () => {
        const emptyLabels = fields.filter(f => !f.label.trim())
        if (emptyLabels.length > 0) {
            toast.error("Please fill in all question titles before saving.")
            return
        }

        setIsSaving(true)
        try {
            await saveFormFields(formId, fields)
            toast.success("Form saved successfully!")
            router.push("/admin/forms")
            router.refresh()
        } catch (error) {
            console.error("Failed to save fields", error)
            toast.error("Failed to save form fields.")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* Sticky save bar */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-between items-center sticky top-0 z-30 bg-[#0a0a0b]/80 backdrop-blur-xl py-3 -mx-2 px-2 rounded-xl"
            >
                <div className="flex items-center gap-3">
                    <p className="text-sm text-[#71717a]">
                        {fields.length} item{fields.length !== 1 ? "s" : ""} · Drag to reorder
                    </p>
                    {/* Auto-save status */}
                    <AnimatePresence mode="wait">
                        {saveStatus === "saving" && (
                            <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="flex items-center gap-1.5 text-xs text-[#fbbf24]">
                                <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                            </motion.span>
                        )}
                        {saveStatus === "saved" && (
                            <motion.span key="saved" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                className="flex items-center gap-1.5 text-xs text-emerald-400">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                Saved
                            </motion.span>
                        )}
                        {saveStatus === "error" && (
                            <motion.span key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="text-xs text-[#ef4444]">Auto-save failed</motion.span>
                        )}
                    </AnimatePresence>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 h-11 px-6 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm font-medium transition-all shadow-[0_0_20px_rgba(59,130,246,0.35)] disabled:opacity-50 active:scale-[0.97]"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save & Exit
                </button>
            </motion.div>

            {/* Empty state */}
            <AnimatePresence mode="wait">
                {fields.length === 0 && (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-[#27272a] rounded-2xl text-center"
                    >
                        <motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                            className="w-16 h-16 rounded-full bg-[#1e1e22] flex items-center justify-center mb-5"
                        >
                            <PlusCircle className="w-8 h-8 text-[#52525b]" />
                        </motion.div>
                        <h3 className="text-lg font-semibold text-[#e4e4e7] mb-2">No questions yet</h3>
                        <p className="text-[#71717a] max-w-xs text-sm">
                            Click the <strong className="text-[#3b82f6]">+</strong> button on the right to add fields.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Drag-and-drop question list */}
            <Reorder.Group axis="y" values={fields} onReorder={setFields} className="space-y-4">
                {fields.map((field, index) => (
                    <Reorder.Item key={field.id} value={field} className="list-none">
                        <FieldCard
                            field={field}
                            index={index}
                            sectionFields={sectionFields}
                            updateField={updateField}
                            removeField={removeField}
                            addOption={addOption}
                            updateOption={updateOption}
                            handleOptionPaste={handleOptionPaste}
                            removeOption={removeOption}
                            reorderOption={reorderOption}
                            updateOptionRouting={updateOptionRouting}
                        />
                    </Reorder.Item>
                ))}
            </Reorder.Group>

            {/* ====== FLOATING ACTION BUTTON (Google Forms style) ====== */}
            <div className="fixed bottom-8 right-8 z-40">
                <AnimatePresence>
                    {showFab && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="absolute bottom-16 right-0 w-56 bg-[#141416] border border-[#27272a] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden mb-2"
                        >
                            <div className="p-2 max-h-[350px] overflow-y-auto">
                                {FIELD_TYPES.map((ft) => {
                                    const Icon = ft.icon
                                    return (
                                        <button
                                            key={ft.type}
                                            type="button"
                                            onClick={() => addField(ft.type)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#1e1e22] transition-colors text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: ft.bg }}>
                                                <Icon className="w-4 h-4" style={{ color: ft.color }} />
                                            </div>
                                            <span className="text-sm font-medium text-[#e4e4e7]">{ft.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowFab(!showFab)}
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all ${
                        showFab
                            ? "bg-[#27272a] text-white rotate-45"
                            : "bg-[#3b82f6] text-white shadow-[0_0_30px_rgba(59,130,246,0.4)]"
                    }`}
                >
                    <Plus className="w-6 h-6 transition-transform" />
                </motion.button>
            </div>
        </div>
    )
}

// ============================================================
// Individual Field Card
// ============================================================

function FieldCard({
    field, index, sectionFields, updateField, removeField, addOption, updateOption, handleOptionPaste, removeOption, reorderOption, updateOptionRouting
}: {
    field: RegistrationField
    index: number
    sectionFields: RegistrationField[]
    updateField: (id: string, updates: Partial<RegistrationField>) => void
    removeField: (id: string) => void
    addOption: (id: string) => void
    updateOption: (id: string, i: number, v: string) => void
    handleOptionPaste: (id: string, i: number, e: React.ClipboardEvent<HTMLInputElement>) => void
    removeOption: (id: string, i: number) => void
    reorderOption: (id: string, i: number, dir: 'up' | 'down') => void
    updateOptionRouting: (id: string, option: string, sectionId: string) => void
}) {
    const meta = getFieldMeta(field.type)
    const Icon = meta.icon

    // ===== Section Divider =====
    if (field.type === "section") {
        return (
            <div className="relative bg-[#0f0f11] border border-dashed border-[#3f3f46] rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing">
                <div className="h-0.5 bg-gradient-to-r from-[#94a3b8]/50 via-[#64748b]/30 to-transparent" />
                
                {/* After Previous Section Action */}
                <div className="flex items-center gap-3 px-6 py-4 bg-[#141416] border-b border-dashed border-[#3f3f46]">
                    <span className="text-sm font-medium text-[#a1a1aa]">After section:</span>
                    <select
                        value={field.validation?.afterSection || "__next__"}
                        onChange={(e) => {
                            const newValidation = { ...(field.validation || {}), afterSection: e.target.value }
                            updateField(field.id, { validation: newValidation })
                        }}
                        className="h-9 px-3 rounded-lg bg-[#1e1e22] border border-[#27272a] text-white text-sm focus:border-[#64748b] outline-none w-72"
                    >
                        <option value="__next__">Continue to next section</option>
                        {sectionFields.filter(s => s.id !== field.id).map(s => (
                            <option key={s.id} value={s.id}>Go to section: {s.label || "Untitled Section"}</option>
                        ))}
                        <option value="__submit__">Submit form</option>
                    </select>
                </div>

                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <GripVertical className="w-5 h-5 text-[#3f3f46] cursor-grab" />
                            <div className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold bg-[#94a3b8]/10 text-[#94a3b8]">
                                <SeparatorHorizontal className="w-3.5 h-3.5" />
                                Section Divider
                            </div>
                        </div>
                        <button type="button" onClick={() => removeField(field.id)} className="p-2 rounded-lg text-[#52525b] hover:text-[#ef4444] hover:bg-[#dc2626]/10 transition-all">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    <input type="text" value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} placeholder="Section title..."
                        className="w-full p-3 rounded-xl bg-[#0a0a0b] border border-[#27272a] text-white text-lg font-semibold placeholder:text-[#3f3f46] focus:border-[#64748b] focus:ring-1 focus:ring-[#64748b]/30 outline-none transition-all mb-3" />
                    <input type="text" value={field.description || ""} onChange={(e) => updateField(field.id, { description: e.target.value })} placeholder="Section description (optional)..."
                        className="w-full p-3 rounded-xl bg-[#0a0a0b] border border-[#1e1e22] text-[#a1a1aa] text-sm placeholder:text-[#3f3f46] focus:border-[#64748b] outline-none transition-all" />
                </div>
            </div>
        )
    }

    // ===== Regular Field =====
    return (
        <div className="bg-[#141416] border border-[#27272a] rounded-2xl overflow-hidden hover:border-[#3f3f46] transition-colors cursor-grab active:cursor-grabbing">
            <div className="h-0.5" style={{ backgroundColor: meta.color }} />
            <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <GripVertical className="w-5 h-5 text-[#3f3f46] cursor-grab" />
                        <span className="w-7 h-7 rounded-lg bg-[#1e1e22] text-[#a1a1aa] flex items-center justify-center text-xs font-bold">{index + 1}</span>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize" style={{ backgroundColor: meta.bg, color: meta.color }}>
                            <Icon className="w-3.5 h-3.5" />
                            {meta.label}
                        </div>
                    </div>
                    <button type="button" onClick={() => removeField(field.id)} className="p-2 rounded-lg text-[#52525b] hover:text-[#ef4444] hover:bg-[#dc2626]/10 transition-all">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>

                {/* Question input */}
                <textarea value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} placeholder="Enter your question here..."
                    rows={1}
                    onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
                    className="w-full p-4 rounded-xl bg-[#0a0a0b] border border-[#27272a] text-white text-base placeholder:text-[#3f3f46] focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/30 outline-none transition-all mb-4 resize-none overflow-hidden" />

                {/* Required toggle */}
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Required</span>
                    <button type="button" onClick={() => updateField(field.id, { required: !field.required })}
                        className={`relative w-11 h-6 rounded-full transition-colors ${field.required ? "bg-[#3b82f6]" : "bg-[#27272a]"}`}>
                        <motion.div layout className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                            style={{ left: field.required ? "calc(100% - 20px)" : "4px" }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                    </button>
                    <span className="text-xs text-[#52525b]">{field.required ? "Required" : "Optional"}</span>
                </div>

                {/* Length limits toggle (only text/textarea) */}
                {supportsLengthLimits(field.type) && (
                    <CollapsibleLimits
                        label="Character Limits"
                        isEnabled={field.minLength != null || field.maxLength != null}
                        onToggle={(enabled) => {
                            if (!enabled) updateField(field.id, { minLength: undefined, maxLength: undefined })
                        }}
                    >
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-[#52525b] uppercase block mb-1">Min</label>
                                <input type="number" min={0} value={field.minLength ?? ""} onChange={(e) => updateField(field.id, { minLength: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="—"
                                    className="w-full h-9 px-3 rounded-lg bg-[#141416] border border-[#27272a] text-white text-sm placeholder:text-[#3f3f46] focus:border-[#3b82f6] outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] text-[#52525b] uppercase block mb-1">Max</label>
                                <input type="number" min={0} value={field.maxLength ?? ""} onChange={(e) => updateField(field.id, { maxLength: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="—"
                                    className="w-full h-9 px-3 rounded-lg bg-[#141416] border border-[#27272a] text-white text-sm placeholder:text-[#3f3f46] focus:border-[#3b82f6] outline-none" />
                            </div>
                        </div>
                    </CollapsibleLimits>
                )}

                {/* Value limits toggle (number fields) */}
                {supportsValueLimits(field.type) && (
                    <CollapsibleLimits
                        label="Value Range"
                        isEnabled={field.minValue != null || field.maxValue != null}
                        onToggle={(enabled) => {
                            if (!enabled) updateField(field.id, { minValue: undefined, maxValue: undefined })
                        }}
                    >
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-[#52525b] uppercase block mb-1">Min</label>
                                <input type="number" value={field.minValue ?? ""} onChange={(e) => updateField(field.id, { minValue: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="—"
                                    className="w-full h-9 px-3 rounded-lg bg-[#141416] border border-[#27272a] text-white text-sm placeholder:text-[#3f3f46] focus:border-[#3b82f6] outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] text-[#52525b] uppercase block mb-1">Max</label>
                                <input type="number" value={field.maxValue ?? ""} onChange={(e) => updateField(field.id, { maxValue: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="—"
                                    className="w-full h-9 px-3 rounded-lg bg-[#141416] border border-[#27272a] text-white text-sm placeholder:text-[#3f3f46] focus:border-[#3b82f6] outline-none" />
                            </div>
                        </div>
                    </CollapsibleLimits>
                )}

                {/* Dropdown / Checkbox options with routing */}
                {(field.type === "select" || field.type === "checkbox") && (
                    <div className="bg-[#0f0f11] rounded-xl border border-[#1e1e22] p-4 space-y-3">
                        <label className="text-xs font-bold text-[#71717a] uppercase tracking-widest block">
                            {field.type === "select" ? "Dropdown" : "Checkbox"} Options
                        </label>
                        {field.options?.map((option, idx) => (
                            <div key={idx} className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col shrink-0">
                                        <button type="button" onClick={() => reorderOption(field.id, idx, 'up')} disabled={idx === 0}
                                            className="w-5 h-4 flex items-center justify-center text-[#52525b] hover:text-white transition-all disabled:opacity-20" title="Move up">
                                            <ChevronUp className="w-3.5 h-3.5" />
                                        </button>
                                        <button type="button" onClick={() => reorderOption(field.id, idx, 'down')} disabled={idx === (field.options?.length || 1) - 1}
                                            className="w-5 h-4 flex items-center justify-center text-[#52525b] hover:text-white transition-all disabled:opacity-20" title="Move down">
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <span className="w-7 h-7 rounded bg-[#1e1e22] text-[#52525b] flex items-center justify-center text-xs font-mono shrink-0">{idx + 1}</span>
                                    <input type="text" value={option} onChange={(e) => updateOption(field.id, idx, e.target.value)}
                                        onPaste={(e) => handleOptionPaste(field.id, idx, e)}
                                        placeholder={`Option ${idx + 1}`}
                                        className="flex-1 h-9 px-3 rounded-lg bg-[#141416] border border-[#27272a] text-white text-sm placeholder:text-[#3f3f46] focus:border-[#a78bfa] outline-none transition-all" />
                                    {/* Routing: Go to section */}
                                    {sectionFields.length > 0 && field.type === "select" && (
                                        <select
                                            value={field.optionRouting?.[option] || "__none__"}
                                            onChange={(e) => updateOptionRouting(field.id, option, e.target.value)}
                                            className="h-9 px-2 rounded-lg bg-[#141416] border border-[#27272a] text-[#a1a1aa] text-xs focus:border-[#a78bfa] outline-none max-w-[140px] truncate"
                                            title="Go to section"
                                        >
                                            <option value="__none__">Continue</option>
                                            {sectionFields.map(s => (
                                                <option key={s.id} value={s.id}>{s.label || "Untitled Section"}</option>
                                            ))}
                                            <option value="__submit__">Submit form</option>
                                        </select>
                                    )}
                                    <button type="button" onClick={() => removeOption(field.id, idx)} disabled={field.options!.length <= 1}
                                        className="w-7 h-7 flex items-center justify-center rounded text-[#52525b] hover:text-[#ef4444] hover:bg-[#dc2626]/10 transition-all disabled:opacity-20 shrink-0">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <div className="flex items-center gap-3 mt-2">
                            <button type="button" onClick={() => addOption(field.id)}
                                className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#1e1e22] hover:bg-[#27272a] text-[#a78bfa] text-xs font-semibold transition-all">
                                <Plus className="w-3.5 h-3.5" /> Add Option
                            </button>
                            {!field.allowOther && (
                                <button type="button" onClick={() => updateField(field.id, { allowOther: true })}
                                    className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#1e1e22] hover:bg-[#27272a] text-[#71717a] text-xs font-semibold transition-all hover:text-white">
                                    <Plus className="w-3.5 h-3.5" /> Add &quot;Other&quot;
                                </button>
                            )}
                        </div>
                        {field.allowOther && (
                            <div className="flex items-center gap-2 mt-2 opacity-70">
                                <span className="w-7 h-7 rounded bg-[#1e1e22] text-[#52525b] flex items-center justify-center text-xs">⊕</span>
                                <span className="flex-1 h-9 px-3 rounded-lg bg-[#0a0a0b] border border-dashed border-[#3f3f46] text-[#71717a] text-sm flex items-center">Other...</span>
                                <button type="button" onClick={() => updateField(field.id, { allowOther: false })}
                                    className="w-7 h-7 flex items-center justify-center rounded text-[#52525b] hover:text-[#ef4444] hover:bg-[#dc2626]/10 transition-all shrink-0">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                        {sectionFields.length > 0 && field.type === "select" && (
                            <p className="text-[10px] text-[#52525b] mt-2">
                                Tip: set &quot;Go to section&quot; for each option to create conditional branching.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================
// Collapsible Limits Toggle
// ============================================================

function CollapsibleLimits({ label, isEnabled, onToggle, children }: {
    label: string
    isEnabled: boolean
    onToggle: (enabled: boolean) => void
    children: React.ReactNode
}) {
    const [open, setOpen] = useState(isEnabled)

    const handleToggle = () => {
        const next = !open
        setOpen(next)
        if (!next) onToggle(false)
    }

    return (
        <div className="mb-4">
            <button type="button" onClick={handleToggle}
                className="flex items-center gap-3 w-full text-left px-1 py-1.5 group">
                <div className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${open ? "bg-[#3b82f6]" : "bg-[#27272a]"}`}>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all"
                        style={{ left: open ? "calc(100% - 18px)" : "2px" }} />
                </div>
                <span className="text-xs font-bold text-[#71717a] uppercase tracking-widest group-hover:text-[#a1a1aa] transition-colors">{label}</span>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-[#0f0f11] rounded-xl border border-[#1e1e22] p-4 mt-2">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

/* ============================================================
   Backward-compatible FormBuilder for event-form.tsx
   ============================================================ */

interface LegacyFormBuilderProps {
    fields: RegistrationField[]
    onChange: (fields: RegistrationField[]) => void
}

export function FormBuilder({ fields, onChange }: LegacyFormBuilderProps) {
    const addField = (type: QuestionType) => {
        onChange([...fields, { id: crypto.randomUUID(), type, label: "", required: true, options: (type === "select" || type === "checkbox") ? ["Option 1"] : undefined }])
    }
    const updateField = (id: string, updates: Partial<RegistrationField>) => onChange(fields.map(f => f.id === id ? { ...f, ...updates } : f))
    const removeField = (id: string) => onChange(fields.filter(f => f.id !== id))
    const addOption = (fId: string) => { const f = fields.find(x => x.id === fId); if (f?.options) updateField(fId, { options: [...f.options, `Option ${f.options.length + 1}`] }) }
    const updateOption = (fId: string, i: number, v: string) => { const f = fields.find(x => x.id === fId); if (f?.options) { const o = [...f.options]; o[i] = v; updateField(fId, { options: o }) } }
    const removeOption = (fId: string, i: number) => { const f = fields.find(x => x.id === fId); if (f?.options && f.options.length > 1) updateField(fId, { options: f.options.filter((_, j) => j !== i) }) }
    const handleOptionPaste = (fId: string, index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
        const options = event.clipboardData.getData("text").split(/\r?\n/).map(option => option.trim()).filter(Boolean)
        if (options.length < 2) return

        event.preventDefault()
        const field = fields.find(item => item.id === fId)
        if (!field?.options) return
        const updatedOptions = [...field.options]
        updatedOptions.splice(index, 1, ...options)
        updateField(fId, { options: updatedOptions })
    }
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {FIELD_TYPES.filter(ft => ft.type !== "section").map((ft) => {
                    const Icon = ft.icon
                    return (
                        <button key={ft.type} type="button" onClick={() => addField(ft.type)}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#141416] border border-[#1e1e22] hover:border-[#3f3f46] transition-colors">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: ft.bg }}><Icon className="w-4 h-4" style={{ color: ft.color }} /></div>
                            <span className="text-xs font-medium text-[#a1a1aa]">{ft.label}</span>
                        </button>
                    )
                })}
            </div>
            {fields.length === 0 && <div className="text-center p-8 border-2 border-dashed border-[#27272a] rounded-2xl text-[#52525b]">No custom questions yet.</div>}
            <div className="space-y-3">
                {fields.map((field, index) => {
                    const meta = getFieldMeta(field.type); const Icon = meta.icon
                    return (
                        <div key={field.id} className="bg-[#141416] border border-[#27272a] rounded-xl p-5 relative group hover:border-[#3f3f46] transition-colors">
                            <button type="button" onClick={() => removeField(field.id)} className="absolute top-3 right-3 p-2 rounded-lg text-[#52525b] hover:text-[#ef4444] hover:bg-[#dc2626]/10 transition-all"><Trash2 className="w-4 h-4" /></button>
                            <div className="pr-10 space-y-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="w-6 h-6 rounded bg-[#1e1e22] text-[#a1a1aa] flex items-center justify-center text-xs font-bold">{index + 1}</span>
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold capitalize" style={{ backgroundColor: meta.bg, color: meta.color }}><Icon className="w-3 h-3" />{meta.label}</div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#a1a1aa]">Question</label>
                                    <input type="text" value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} placeholder="For example: Which department are you from?" className="w-full p-3 rounded-lg bg-[#0a0a0b] border border-[#27272a] text-white placeholder:text-[#71717a] focus:border-[#3b82f6] outline-none transition-all text-sm" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#a1a1aa]">Help text <span className="normal-case font-normal text-[#71717a]">(optional)</span></label>
                                    <input type="text" value={field.description || ""} onChange={e => updateField(field.id, { description: e.target.value })} placeholder="Explain what the participant should enter" className="w-full p-3 rounded-lg bg-[#0a0a0b] border border-[#27272a] text-white placeholder:text-[#71717a] focus:border-[#3b82f6] outline-none transition-all text-sm" />
                                </div>

                                {(field.type === "select" || field.type === "checkbox") && (
                                    <div className="rounded-xl border border-[#27272a] bg-[#0f0f11] p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-white">Choices participants can select</p>
                                                <p className="text-xs text-[#a1a1aa] mt-1">Add each option separately, or paste a line-separated list.</p>
                                            </div>
                                            <button type="button" onClick={() => addOption(field.id)} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-2.5 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/25 transition-colors">
                                                <Plus className="w-3.5 h-3.5" /> Add option
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {(field.options || []).map((option, optionIndex) => (
                                                <div key={`${field.id}-${optionIndex}`} className="flex items-center gap-2">
                                                    <span className="w-6 text-center text-xs font-bold text-[#71717a]">{optionIndex + 1}</span>
                                                    <input type="text" value={option} onPaste={(event) => handleOptionPaste(field.id, optionIndex, event)} onChange={event => updateOption(field.id, optionIndex, event.target.value)} placeholder={`Option ${optionIndex + 1}`} className="min-w-0 flex-1 p-2.5 rounded-lg bg-[#0a0a0b] border border-[#27272a] text-white placeholder:text-[#71717a] focus:border-[#3b82f6] outline-none transition-all text-sm" />
                                                    <button type="button" onClick={() => removeOption(field.id, optionIndex)} disabled={(field.options || []).length <= 1} aria-label={`Remove option ${optionIndex + 1}`} className="p-2 text-[#71717a] hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                        </div>
                                        {field.type === "select" && (
                                            <label className="flex items-center gap-2 text-xs text-[#d4d4d8] cursor-pointer">
                                                <input type="checkbox" checked={Boolean(field.allowOther)} onChange={event => updateField(field.id, { allowOther: event.target.checked })} className="h-4 w-4 rounded border-[#52525b] accent-blue-500" />
                                                Let participants enter an option that is not listed
                                            </label>
                                        )}
                                    </div>
                                )}
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-semibold text-[#71717a] uppercase">Required</span>
                                    <button type="button" onClick={() => updateField(field.id, { required: !field.required })} className={`relative w-10 h-5 rounded-full transition-colors ${field.required ? "bg-[#3b82f6]" : "bg-[#27272a]"}`}>
                                        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all" style={{ left: field.required ? "calc(100% - 18px)" : "2px" }} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
