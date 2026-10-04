'use server'

import { createClient as createServerClient } from "@supabase/supabase-js"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { revalidatePath, revalidateTag } from "next/cache"
import { generateEventSlug } from "@/lib/utils/slugify"
import { parseDateTimeLocal } from "@/lib/utils"
import { prepareImageUpload, IMMUTABLE_CACHE_CONTROL } from "@/lib/images/optimize"
import { getCachedEventDetail } from "@/lib/data/event-detail-cache"

// Helper to get authenticated client or admin client
async function getSupabase() {
    // Ideally use createServerClient from @supabase/ssr with cookies
    // For this prototype, we rely on the Service Role for writes to ensure it works without complex RLS setup debugging
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function createEvent(formData: FormData) {
    const session = await auth()
    if (!session || session.user.role === 'student') {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    const title = formData.get("title") as string
    const description = formData.get("description") as string
    const venue = formData.get("venue") as string
    const capacity = parseInt(formData.get("capacity") as string)
    const price = parseFloat(formData.get("price") as string)
    const status = formData.get("status") as string || 'draft'
    const bannerFile = formData.get("banner_file") as File
    let banner = formData.get("banner") as string

    if (bannerFile && bannerFile.size > 0) {
        const upload = await prepareImageUpload(bannerFile)
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('events')
            .upload(`${Date.now()}-${upload.fileName}`, upload.body, {
                upsert: true,
                contentType: upload.contentType,
                cacheControl: IMMUTABLE_CACHE_CONTROL
            })

        if (uploadError) {
            console.error("Upload Error:", uploadError)
        } else {
            const { data: { publicUrl } } = supabase.storage.from('events').getPublicUrl(uploadData.path)
            banner = publicUrl
        }
    }

    const co_host_club_id = formData.get("co_host_club_id") as string || null
    const registration_fields = formData.get("registration_fields") as string || "[]"
    const is_virtual = formData.get("is_virtual") === "true"
    const meeting_link = formData.get("meeting_link") as string || null
    const banner_position = formData.get("banner_position") as string || "center"
    const event_type = formData.get("event_type") as string || "workshop"
    const difficulty_level = formData.get("difficulty_level") as string || "easy"
    let club_id = formData.get("club_id") as string || null
    const poc_name = formData.get("poc_name") as string || null


    // Multi-day scheduling
    const is_multi_day = formData.get("is_multi_day") === "true"
    let start_time: string
    let end_time: string
    let daily_start_time: string | null = null
    let daily_end_time: string | null = null
    let excluded_dates: string[] = []

    if (is_multi_day) {
        const start_date = formData.get("start_date") as string
        const end_date = formData.get("end_date") as string
        daily_start_time = formData.get("daily_start_time") as string
        daily_end_time = formData.get("daily_end_time") as string

        // Parse excluded dates (holidays)
        const excludedDatesStr = formData.get("excluded_dates") as string
        try {
            excluded_dates = excludedDatesStr ? JSON.parse(excludedDatesStr) : []
        } catch {
            excluded_dates = []
        }

        // Combine date + time for start_time and end_time
        start_time = parseDateTimeLocal(`${start_date}T${daily_start_time}`)
        end_time = parseDateTimeLocal(`${end_date}T${daily_end_time}`)
    } else {
        start_time = parseDateTimeLocal(formData.get("start_time") as string)
        end_time = parseDateTimeLocal(formData.get("end_time") as string)
    }

    // If no club selected, try to find one or create default
    if (!club_id) {
        const { data: clubs } = await supabase.from('clubs').select('id').order('name', { ascending: true }).limit(1)
        if (clubs && clubs.length > 0) {
            club_id = clubs[0].id
        } else {
            const { data: newClub } = await supabase.from('clubs').insert({
                name: "Technova Main",
                description: "Central Society"
            }).select().single()
            club_id = newClub.id
        }
    }

    // 2. Create Event
    const { data: newEvent, error } = await supabase.from('events').insert({
        club_id,
        title,
        description,
        start_time,
        end_time,
        venue,
        capacity,
        price,
        status,
        banner,
        co_host_club_id: co_host_club_id === 'none' ? null : co_host_club_id,
        updated_at: new Date().toISOString(),
        registration_fields: JSON.parse(registration_fields),
        is_virtual,
        meeting_link,
        banner_position,
        is_multi_day,
        daily_start_time,
        daily_end_time,
        event_type,
        difficulty_level,
        poc_name,
        excluded_dates
    }).select('id').single()

    if (error || !newEvent) {
        console.error("Create Event Error:", error)
        throw new Error("Failed to create event")
    }

    // Generate and update slug after insert (needs the ID for uniqueness)
    const slug = generateEventSlug(title, newEvent.id)
    await supabase.from('events').update({ slug }).eq('id', newEvent.id)

    revalidatePath("/events")
    revalidateTag("public-events", { expire: 0 })
    revalidatePath("/admin/events")

    return { success: true, message: "Event created successfully!", eventId: newEvent.id, slug }
}

export async function updateEvent(formData: FormData) {
    const session = await auth()
    if (!session || session.user.role === 'student') {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()
    const id = formData.get("id") as string

    if (!id) throw new Error("Event ID is required")

    const title = formData.get("title") as string
    const description = formData.get("description") as string
    const venue = formData.get("venue") as string
    const capacity = parseInt(formData.get("capacity") as string)
    const price = parseFloat(formData.get("price") as string)
    const status = formData.get("status") as string
    const bannerFile = formData.get("banner_file") as File
    let banner = formData.get("banner") as string

    if (bannerFile && bannerFile.size > 0) {
        const upload = await prepareImageUpload(bannerFile)
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('events')
            .upload(`${Date.now()}-${upload.fileName}`, upload.body, {
                upsert: true,
                contentType: upload.contentType,
                cacheControl: IMMUTABLE_CACHE_CONTROL
            })

        if (uploadError) {
            console.error("Upload Error:", uploadError)
        } else {
            const { data: { publicUrl } } = supabase.storage.from('events').getPublicUrl(uploadData.path)
            banner = publicUrl
        }
    }

    const club_id = formData.get("club_id") as string
    const co_host_club_id = formData.get("co_host_club_id") as string || null
    const registration_fields = formData.get("registration_fields") as string || "[]"
    const is_virtual = formData.get("is_virtual") === "true"
    const meeting_link = formData.get("meeting_link") as string || null
    const banner_position = formData.get("banner_position") as string || "center"
    const event_type = formData.get("event_type") as string || "workshop"
    const difficulty_level = formData.get("difficulty_level") as string || "easy"
    const poc_name = formData.get("poc_name") as string || null

    // Multi-day scheduling
    const is_multi_day = formData.get("is_multi_day") === "true"
    let start_time: string
    let end_time: string
    let daily_start_time: string | null = null
    let daily_end_time: string | null = null
    let excluded_dates: string[] = []

    if (is_multi_day) {
        const start_date = formData.get("start_date") as string
        const end_date = formData.get("end_date") as string
        daily_start_time = formData.get("daily_start_time") as string
        daily_end_time = formData.get("daily_end_time") as string

        // Parse excluded dates (holidays)
        const excludedDatesStr = formData.get("excluded_dates") as string
        try {
            excluded_dates = excludedDatesStr ? JSON.parse(excludedDatesStr) : []
        } catch {
            excluded_dates = []
        }

        // Combine date + time for start_time and end_time
        start_time = parseDateTimeLocal(`${start_date}T${daily_start_time}`)
        end_time = parseDateTimeLocal(`${end_date}T${daily_end_time}`)
    } else {
        start_time = parseDateTimeLocal(formData.get("start_time") as string)
        end_time = parseDateTimeLocal(formData.get("end_time") as string)
    }

    const { error } = await supabase.from('events').update({
        club_id,
        title,
        description,
        start_time,
        end_time,
        venue,
        capacity,
        price,
        status,
        banner,
        banner_position,
        slug: generateEventSlug(title, id), // Regenerate slug on title change
        co_host_club_id: co_host_club_id === 'none' ? null : co_host_club_id,
        updated_at: new Date().toISOString(),
        registration_fields,
        is_virtual,
        meeting_link,
        is_multi_day,
        daily_start_time,
        daily_end_time,
        event_type,
        difficulty_level,
        poc_name,
        excluded_dates
    }).eq('id', id)

    if (error) {
        console.error("Update Event Error:", error)
        throw new Error("Failed to update event")
    }

    const slug = generateEventSlug(title, id)
    revalidatePath("/events")
    revalidateTag("public-events", { expire: 0 })
    revalidatePath("/admin/events")
    revalidatePath(`/events/${id}`)
    revalidatePath(`/events/${slug}`)

    return { success: true, message: "Event updated successfully!", slug }
}

export async function deleteEvent(id: string) {
    const session = await auth()
    if (!session || session.user.role === 'student') {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()
    const { error } = await supabase.from('events').delete().eq('id', id)

    if (error) {
        console.error("Delete Event Error:", error)
        throw new Error("Failed to delete event")
    }

    revalidatePath("/events")
    revalidateTag("public-events", { expire: 0 })
    revalidatePath("/admin/events")
}

export async function togglePastEvent(eventId: string) {
    const session = await auth()
    if (!session || session.user.role === 'student') {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    // First verify the event exists
    const { data: event, error: fetchError } = await supabase
        .from('events')
        .select('id, end_time, is_past_event')
        .eq('id', eventId)
        .single()

    if (fetchError || !event) {
        console.error("Fetch Event Error:", fetchError)
        throw new Error("Event not found")
    }

    const now = new Date()
    const endTime = new Date(event.end_time)

    // Only allow adding to past events if the event has ended
    // But always allow removing from past events
    if (endTime > now && !event.is_past_event) {
        throw new Error("Cannot mark an ongoing or future event as past")
    }

    // Toggle the is_past_event flag
    const newValue = !event.is_past_event

    const { error } = await supabase.from('events')
        .update({
            is_past_event: newValue,
            updated_at: new Date().toISOString()
        })
        .eq('id', eventId)

    if (error) {
        console.error("Toggle Past Event Error:", error)
        throw new Error("Failed to update event")
    }

    revalidatePath("/events")
    revalidateTag("public-events", { expire: 0 })
    revalidatePath("/admin/events")
    revalidatePath(`/events/${eventId}`)
    revalidatePath(`/admin/events/${eventId}`)

    return { success: true, isPastEvent: newValue }
}

/**
 * Admin "Stop registrations" / "Reopen registrations" switch.
 * Existing registrations are untouched; only new sign-ups are refused.
 */
export async function setRegistrationsClosed(eventId: string, closed: boolean) {
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized")
    }

    const supabase = await getSupabase()

    const { data: event, error } = await supabase.from('events')
        .update({
            registrations_closed: closed,
            updated_at: new Date().toISOString()
        })
        .eq('id', eventId)
        .select('id, slug, registrations_closed')
        .maybeSingle()

    if (error || !event) {
        console.error("Set Registrations Closed Error:", error)
        throw new Error("Failed to update registrations")
    }

    revalidatePath("/events")
    revalidateTag("public-events", { expire: 0 })
    revalidatePath("/admin/events")
    revalidatePath("/events/[id]", "page")  // public event pages are addressed by slug or id
    revalidatePath(`/admin/events/${eventId}`)

    return { success: true, registrationsClosed: event.registrations_closed as boolean }
}

export async function getPublicEvents() {
    const supabase = await getSupabase()
    // Include both live events AND past events (status='completed' or is_past_event=true)
    // Only the columns the public events page renders. `*` sent every column
    // (including online meeting links) to every visitor.
    const { data, error } = await supabase.from('events')
        .select(`
            id, slug, title, banner, banner_position, price, is_virtual, venue,
            is_multi_day, start_time, end_time, is_past_event, status, created_at,
            club:clubs!events_club_id_fkey(name, logo_url)
        `)
        .in('status', ['live', 'completed']) // Include both live and completed events
        .order('created_at', { ascending: false })

    return data || []
}

export async function getEvents() {
    const supabase = await getSupabase()
    const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false })
    return data || []
}

/** Online meeting links go only to admins and to students registered for the event. */
async function canSeeMeetingLink(supabase: Awaited<ReturnType<typeof getSupabase>>, eventId: string): Promise<boolean> {
    const session = await auth()
    if (!session?.user?.id) return false
    if (['admin', 'super_admin'].includes(session.user.role)) return true
    const { data } = await supabase
        .from('registrations')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', session.user.id)
        .maybeSingle()
    return !!data
}

export async function getEventById(id: string) {
    const supabase = await getSupabase()

    // Fetch event with club
    const { data: event, error } = await supabase.from('events')
        .select(`
            *,
            club:clubs!events_club_id_fkey(name, logo_url)
        `)
        .eq('id', id)
        .single()

    if (error || !event) return null

    // Fetch registration count separately (more reliable than count in select sometimes with foreign keys)
    const { count } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', id)

    // Fetch POC details if available
    let pocDetails = null
    if (event.poc_name && event.club_id) {
        const { data: member } = await supabase
            .from('club_members')
            .select('email, phone, role')
            .eq('club_id', event.club_id)
            .eq('name', event.poc_name)
            .single()

        if (member) {
            pocDetails = member
        }
    }

    const meeting_link = event.meeting_link && await canSeeMeetingLink(supabase, event.id)
        ? event.meeting_link
        : null

    return {
        ...event,
        meeting_link,
        registered_count: count || 0,
        poc_email: pocDetails?.email || null,
        poc_phone: pocDetails?.phone || null,
        poc_role: pocDetails?.role || null
    }
}

/**
 * Get event by slug or ID (for backwards compatibility)
 * Tries slug first, then falls back to UUID lookup
 */
export async function getEventBySlugOrId(slugOrId: string) {
    // Shared event data comes from a 30-second cache; only the meeting-link check is per student.
    const cached = await getCachedEventDetail(slugOrId)
    if (!cached) return null
    const { event, registeredCount, poc } = cached

    const supabase = await getSupabase()
    const meeting_link = event.meeting_link && await canSeeMeetingLink(supabase, event.id)
        ? event.meeting_link
        : null

    return {
        ...event,
        meeting_link,
        registered_count: registeredCount,
        poc_email: poc?.email || null,
        poc_phone: poc?.phone || null,
        poc_role: poc?.role || null
    }
}

