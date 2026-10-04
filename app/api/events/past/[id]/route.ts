import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { revalidateTag } from 'next/cache'
import { prepareImageUpload, IMMUTABLE_CACHE_CONTROL } from '@/lib/images/optimize'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Super admin only
    const session = await auth()
    if (!session || session.user.role !== 'super_admin') {
        return NextResponse.json({ error: 'Unauthorized - Super admin access required' }, { status: 401 })
    }

    const { id } = await params

    try {
        const formData = await req.formData()

        const title = formData.get('title') as string
        const club_id = formData.get('club_id') as string
        const event_date = formData.get('event_date') as string
        const attendance_count = parseInt(formData.get('attendance_count') as string)
        const description = formData.get('description') as string || null
        const bannerFile = formData.get('banner') as File | null
        const existingBanner = formData.get('existing_banner') as string | null

        // Validation
        if (!title || !club_id || !event_date || !attendance_count) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Handle banner - use existing if no new file uploaded
        let banner_url = existingBanner
        if (bannerFile && bannerFile.size > 0) {
            const upload = await prepareImageUpload(bannerFile)
            const fileName = `past-events/${Date.now()}-${upload.fileName}`
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('event-banners')
                .upload(fileName, upload.body, {
                    cacheControl: IMMUTABLE_CACHE_CONTROL,
                    contentType: upload.contentType,
                    upsert: false
                })

            if (uploadError) {
                console.error('Banner upload error:', uploadError)
                // Continue with existing banner if upload fails
            } else {
                const { data: { publicUrl } } = supabase.storage
                    .from('event-banners')
                    .getPublicUrl(fileName)
                banner_url = publicUrl
            }
        }

        // Update past event with simplified data
        const eventDate = new Date(event_date)
        const showOnClubPage = formData.get('show_on_club_page') === 'on'

        const isPaid = formData.get('is_paid') === 'true'
        const ticketPrice = isPaid ? parseFloat(formData.get('ticket_price') as string) : null

        const { data: event, error } = await supabase
            .from('events')
            .update({
                club_id,
                title,
                description,
                banner: banner_url,
                start_time: eventDate.toISOString(),
                end_time: eventDate.toISOString(),
                capacity: attendance_count,
                is_paid: isPaid,
                ticket_price: ticketPrice,
                show_on_club_page: showOnClubPage,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single()

        if (error) {
            console.error('Update past event error:', error)
            return NextResponse.json({ error: error.message || 'Failed to update past event' }, { status: 500 })
        }

        revalidateTag('public-events', { expire: 0 })

        return NextResponse.json({
            success: true,
            message: 'Past event updated successfully',
            event
        })

    } catch (error) {
        console.error('Past event API error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
