'use client'

import { useState, useTransition } from "react"
import { Lightbulb, Loader2, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react"
import { summarizeEventFeedback, type FeedbackThemes } from "@/lib/actions/feedback-ai"

function Column({ title, items, icon: Icon, tone }: { title: string; items: string[]; icon: any; tone: string }) {
    return (
        <div className="rounded-xl bg-black/30 border border-white/5 p-4">
            <div className={`flex items-center gap-2 text-sm font-medium mb-2 ${tone}`}><Icon className="w-4 h-4" />{title}</div>
            {items.length === 0 ? <p className="text-xs text-gray-500">Nothing notable.</p> : (
                <ul className="space-y-1.5 text-sm text-gray-300 list-disc pl-4">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
            )}
        </div>
    )
}

/** "Summarise comments with AI" panel for an event's feedback. */
export function FeedbackAiSummary({ eventId }: { eventId: string }) {
    const [result, setResult] = useState<FeedbackThemes | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pending, start] = useTransition()

    const run = () => start(async () => {
        setError(null)
        const res = await summarizeEventFeedback(eventId)
        if ("error" in res) setError(res.error)
        else setResult(res)
    })

    return (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-violet-200 font-medium"><Sparkles className="w-4 h-4" /> What students said</div>
                    <p className="text-xs text-gray-500 mt-0.5">AI groups the written comments into themes. Only comment answers are sent (no names, IDs or contact details) to NVIDIA&apos;s API.</p>
                </div>
                <button onClick={run} disabled={pending} className="h-9 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60 shrink-0">
                    {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {result ? "Refresh" : "Summarise comments"}
                </button>
            </div>
            {error && <p className="text-sm text-red-300">{error}</p>}
            {result && (
                <>
                    {result.overall && <p className="text-sm text-gray-200">{result.overall} <span className="text-xs text-gray-500">({result.commentsRead} comments read)</span></p>}
                    <div className="grid md:grid-cols-3 gap-3">
                        <Column title="Praise" items={result.praise} icon={ThumbsUp} tone="text-green-300" />
                        <Column title="Complaints" items={result.complaints} icon={ThumbsDown} tone="text-red-300" />
                        <Column title="Suggestions" items={result.suggestions} icon={Lightbulb} tone="text-amber-300" />
                    </div>
                </>
            )}
        </div>
    )
}
