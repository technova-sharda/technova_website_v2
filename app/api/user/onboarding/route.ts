import { auth } from "@/lib/auth"
import { createClient as createServerClient } from "@supabase/supabase-js"
import { z } from "zod"

// Input validation schema
const onboardingSchema = z.object({
    system_id: z.string()
        .min(5, "System ID must be at least 5 characters")
        .max(20, "System ID must be at most 20 characters")
        .regex(/^[a-zA-Z0-9_-]+$/, "System ID can only contain letters, numbers, underscores, and hyphens"),
    year: z.number()
        .int()
        .min(1, "Year must be between 1-4")
        .max(4, "Year must be between 1-4"),
    course: z.string()
        .min(2, "Course must be at least 2 characters")
        .max(50, "Course must be at most 50 characters"),
    section: z.string()
        .min(1, "Section is required")
        .max(10, "Section must be at most 10 characters"),
    mobile: z.string()
        .regex(/^[0-9]{10}$/, "Mobile number must be exactly 10 digits")
        .optional()
        .nullable(),
    skills: z.array(z.string().max(50))
        .max(20, "Maximum 20 skills allowed")
        .optional(),
})

const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'next_auth' } }
)

const supabasePublic = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
    const session = await auth()

    if (!session || !session.user?.id) {
        return new Response("Unauthorized", { status: 401 })
    }

    // Rate limiting: 5 onboarding attempts per minute per user
    const { checkRateLimit, getClientIdentifier } = await import('@/lib/rate-limit')
    const rateLimit = checkRateLimit(
        getClientIdentifier(req, session.user.id),
        { limit: 5, windowSeconds: 60, bucket: 'onboarding' }
    )
    if (!rateLimit.success) {
        return new Response("Too many requests. Please try again later.", { status: 429 })
    }

    // Parse and validate input with Zod
    let validatedData
    try {
        const body = await req.json()
        validatedData = onboardingSchema.parse(body)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return new Response(JSON.stringify({ errors: error.issues }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }
        return new Response("Invalid request body", { status: 400 })
    }

    const { system_id, year, course, section, mobile, skills } = validatedData

    // Check uniqueness of system_id
    const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("system_id", system_id)
        .maybeSingle()

    if (existing && existing.id !== session.user.id) {
        return new Response("System ID already in use", { status: 409 })
    }

    // Update user in next_auth.users
    const { error: userError } = await supabase
        .from("users")
        .update({
            system_id,
            year,
            course,
            section,
            mobile: mobile || null
        })
        .eq("id", session.user.id)

    if (userError) {
        console.error("User Update Error:", userError)
        return new Response("Database error", { status: 500 })
    }

    // Handle skills - update or insert into public.profiles
    if (skills && Array.isArray(skills) && skills.length > 0) {
        const { data: profile } = await supabasePublic
            .from("profiles")
            .select("id")
            .eq("id", session.user.id)
            .maybeSingle()

        if (!profile) {
            // Insert new profile
            const { error: insertError } = await supabasePublic
                .from("profiles")
                .insert({
                    id: session.user.id,
                    skills: skills
                })

            if (insertError) {
                console.error("Profile Insert Error:", insertError)
            }
        } else {
            // Update existing profile
            const { error: updateError } = await supabasePublic
                .from("profiles")
                .update({ skills: skills })
                .eq("id", session.user.id)

            if (updateError) {
                console.error("Profile Update Error:", updateError)
            }
        }
    }

    return new Response("OK", { status: 200 })
}
