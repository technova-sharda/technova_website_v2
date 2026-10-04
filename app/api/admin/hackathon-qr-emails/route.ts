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

function buildTeamQrEmailHtml(teamName: string, leaderName: string, members: { name: string, id: string }[]) {
    const qrBlocks = members.map(m => {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(m.id)}`
        return `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
                <td align="center" style="padding:24px; background:#1a1a1a; border-radius:16px; border:1px solid #333;">
                    <h3 style="margin:0 0 16px; color:#fff; font-size:18px;">${m.name}'s QR Code</h3>
                    <img src="${qrUrl}" alt="${m.name}'s QR Code" width="220" height="220" style="display:block; border-radius:8px; margin-bottom:12px;" />
                    <p style="margin:0; color:#6b7280; font-size:11px; font-family:monospace; word-break:break-all;">
                        ID: ${m.id}
                    </p>
                </td>
            </tr>
        </table>
        `
    }).join('')

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0; padding:0; background-color:#0a0a0a; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a; padding:40px 0;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color:#111; border-radius:16px; border:1px solid #222; overflow:hidden;">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #059669, #0d9488); padding:32px 40px; text-align:center;">
                                <h1 style="margin:0; color:#fff; font-size:24px; font-weight:800; letter-spacing:-0.5px;">
                                    CodeMania Hackathon
                                </h1>
                                <p style="margin:8px 0 0; color:rgba(255,255,255,0.85); font-size:14px;">
                                    By Technova Society • Team QR Codes
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Body -->
                        <tr>
                            <td style="padding:40px;">
                                <p style="color:#e5e7eb; font-size:16px; margin:0 0 8px;">
                                    Hi <strong style="color:#fff;">${leaderName}</strong>,
                                </p>
                                <p style="color:#9ca3af; font-size:14px; margin:0 0 32px; line-height:1.6;">
                                    Welcome to the CodeMania Hackathon! Below are the personal QR codes for everyone in <strong style="color:#fff;">Team ${teamName}</strong>. 
                                    As the team lead, please ensure your members have their respective QR codes ready during:
                                </p>
                                
                                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                                    <tr>
                                        <td style="padding:12px 16px; background:rgba(5,150,105,0.15); border-radius:12px 12px 0 0; border:1px solid rgba(5,150,105,0.2); border-bottom:none;">
                                            <p style="margin:0; color:#34d399; font-size:14px; font-weight:600;">Registration Check-in</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:12px 16px; background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.2); border-bottom:none;">
                                            <p style="margin:0; color:#fbbf24; font-size:14px; font-weight:600;">Meal Distribution (Lunch, Dinner, Snacks)</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:12px 16px; background:rgba(59,130,246,0.15); border-radius:0 0 12px 12px; border:1px solid rgba(59,130,246,0.2);">
                                            <p style="margin:0; color:#60a5fa; font-size:14px; font-weight:600;">Any logistics verification</p>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- QR Codes List -->
                                ${qrBlocks}
                                
                                <p style="color:#6b7280; font-size:12px; margin:24px 0 0; text-align:center; line-height:1.5;">
                                    <strong style="color:#9ca3af;">Tip:</strong> You can forward this email to your teammates or have them screenshot their individual QR codes for quick access on hackathon day.
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
    
    // Check if this is a resend (force re-send even to already emailed teams)
    const { searchParams } = new URL(request.url)
    const isResend = searchParams.get('resend') === 'true'

    let bodyTeamIds: string[] = []
    try {
        const body = await request.json()
        if (body && Array.isArray(body.teamIds)) {
            bodyTeamIds = body.teamIds
        }
    } catch (e) {
        // no body or invalid json, ignore
    }

    let query = supabase
        .from('hackathon_teams')
        .select(`
            id, name, status, qr_emailed,
            hackathon_participants (id, name, email, role)
        `)

    if (bodyTeamIds.length > 0) {
        query = query.in('id', bodyTeamIds)
    }

    const { data: teams, error: teamsError } = await query

    if (teamsError || !teams) {
        console.error('[QR Email] Failed to fetch teams:', teamsError?.message)
        return NextResponse.json({ error: teamsError?.message || "Failed to fetch teams" }, { status: 500 })
    }

    console.log(`[QR Email] Found ${teams.length} total teams. Resend mode: ${isResend}`)

    let sent = 0
    let failed = 0
    let skipped = 0
    const errors: string[] = []

    for (const team of teams) {
        const participants = (team as any).hackathon_participants || []
        
        // Skip teams with no participants
        if (participants.length === 0) {
            skipped++
            console.log(`[QR Email] Skipped ${team.name}: No participants`)
            continue
        }

        // Skip already emailed teams unless resend is requested
        if ((team as any).qr_emailed && !isResend) {
            skipped++
            console.log(`[QR Email] Skipped ${team.name}: Already emailed (use resend to force)`)
            continue
        }

        // Find the email to send to (prefer leader, then any member with email)
        const leader = participants.find((p: any) => p.role?.toLowerCase() === 'leader' && p.email && p.email.trim() !== '')
            || participants.find((p: any) => p.email && p.email.trim() !== '')

        if (!leader || !leader.email || !leader.email.trim()) {
            failed++
            errors.push(`Team "${team.name}": No valid email found for any member.`)
            console.log(`[QR Email] Failed ${team.name}: No email found. Participants: ${JSON.stringify(participants.map((p: any) => ({ name: p.name, email: p.email })))}`)
            continue
        }

        const recipientEmail = leader.email.trim()
        const recipientName = leader.name || 'Team Lead'

        // Build the member list for QR generation
        const qrMembers = participants.map((p: any) => ({
            name: p.name || 'Participant',
            id: p.id
        }))

        // Rate limit: ~1.5 req/sec for Resend
        if (sent > 0) {
            await delay(700)
        }

        let retries = 2
        while (retries > 0) {
            try {
                const html = buildTeamQrEmailHtml(team.name, recipientName, qrMembers)

                const result = await resend.emails.send({
                    from: 'Technova <noreply@technovashardauniversity.in>',
                    to: recipientEmail,
                    subject: `Your Team's Hackathon QR Codes — Team ${team.name}`,
                    html
                })

                // Resend reports failures in the result instead of throwing
                if (result.error) throw new Error(result.error.message)
                console.log(`[QR Email] Sent to ${recipientEmail} for Team "${team.name}" (${qrMembers.length} QR codes). Resend ID: ${(result as any)?.data?.id || 'N/A'}`)

                // Mark team as emailed
                await supabase.from('hackathon_teams').update({ qr_emailed: true }).eq('id', team.id)

                sent++
                break
            } catch (err: any) {
                retries--
                if (err?.statusCode === 429 && retries > 0) {
                    console.log(`[QR Email] Rate limited for ${team.name}, waiting 2s...`)
                    await delay(2000)
                } else {
                    const errMsg = err?.message || err?.statusCode || 'unknown error'
                    console.error(`[QR Email] Failed: ${recipientEmail} for Team "${team.name}":`, errMsg)
                    failed++
                    errors.push(`Team "${team.name}" (${recipientEmail}): ${errMsg}`)
                    break
                }
            }
        }
    }

    const summary = `Sent ${sent} QR email(s).${failed > 0 ? ` ${failed} failed.` : ''}${skipped > 0 ? ` ${skipped} skipped.` : ''}`
    console.log(`[QR Email] SUMMARY: ${summary}`)

    return NextResponse.json({
        success: true,
        sent,
        failed,
        skipped,
        errors: errors.slice(0, 10),
        message: summary
    })
}
