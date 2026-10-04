'use server'

import { auth } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { aiConfigured } from "@/lib/ai/nvidia"
import { redact, summarizeComments, type FeedbackThemes } from "@/lib/ai/feedback-themes"

export type { FeedbackThemes }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Summarises an event's written feedback into themes (admin action).
 * Only long-answer ("textarea") answers are used; short text fields are usually
 * name / system ID, so they're never sent. Comments go to NVIDIA's API.
 */
export async function summarizeEventFeedback(eventId: string): Promise<FeedbackThemes | { error: string }> {
    const session = await auth()
    if (!session || !["admin", "super_admin"].includes(session.user.role)) return { error: "Unauthorized" }
    if (!UUID.test(eventId)) return { error: "Event not found" }
    if (!aiConfigured()) return { error: "The NVIDIA API key (NAPI_KEY) isn't set on the server." }

    const sb = createAdminClient()
    const { data: forms } = await sb.from("event_feedback_forms").select("id").eq("event_id", eventId)
    const formIds = (forms ?? []).map(f => f.id)
    if (formIds.length === 0) return { error: "This event has no feedback forms." }

    const [{ data: questions }, { data: responses }] = await Promise.all([
        sb.from("feedback_questions").select("id, label").in("form_id", formIds).eq("question_type", "textarea"),
        sb.from("feedback_responses").select("answers").in("form_id", formIds).limit(1000),
    ])
    const commentQuestions = new Map((questions ?? []).map(q => [q.id, q.label as string]))
    const comments: string[] = []
    for (const r of responses ?? []) {
        for (const [qid, value] of Object.entries((r.answers ?? {}) as Record<string, unknown>)) {
            if (!commentQuestions.has(qid) || typeof value !== "string") continue
            const c = redact(value).slice(0, 400)
            if (c.length >= 4 && !/^(na|n\/a|no|none|nil|nothing|-|ok|good|nice)\.?$/i.test(c)) comments.push(c)
        }
    }
    if (comments.length === 0) return { error: "No written comments to summarise yet." }

    return summarizeComments(comments)
}
