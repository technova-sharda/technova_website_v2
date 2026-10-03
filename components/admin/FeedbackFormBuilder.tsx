'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { ArrowLeft, Plus, Trash2, Star, ChevronDown, AlertCircle, Loader2 } from 'lucide-react'
import type { FeedbackQuestion, FeedbackFormWithMeta } from '@/lib/actions/feedback'

interface Props {
    isMultiDay: boolean
    existingForms: FeedbackFormWithMeta[]
    editingForm: FeedbackFormWithMeta | null
    onSave: (data: {
        title: string
        dayNumber: number | null
        releaseMode: 'automatic' | 'manual'
        autoCloseDays: number | null
        questions: FeedbackQuestion[]
    }) => void
    onCancel: () => void
}

const QUESTION_TYPES = [
    { value: 'text', label: 'Short Text', placeholder: 'Single line text input' },
    { value: 'textarea', label: 'Long Text', placeholder: 'Multi-line text area' },
    { value: 'rating', label: 'Rating (1-5 Stars)', placeholder: 'Star rating' },
    { value: 'select', label: 'Dropdown', placeholder: 'Single selection dropdown' },
    { value: 'radio', label: 'Multiple Choice', placeholder: 'Single selection from options' },
    { value: 'checkbox', label: 'Checkboxes', placeholder: 'Multiple selections allowed' },
] as const

const EASE_OUT = [0.23, 1, 0.32, 1] as const

const fieldClass = "w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition-colors"
const labelClass = "block text-xs font-medium text-gray-400 mb-1.5"

export function FeedbackFormBuilder({ isMultiDay, existingForms, editingForm, onSave, onCancel }: Props) {
    const [title, setTitle] = useState(editingForm?.title || 'Event Feedback')
    const [dayNumber, setDayNumber] = useState<number | null>(editingForm?.day_number ?? null)
    const [releaseMode, setReleaseMode] = useState<'automatic' | 'manual'>(editingForm?.release_mode || 'automatic')
    const [autoCloseDays, setAutoCloseDays] = useState<number | null>(editingForm?.auto_close_after_days ?? null)
    const [questions, setQuestions] = useState<FeedbackQuestion[]>(
        editingForm?.questions?.map((q: any, i: number) => ({
            id: q.id,
            question_type: q.question_type,
            label: q.label,
            placeholder: q.placeholder || '',
            options: q.options || [],
            is_required: q.is_required ?? true,
            order_index: i
        })) || [
            { question_type: 'rating', label: 'How would you rate this event overall?', is_required: true, order_index: 0 },
            { question_type: 'textarea', label: 'What did you like most about this event?', is_required: true, order_index: 1 },
            { question_type: 'textarea', label: 'How can we improve future events?', is_required: false, order_index: 2 }
        ]
    )
    // Stable per-question keys (kept in step with `questions`) so add/remove/reorder animate correctly
    const nextKey = useRef(0)
    const [keys, setKeys] = useState<number[]>(() => questions.map(() => nextKey.current++))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Day numbers already used by other forms
    const usedDays = existingForms.filter(f => f.id !== editingForm?.id).map(f => f.day_number)

    function addQuestion() {
        setQuestions([
            ...questions,
            {
                question_type: 'text',
                label: '',
                is_required: true,
                order_index: questions.length
            }
        ])
        setKeys([...keys, nextKey.current++])
    }

    function removeQuestion(index: number) {
        setQuestions(questions.filter((_, i) => i !== index))
        setKeys(keys.filter((_, i) => i !== index))
    }

    function updateQuestion(index: number, field: keyof FeedbackQuestion, value: any) {
        setQuestions(questions.map((q, i) => i === index ? { ...q, [field]: value } : q))
    }

    function addOption(questionIndex: number) {
        const q = questions[questionIndex]
        const options = q.options || []
        updateQuestion(questionIndex, 'options', [
            ...options,
            { value: `option_${options.length + 1}`, label: '' }
        ])
    }

    function updateOption(questionIndex: number, optionIndex: number, label: string) {
        const q = questions[questionIndex]
        const options = [...(q.options || [])]
        options[optionIndex] = { ...options[optionIndex], label, value: label.toLowerCase().replace(/\s+/g, '_') }
        updateQuestion(questionIndex, 'options', options)
    }

    function removeOption(questionIndex: number, optionIndex: number) {
        const q = questions[questionIndex]
        updateQuestion(questionIndex, 'options', (q.options || []).filter((_, i) => i !== optionIndex))
    }

    function moveQuestion(index: number, direction: 'up' | 'down') {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === questions.length - 1)) return
        const swapIndex = direction === 'up' ? index - 1 : index + 1
        const swap = <T,>(list: T[]) => {
            const next = [...list]
            ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
            return next
        }
        setQuestions(swap(questions).map((q, i) => ({ ...q, order_index: i })))
        setKeys(swap(keys))
    }

    function validate(): string | null {
        if (!title.trim()) return 'Please enter a form title'
        if (questions.length === 0) return 'Please add at least one question'
        if (questions.some(q => !q.label.trim())) return 'Please fill in all question labels'

        for (const q of questions) {
            if (['select', 'radio', 'checkbox'].includes(q.question_type)) {
                if (!q.options || q.options.length < 2) return `Question "${q.label}" needs at least 2 options`
                if (q.options.some(o => !o.label.trim())) return `Please fill in all options for "${q.label}"`
            }
        }
        return null
    }

    async function handleSubmit() {
        const problem = validate()
        setError(problem)
        if (problem) return

        setSaving(true)
        try {
            await onSave({
                title,
                dayNumber,
                releaseMode,
                autoCloseDays,
                questions: questions.map((q, i) => ({ ...q, order_index: i }))
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <MotionConfig reducedMotion="user">
            <motion.div
                className="space-y-6 text-white"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
            >
                {/* Header */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onCancel}
                        className="p-2 rounded-lg bg-zinc-900 border border-white/10 text-gray-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        aria-label="Back"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-lg font-semibold">
                        {editingForm ? 'Edit Feedback Form' : 'Create Feedback Form'}
                    </h3>
                </div>

                {/* Form Settings */}
                <div className="bg-black/30 border border-white/10 p-5 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Form Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className={fieldClass}
                                placeholder="Event Feedback"
                            />
                        </div>

                        {isMultiDay && (
                            <div>
                                <label className={labelClass}>Day (for multi-day events)</label>
                                <Select
                                    value={dayNumber ?? ''}
                                    onChange={(v) => setDayNumber(v ? parseInt(v) : null)}
                                >
                                    <option value="">General (all days)</option>
                                    {[1, 2, 3, 4, 5].map(d => (
                                        <option key={d} value={d} disabled={usedDays.includes(d)}>
                                            Day {d} {usedDays.includes(d) ? '(exists)' : ''}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}

                        <div>
                            <label className={labelClass}>Release Mode</label>
                            <Select value={releaseMode} onChange={(v) => setReleaseMode(v as 'automatic' | 'manual')}>
                                <option value="automatic">Automatic (when event ends)</option>
                                <option value="manual">Manual (you release it)</option>
                            </Select>
                        </div>

                        <div>
                            <label className={labelClass}>Auto-Close After</label>
                            <Select
                                value={autoCloseDays ?? ''}
                                onChange={(v) => setAutoCloseDays(v ? parseInt(v) : null)}
                            >
                                <option value="">Never (manually close)</option>
                                <option value="3">3 days after release</option>
                                <option value="7">7 days after release</option>
                                <option value="14">14 days after release</option>
                                <option value="30">30 days after release</option>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Questions */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium">
                            Questions <span className="text-gray-500 font-normal">({questions.length})</span>
                        </h4>
                        <button
                            onClick={addQuestion}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Question
                        </button>
                    </div>

                    <AnimatePresence initial={false}>
                        {questions.map((question, index) => (
                            <motion.div
                                key={keys[index]}
                                layout
                                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                                transition={{ duration: 0.25, ease: EASE_OUT, layout: { duration: 0.3, ease: EASE_OUT } }}
                                className="bg-zinc-900 border border-white/10 hover:border-white/20 rounded-xl p-4 transition-colors"
                            >
                                <div className="flex items-start gap-3">
                                    {/* Number + reorder */}
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="w-7 h-7 rounded-lg bg-violet-500/15 text-violet-300 text-xs font-semibold flex items-center justify-center">
                                            {index + 1}
                                        </span>
                                        <button
                                            onClick={() => moveQuestion(index, 'up')}
                                            disabled={index === 0}
                                            className="p-1 text-gray-500 hover:text-white hover:bg-white/5 rounded disabled:opacity-20 disabled:hover:bg-transparent"
                                            aria-label="Move up"
                                        >
                                            <ChevronDown className="w-4 h-4 rotate-180" />
                                        </button>
                                        <button
                                            onClick={() => moveQuestion(index, 'down')}
                                            disabled={index === questions.length - 1}
                                            className="p-1 text-gray-500 hover:text-white hover:bg-white/5 rounded disabled:opacity-20 disabled:hover:bg-transparent"
                                            aria-label="Move down"
                                        >
                                            <ChevronDown className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex-1 min-w-0 space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div>
                                                <label className={labelClass}>Type</label>
                                                <Select
                                                    value={question.question_type}
                                                    onChange={(v) => updateQuestion(index, 'question_type', v)}
                                                >
                                                    {QUESTION_TYPES.map(t => (
                                                        <option key={t.value} value={t.value}>{t.label}</option>
                                                    ))}
                                                </Select>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className={labelClass}>Question</label>
                                                <input
                                                    type="text"
                                                    value={question.label}
                                                    onChange={(e) => updateQuestion(index, 'label', e.target.value)}
                                                    className={fieldClass}
                                                    placeholder="Enter question..."
                                                />
                                            </div>
                                        </div>

                                        {/* Options for select/radio/checkbox */}
                                        {['select', 'radio', 'checkbox'].includes(question.question_type) && (
                                            <div className="pl-4 border-l-2 border-violet-500/30 space-y-2">
                                                <p className="text-xs text-gray-400 font-medium">Options</p>
                                                {(question.options || []).map((opt, optIndex) => (
                                                    <div key={optIndex} className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={opt.label}
                                                            onChange={(e) => updateOption(index, optIndex, e.target.value)}
                                                            className={`${fieldClass} py-1.5`}
                                                            placeholder={`Option ${optIndex + 1}`}
                                                        />
                                                        <button
                                                            onClick={() => removeOption(index, optIndex)}
                                                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md"
                                                            aria-label="Remove option"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => addOption(index)}
                                                    className="text-xs text-violet-300 hover:text-violet-200"
                                                >
                                                    + Add option
                                                </button>
                                            </div>
                                        )}

                                        {question.question_type === 'rating' && (
                                            <div className="flex items-center gap-1 text-yellow-400">
                                                {[1, 2, 3, 4, 5].map(n => (
                                                    <Star key={n} className="w-5 h-5 fill-current" />
                                                ))}
                                                <span className="text-xs text-gray-500 ml-2">1-5 star rating</span>
                                            </div>
                                        )}

                                        {/* Required toggle */}
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={question.is_required}
                                            onClick={() => updateQuestion(index, 'is_required', !question.is_required)}
                                            className="flex items-center gap-2 text-sm text-gray-300"
                                        >
                                            <span className={`relative w-8 h-[18px] rounded-full transition-colors ${question.is_required ? 'bg-violet-600' : 'bg-white/10'}`}>
                                                <motion.span
                                                    className="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white"
                                                    animate={{ x: question.is_required ? 14 : 0 }}
                                                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                                                />
                                            </span>
                                            Required
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => removeQuestion(index)}
                                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        aria-label="Delete question"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {questions.length === 0 && (
                        <div className="text-center py-10 rounded-xl border-2 border-dashed border-white/10">
                            <p className="text-gray-500 mb-2">No questions yet</p>
                            <button onClick={addQuestion} className="text-violet-300 hover:text-violet-200">
                                Add your first question
                            </button>
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300"
                        >
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 font-medium transition-colors"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? 'Saving...' : editingForm ? 'Save Changes' : 'Create Form'}
                    </button>
                    <button
                        onClick={onCancel}
                        className="px-6 py-2 text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </motion.div>
        </MotionConfig>
    )
}

/** Native select styled for the dark admin; option lists render dark too. */
function Select({ value, onChange, children }: { value: string | number, onChange: (value: string) => void, children: React.ReactNode }) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`${fieldClass} appearance-none pr-9 cursor-pointer [&>option]:bg-zinc-900 [&>option]:text-white`}
                style={{ colorScheme: 'dark' }}
            >
                {children}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
    )
}
