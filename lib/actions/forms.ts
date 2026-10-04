'use server'

import { createClient as createServerClient } from "@supabase/supabase-js"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { Resend } from "resend"
import { sendEmailOrThrow } from "@/lib/email/send"
import { render } from "@react-email/render"
import FormSubmissionEmail from "@/emails/form-submission"

const resend = new Resend(process.env.RESEND_API_KEY)

function getSupabase() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://technovashardauniversity.in'

// ============================================================
// FORM CRUD
// ============================================================

export async function createForm(formData: FormData) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()
    
    const title = formData.get("title") as string
    const description = formData.get("description") as string
    const deadline = formData.get("deadline") as string

    const { data: newForm, error } = await supabase.from("forms").insert({
        title,
        description,
        deadline: deadline || null,
        created_by: session.user.id,
        allow_edit: true
    }).select("id").single()

    if (error || !newForm) {
        console.error("Create Form Error:", error)
        throw new Error("Failed to create form")
    }

    revalidatePath("/admin/forms")
    return { success: true, formId: newForm.id }
}

export async function updateForm(id: string, formData: FormData) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()
    
    const title = formData.get("title") as string
    const description = formData.get("description") as string
    const deadline = formData.get("deadline") as string
    const is_active = formData.get("is_active") === "true"

    const { error } = await supabase.from("forms").update({
        title,
        description,
        deadline: deadline || null,
        is_active,
        updated_at: new Date().toISOString()
    }).eq("id", id)

    if (error) {
        console.error("Update Form Error:", error)
        throw new Error("Failed to update form")
    }

    revalidatePath("/admin/forms")
    revalidatePath(`/admin/forms/${id}/edit`)
    revalidatePath(`/forms/${id}`)
    return { success: true }
}

export async function updateFormSettings(formId: string, settings: {
    title?: string
    description?: string | null  // null clears it (the settings form sends null for an empty box)
    is_active?: boolean
    is_published?: boolean
    allow_edit?: boolean
    show_referral?: boolean
    confirmation_message?: string | null
    deadline?: string | null
}) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()

    const { error } = await supabase.from("forms").update({
        ...settings,
        updated_at: new Date().toISOString()
    }).eq("id", formId)

    if (error) {
        console.error("Update Settings Error:", error)
        throw new Error("Failed to update form settings")
    }

    revalidatePath("/admin/forms")
    revalidatePath(`/admin/forms/${formId}/edit`)
    revalidatePath(`/forms/${formId}`)
    return { success: true }
}

export async function deleteForm(id: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()

    const { error } = await supabase
        .from("forms")
        .delete()
        .eq("id", id)

    if (error) {
        console.error("Delete Form Error:", error)
        throw new Error("Failed to delete form")
    }

    revalidatePath("/admin/forms")
    return { success: true }
}

export async function duplicateForm(formId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()

    // Get original form
    const { data: original } = await supabase
        .from("forms")
        .select("*, fields:form_fields(*)")
        .eq("id", formId)
        .single()

    if (!original) throw new Error("Form not found")

    // Create copy
    const { data: newForm, error } = await supabase.from("forms").insert({
        title: `${original.title} (Copy)`,
        description: original.description,
        is_active: false,
        is_published: false,
        allow_edit: original.allow_edit,
        show_referral: original.show_referral,
        confirmation_message: original.confirmation_message,
        deadline: null,
        created_by: session.user.id
    }).select("id").single()

    if (error || !newForm) throw new Error("Failed to duplicate form")

    // Copy fields
    if (original.fields && original.fields.length > 0) {
        const fieldsToInsert = original.fields.map((f: any, i: number) => ({
            form_id: newForm.id,
            label: f.label,
            description: f.description,
            type: f.type,
            options: f.options,
            required: f.required,
            order_index: i,
        }))

        await supabase.from("form_fields").insert(fieldsToInsert)
    }

    revalidatePath("/admin/forms")
    return { success: true, formId: newForm.id }
}

// ============================================================
// FORM READS
// ============================================================

export async function getForms() {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()
    
    const { data, error } = await supabase
        .from("forms")
        .select(`
            *,
            responses:form_responses(count)
        `)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Fetch Forms Error:", error)
        return []
    }

    return data.map(form => ({
        ...form,
        response_count: form.responses?.[0]?.count || 0
    }))
}

export async function getFormById(id: string) {
    const supabase = getSupabase()
    
    const { data: form, error } = await supabase
        .from("forms")
        .select(`
            *,
            fields:form_fields(*)
        `)
        .eq("id", id)
        .single()

    if (error || !form) {
        return null
    }

    // Sort fields by order_index
    form.fields.sort((a: any, b: any) => a.order_index - b.order_index)

    return form
}

// ============================================================
// FORM FIELDS
// ============================================================

export async function saveFormFields(formId: string, fields: any[]) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()

    // 1. Fetch existing fields to see what needs to be deleted
    const { data: existingFields } = await supabase
        .from("form_fields")
        .select("id")
        .eq("form_id", formId)

    const incomingIds = fields.map(f => f.id).filter(Boolean)
    const existingIds = (existingFields || []).map(f => f.id)
    const idsToDelete = existingIds.filter(id => !incomingIds.includes(id))

    // 2. Delete removed fields
    if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
            .from("form_fields")
            .delete()
            .in("id", idsToDelete)
            
        if (deleteError) {
            throw new Error("Failed to clear removed fields")
        }
    }

    // 3. Upsert current fields
    if (fields.length > 0) {
        const fieldsToUpsert = fields.map((f, i) => {
            const validation: any = {}
            if (f.minLength != null) validation.minLength = f.minLength
            if (f.maxLength != null) validation.maxLength = f.maxLength
            if (f.minValue != null) validation.minValue = f.minValue
            if (f.maxValue != null) validation.maxValue = f.maxValue
            if (f.allowOther) validation.allowOther = true
            
            if (f.validation?.afterSection) {
                validation.afterSection = f.validation.afterSection
            }

            if (f.optionRouting && Object.keys(f.optionRouting).length > 0) {
                validation.optionRouting = f.optionRouting
            }

            // Enforce phone safety limits
            if (f.type === 'phone') {
                validation.minLength = Math.max(validation.minLength || 10, 10)
                validation.maxLength = Math.min(validation.maxLength || 15, 15)
            }

            return {
                id: f.id,
                form_id: formId,
                label: f.label,
                description: f.description || null,
                type: f.type,
                options: f.options || null,
                required: f.required || false,
                order_index: i,
                validation: Object.keys(validation).length > 0 ? validation : null
            }
        })

        const { error: upsertError } = await supabase
            .from("form_fields")
            .upsert(fieldsToUpsert, { onConflict: "id" })

        if (upsertError) {
            console.error("Save Fields Error:", upsertError)
            throw new Error("Failed to save fields")
        }
    }

    revalidatePath(`/admin/forms/${formId}/edit`)
    revalidatePath(`/forms/${formId}`)
    return { success: true }
}

// ============================================================
// FORM RESPONSES
// ============================================================

export async function submitFormResponse(formId: string, answers: any[], referrerId?: string) {
    const session = await auth()
    if (!session) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()
    const userId = session.user.id
    
    // Check if form is active and deadline hasn't passed
    const { data: form } = await supabase.from("forms").select("*").eq("id", formId).single()
    if (!form || !form.is_active) {
        throw new Error("Form is not active")
    }
    if (form.deadline && new Date(form.deadline) < new Date()) {
        throw new Error("Form deadline has passed. No new submissions or edits are allowed.")
    }

    // Upsert response (to allow editing)
    const { data: response, error: responseError } = await supabase
        .from("form_responses")
        .upsert({
            form_id: formId,
            user_id: userId,
            referrer_id: form.show_referral ? (referrerId || null) : null,
            updated_at: new Date().toISOString()
        }, { onConflict: 'form_id, user_id' })
        .select("id")
        .single()

    if (responseError || !response) {
        console.error("Response Error:", responseError)
        throw new Error("Failed to save response")
    }

    // Delete existing answers to replace them
    await supabase.from("form_response_answers").delete().eq("response_id", response.id)

    // Insert new answers
    const answersToInsert = answers.map(a => ({
        response_id: response.id,
        field_id: a.field_id,
        answer_text: a.answer_text || null,
        answer_json: a.answer_json || null
    }))

    const { error: answersError } = await supabase.from("form_response_answers").insert(answersToInsert)

    if (answersError) {
        console.error("Answers Error:", answersError)
        throw new Error("Failed to save answers")
    }

    // Get field labels for email
    const { data: fields } = await supabase
        .from("form_fields")
        .select("id, label, type")
        .eq("form_id", formId)
        .order("order_index")

    // Build Q&A pairs for the email
    const responseSummary = (fields || [])
        .filter((f: any) => f.type !== 'section') // skip section headers
        .map((field: any) => {
            const ans = answers.find(a => a.field_id === field.id)
            let value = "-"
            if (ans) {
                if (ans.answer_text) value = ans.answer_text
                if (ans.answer_json) {
                    value = Array.isArray(ans.answer_json)
                        ? ans.answer_json.join(", ")
                        : JSON.stringify(ans.answer_json)
                }
            }
            return { question: field.label, answer: value }
        })
    
    // Send email confirmation with response summary
    try {
        const emailHtml = await render(FormSubmissionEmail({
            userName: session.user.name || 'Student',
            formTitle: form.title,
            formUrl: `${BASE_URL}/forms/${formId}`,
            responses: responseSummary
        }))

        await sendEmailOrThrow(resend, {
            from: 'Technova <noreply@technovashardauniversity.in>',
            to: session.user.email!,
            subject: `Submission Received: ${form.title}`,
            html: emailHtml
        })
    } catch (err) {
        console.error("Failed to send form confirmation email:", err)
    }

    revalidatePath(`/forms/${formId}`)
    return { success: true }
}

export async function getFormResponses(formId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()

    // Get the form fields for headers
    const { data: fields } = await supabase
        .from("form_fields")
        .select("*")
        .eq("form_id", formId)
        .order("order_index")

    // Get the responses with user info from separate query
    const { data: responses, error } = await supabase
        .from("form_responses")
        .select(`
            *,
            answers:form_response_answers(field_id, answer_text, answer_json)
        `)
        .eq("form_id", formId)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Fetch Responses Error:", error)
        return { fields: [], responses: [] }
    }

    // Fetch user details separately to avoid cross-schema join issues
    const userIds = (responses || []).map((r: any) => r.user_id)
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

    const enrichedResponses = (responses || []).map((r: any) => ({
        ...r,
        user: usersMap[r.user_id] || { name: "Unknown", email: "", system_id: "" }
    }))
    
    return { fields: fields || [], responses: enrichedResponses }
}

export async function getUserFormResponse(formId: string, userId: string) {
    const supabase = getSupabase()

    const { data: response, error } = await supabase
        .from("form_responses")
        .select(`
            *,
            answers:form_response_answers(*)
        `)
        .eq("form_id", formId)
        .eq("user_id", userId)
        .single()

    if (error || !response) return null
    return response
}

// ============================================================
// REFERRAL LEADERBOARD
// ============================================================

export async function getFormReferralLeaderboard(formId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()

    const { data: responses, error } = await supabase
        .from("form_responses")
        .select("referrer_id")
        .eq("form_id", formId)
        .not("referrer_id", "is", null)

    if (error || !responses) return []

    const counts: Record<string, number> = {}
    for (const r of responses) {
        if (r.referrer_id) {
            counts[r.referrer_id] = (counts[r.referrer_id] || 0) + 1
        }
    }

    const systemIds = Object.keys(counts)
    if (systemIds.length === 0) return []

    const { data: users } = await supabase
        .schema("next_auth")
        .from("users")
        .select("name, system_id")
        .in("system_id", systemIds)

    const leaderboard = (users || []).map(u => ({
        name: u.name || "Unknown",
        system_id: u.system_id,
        count: counts[u.system_id] || 0
    })).sort((a, b) => b.count - a.count)

    return leaderboard
}

// ============================================================
// CSV EXPORT
// ============================================================

export async function exportFormResponsesToCSV(formId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const { fields, responses } = await getFormResponses(formId)

    // Build CSV header
    const questionFields = fields.filter((f: any) => f.type !== 'section')
    const headers = ["Name", "Email", "System ID", ...questionFields.map((f: any) => f.label), "Submitted At"]
    
    // Build rows
    const rows = responses.map((r: any) => {
        const row = [
            r.user?.name || "",
            r.user?.email || "",
            r.user?.system_id || "",
        ]
        for (const field of questionFields) {
            const answer = r.answers?.find((a: any) => a.field_id === field.id)
            let val = ""
            if (answer) {
                if (answer.answer_text) val = answer.answer_text
                if (answer.answer_json) val = Array.isArray(answer.answer_json) ? answer.answer_json.join(", ") : JSON.stringify(answer.answer_json)
            }
            // Escape quotes and wrap in quotes for CSV
            row.push(`"${val.replace(/"/g, '""')}"`)
        }
        // Explicit IST: the server runs in UTC
        row.push(r.created_at ? new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "")
        return row.join(",")
    })

    const csv = [headers.map(h => `"${h}"`).join(","), ...rows].join("\n")
    return csv
}

// ============================================================
// EMAIL BLAST TO RESPONDENTS
// ============================================================

export async function sendEmailToRespondents(
    formId: string, 
    subject: string, 
    body: string, 
    recipientType: 'all' | 'selective',
    selectedUserIds?: string[]
) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()

    // Get form title
    const { data: form } = await supabase.from("forms").select("title").eq("id", formId).single()
    if (!form) throw new Error("Form not found")

    // Get respondent user IDs
    let userIds: string[] = []

    if (recipientType === 'all') {
        const { data: responses } = await supabase
            .from("form_responses")
            .select("user_id")
            .eq("form_id", formId)
        userIds = (responses || []).map((r: any) => r.user_id)
    } else if (recipientType === 'selective' && selectedUserIds) {
        userIds = selectedUserIds
    }

    if (userIds.length === 0) {
        throw new Error("No recipients found")
    }

    // Get email addresses
    const { data: users } = await supabase
        .schema("next_auth")
        .from("users")
        .select("id, name, email")
        .in("id", userIds)

    if (!users || users.length === 0) {
        throw new Error("No valid email addresses found")
    }

    // Rate limit: 2 emails per second for Resend free tier
    const batchSize = 2
    let sentCount = 0
    let failedCount = 0

    for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize)
        
        const promises = batch.map(async (user: any) => {
            if (!user.email) return

            // Replace {{name}} placeholder in body
            const personalizedBody = body.replace(/\{\{name\}\}/g, user.name || 'Student')

            try {
                await sendEmailOrThrow(resend, {
                    from: 'Technova <noreply@technovashardauniversity.in>',
                    to: user.email,
                    subject: subject,
                    html: `
                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 16px; background-color: #09090b;">
                            <div style="max-width: 600px; margin: 0 auto; background-color: #18181b; border-radius: 24px; border: 1px solid #27272a; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
                                <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899); padding: 48px 32px; text-align: center;">
                                    <h1 style="color: #ffffff; font-size: 28px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">${subject}</h1>
                                    <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 15px; font-weight: 500;">Regarding: ${form.title}</p>
                                </div>
                                <div style="padding: 40px 32px;">
                                    <div style="font-size: 16px; line-height: 1.7; color: #d4d4d8; white-space: pre-wrap;">${personalizedBody}</div>
                                </div>
                                <div style="border-top: 1px solid #27272a; margin: 0;"></div>
                                <div style="padding: 32px; text-align: center; background-color: #09090b;">
                                    <p style="margin: 0; font-size: 11px; color: #52525b; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">
                                        Technova • Sharda University
                                    </p>
                                    <p style="color: #3f3f46; font-size: 11px; margin: 8px 0 0 0;">
                                        This email was sent to you because you responded to a Technova form.
                                    </p>
                                </div>
                            </div>
                        </div>
                    `
                })
                sentCount++
            } catch (err) {
                console.error(`Failed to send to ${user.email}:`, err)
                failedCount++
            }
        })

        await Promise.allSettled(promises)
        
        // Wait 1.1s between batches if there are more respondents to avoid rate limit
        if (i + batchSize < users.length) {
            await new Promise(resolve => setTimeout(resolve, 1100))
        }
    }

    return { success: true, sentCount, failedCount, totalRecipients: users.length }
}

// ============================================================
// CLEAR / DELETE RESPONSES
// ============================================================

export async function clearFormResponses(formId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = getSupabase()

    const { error } = await supabase
        .from("form_responses")
        .delete()
        .eq("form_id", formId)

    if (error) {
        console.error("Clear responses error:", error)
        throw new Error("Failed to clear responses")
    }

    revalidatePath(`/admin/forms/${formId}/responses`)
    return { success: true }
}

export async function deleteSelectedResponses(formId: string, responseIds: string[]) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }
    if (!responseIds.length) throw new Error("No responses selected")

    const supabase = getSupabase()

    const { error } = await supabase
        .from("form_responses")
        .delete()
        .in("id", responseIds)
        .eq("form_id", formId)

    if (error) {
        console.error("Delete selected responses error:", error)
        throw new Error("Failed to delete selected responses")
    }

    revalidatePath(`/admin/forms/${formId}/responses`)
    return { success: true, deletedCount: responseIds.length }
}
