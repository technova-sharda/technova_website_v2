import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createClient as createServerClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

function getSupabase() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function buildVolunteerQrEmailHtml(name: string, id: string, shift: string | null) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(id)}`
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0; padding:0; background-color:#1a1025; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1025; padding:40px 0;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color:#111; border-radius:16px; border:1px solid #3b0764; overflow:hidden;">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding:32px 40px; text-align:center;">
                                <h1 style="margin:0; color:#fff; font-size:24px; font-weight:800; letter-spacing:-0.5px;">
                                    🚀 CodeMania Hackathon
                                </h1>
                                <p style="margin:8px 0 0; color:rgba(255,255,255,0.85); font-size:14px;">
                                    By Technova Society • Volunteer QR Pass
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Body -->
                        <tr>
                            <td style="padding:40px;">
                                <p style="color:#e5e7eb; font-size:16px; margin:0 0 8px;">
                                    Hi <strong style="color:#fff;">${name}</strong>, Wecome aboard! 🎉
                                </p>
                                <p style="color:#9ca3af; font-size:14px; margin:0 0 24px; line-height:1.6;">
                                    We are absolutely thrilled to welcome you as a volunteer for the <strong>CodeMania Hackathon</strong>. Events like this are truly powered by the dedication, energy, and hard work of people like you.
                                </p>
                                <p style="color:#9ca3af; font-size:14px; margin:0 0 24px; line-height:1.6;">
                                    We wish you the very best as we work together to create an unforgettable experience for all the participants. Below is your personal <strong>Volunteer QR pass</strong>. Please keep this code ready during:
                                </p>
                                <p style="color:#e5e7eb; font-size:15px; margin:0 0 32px; line-height:1.4;">
                                    Best,<br/>
                                    <strong>Mohammad Sameer</strong><br/>
                                    <span style="color:#9ca3af; font-size:13px;">Technova President</span>
                                </p>
                                
                                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                                    <tr>
                                        <td style="padding:12px 16px; background:rgba(124,58,237,0.15); border-radius:12px; border:1px solid rgba(124,58,237,0.2);">
                                            <p style="margin:0; color:#c4b5fd; font-size:14px; font-weight:600;">✅ Volunteer Check-in & Meals</p>
                                        </td>
                                    </tr>
                                    ${shift ? `
                                    <tr>
                                        <td style="padding:12px 16px; margin-top:8px; display:block; background:rgba(79,70,229,0.15); border-radius:12px; border:1px solid rgba(79,70,229,0.2);">
                                            <p style="margin:0; color:#a5b4fc; font-size:14px; font-weight:600;">⏱ Assigned Shift: ${shift}</p>
                                        </td>
                                    </tr>` : ''}
                                </table>
                                
                                <!-- QR Codes List -->
                                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                                    <tr>
                                        <td align="center" style="padding:24px; background:#1a1a1a; border-radius:16px; border:1px solid #333;">
                                            <h3 style="margin:0 0 16px; color:#c4b5fd; font-size:18px;">Your Volunteer Pass</h3>
                                            <img src="${qrUrl}" alt="${name}'s QR Code" width="220" height="220" style="display:block; border-radius:8px; margin-bottom:12px;" />
                                            <p style="margin:0; color:#6b7280; font-size:11px; font-family:monospace; word-break:break-all;">
                                                ID: ${id}
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                                
                                <p style="color:#6b7280; font-size:12px; margin:24px 0 0; text-align:center; line-height:1.5;">
                                    💡 <strong style="color:#9ca3af;">Tip:</strong> Take a screenshot of your QR code for quick access on hackathon day.
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="padding:24px 40px; background:#0d0d0d; border-top:1px solid #222; text-align:center;">
                                <p style="margin:0; color:#4b5563; font-size:12px;">
                                    Technova — Technical Society, Sharda University
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>`
}

export async function POST(request: NextRequest) {
    const session = await auth()
    if (!session || !session.user || !['admin', 'super_admin', 'student_lead'].includes(session.user.role as string)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabase()
    
    // Check if this is a resend (force re-send even to already emailed)
    const { searchParams } = new URL(request.url)
    const isResend = searchParams.get('resend') === 'true'

    const { data: volunteers, error: volunteersError } = await supabase
        .from('hackathon_volunteers')
        .select(`id, name, email, shift, qr_emailed`)

    if (volunteersError || !volunteers) {
        console.error('[Volunteer QR Email] Failed to fetch volunteers:', volunteersError?.message)
        return NextResponse.json({ error: volunteersError?.message || "Failed to fetch volunteers" }, { status: 500 })
    }

    console.log(`[Volunteer QR Email] Found ${volunteers.length} total volunteers. Resend mode: ${isResend}`)

    let sent = 0
    let failed = 0
    let skipped = 0
    const errors: string[] = []

    for (const volunteer of volunteers) {
        // Skip already emailed volunteers unless resend is requested
        if (volunteer.qr_emailed && !isResend) {
            skipped++
            console.log(`[Volunteer QR Email] Skipped ${volunteer.name}: Already emailed`)
            continue
        }

        if (!volunteer.email || !volunteer.email.trim()) {
            failed++
            errors.push(`Volunteer "${volunteer.name}": No email found.`)
            console.log(`[Volunteer QR Email] Failed ${volunteer.name}: No email found.`)
            continue
        }

        const recipientEmail = volunteer.email.trim()
        const recipientName = volunteer.name || 'Volunteer'

        // Rate limit: ~1.5 req/sec for Resend
        if (sent > 0) {
            await delay(700)
        }

        let retries = 2
        while (retries > 0) {
            try {
                const html = buildVolunteerQrEmailHtml(recipientName, volunteer.id, volunteer.shift)

                const result = await resend.emails.send({
                    from: 'Technova <noreply@technovashardauniversity.in>',
                    to: recipientEmail,
                    subject: `🎟️ Your Volunteer QR Pass — CodeMania Hackathon`,
                    html
                })

                // Resend reports failures in the result instead of throwing
                if (result.error) throw new Error(result.error.message)
                console.log(`[Volunteer QR Email] ✅ Sent to ${recipientEmail} for Volunteer "${volunteer.name}". Resend ID: ${(result as any)?.data?.id || 'N/A'}`)

                // Mark volunteer as emailed
                await supabase.from('hackathon_volunteers').update({ qr_emailed: true }).eq('id', volunteer.id)

                sent++
                break
            } catch (err: any) {
                retries--
                if (err?.statusCode === 429 && retries > 0) {
                    console.log(`[Volunteer QR Email] Rate limited, waiting 2s...`)
                    await delay(2000)
                } else {
                    const errMsg = err?.message || err?.statusCode || 'unknown error'
                    console.error(`[Volunteer QR Email] ❌ Failed: ${recipientEmail} for Volunteer "${volunteer.name}":`, errMsg)
                    failed++
                    errors.push(`Volunteer "${volunteer.name}" (${recipientEmail}): ${errMsg}`)
                    break
                }
            }
        }
    }

    const summary = `✅ Sent ${sent} QR email(s).${failed > 0 ? ` ❌ ${failed} failed.` : ''}${skipped > 0 ? ` ⏭️ ${skipped} skipped.` : ''}`
    console.log(`[Volunteer QR Email] SUMMARY: ${summary}`)

    return NextResponse.json({
        success: true,
        sent,
        failed,
        skipped,
        errors: errors.slice(0, 10),
        message: summary
    })
}
