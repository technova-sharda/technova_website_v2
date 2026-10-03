"use server"

import { createClient as createServerClient } from "@supabase/supabase-js"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { Resend } from "resend"
import { sendEmailOrThrow } from "@/lib/email/send"
import { render } from "@react-email/render"
import EvaluatorInviteEmail from "@/emails/evaluator-invite"
import { EvaluatorUpdateEmail } from "@/emails/evaluator-update"

const resend = new Resend(process.env.RESEND_API_KEY)

function getSupabase() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

const DEFAULT_CRITERIA = [
    "Communication Skills",
    "Teamwork & Collaboration",
    "Dedication & Commitment",
    "Relevance to Role",
    "Leadership Potential"
]

// ============================================================
// EVALUATION CRITERIA
// ============================================================

export async function getEvaluationCriteria(formId: string): Promise<string[]> {
    const supabase = getSupabase()
    const { data } = await supabase
        .from("forms")
        .select("evaluation_criteria")
        .eq("id", formId)
        .single()

    return data?.evaluation_criteria || DEFAULT_CRITERIA
}

export async function updateEvaluationCriteria(formId: string, criteria: string[]) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()
    const { error } = await supabase
        .from("forms")
        .update({ evaluation_criteria: criteria })
        .eq("id", formId)

    if (error) throw new Error("Failed to update criteria")
    revalidatePath(`/admin/forms/${formId}/evaluate`)
    return { success: true }
}

// ============================================================
// EVALUATORS MANAGEMENT
// ============================================================

async function isAdminSession() {
    const session = await auth()
    return !!session && ['admin', 'super_admin'].includes(session.user.role)
}

// Admin only: the rows include each evaluator's secret magic_token.
export async function getFormEvaluators(formId: string) {
    if (!(await isAdminSession())) return []

    const supabase = getSupabase()
    const { data, error } = await supabase
        .from("form_evaluators")
        .select("*")
        .eq("form_id", formId)
        .order("created_at", { ascending: true })

    if (error) {
        console.error("Fetch evaluators error:", error)
        return []
    }
    return data || []
}

export async function addFormEvaluator(formId: string, name: string, email: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()
    const { data, error } = await supabase
        .from("form_evaluators")
        .insert({ form_id: formId, name, email })
        .select()
        .single()

    if (error) {
        if (error.code === '23505') throw new Error("This evaluator already exists for this form")
        throw new Error("Failed to add evaluator")
    }

    try {
        const { data: form } = await supabase.from("forms").select("title").eq("id", formId).single()
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://technovashardauniversity.in"
        const evaluateUrl = `${appUrl}/form-evaluate?token=${data.magic_token}`

        const emailHtml = await render(EvaluatorInviteEmail({
            evaluatorName: name,
            formTitle: form?.title || "TechNova Form",
            evaluateUrl
        }))

        await sendEmailOrThrow(resend, {
            from: 'Technova <noreply@technovashardauniversity.in>',
            to: email,
            subject: `You have been invited to evaluate: ${form?.title || "TechNova Form"}`,
            html: emailHtml
        })
    } catch (e) {
        console.error("Failed to send evaluator invite email:", e)
    }

    revalidatePath(`/admin/forms/${formId}/evaluate`)
    return data
}

export async function removeFormEvaluator(evaluatorId: string, formId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()
    const { error } = await supabase
        .from("form_evaluators")
        .delete()
        .eq("id", evaluatorId)

    if (error) throw new Error("Failed to remove evaluator")
    revalidatePath(`/admin/forms/${formId}/evaluate`)
    return { success: true }
}

export async function sendEmailToEvaluators(formId: string, subject: string, message: string, evaluatorIds: string[] = []) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()

    // Get form title
    const { data: form } = await supabase.from("forms").select("title").eq("id", formId).single()
    if (!form) throw new Error("Form not found")

    // Get evaluators for this form
    let query = supabase
        .from("form_evaluators")
        .select("id, name, email, magic_token")
        .eq("form_id", formId)
        
    if (evaluatorIds && evaluatorIds.length > 0) {
        query = query.in("id", evaluatorIds)
    }

    const { data: evaluators } = await query

    if (!evaluators || evaluators.length === 0) {
        throw new Error("No evaluators found for this form")
    }

    if (!process.env.RESEND_API_KEY) {
        console.warn("RESEND_API_KEY is not set. Email blast skipped.")
        return { success: true } // Return success so UI doesn't crash in dev
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    // Rate limit: 2 emails per second for Resend free tier
    const BATCH_SIZE = 2
    for (let i = 0; i < evaluators.length; i += BATCH_SIZE) {
        const batch = evaluators.slice(i, i + BATCH_SIZE)
        
        const emailPromises = batch.map(async (evaluator) => {
            const evaluateUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://technovashardauniversity.in"}/form-evaluate?token=${evaluator.magic_token}`
            
            const emailHtml = await render(EvaluatorUpdateEmail({
                evaluatorName: evaluator.name,
                formTitle: form.title,
                evaluateUrl,
                subject,
                message
            }))

            return sendEmailOrThrow(resend, {
                from: 'Technova <noreply@technovashardauniversity.in>',
                to: evaluator.email,
                subject: subject,
                html: emailHtml
            })
        })

        await Promise.allSettled(emailPromises)
        
        // Wait 1.1s between batches if there are more evaluators to avoid rate limit
        if (i + BATCH_SIZE < evaluators.length) {
            await new Promise(resolve => setTimeout(resolve, 1100))
        }
    }

    return { success: true, count: evaluators.length }
}

// ============================================================
// EVALUATOR AUTH (magic token)
// ============================================================

export async function getEvaluatorByToken(token: string) {
    const supabase = getSupabase()
    const { data } = await supabase
        .from("form_evaluators")
        .select("id, form_id, name, email")
        .eq("magic_token", token)
        .maybeSingle()

    return data
}

// ============================================================
// SUBMIT / UPDATE EVALUATION
// ============================================================

export async function submitFormEvaluation(
    evaluatorToken: string,
    responseId: string,
    scores: Record<string, number>,
    remarks: string
) {
    const evaluator = await getEvaluatorByToken(evaluatorToken)
    if (!evaluator) throw new Error("Invalid evaluator token")

    const supabase = getSupabase()

    // Check if evaluations are open
    const { data: form } = await supabase.from("forms").select("evaluations_open").eq("id", evaluator.form_id).single()
    if (form && form.evaluations_open === false) {
        throw new Error("Evaluations are currently closed for this form.")
    }

    // The response must belong to the form this evaluator was invited to
    const { data: response } = await supabase
        .from("form_responses")
        .select("id")
        .eq("id", responseId)
        .eq("form_id", evaluator.form_id)
        .maybeSingle()
    if (!response) throw new Error("This submission is not part of your evaluation form.")

    // Check if evaluation is locked
    const { data: existing } = await supabase
        .from("form_evaluations")
        .select("is_locked, unlock_status")
        .eq("evaluator_id", evaluator.id)
        .eq("response_id", responseId)
        .maybeSingle()

    if (existing?.is_locked && existing.unlock_status !== 'approved') {
        throw new Error("This evaluation is locked and cannot be edited. Please request an unlock.")
    }

    // Upsert evaluation, locking it
    const { error } = await supabase
        .from("form_evaluations")
        .upsert({
            form_id: evaluator.form_id,
            evaluator_id: evaluator.id,
            response_id: responseId,
            scores,
            remarks,
            is_locked: true,
            unlock_status: 'none',
            updated_at: new Date().toISOString()
        }, { onConflict: "evaluator_id,response_id" })

    if (error) {
        console.error("Evaluation submit error:", error)
        throw new Error("Failed to submit evaluation")
    }

    return { success: true }
}

// ============================================================
// ADVANCED CONTROLS (Open/Close, Clear, Locks)
// ============================================================

export async function toggleEvaluationsOpen(formId: string, isOpen: boolean) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()
    const { error } = await supabase
        .from("forms")
        .update({ evaluations_open: isOpen })
        .eq("id", formId)

    if (error) throw new Error("Failed to toggle evaluation status")
    revalidatePath(`/admin/forms/${formId}/evaluate`)
    return { success: true }
}

export async function clearAllEvaluations(formId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()
    const { error } = await supabase
        .from("form_evaluations")
        .delete()
        .eq("form_id", formId)

    if (error) throw new Error("Failed to clear evaluations")
    revalidatePath(`/admin/forms/${formId}/evaluate`)
    return { success: true }
}

export async function requestEvaluationUnlock(evaluatorToken: string, responseId: string) {
    const evaluator = await getEvaluatorByToken(evaluatorToken)
    if (!evaluator) throw new Error("Invalid evaluator token")

    const supabase = getSupabase()
    const { error } = await supabase
        .from("form_evaluations")
        .update({ unlock_status: 'pending' })
        .eq("evaluator_id", evaluator.id)
        .eq("response_id", responseId)

    if (error) throw new Error("Failed to request unlock")
    return { success: true }
}

export async function resolveUnlockRequest(formId: string, evaluationId: string, status: 'approved' | 'declined') {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()
    const { error } = await supabase
        .from("form_evaluations")
        .update({ 
            unlock_status: status,
            is_locked: status === 'approved' ? false : true 
        })
        .eq("id", evaluationId)

    if (error) throw new Error("Failed to resolve unlock request")
    revalidatePath(`/admin/forms/${formId}/evaluate`)
    return { success: true }
}

// ============================================================
// EVALUATION RESULTS (admin view)
// ============================================================

export async function getFormEvaluationResults(formId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()

    // Get all evaluations for this form (no cross-schema join)
    const { data: evaluations, error } = await supabase
        .from("form_evaluations")
        .select(`
            *,
            evaluator:form_evaluators(id, name, email)
        `)
        .eq("form_id", formId)
        .order("created_at", { ascending: true })

    if (error) {
        console.error("Fetch evaluations error:", error)
        return []
    }

    if (!evaluations || evaluations.length === 0) return []

    // Fetch the related responses and their answers
    const responseIds = [...new Set(evaluations.map(e => e.response_id))]
    const { data: responses } = await supabase
        .from("form_responses")
        .select(`
            id, user_id,
            answers:form_response_answers(field_id, answer_text, answer_json)
        `)
        .in("id", responseIds)

    // Fetch user details from next_auth schema
    const userIds = [...new Set((responses || []).map((r: any) => r.user_id))]
    let usersMap: Record<string, any> = {}
    if (userIds.length > 0) {
        const { data: users } = await supabase
            .schema("next_auth")
            .from("users")
            .select("id, name, email, system_id")
            .in("id", userIds)
        for (const u of (users || [])) {
            usersMap[u.id] = u
        }
    }

    // Build response map with user data merged
    const responseMap: Record<string, any> = {}
    for (const r of (responses || [])) {
        responseMap[r.id] = {
            ...r,
            user: usersMap[r.user_id] || { name: "Unknown", email: "", system_id: "" }
        }
    }

    // Enrich evaluations with response + user data
    return evaluations.map(ev => ({
        ...ev,
        response: responseMap[ev.response_id] || null
    }))
}

// Get candidates (form responses) for evaluation
// Applicants' answers plus name/email/system ID: only for admins, or for an
// evaluator whose magic token belongs to this form.
export async function getFormCandidates(formId: string, evaluatorToken?: string) {
    if (evaluatorToken) {
        const evaluator = await getEvaluatorByToken(evaluatorToken)
        if (!evaluator || evaluator.form_id !== formId) return []
    } else if (!(await isAdminSession())) {
        return []
    }

    const supabase = getSupabase()

    const { data: responses, error } = await supabase
        .from("form_responses")
        .select(`
            id, user_id, created_at,
            answers:form_response_answers(field_id, answer_text, answer_json)
        `)
        .eq("form_id", formId)
        .order("created_at", { ascending: true })

    if (error) return []

    // Fetch user details from next_auth schema
    const userIds = [...new Set((responses || []).map((r: any) => r.user_id))]
    let usersMap: Record<string, any> = {}
    if (userIds.length > 0) {
        const { data: users } = await supabase
            .schema("next_auth")
            .from("users")
            .select("id, name, email, system_id")
            .in("id", userIds)
        for (const u of (users || [])) {
            usersMap[u.id] = u
        }
    }

    return (responses || []).map((r: any) => ({
        ...r,
        user: usersMap[r.user_id] || { name: "Unknown", email: "", system_id: "" }
    }))
}

// Get evaluations by a specific evaluator
// An evaluator's own scores: only with that evaluator's token, or for admins.
export async function getEvaluationsByEvaluator(evaluatorId: string, evaluatorToken?: string) {
    if (evaluatorToken) {
        const evaluator = await getEvaluatorByToken(evaluatorToken)
        if (!evaluator || evaluator.id !== evaluatorId) return []
    } else if (!(await isAdminSession())) {
        return []
    }

    const supabase = getSupabase()

    const { data, error } = await supabase
        .from("form_evaluations")
        .select("response_id, scores, remarks, updated_at, is_locked, unlock_status")
        .eq("evaluator_id", evaluatorId)

    if (error) throw new Error("Failed to fetch evaluations")
    return data || []
}
