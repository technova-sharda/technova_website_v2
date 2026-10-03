import { NextRequest } from 'next/server'
import { createClient } from "@supabase/supabase-js"
import { auth } from "@/lib/auth"
import JSZip from 'jszip'
import { generateCertificateWithTemplate, generatePositionCertificate } from '@/lib/certificates/generate'
import { getSignedCertificateUrl } from '@/lib/certificates/storage'
import { formatDateShort } from '@/lib/utils'
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Rate limit: 2 bulk downloads per minute (more restrictive for heavy operation)
const RATE_LIMIT_CONFIG = { limit: 2, windowSeconds: 60, bucket: 'certificate-bulk' }

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
    // Auth check FIRST (before rate limit to avoid unnecessary tracking)
    const session = await auth()
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, session.user.id)
    const rateLimitResult = checkRateLimit(clientId, RATE_LIMIT_CONFIG)

    if (!rateLimitResult.success) {
        return Response.json(
            { error: 'Rate limit exceeded. Please wait before downloading again.' },
            { status: 429 }
        )
    }

    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get('eventId')

    // Validate eventId format to prevent injection
    if (!eventId || !UUID_REGEX.test(eventId)) {
        return Response.json({ error: 'Invalid Event ID format' }, { status: 400 })
    }

    try {
        // Get event details
        const { data: event } = await supabase
            .from('events')
            .select('title, start_time, club_id, club:clubs!events_club_id_fkey(name)')
            .eq('id', eventId)
            .single()

        if (!event) {
            return Response.json({ error: 'Event not found' }, { status: 404 })
        }

        const clubData = event.club as { name: string }[] | { name: string } | null
        const clubName = Array.isArray(clubData) ? clubData[0]?.name : clubData?.name

        // Get template
        const { data: template } = await supabase
            .from('certificate_templates')
            .select('*')
            .eq('event_id', eventId)
            .single()

        // Template bucket is private; sign the URL for the generator
        const templateUrl = template?.template_url ? await getSignedCertificateUrl(template.template_url, 300) : null

        // Get all certificates for this event
        const { data: certificates, error: certError } = await supabase
            .from('certificates')
            .select('id, certificate_id, user_id, certificate_type, role_title, position_id, file_url, qr_region')
            .eq('event_id', eventId)
            .eq('status', 'valid')

        if (certError || !certificates || certificates.length === 0) {
            return Response.json({ error: 'No certificates found' }, { status: 404 })
        }

        // QR placement per position for ready-made certificates
        const { data: positions } = await supabase
            .from('certificate_positions')
            .select('id, qr_region')
            .eq('event_id', eventId)
        const positionQr = new Map((positions || []).map(p => [p.id, p.qr_region]))

        // Get user details
        const userIds = certificates.map(c => c.user_id)
        const { data: users } = await supabase
            .schema('next_auth')
            .from('users')
            .select('id, name, email')
            .in('id', userIds)

        const userMap = new Map(users?.map(u => [u.id, u]) || [])

        // Create ZIP
        const zip = new JSZip()
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.technovashardauniversity.in'

        // Generate each certificate and add to ZIP
        for (const cert of certificates) {
            const user = userMap.get(cert.user_id)
            if (!user) continue

            try {
                const pdfBytes = cert.position_id && cert.file_url
                    ? await generatePositionCertificate(
                        cert.file_url,
                        cert.qr_region || positionQr.get(cert.position_id),
                        cert.certificate_id,
                        baseUrl
                    )
                    : await generateCertificateWithTemplate(
                    templateUrl,
                    template?.qr_region || null,
                    template?.text_regions || [],
                    {
                        participantName: user.name || 'Participant',
                        eventName: event.title || 'Event',
                        eventDate: formatDateShort(event.start_time || new Date().toISOString()),
                        certificateId: cert.certificate_id,
                        organizerName: clubName || 'Technova',
                        roleTitle: cert.role_title || undefined
                    },
                    baseUrl
                )

                // Sanitize filename; position certificates get their own folder
                const safeName = (user.name || 'participant').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
                const folder = cert.role_title && cert.position_id
                    ? `${cert.role_title.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Positions'}/`
                    : ''
                const fileName = `${folder}${safeName}_${cert.certificate_id}.pdf`

                zip.file(fileName, pdfBytes)
            } catch (genError) {
                console.error(`Error generating certificate ${cert.certificate_id}:`, genError)
                // Continue with other certificates
            }
        }

        // Generate ZIP as ArrayBuffer
        const zipBuffer = await zip.generateAsync({
            type: 'arraybuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        })

        // Safe event name for filename
        const safeEventName = (event.title || 'event').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40)
        const zipFileName = `certificates_${safeEventName}_${new Date().toISOString().split('T')[0]}.zip`

        return new Response(zipBuffer, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${zipFileName}"`,
                'Content-Length': zipBuffer.byteLength.toString()
            }
        })

    } catch (error) {
        console.error('Bulk download error:', error)
        return Response.json({ error: 'Failed to generate certificates' }, { status: 500 })
    }
}
