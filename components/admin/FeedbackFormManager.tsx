'use client'

import { useState, useEffect } from 'react'
import { Plus, MessageSquare, Send, Download, Trash2, ChevronDown, ChevronUp, Users, Clock, Eye, Star, BarChart3, Percent } from 'lucide-react'
import { Toast, useToast } from '@/components/ui/toast'
import { FeedbackFormBuilder } from './FeedbackFormBuilder'
import { FeedbackFormPreview } from './FeedbackFormPreview'
import {
    createFeedbackForm,
    updateFeedbackForm,
    deleteFeedbackForm,
    releaseFeedbackForm,
    closeFeedbackForm,
    getEventFeedbackForms,
    getFeedbackResponses,
    getFeedbackAnalytics,
    toggleRequiresFeedback,
    type FeedbackFormWithMeta,
    type FeedbackQuestion,
    type FeedbackAnalytics
} from '@/lib/actions/feedback'

interface Props {
    eventId: string
    isMultiDay: boolean
    isVirtual: boolean
    requiresFeedback: boolean
}

export function FeedbackFormManager({ eventId, isMultiDay, isVirtual, requiresFeedback: initialRequiresFeedback }: Props) {
    const [forms, setForms] = useState<FeedbackFormWithMeta[]>([])
    const [loading, setLoading] = useState(true)
    const [showBuilder, setShowBuilder] = useState(false)
    const [editingForm, setEditingForm] = useState<FeedbackFormWithMeta | null>(null)
    const [expandedFormId, setExpandedFormId] = useState<string | null>(null)
    const [responses, setResponses] = useState<any[]>([])
    const [loadingResponses, setLoadingResponses] = useState(false)
    const [requiresFeedback, setRequiresFeedback] = useState(initialRequiresFeedback)
    const [analytics, setAnalytics] = useState<FeedbackAnalytics | null>(null)
    const [previewForm, setPreviewForm] = useState<FeedbackFormWithMeta | null>(null)
    const { toast, showToast, hideToast } = useToast()

    useEffect(() => {
        loadForms()
    }, [eventId])

    async function loadForms() {
        setLoading(true)
        try {
            const data = await getEventFeedbackForms(eventId)
            setForms(data)
            // Load analytics if there are forms with responses
            if (data.length > 0) {
                try {
                    const analyticsData = await getFeedbackAnalytics(eventId)
                    setAnalytics(analyticsData)
                } catch (e) {
                    console.error('Failed to load analytics:', e)
                }
            }
        } catch (error) {
            console.error('Failed to load forms:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleSaveForm(formData: { title: string; dayNumber: number | null; releaseMode: 'automatic' | 'manual'; autoCloseDays: number | null; questions: FeedbackQuestion[] }) {
        try {
            if (editingForm?.id) {
                await updateFeedbackForm(editingForm.id, {
                    title: formData.title,
                    release_mode: formData.releaseMode,
                    auto_close_after_days: formData.autoCloseDays,
                    questions: formData.questions
                })
                showToast('Feedback form updated!', 'success')
            } else {
                await createFeedbackForm({
                    event_id: eventId,
                    title: formData.title,
                    day_number: formData.dayNumber,
                    release_mode: formData.releaseMode,
                    auto_close_after_days: formData.autoCloseDays,
                    questions: formData.questions
                })
                showToast('Feedback form created!', 'success')
            }
            setShowBuilder(false)
            setEditingForm(null)
            loadForms()
        } catch (error: any) {
            showToast(error.message || 'Failed to save form', 'error')
        }
    }

    async function handleDelete(formId: string) {
        if (!confirm('Are you sure you want to delete this feedback form? All responses will be lost.')) return
        try {
            await deleteFeedbackForm(formId)
            showToast('Feedback form deleted', 'success')
            loadForms()
        } catch (error: any) {
            showToast(error.message || 'Failed to delete form', 'error')
        }
    }

    async function handleRelease(formId: string) {
        try {
            await releaseFeedbackForm(formId)
            showToast('Feedback form released!', 'success')
            loadForms()
        } catch (error: any) {
            showToast(error.message || 'Failed to release form', 'error')
        }
    }

    async function handleClose(formId: string) {
        if (!confirm('Close this form? Students will no longer be able to submit feedback.')) return
        try {
            await closeFeedbackForm(formId)
            showToast('Feedback form closed', 'success')
            loadForms()
        } catch (error: any) {
            showToast(error.message || 'Failed to close form', 'error')
        }
    }

    async function handleViewResponses(formId: string) {
        if (expandedFormId === formId) {
            setExpandedFormId(null)
            setResponses([])
            return
        }
        setExpandedFormId(formId)
        setLoadingResponses(true)
        try {
            const data = await getFeedbackResponses(formId)
            setResponses(data)
        } catch (error) {
            console.error('Failed to load responses:', error)
            setResponses([])
        } finally {
            setLoadingResponses(false)
        }
    }

    async function handleToggleRequiresFeedback() {
        try {
            const result = await toggleRequiresFeedback(eventId)
            setRequiresFeedback(result.newValue)
            showToast(result.newValue ? 'Feedback required for attendance' : 'Feedback no longer required for attendance', 'success')
        } catch (error: any) {
            showToast(error.message || 'Failed to update setting', 'error')
        }
    }

    function handleExport(formId: string) {
        window.open(`/api/feedback/export?formId=${formId}`, '_blank')
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (showBuilder) {
        return (
            <FeedbackFormBuilder
                isMultiDay={isMultiDay}
                existingForms={forms}
                editingForm={editingForm}
                onSave={handleSaveForm}
                onCancel={() => { setShowBuilder(false); setEditingForm(null) }}
            />
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-semibold">Feedback Forms</h3>
                </div>
                <button
                    onClick={() => setShowBuilder(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Create Form
                </button>
            </div>

            {/* Analytics Dashboard */}
            {analytics && forms.length > 0 && analytics.totalResponses > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Average Rating */}
                    <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 p-4 rounded-xl border border-yellow-500/20">
                        <div className="flex items-center gap-2 text-yellow-300 mb-2">
                            <Star className="w-4 h-4 fill-current" />
                            <span className="text-sm font-medium">Average Rating</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-yellow-200">
                                {analytics.averageRating ?? '—'}
                            </span>
                            <span className="text-yellow-400">/5</span>
                        </div>
                        <div className="flex gap-1 mt-2">
                            {[1, 2, 3, 4, 5].map(n => (
                                <Star
                                    key={n}
                                    className={`w-4 h-4 ${n <= (analytics.averageRating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-white/15'}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Response Rate */}
                    <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-4 rounded-xl border border-blue-500/20">
                        <div className="flex items-center gap-2 text-blue-300 mb-2">
                            <Percent className="w-4 h-4" />
                            <span className="text-sm font-medium">Response Rate</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-blue-200">{analytics.responseRate}%</span>
                        </div>
                        <div className="text-sm text-blue-400 mt-1">
                            {analytics.totalResponses} of {analytics.totalRegistrations} registered
                        </div>
                        <div className="w-full bg-blue-500/20 rounded-full h-2 mt-2">
                            <div
                                className="bg-blue-500 h-2 rounded-full transition-all"
                                style={{ width: `${analytics.responseRate}%` }}
                            />
                        </div>
                    </div>

                    {/* Rating Distribution */}
                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-4 rounded-xl border border-purple-500/20">
                        <div className="flex items-center gap-2 text-purple-300 mb-2">
                            <BarChart3 className="w-4 h-4" />
                            <span className="text-sm font-medium">Rating Distribution</span>
                        </div>
                        <div className="space-y-1">
                            {[5, 4, 3, 2, 1].map(rating => {
                                const count = analytics.ratingDistribution[rating as 1 | 2 | 3 | 4 | 5]
                                const total = Object.values(analytics.ratingDistribution).reduce((a, b) => a + b, 0)
                                const percent = total > 0 ? (count / total) * 100 : 0
                                return (
                                    <div key={rating} className="flex items-center gap-2 text-xs">
                                        <span className="w-3 text-purple-300">{rating}</span>
                                        <div className="flex-1 bg-purple-500/20 rounded-full h-2">
                                            <div
                                                className="bg-purple-500 h-2 rounded-full transition-all"
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                        <span className="w-6 text-right text-purple-400">{count}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Online event feedback requirement toggle */}
            {isVirtual && forms.length > 0 && (
                <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={requiresFeedback}
                            onChange={handleToggleRequiresFeedback}
                            className="w-4 h-4 text-purple-400 rounded"
                        />
                        <div>
                            <p className="font-medium text-purple-200">Require feedback for attendance</p>
                            <p className="text-sm text-purple-300">Students must submit feedback before their attendance can be marked (for online check-in)</p>
                        </div>
                    </label>
                </div>
            )}

            {/* Forms List */}
            {forms.length === 0 ? (
                <div className="text-center py-12 bg-white/[0.03] rounded-xl border-2 border-dashed border-white/10">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No feedback forms created yet</p>
                    <button
                        onClick={() => setShowBuilder(true)}
                        className="text-purple-400 hover:text-purple-300 font-medium"
                    >
                        Create your first feedback form
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {forms.map(form => (
                        <div key={form.id} className="border border-white/10 rounded-xl overflow-hidden">
                            {/* Form Header */}
                            <div className="p-4 bg-zinc-900">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-semibold">{form.title}</h4>
                                            {form.day_number && (
                                                <span className="text-xs px-2 py-0.5 bg-orange-500/10 text-orange-300 rounded-full">
                                                    Day {form.day_number}
                                                </span>
                                            )}
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${form.is_released
                                                ? form.closes_at ? 'bg-white/5 text-gray-300' : 'bg-green-500/10 text-green-300'
                                                : 'bg-yellow-500/10 text-yellow-300'
                                                }`}>
                                                {form.is_released
                                                    ? form.closes_at ? 'Closed' : 'Open'
                                                    : form.release_mode === 'automatic' ? 'Auto-Release' : 'Not Released'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3 h-3" />
                                                {form.response_count} responses
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MessageSquare className="w-3 h-3" />
                                                {form.questions?.length || 0} questions
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Release button */}
                                        {!form.is_released && form.release_mode === 'manual' && (
                                            <button
                                                onClick={() => handleRelease(form.id!)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                                            >
                                                <Send className="w-3 h-3" />
                                                Release
                                            </button>
                                        )}
                                        {/* Close button */}
                                        {form.is_released && !form.closes_at && (
                                            <button
                                                onClick={() => handleClose(form.id!)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700"
                                            >
                                                <Clock className="w-3 h-3" />
                                                Close
                                            </button>
                                        )}
                                        {/* Preview */}
                                        <button
                                            onClick={() => setPreviewForm(form)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-white/5 text-gray-300 rounded-lg text-sm hover:bg-white/10"
                                            title="Preview form"
                                        >
                                            <Eye className="w-3 h-3" />
                                            Preview
                                        </button>
                                        {/* View responses */}
                                        <button
                                            onClick={() => handleViewResponses(form.id!)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-300 rounded-lg text-sm hover:bg-blue-500/20"
                                        >
                                            <Users className="w-3 h-3" />
                                            {expandedFormId === form.id ? 'Hide' : 'Responses'}
                                        </button>
                                        {/* Export */}
                                        <button
                                            onClick={() => handleExport(form.id!)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 text-purple-300 rounded-lg text-sm hover:bg-purple-500/20"
                                            title="Export to Excel"
                                        >
                                            <Download className="w-3 h-3" />
                                        </button>
                                        {/* Edit */}
                                        <button
                                            onClick={() => { setEditingForm(form); setShowBuilder(true) }}
                                            className="px-3 py-1.5 text-gray-400 hover:bg-white/5 rounded-lg text-sm"
                                        >
                                            Edit
                                        </button>
                                        {/* Delete */}
                                        <button
                                            onClick={() => handleDelete(form.id!)}
                                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg"
                                            title="Delete form"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Responses Panel */}
                            {expandedFormId === form.id && (
                                <div className="border-t border-white/10 bg-white/[0.03] p-4">
                                    {loadingResponses ? (
                                        <div className="flex items-center justify-center py-8">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                        </div>
                                    ) : responses.length === 0 ? (
                                        <p className="text-center text-gray-500 py-8">No responses yet</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-white/5">
                                                    <tr>
                                                        <th className="text-left p-2 font-medium">Student</th>
                                                        <th className="text-left p-2 font-medium">System ID</th>
                                                        <th className="text-left p-2 font-medium">Submitted</th>
                                                        {form.questions?.map((q: any) => (
                                                            <th key={q.id} className="text-left p-2 font-medium max-w-[200px] truncate" title={q.label}>
                                                                {q.label}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {responses.map(resp => (
                                                        <tr key={resp.id} className="hover:bg-white/[0.03]">
                                                            <td className="p-2">
                                                                <div className="font-medium">{resp.user?.name || 'Unknown'}</div>
                                                                <div className="text-xs text-gray-500">{resp.user?.email}</div>
                                                            </td>
                                                            <td className="p-2 font-mono text-xs">{resp.user?.system_id || '-'}</td>
                                                            <td className="p-2 text-gray-500 text-xs">
                                                                {new Date(resp.submitted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                                            </td>
                                                            {form.questions?.map((q: any) => {
                                                                const answer = resp.answers?.[q.id]
                                                                const displayAnswer = Array.isArray(answer) ? answer.join(', ') : (answer ?? '-')
                                                                return (
                                                                    <td key={q.id} className="p-2 max-w-[200px] truncate" title={displayAnswer}>
                                                                        {q.question_type === 'rating' ? (
                                                                            <span className="inline-flex gap-0.5" aria-label={`${answer || 0} of 5`}>{[1, 2, 3, 4, 5].map(n => <Star key={n} className={`w-3.5 h-3.5 ${n <= (answer || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-600'}`} />)}</span>
                                                                        ) : displayAnswer}
                                                                    </td>
                                                                )
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

            {/* Preview Modal */}
            {previewForm && (
                <FeedbackFormPreview
                    form={previewForm}
                    onClose={() => setPreviewForm(null)}
                />
            )}
        </div>
    )
}
