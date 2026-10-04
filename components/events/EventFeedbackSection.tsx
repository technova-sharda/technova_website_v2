'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, CheckCircle, Clock, Star, Loader2, Gift } from 'lucide-react'
import { Toast, useToast } from '@/components/ui/toast'
import { FEEDBACK_XP_REWARD } from '@/lib/constants/feedback'
import {
    checkFeedbackAvailability,
    getMyFeedbackSubmission,
    submitFeedback
} from '@/lib/actions/feedback'

interface Props {
    eventId: string
    userId?: string
    isRegistered: boolean
    eventEnded: boolean
}

interface FeedbackFormUI {
    id: string
    title: string
    day_number: number | null
    isAvailable: boolean
    isClosed: boolean
}

export function EventFeedbackSection({ eventId, userId, isRegistered, eventEnded }: Props) {
    const [status, setStatus] = useState<'loading' | 'disabled' | 'not_released' | 'open' | 'closed' | 'submitted'>('loading')
    const [forms, setForms] = useState<FeedbackFormUI[]>([])
    const [selectedFormId, setSelectedFormId] = useState<string | null>(null)
    const [questions, setQuestions] = useState<any[]>([])
    const [answers, setAnswers] = useState<Record<string, any>>({})
    const [submitting, setSubmitting] = useState(false)
    const [alreadySubmitted, setAlreadySubmitted] = useState<Record<string, boolean>>({})
    const { toast, showToast, hideToast } = useToast()

    useEffect(() => {
        loadFeedbackStatus()
    }, [eventId])

    async function loadFeedbackStatus() {
        try {
            const result = await checkFeedbackAvailability(eventId)

            if (!result.available && result.status === 'disabled') {
                setStatus('disabled')
                return
            }

            if (!result.available && result.status === 'no_forms') {
                setStatus('disabled')
                return
            }

            const formsData = result.forms || []
            setForms(formsData)

            // Check submission status for each form
            // Declare submittedMap outside so it's in scope for status checks
            let submittedMap: Record<string, boolean> = {}
            if (userId) {
                for (const form of formsData) {
                    const submission = await getMyFeedbackSubmission(form.id)
                    submittedMap[form.id] = !!submission
                }
                setAlreadySubmitted(submittedMap)
            }

            // Determine overall status - IMPORTANT: use submittedMap (local variable) not alreadySubmitted (stale state)
            const hasAvailable = formsData.some((f: FeedbackFormUI) => f.isAvailable)
            const allSubmitted = userId && formsData.length > 0 && formsData.every((f: FeedbackFormUI) => submittedMap[f.id])

            if (allSubmitted) {
                setStatus('submitted')
            } else if (hasAvailable) {
                setStatus('open')
                // Auto-select first available form that hasn't been submitted
                const firstAvailable = formsData.find((f: FeedbackFormUI) => f.isAvailable && !submittedMap[f.id])
                if (firstAvailable) {
                    loadFormQuestions(firstAvailable.id)
                } else {
                    // All available forms already submitted
                    setStatus('submitted')
                }
            } else if (result.status === 'not_released') {
                setStatus('not_released')
            } else {
                setStatus('closed')
            }
        } catch (error) {
            console.error('Failed to load feedback status:', error)
            setStatus('disabled')
        }
    }

    async function loadFormQuestions(formId: string) {
        setSelectedFormId(formId)
        // Fetch questions for the form
        try {
            const response = await fetch(`/api/feedback/questions?formId=${formId}`)
            const data = await response.json()
            setQuestions(data.questions || [])
            setAnswers({})
        } catch (error) {
            console.error('Failed to load questions:', error)
        }
    }

    function updateAnswer(questionId: string, value: any) {
        setAnswers(prev => ({ ...prev, [questionId]: value }))
    }

    function toggleCheckboxAnswer(questionId: string, optionValue: string) {
        setAnswers(prev => {
            const current = prev[questionId] || []
            const isChecked = current.includes(optionValue)
            return {
                ...prev,
                [questionId]: isChecked
                    ? current.filter((v: string) => v !== optionValue)
                    : [...current, optionValue]
            }
        })
    }

    async function handleSubmit() {
        if (!selectedFormId) return
        if (!userId) {
            showToast('Please log in to submit feedback', 'error')
            return
        }
        if (!isRegistered) {
            showToast('You must be registered for this event to submit feedback', 'error')
            return
        }

        // Validate required answers
        const requiredQuestions = questions.filter(q => q.is_required)
        for (const q of requiredQuestions) {
            const answer = answers[q.id]
            if (answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
                showToast(`Please answer: ${q.label}`, 'error')
                return
            }
        }

        setSubmitting(true)
        try {
            const result = await submitFeedback(selectedFormId, answers)

            // Check if submission was successful
            if (!result.success) {
                showToast(result.error || 'Failed to submit feedback', 'error')
                return
            }

            if (result.xpAwarded && result.xpAwarded > 0) {
                showToast(`Thank you! You earned +${result.xpAwarded} XP`, 'success')
            } else {
                showToast(result.message || 'Thank you for your feedback!', 'success')
            }

            setAlreadySubmitted(prev => ({ ...prev, [selectedFormId]: true }))

            // Check if all forms submitted
            const allSubmitted = forms.every(f => f.id === selectedFormId || alreadySubmitted[f.id])
            if (allSubmitted) {
                setStatus('submitted')
            } else {
                // Load next available form
                const nextForm = forms.find(f => f.isAvailable && f.id !== selectedFormId && !alreadySubmitted[f.id])
                if (nextForm) {
                    loadFormQuestions(nextForm.id)
                } else {
                    setStatus('submitted')
                }
            }
        } catch (error: any) {
            showToast(error.message || 'Failed to submit feedback', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    // Don't show anything if feedback is disabled
    if (status === 'loading') {
        return (
            <div className="bg-white rounded-xl shadow-xl p-4 sm:p-6">
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
            </div>
        )
    }

    if (status === 'disabled') {
        return null
    }

    return (
        <div className="bg-white rounded-xl shadow-xl p-4 sm:p-6 mt-6 sm:mt-8">
            <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-purple-600" />
                <h2 className="text-xl font-bold">Event Feedback</h2>
            </div>

            {/* Status Messages */}
            {status === 'not_released' && (
                <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <div>
                        <p className="font-medium text-yellow-900">Feedback Not Yet Available</p>
                        <p className="text-sm text-yellow-700">
                            {eventEnded ? 'Feedback will be available soon.' : 'Feedback will be available after the event ends.'}
                        </p>
                    </div>
                </div>
            )}

            {status === 'closed' && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <Clock className="w-5 h-5 text-gray-500" />
                    <div>
                        <p className="font-medium text-gray-900">Feedback Closed</p>
                        <p className="text-sm text-gray-600">The feedback period for this event has ended.</p>
                    </div>
                </div>
            )}

            {status === 'submitted' && (
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                        <p className="font-medium text-green-900">Feedback Submitted</p>
                        <p className="text-sm text-green-700">Thank you for your feedback! Your input helps us improve future events.</p>
                    </div>
                </div>
            )}

            {/* Feedback Form */}
            {status === 'open' && (
                <div className="space-y-6">
                    {/* Form selector for multi-day events */}
                    {forms.filter(f => f.isAvailable && !alreadySubmitted[f.id]).length > 1 && (
                        <div className="flex gap-2 flex-wrap">
                            {forms.filter(f => f.isAvailable && !alreadySubmitted[f.id]).map(form => (
                                <button
                                    key={form.id}
                                    onClick={() => loadFormQuestions(form.id)}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${selectedFormId === form.id
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {form.day_number ? `Day ${form.day_number}` : form.title}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* XP Reward Banner */}
                    <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <Gift className="w-4 h-4 text-purple-600" />
                        <p className="text-sm text-purple-800">
                            <span className="font-medium">Earn +{FEEDBACK_XP_REWARD} XP</span> by submitting your feedback!
                        </p>
                    </div>

                    {/* Login prompt */}
                    {!userId && (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-blue-800">Please log in to submit feedback.</p>
                        </div>
                    )}

                    {/* Registration prompt */}
                    {userId && !isRegistered && (
                        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                            <p className="text-yellow-800">You must be registered for this event to submit feedback.</p>
                        </div>
                    )}

                    {/* Questions */}
                    {userId && isRegistered && questions.length > 0 && (
                        <div className="space-y-6">
                            {questions.map((question, index) => (
                                <div key={question.id} className="space-y-2">
                                    <label className="block font-medium text-gray-900">
                                        {index + 1}. {question.label}
                                        {question.is_required && <span className="text-red-500 ml-1">*</span>}
                                    </label>

                                    {/* Text input */}
                                    {question.question_type === 'text' && (
                                        <input
                                            type="text"
                                            value={answers[question.id] || ''}
                                            onChange={(e) => updateAnswer(question.id, e.target.value)}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                            placeholder={question.placeholder || 'Your answer...'}
                                        />
                                    )}

                                    {/* Textarea */}
                                    {question.question_type === 'textarea' && (
                                        <textarea
                                            value={answers[question.id] || ''}
                                            onChange={(e) => updateAnswer(question.id, e.target.value)}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[100px]"
                                            placeholder={question.placeholder || 'Your answer...'}
                                        />
                                    )}

                                    {/* Rating */}
                                    {question.question_type === 'rating' && (
                                        <div className="flex items-center gap-2">
                                            {[1, 2, 3, 4, 5].map((value) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => updateAnswer(question.id, value)}
                                                    className="p-1 transition-colors"
                                                >
                                                    <Star
                                                        className={`w-8 h-8 ${(answers[question.id] || 0) >= value
                                                            ? 'text-yellow-400 fill-yellow-400'
                                                            : 'text-gray-300'
                                                            }`}
                                                    />
                                                </button>
                                            ))}
                                            {answers[question.id] && (
                                                <span className="text-sm text-gray-500 ml-2">
                                                    {answers[question.id]} / 5
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Select */}
                                    {question.question_type === 'select' && (
                                        <select
                                            value={answers[question.id] || ''}
                                            onChange={(e) => updateAnswer(question.id, e.target.value)}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        >
                                            <option value="">Select an option...</option>
                                            {question.options?.map((opt: any) => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    )}

                                    {/* Radio */}
                                    {question.question_type === 'radio' && (
                                        <div className="space-y-2">
                                            {question.options?.map((opt: any) => (
                                                <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name={question.id}
                                                        value={opt.value}
                                                        checked={answers[question.id] === opt.value}
                                                        onChange={(e) => updateAnswer(question.id, e.target.value)}
                                                        className="w-4 h-4 text-purple-600"
                                                    />
                                                    <span>{opt.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    {/* Checkbox */}
                                    {question.question_type === 'checkbox' && (
                                        <div className="space-y-2">
                                            {question.options?.map((opt: any) => (
                                                <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={(answers[question.id] || []).includes(opt.value)}
                                                        onChange={() => toggleCheckboxAnswer(question.id, opt.value)}
                                                        className="w-4 h-4 text-purple-600 rounded"
                                                    />
                                                    <span>{opt.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Submit button */}
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        Submit Feedback
                                        <span className="text-purple-200">+{FEEDBACK_XP_REWARD} XP</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Loading questions */}
                    {selectedFormId && questions.length === 0 && userId && isRegistered && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                    )}
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
        </div>
    )
}
