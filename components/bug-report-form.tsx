'use client'

import { useState } from 'react'
import { submitBugReport, type BugReportSubmission } from '@/lib/actions/bug-reports'
import { Bug, Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react'

export default function BugReportForm() {
    const [formData, setFormData] = useState<BugReportSubmission>({
        title: '',
        description: '',
        category: 'Bug'
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [result, setResult] = useState<{ type: 'success' | 'error'; message: string; xp?: number } | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setResult(null)

        // Capture browser info
        const browserInfo = {
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            url: window.location.href
        }

        const response = await submitBugReport({
            ...formData,
            browserInfo
        })

        setIsSubmitting(false)

        if (response.success) {
            setResult({
                type: 'success',
                message: response.message,
                xp: response.xpAwarded
            })
            // Reset form
            setFormData({ title: '', description: '', category: 'Bug' })
        } else {
            setResult({
                type: 'error',
                message: response.message
            })
        }
    }

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="bg-gradient-to-br from-zinc-900 to-black border border-white/10 rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-red-500/20 rounded-xl">
                        <Bug className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Report a Bug</h2>
                        <p className="text-sm text-gray-400">Help us improve - earn XP for valid reports!</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Title */}
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium mb-2">
                            Bug Title <span className="text-red-400">*</span>
                        </label>
                        <input
                            id="title"
                            type="text"
                            required
                            maxLength={100}
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Brief description of the issue"
                            className="w-full bg-zinc-800/50 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label htmlFor="category" className="block text-sm font-medium mb-2">
                            Category <span className="text-red-400">*</span>
                        </label>
                        <select
                            id="category"
                            required
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                            className="w-full bg-zinc-800/50 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value="Bug">Bug</option>
                            <option value="UI">UI Issue</option>
                            <option value="Performance">Performance Issue</option>
                            <option value="Feature Request">Feature Request</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium mb-2">
                            Description <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            id="description"
                            required
                            rows={6}
                            maxLength={1000}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Describe the issue in detail. Include steps to reproduce if applicable."
                            className="w-full bg-zinc-800/50 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">{formData.description.length}/1000 characters</p>
                    </div>

                    {/* XP Info */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                        <p className="text-sm text-blue-300">
                            <strong>XP Rewards:</strong> First report: 10 XP, Additional reports: 5 XP each (max 50 XP total)
                        </p>
                    </div>

                    {/* Result Message */}
                    {result && (
                        <div className={`flex items-start gap-3 p-4 rounded-lg border ${result.type === 'success'
                                ? 'bg-green-500/10 border-green-500/20'
                                : 'bg-red-500/10 border-red-500/20'
                            }`}>
                            {result.type === 'success' ? (
                                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            )}
                            <div>
                                <p className={result.type === 'success' ? 'text-green-300' : 'text-red-300'}>
                                    {result.message}
                                </p>
                                {result.xp && result.xp > 0 && (
                                    <p className="text-sm text-green-400 font-semibold mt-1 flex items-center gap-1.5">
                                        <Sparkles className="w-4 h-4" /> +{result.xp} XP earned!
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Bug className="w-5 h-5" />
                                Submit Bug Report
                            </>
                        )}
                    </button>
                </form>

                <p className="text-xs text-gray-500 text-center mt-6">
                    Browser info will be automatically captured to help with debugging
                </p>
            </div>
        </div>
    )
}
