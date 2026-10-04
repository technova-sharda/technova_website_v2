'use server'

import { createClient as createServerClient } from "@supabase/supabase-js"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { FEEDBACK_XP_REWARD } from "@/lib/constants/feedback"

// ==========================================
// Helper - Get Supabase client
// ==========================================

async function getSupabase() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// ==========================================
// Types
// ==========================================

export interface FeedbackQuestion {
    id?: string
    question_type: 'text' | 'textarea' | 'rating' | 'select' | 'checkbox' | 'radio'
    label: string
    placeholder?: string
    options?: { value: string; label: string }[]
    is_required: boolean
    order_index: number
}

export interface FeedbackForm {
    id?: string
    event_id: string
    day_number?: number | null
    title: string
    description?: string
    release_mode: 'automatic' | 'manual'
    is_released?: boolean
    closes_at?: string | null
    auto_close_after_days?: number | null
    questions: FeedbackQuestion[]
}

export interface FeedbackFormWithMeta extends FeedbackForm {
    released_at?: string
    created_at?: string
    response_count?: number
}

export interface FeedbackAnalytics {
    averageRating: number | null
    responseRate: number
    totalResponses: number
    totalRegistrations: number
    ratingDistribution: {
        1: number
        2: number
        3: number
        4: number
        5: number
    }
}

// ==========================================
// Admin Actions
// ==========================================

/**
 * Create a new feedback form for an event
 */
export async function createFeedbackForm(formData: FeedbackForm) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    // 1. Create the form
    const { data: form, error: formError } = await supabase
        .from('event_feedback_forms')
        .insert({
            event_id: formData.event_id,
            day_number: formData.day_number || null,
            title: formData.title,
            description: formData.description || null,
            release_mode: formData.release_mode,
            auto_close_after_days: formData.auto_close_after_days || null,
            is_released: false
        })
        .select()
        .single()

    if (formError) {
        console.error("Create Form Error:", formError)
        throw new Error(formError.message || "Failed to create feedback form")
    }

    // 2. Create questions
    if (formData.questions && formData.questions.length > 0) {
        const questionsToInsert = formData.questions.map((q, index) => ({
            form_id: form.id,
            question_type: q.question_type,
            label: q.label,
            placeholder: q.placeholder || null,
            options: q.options || null,
            is_required: q.is_required,
            order_index: index
        }))

        const { error: questionsError } = await supabase
            .from('feedback_questions')
            .insert(questionsToInsert)

        if (questionsError) {
            console.error("Create Questions Error:", questionsError)
            // Rollback: delete the form
            await supabase.from('event_feedback_forms').delete().eq('id', form.id)
            throw new Error("Failed to create feedback questions")
        }
    }

    // 3. Enable feedback on event
    await supabase
        .from('events')
        .update({ feedback_enabled: true })
        .eq('id', formData.event_id)

    revalidatePath(`/admin/events/${formData.event_id}`)
    revalidatePath(`/events/${formData.event_id}`)

    return form
}

/**
 * Update an existing feedback form
 */
export async function updateFeedbackForm(formId: string, formData: Partial<FeedbackForm>) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    // 1. Update form details
    const { error: formError } = await supabase
        .from('event_feedback_forms')
        .update({
            title: formData.title,
            description: formData.description,
            release_mode: formData.release_mode,
            auto_close_after_days: formData.auto_close_after_days,
            closes_at: formData.closes_at,
            updated_at: new Date().toISOString()
        })
        .eq('id', formId)

    if (formError) {
        console.error("Update Form Error:", formError)
        throw new Error("Failed to update feedback form")
    }

    // 2. Update questions if provided
    if (formData.questions) {
        // Delete existing questions
        await supabase.from('feedback_questions').delete().eq('form_id', formId)

        // Insert new questions
        if (formData.questions.length > 0) {
            const questionsToInsert = formData.questions.map((q, index) => ({
                form_id: formId,
                question_type: q.question_type,
                label: q.label,
                placeholder: q.placeholder || null,
                options: q.options || null,
                is_required: q.is_required,
                order_index: index
            }))

            const { error: questionsError } = await supabase
                .from('feedback_questions')
                .insert(questionsToInsert)

            if (questionsError) {
                console.error("Update Questions Error:", questionsError)
                throw new Error("Failed to update feedback questions")
            }
        }
    }

    // Get event_id for revalidation
    const { data: form } = await supabase
        .from('event_feedback_forms')
        .select('event_id')
        .eq('id', formId)
        .single()

    if (form) {
        revalidatePath(`/admin/events/${form.event_id}`)
        revalidatePath(`/events/${form.event_id}`)
    }

    return { success: true }
}

/**
 * Delete a feedback form
 */
export async function deleteFeedbackForm(formId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    // Get event_id first for revalidation
    const { data: form } = await supabase
        .from('event_feedback_forms')
        .select('event_id')
        .eq('id', formId)
        .single()

    const { error } = await supabase
        .from('event_feedback_forms')
        .delete()
        .eq('id', formId)

    if (error) {
        console.error("Delete Form Error:", error)
        throw new Error("Failed to delete feedback form")
    }

    if (form) {
        // Check if any other forms exist for this event
        const { count } = await supabase
            .from('event_feedback_forms')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', form.event_id)

        // If no forms left, disable feedback on event
        if (count === 0) {
            await supabase
                .from('events')
                .update({ feedback_enabled: false })
                .eq('id', form.event_id)
        }

        revalidatePath(`/admin/events/${form.event_id}`)
        revalidatePath(`/events/${form.event_id}`)
    }

    return { success: true }
}

/**
 * Release a feedback form manually
 */
export async function releaseFeedbackForm(formId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    const { data: form, error } = await supabase
        .from('event_feedback_forms')
        .update({
            is_released: true,
            released_at: new Date().toISOString()
        })
        .eq('id', formId)
        .select('event_id')
        .single()

    if (error) {
        console.error("Release Form Error:", error)
        throw new Error("Failed to release feedback form")
    }

    revalidatePath(`/admin/events/${form.event_id}`)
    revalidatePath(`/events/${form.event_id}`)

    return { success: true }
}

/**
 * Close a feedback form
 */
export async function closeFeedbackForm(formId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    const { data: form, error } = await supabase
        .from('event_feedback_forms')
        .update({
            closes_at: new Date().toISOString()
        })
        .eq('id', formId)
        .select('event_id')
        .single()

    if (error) {
        console.error("Close Form Error:", error)
        throw new Error("Failed to close feedback form")
    }

    revalidatePath(`/admin/events/${form.event_id}`)
    revalidatePath(`/events/${form.event_id}`)

    return { success: true }
}

/**
 * Get all feedback forms for an event
 */
export async function getEventFeedbackForms(eventId: string): Promise<FeedbackFormWithMeta[]> {
    const supabase = await getSupabase()

    const { data: forms, error } = await supabase
        .from('event_feedback_forms')
        .select('*, questions:feedback_questions(*)')
        .eq('event_id', eventId)
        .order('day_number', { ascending: true, nullsFirst: true })

    if (error) {
        console.error("Get Forms Error:", error)
        return []
    }

    // Get response counts
    const formsWithCounts = await Promise.all(
        forms.map(async (form: any) => {
            const { count } = await supabase
                .from('feedback_responses')
                .select('*', { count: 'exact', head: true })
                .eq('form_id', form.id)

            return {
                ...form,
                questions: form.questions?.sort((a: any, b: any) => a.order_index - b.order_index) || [],
                response_count: count || 0
            }
        })
    )

    return formsWithCounts
}

/**
 * Get all responses for a feedback form (admin only)
 */
export async function getFeedbackResponses(formId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    // 1. Get responses
    const { data: responses, error } = await supabase
        .from('feedback_responses')
        .select('*')
        .eq('form_id', formId)
        .order('submitted_at', { ascending: false })

    if (error) {
        console.error("Get Responses Error:", error)
        return []
    }

    if (!responses || responses.length === 0) return []

    // 2. Get user IDs
    const userIds = responses.map(r => r.user_id)

    // 3. Get user details
    const { data: users } = await supabase
        .schema('next_auth')
        .from('users')
        .select('id, name, email, system_id, year, course, section')
        .in('id', userIds)

    // 4. Merge data
    const combined = responses.map(resp => {
        const user = users?.find(u => u.id === resp.user_id)
        return {
            ...resp,
            user: user || { name: 'Unknown', email: 'Unknown' }
        }
    })

    return combined
}

/**
 * Toggle requires_feedback_for_attendance on an event
 */
export async function toggleRequiresFeedback(eventId: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    // Get current value
    const { data: event } = await supabase
        .from('events')
        .select('requires_feedback_for_attendance')
        .eq('id', eventId)
        .single()

    if (!event) {
        throw new Error("Event not found")
    }

    const { error } = await supabase
        .from('events')
        .update({
            requires_feedback_for_attendance: !event.requires_feedback_for_attendance
        })
        .eq('id', eventId)

    if (error) {
        console.error("Toggle Requires Feedback Error:", error)
        throw new Error("Failed to update event")
    }

    revalidatePath(`/admin/events/${eventId}`)
    revalidatePath(`/events/${eventId}`)

    return { success: true, newValue: !event.requires_feedback_for_attendance }
}

// ==========================================
// Student Actions
// ==========================================

/**
 * Submit feedback response
 */
export async function submitFeedback(formId: string, answers: Record<string, any>): Promise<{ success: boolean; message?: string; error?: string; xpAwarded?: number; attendanceMarked?: boolean }> {
    try {
        const session = await auth()
        if (!session) {
            return { success: false, error: "Please log in to submit feedback" }
        }

        const supabase = await getSupabase()

        // 1. Verify form exists and is open
        const { data: form, error: formError } = await supabase
            .from('event_feedback_forms')
            .select('*, event:events(*)')
            .eq('id', formId)
            .single()

        if (formError || !form) {
            return { success: false, error: "Feedback form not found" }
        }

        // 2. Check if form is available
        const now = new Date()
        const eventEnded = new Date(form.event.end_time) < now
        const isAvailable = (form.release_mode === 'automatic' && eventEnded) ||
            (form.release_mode === 'manual' && form.is_released)
        const isClosed = form.closes_at && new Date(form.closes_at) < now

        if (!isAvailable) {
            return { success: false, error: "Feedback form is not yet available" }
        }

        if (isClosed) {
            return { success: false, error: "Feedback form has closed" }
        }

        // 3. Check for duplicate submission
        const { data: existing, error: existingError } = await supabase
            .from('feedback_responses')
            .select('id')
            .eq('form_id', formId)
            .eq('user_id', session.user.id)
            .maybeSingle()

        // Only block if we actually found an existing submission (not just a query error)
        if (existing && !existingError) {
            return { success: false, error: "You have already submitted feedback for this form" }
        }

        // 4. Check if user is registered for the event
        const { data: registration } = await supabase
            .from('registrations')
            .select('id, attended')
            .eq('event_id', form.event_id)
            .eq('user_id', session.user.id)
            .single()

        if (!registration) {
            return { success: false, error: "You must be registered for this event to submit feedback" }
        }

        // 5. Insert response
        const { data: insertedData, error: insertError } = await supabase
            .from('feedback_responses')
            .insert({
                form_id: formId,
                user_id: session.user.id,
                answers,
                xp_awarded: false
            })
            .select('id')
            .single()

        if (insertError) {
            console.error("[Feedback] Insert Error:", insertError.message, insertError.code, insertError.details)
            if (insertError.code === '23505') {
                return { success: false, error: "You have already submitted feedback for this form" }
            }
            return { success: false, error: `Failed to submit feedback: ${insertError.message}` }
        }


        // 6. Award XP
        let xpAwarded = 0
        try {
            const { awardXPForFeedback } = await import('@/lib/xp/feedback-award')
            const result = await awardXPForFeedback(session.user.id, formId, form.event_id)
            xpAwarded = result.xpAwarded

            // Mark XP as awarded
            await supabase
                .from('feedback_responses')
                .update({ xp_awarded: true })
                .eq('form_id', formId)
                .eq('user_id', session.user.id)
        } catch (xpError) {
            console.error("XP Award Error:", xpError)
            // Don't fail the submission if XP fails
        }

        // 7. For virtual events, mark attendance automatically
        let attendanceMarked = false
        if (form.event.is_virtual && !registration.attended) {
            const { error: attendError } = await supabase
                .from('registrations')
                .update({ attended: true })
                .eq('id', registration.id)

            if (!attendError) {
                attendanceMarked = true
                // Award XP for attendance as well (using daily XP distribution)
                // This is wrapped in try-catch because the daily_checkins table may not exist
                try {
                    const { awardDailyXP } = await import('@/lib/xp/award')
                    await awardDailyXP(session.user.id, form.event_id, {
                        event_type: form.event.event_type || 'workshop',
                        difficulty_level: form.event.difficulty_level || 'easy',
                        start_time: form.event.start_time,
                        end_time: form.event.end_time
                    })
                } catch (xpErr) {
                    // Silently log - don't fail feedback submission due to XP issues
                    console.error("Attendance XP Error (non-fatal):", xpErr instanceof Error ? xpErr.message : xpErr)
                }
            }
        }

        revalidatePath(`/events/${form.event_id}`)

        return {
            success: true,
            message: attendanceMarked
                ? 'Feedback submitted and attendance marked!'
                : 'Feedback submitted successfully!',
            xpAwarded,
            attendanceMarked
        }
    } catch (err) {
        console.error("Submit Feedback Unexpected Error:", err)
        return { success: false, error: "An unexpected error occurred. Please try again." }
    }
}

/**
 * Get user's feedback submission for a form
 */
export async function getMyFeedbackSubmission(formId: string) {
    const session = await auth()
    if (!session) return null

    const supabase = await getSupabase()

    const { data } = await supabase
        .from('feedback_responses')
        .select('*')
        .eq('form_id', formId)
        .eq('user_id', session.user.id)
        .maybeSingle()

    return data
}

/**
 * Check if feedback is available for an event
 */
export async function checkFeedbackAvailability(eventId: string) {
    const supabase = await getSupabase()

    // Get event and forms
    const { data: event } = await supabase
        .from('events')
        .select('end_time, feedback_enabled')
        .eq('id', eventId)
        .single()

    if (!event || !event.feedback_enabled) {
        return { available: false, status: 'disabled' }
    }

    const { data: forms } = await supabase
        .from('event_feedback_forms')
        .select('id, title, day_number, release_mode, is_released, closes_at')
        .eq('event_id', eventId)
        .order('day_number', { ascending: true, nullsFirst: true })

    if (!forms || forms.length === 0) {
        return { available: false, status: 'no_forms' }
    }

    const now = new Date()
    const eventEnded = new Date(event.end_time) < now

    // Check each form's availability
    const availableForms = forms.map(form => {
        const isAvailable = (form.release_mode === 'automatic' && eventEnded) ||
            (form.release_mode === 'manual' && form.is_released)
        const isClosed = form.closes_at && new Date(form.closes_at) < now

        return {
            ...form,
            isAvailable: isAvailable && !isClosed,
            isClosed
        }
    })

    const hasAvailableForms = availableForms.some(f => f.isAvailable)

    return {
        available: hasAvailableForms,
        status: hasAvailableForms ? 'open' : (eventEnded ? 'closed' : 'not_released'),
        forms: availableForms
    }
}

/**
 * Check if user has submitted feedback for any form (used for attendance check)
 */
export async function hasSubmittedEventFeedback(userId: string, eventId: string): Promise<boolean> {
    const supabase = await getSupabase()

    // Get all form IDs for this event
    const { data: forms } = await supabase
        .from('event_feedback_forms')
        .select('id')
        .eq('event_id', eventId)

    if (!forms || forms.length === 0) return true // No feedback required if no forms

    const formIds = forms.map(f => f.id)

    // Check if user has submitted to any form
    const { count } = await supabase
        .from('feedback_responses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('form_id', formIds)

    return (count || 0) > 0
}

// ==========================================
// Analytics Actions
// ==========================================

/**
 * Get feedback analytics for an event (admin only)
 */
export async function getFeedbackAnalytics(eventId: string): Promise<FeedbackAnalytics> {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    // Get total registrations for the event
    const { count: totalRegistrations } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)

    // Get all forms for this event
    const { data: forms } = await supabase
        .from('event_feedback_forms')
        .select('id')
        .eq('event_id', eventId)

    if (!forms || forms.length === 0) {
        return {
            averageRating: null,
            responseRate: 0,
            totalResponses: 0,
            totalRegistrations: totalRegistrations || 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        }
    }

    const formIds = forms.map(f => f.id)

    // Get all responses for this event's forms
    const { data: responses, count: totalResponses } = await supabase
        .from('feedback_responses')
        .select('answers', { count: 'exact' })
        .in('form_id', formIds)

    // Get all rating questions for these forms
    const { data: ratingQuestions } = await supabase
        .from('feedback_questions')
        .select('id, form_id')
        .in('form_id', formIds)
        .eq('question_type', 'rating')

    // Calculate rating distribution and average
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let totalRatingSum = 0
    let totalRatingCount = 0

    if (responses && ratingQuestions) {
        const ratingQuestionIds = ratingQuestions.map(q => q.id)

        for (const response of responses) {
            const answers = response.answers as Record<string, any>
            for (const qId of ratingQuestionIds) {
                const rating = answers[qId]
                if (rating && typeof rating === 'number' && rating >= 1 && rating <= 5) {
                    ratingDistribution[rating as 1 | 2 | 3 | 4 | 5]++
                    totalRatingSum += rating
                    totalRatingCount++
                }
            }
        }
    }

    const averageRating = totalRatingCount > 0
        ? Math.round((totalRatingSum / totalRatingCount) * 10) / 10
        : null

    const responseRate = totalRegistrations
        ? Math.round(((totalResponses || 0) / totalRegistrations) * 100)
        : 0

    return {
        averageRating,
        responseRate,
        totalResponses: totalResponses || 0,
        totalRegistrations: totalRegistrations || 0,
        ratingDistribution
    }
}
