import { NextResponse, NextRequest } from "next/server"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/server"
import { Resend } from "resend"
import { sendEmailOrThrow } from "@/lib/email/send"

export async function POST(req: NextRequest) {
    const rateLimit = checkRateLimit(getClientIdentifier(req), { limit: 5, windowSeconds: 60, bucket: 'team-update' })
    if (!rateLimit.success) {
        return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 })
    }

    try {
        const body = await req.json()
        const { action, email, teamId, updates } = body

        const supabase = createAdminClient()

        // Action: LOOKUP — find team by member email (any member can view, only leader can update)
        if (action === 'lookup') {
            if (!email || typeof email !== 'string') {
                return NextResponse.json({ error: "Email is required" }, { status: 400 })
            }

            // Find any participant with this email
            const { data: participant, error: pError } = await supabase
                .from('hackathon_participants')
                .select('id, name, email, role, team_id, hackathon_teams(*)')
                .eq('email', email.toLowerCase().trim())
                .limit(1)
                .single()

            if (pError || !participant) {
                return NextResponse.json({ error: "No team found with this email. Make sure you're using the same email you registered with." }, { status: 404 })
            }

            const team = participant.hackathon_teams as any
            if (!team) {
                return NextResponse.json({ error: "Team data not found" }, { status: 404 })
            }

            // Get all members
            const { data: members } = await supabase
                .from('hackathon_participants')
                .select('id, name, email, phone, role, college, course, section, system_id, year')
                .eq('team_id', team.id)
                .order('role', { ascending: true })

            // Find the leader ID
            const leader = (members || []).find((m: any) => m.role?.toLowerCase() === 'leader')
            const isLeader = participant.role?.toLowerCase() === 'leader'

            return NextResponse.json({
                team: {
                    id: team.id,
                    name: team.name,
                    team_code: team.team_code,
                    idea_title: team.idea_title,
                    theme: team.theme,
                    project_objective: team.project_objective,
                    status: team.status,
                    table_number: team.table_number,
                    mentor_name: team.mentor_name || null,
                    student_coordinator: team.student_coordinator || null,
                    coordinator_phone: team.coordinator_phone || null,
                    need_accommodation: team.need_accommodation || false,
                    accommodation_boys: team.accommodation_boys || 0,
                    accommodation_girls: team.accommodation_girls || 0,
                    sex_ratio: team.sex_ratio || null,
                    arrival_date: team.arrival_date || null,
                    departure_date: team.departure_date || null,
                },
                members: members || [],
                leaderId: leader?.id || participant.id,
                isLeader,
            })
        }

        // Action: UPDATE — update team data
        if (action === 'update') {
            if (!teamId || !updates || !email) {
                return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
            }

            // Verify leader (case-insensitive role match)
            const { data: leader, error: lError } = await supabase
                .from('hackathon_participants')
                .select('id, name, email, team_id')
                .eq('email', email.toLowerCase().trim())
                .ilike('role', 'leader')
                .eq('team_id', teamId)
                .single()

            if (lError || !leader) {
                return NextResponse.json({ error: "Unauthorized. Only the team leader can update." }, { status: 403 })
            }

            const changeLog: string[] = []

            // Update team fields
            const teamUpdates: Record<string, any> = {}
            if (updates.idea_title !== undefined) {
                teamUpdates.idea_title = updates.idea_title
                changeLog.push(`Idea Title → "${updates.idea_title}"`)
            }
            if (updates.project_objective !== undefined) {
                teamUpdates.project_objective = updates.project_objective
                changeLog.push(`Project Objective → "${updates.project_objective}"`)
            }
            if (updates.theme !== undefined) {
                teamUpdates.theme = updates.theme
                changeLog.push(`Theme → "${updates.theme}"`)
            }
            if (updates.mentor_name !== undefined) {
                teamUpdates.mentor_name = updates.mentor_name
                changeLog.push(`Mentor → "${updates.mentor_name}"`)
            }
            if (updates.need_accommodation !== undefined) {
                teamUpdates.need_accommodation = updates.need_accommodation
                changeLog.push(`Need Accommodation → ${updates.need_accommodation ? 'Yes' : 'No'}`)
            }
            if (updates.accommodation_boys !== undefined) {
                teamUpdates.accommodation_boys = updates.accommodation_boys
                changeLog.push(`Boys requiring accommodation → ${updates.accommodation_boys}`)
            }
            if (updates.accommodation_girls !== undefined) {
                teamUpdates.accommodation_girls = updates.accommodation_girls
                changeLog.push(`Girls requiring accommodation → ${updates.accommodation_girls}`)
            }
            if (updates.arrival_date !== undefined) {
                teamUpdates.arrival_date = updates.arrival_date
                changeLog.push(`Arrival → "${updates.arrival_date}"`)
            }
            if (updates.departure_date !== undefined) {
                teamUpdates.departure_date = updates.departure_date
                changeLog.push(`Departure → "${updates.departure_date}"`)
            }

            if (Object.keys(teamUpdates).length > 0) {
                const { error: updateError } = await supabase
                    .from('hackathon_teams')
                    .update(teamUpdates)
                    .eq('id', teamId)

                if (updateError) {
                    return NextResponse.json({ error: "Failed to update team: " + updateError.message }, { status: 500 })
                }
            }

            // Update members
            if (updates.members && Array.isArray(updates.members)) {
                for (const member of updates.members) {
                    if (!member.id) continue
                    const memberUpdates: Record<string, any> = {}
                    if (member.name !== undefined) memberUpdates.name = member.name
                    if (member.email !== undefined) memberUpdates.email = member.email
                    if (member.phone !== undefined) memberUpdates.phone = member.phone
                    if (member.college !== undefined) memberUpdates.college = member.college
                    if (member.course !== undefined) memberUpdates.course = member.course
                    if (member.section !== undefined) memberUpdates.section = member.section
                    if (member.system_id !== undefined) memberUpdates.system_id = member.system_id
                    if (member.year !== undefined) memberUpdates.year = member.year

                    if (Object.keys(memberUpdates).length > 0) {
                        await supabase
                            .from('hackathon_participants')
                            .update(memberUpdates)
                            .eq('id', member.id)
                            .eq('team_id', teamId)
                        
                        changeLog.push(`Member "${member.name || member.id}" updated: ${Object.keys(memberUpdates).join(', ')}`)
                    }
                }
            }

            // Store update log in team's data (using existing columns or metadata approach)
            // We'll use the project_objective field temporarily, or just send email
            // Send admin notification email
            if (process.env.RESEND_API_KEY && changeLog.length > 0) {
                try {
                    const resend = new Resend(process.env.RESEND_API_KEY)
                    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'technova@sharda.ac.in'
                    
                    const { data: teamData } = await supabase
                        .from('hackathon_teams')
                        .select('name, team_code')
                        .eq('id', teamId)
                        .single()

                    await sendEmailOrThrow(resend, {
                        from: "Technova System <no-reply@technovashardauniversity.in>",
                        to: adminEmail,
                        subject: `Team Update: ${teamData?.name || 'Unknown'} (${teamData?.team_code || 'N/A'})`,
                        html: `
                            <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0b; color: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #333;">
                                <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 20px; text-align: center;">
                                    <h1 style="margin: 0; color: #000; font-size: 20px;">Team Data Updated</h1>
                                </div>
                                <div style="padding: 24px;">
                                    <p style="color: #ccc; margin-bottom: 4px; font-size: 14px;"><strong>Team:</strong> ${teamData?.name || 'Unknown'}</p>
                                    <p style="color: #ccc; margin-bottom: 4px; font-size: 14px;"><strong>Code:</strong> ${teamData?.team_code || 'N/A'}</p>
                                    <p style="color: #ccc; margin-bottom: 16px; font-size: 14px;"><strong>Updated by:</strong> ${leader.name} (${leader.email})</p>
                                    <hr style="border-color: #333; margin: 16px 0;" />
                                    <h3 style="color: #f59e0b; font-size: 16px; margin-bottom: 12px;">Changes Made:</h3>
                                    <ul style="color: #ddd; font-size: 13px; line-height: 1.8; padding-left: 16px;">
                                        ${changeLog.map(c => `<li>${c}</li>`).join('')}
                                    </ul>
                                    <p style="color: #666; font-size: 11px; margin-top: 24px; text-align: center;">
                                        Automated notification from Technova Hackathon Portal
                                    </p>
                                </div>
                            </div>
                        `,
                    })
                } catch (emailError) {
                    console.error("Failed to send admin notification:", emailError)
                    // Don't fail the update if email fails
                }
            }

            // Log explicitly to the database table for the Manage Dashboard
            if (changeLog.length > 0) {
                await supabase.from('hackathon_team_updates').insert({
                    team_id: teamId,
                    update_data: {
                        changes: changeLog,
                        updated_by: leader.name,
                        email: leader.email
                    }
                })
            }

            return NextResponse.json({ 
                success: true, 
                message: `Team updated successfully. ${changeLog.length} change(s) applied.`,
                changes: changeLog 
            })
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    } catch (error: any) {
        console.error("Team update error:", error)
        return NextResponse.json({ error: "Server error: " + error.message }, { status: 500 })
    }
}
