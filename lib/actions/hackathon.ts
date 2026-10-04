'use server'

import { createClient as createServerClient } from "@supabase/supabase-js"
import { auth } from "@/lib/auth"
import * as xlsx from 'xlsx'
import { revalidatePath } from "next/cache"
import { Resend } from "resend"
import { sendEmailOrThrow } from "@/lib/email/send"
import { headers } from "next/headers"
import { checkRateLimit } from "@/lib/rate-limit"
import { fetchAllRows } from "@/lib/supabase/fetch-all"

export async function getSupabase() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function uploadHackathonData(formData: FormData) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) {
        throw new Error("Unauthorized")
    }

    const file = formData.get('file') as File
    if (!file) {
        return { error: "No file provided" }
    }

    try {
        const buffer = await file.arrayBuffer()
        const workbook = xlsx.read(buffer, { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        let data: any[] = xlsx.utils.sheet_to_json(worksheet)

        if (!data || data.length === 0) {
            return { error: "File is empty or invalid" }
        }

        // Handle merged title rows (detect if first row values look like actual column headers)
        const firstVals = Object.values(data[0]).map((v: any) => String(v).trim().toLowerCase());
        const teamHeaderIndicators = ['team name', 'team id', 'project title', 'track', 'email', 'college', 'team lead', 's.no'];
        const teamLooksLikeHeaders = teamHeaderIndicators.filter(h => firstVals.some(v => v.includes(h))).length >= 3;
        if (teamLooksLikeHeaders) {
            const realHeaders = Object.values(data[0]).map((v: any) => String(v).trim());
            const oldKeys = Object.keys(data[0]);
            data = data.slice(1).map(row => {
                const remapped: any = {};
                oldKeys.forEach((oldKey, idx) => {
                    if (idx < realHeaders.length) remapped[realHeaders[idx]] = row[oldKey] ?? '';
                });
                return remapped;
            });
        }

        const supabase = await getSupabase()

        // Flexible column mapping for various spreadsheet formats
        // Supports: Team Id, Team Name, Project Title, Team Lead Name, Project Objective(Short Synopsis),
        // Total Members, Team members name(separated by ;), Is a mentor accompanying you?,
        // College Name, Track, Student Coordinator, Coordinator Phone, Team Contact Number, Team Email,
        // Team Status, Need Accommodation, Remarks

        let teamsAdded = 0
        let participantsAdded = 0

        for (const row of data as any[]) {
            const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
            const keys = Object.keys(row);

            // Helper: find key by multiple possible cleanStr matches
            const findKey = (...patterns: string[]) => keys.find(k => {
                const clean = cleanStr(k);
                return patterns.some(p => clean.includes(p));
            });

            // ---- TEAM-LEVEL FIELDS ----
            const teamNameKey = findKey('teamname', 'nameofteam') || keys.find(k => cleanStr(k) === 'team');
            const teamCodeKey = findKey('teamid', 'teamcode');
            const ideaKey = findKey('projecttitle', 'ideatitle', 'solution') || keys.find(k => {
                const c = cleanStr(k); return c.includes('project') && c.includes('title');
            });
            const objectiveKey = findKey('synopsis', 'projectobjective', 'objective') || keys.find(k => {
                const c = cleanStr(k); return c.includes('project') && (c.includes('objective') || c.includes('synopsis') || c.includes('description'));
            });
            const themeKey = keys.find(k => {
                const c = cleanStr(k);
                return c === 'track' || c === 'theme' || c.includes('trackselection') || c.includes('projecttheme');
            });
            const categoryKey = !themeKey ? findKey('category', 'categoryselection') : null;

            const coordinatorNameKey = findKey('studentcoordinator', 'coordinatorname');
            const coordinatorPhoneKey = findKey('coordinatorphone', 'coordinatornumber');
            const accommodationKey = findKey('accommodation', 'accomodation', 'needaccomodation', 'needaccommodation');
            const remarksKey = findKey('remark');
            const mentorKey = keys.find(k => cleanStr(k).includes('mentor'));
            const totalMembersKey = findKey('totalmembers', 'membercount');
            const sexRatioKey = findKey('sexratio', 'boysandgirls', 'genderratio');
            const arrivalDateKey = findKey('arrivaldate', 'arrival');
            const departureDateKey = findKey('departuredate', 'departure');

            // ---- EXTRACT VALUES ----
            const teamCode = teamCodeKey && row[teamCodeKey] ? String(row[teamCodeKey]).trim() : null;
            let teamName = (teamNameKey && row[teamNameKey]) ? String(row[teamNameKey]).trim() : '';
            if (!teamName && !teamCode) {
                // Skip rows with no team name AND no team code (likely header/title rows)
                continue;
            }
            if (!teamName) teamName = `Team ${teamCode || Math.floor(Math.random() * 10000)}`;

            const ideaTitle = (ideaKey && row[ideaKey]) ? String(row[ideaKey]).trim() : 'TBD';
            const projectObjective = (objectiveKey && row[objectiveKey]) ? String(row[objectiveKey]).trim() : null;
            const themeValue = themeKey ? row[themeKey] : (categoryKey ? row[categoryKey] : null);
            const theme = themeValue ? String(themeValue).trim() : null;

            const studentCoordinator = coordinatorNameKey && row[coordinatorNameKey] ? String(row[coordinatorNameKey]).trim() : null;
            const coordinatorPhone = coordinatorPhoneKey && row[coordinatorPhoneKey] ? String(row[coordinatorPhoneKey]).trim() : null;
            const needAccommodationStr = accommodationKey && row[accommodationKey] ? String(row[accommodationKey]).toLowerCase().trim() : '';
            const needAccommodation = needAccommodationStr === 'yes' || needAccommodationStr === 'true';
            const remarks = remarksKey && row[remarksKey] ? String(row[remarksKey]).trim() : null;
            const sexRatio = sexRatioKey && row[sexRatioKey] ? String(row[sexRatioKey]).trim() : null;
            const arrivalDate = arrivalDateKey && row[arrivalDateKey] ? String(row[arrivalDateKey]).trim() : null;
            const departureDate = departureDateKey && row[departureDateKey] ? String(row[departureDateKey]).trim() : null;

            // Parse boys/girls from sex_ratio (e.g. "5G" or "3B 2G" or "5 boys, 2 girls")
            let accommodationBoys = 0;
            let accommodationGirls = 0;
            if (sexRatio) {
                const boysMatch = sexRatio.match(/(\d+)\s*(?:b|boys|male|m)/i);
                const girlsMatch = sexRatio.match(/(\d+)\s*(?:g|girls|female|f)/i);
                if (boysMatch) accommodationBoys = parseInt(boysMatch[1]);
                if (girlsMatch) accommodationGirls = parseInt(girlsMatch[1]);
            }

            // Mentor: could be "Yes", a name, or empty
            let mentorName: string | null = null;
            if (mentorKey && row[mentorKey]) {
                const mentorVal = String(row[mentorKey]).trim();
                const lower = mentorVal.toLowerCase();
                if (lower && lower !== 'no' && lower !== 'n/a' && lower !== 'na' && lower !== 'none' && lower !== '-') {
                    // If it's just "Yes", we store "Yes (name TBD)", otherwise store the actual name
                    mentorName = lower === 'yes' ? 'Yes' : mentorVal;
                }
            }

            // ---- INSERT TEAM ----
            const { data: team, error: teamError } = await supabase
                .from('hackathon_teams')
                .insert({
                    name: teamName,
                    idea_title: ideaTitle,
                    team_code: teamCode,
                    theme: theme,
                    project_objective: projectObjective,
                    student_coordinator: studentCoordinator,
                    coordinator_phone: coordinatorPhone,
                    need_accommodation: needAccommodation,
                    remarks: remarks,
                    mentor_name: mentorName,
                    sex_ratio: sexRatio,
                    arrival_date: arrivalDate,
                    departure_date: departureDate,
                    accommodation_boys: accommodationBoys,
                    accommodation_girls: accommodationGirls,
                    status: 'shortlisted'
                })
                .select()
                .single()

            if (teamError || !team) {
                console.error("Error inserting team:", teamError)
                continue;
            }
            teamsAdded++

            // ---- PARTICIPANTS ----
            const participantPairs: { name: string, email: string, phone: string | null, role: string, course: string | null, section: string | null, system_id: string | null, year: string | null, college: string | null }[] = []

            // College Name (shared across team from spreadsheet column "College Name")
            const collegeKey = keys.find(k => {
                const c = cleanStr(k);
                return c.includes('collegename') || c === 'college' || c.includes('universityname') || c.includes('institute');
            });
            const sharedCollege = collegeKey && row[collegeKey] ? String(row[collegeKey]).trim() : null;

            // Team Email (the single registered email)
            const teamEmailKey = keys.find(k => {
                const c = cleanStr(k);
                return c.includes('teamemail') || c === 'email';
            }) || keys.find(k => {
                const c = cleanStr(k);
                return c.includes('email') && !c.includes('member');
            });
            const teamEmail = teamEmailKey && row[teamEmailKey] ? String(row[teamEmailKey]).trim() : '';

            // Team Contact Number
            const teamPhoneKey = keys.find(k => {
                const c = cleanStr(k);
                return c.includes('teamcontactnumber') || c.includes('contactnumber') || c.includes('teamnumber');
            }) || keys.find(k => {
                const c = cleanStr(k);
                return (c.includes('mobile') || c.includes('phone') || c.includes('contact')) && !c.includes('coordinator') && !c.includes('member');
            });
            const teamPhone = teamPhoneKey && row[teamPhoneKey] ? String(row[teamPhoneKey]).trim() : null;

            // Leader Name (e.g. "Team Lead Name")
            const leaderNameKey = keys.find(k => {
                const lower = k.toLowerCase();
                return lower.includes('lead') && lower.includes('name');
            }) || keys.find(k => {
                const lower = k.toLowerCase();
                return (lower === 'name') || (lower.includes('name') && !lower.includes('team name') && !lower.includes('idea') && !lower.includes('project') && !lower.includes('member'));
            });

            // Leader-specific email/phone - fallback to team-level ones
            const leaderEmailKey = keys.find(k => {
                const c = k.toLowerCase();
                return c.includes('lead') && c.includes('email');
            });
            const leaderPhoneKey = keys.find(k => {
                const c = k.toLowerCase();
                return c.includes('lead') && (c.includes('phone') || c.includes('mobile'));
            });

            participantPairs.push({
                name: (leaderNameKey && row[leaderNameKey]) ? String(row[leaderNameKey]).trim() : 'Unknown Leader',
                email: (leaderEmailKey && row[leaderEmailKey]) ? String(row[leaderEmailKey]).trim() : teamEmail,
                phone: (leaderPhoneKey && row[leaderPhoneKey]) ? String(row[leaderPhoneKey]).trim() : teamPhone,
                course: null,
                section: null,
                system_id: null,
                year: null,
                college: sharedCollege,
                role: 'Leader'
            })

            // Extract individually-named members (Member 1, Member 2, etc.)
            for (let i = 1; i <= 4; i++) {
                const memberNameKey = keys.find(k => k.toLowerCase().includes(`member ${i}`) && k.toLowerCase().includes('name'))
                    || keys.find(k => k.toLowerCase().includes(`member${i}`) && k.toLowerCase().includes('name'));
                const memberEmailKey = keys.find(k => k.toLowerCase().includes(`member ${i}`) && k.toLowerCase().includes('email'))
                    || keys.find(k => k.toLowerCase().includes(`member${i}`) && k.toLowerCase().includes('email'));
                const memberPhoneKey = keys.find(k => k.toLowerCase().includes(`member ${i}`) && (k.toLowerCase().includes('phone') || k.toLowerCase().includes('mobile') || k.toLowerCase().includes('contact')))
                    || keys.find(k => k.toLowerCase().includes(`member${i}`) && (k.toLowerCase().includes('phone') || k.toLowerCase().includes('mobile') || k.toLowerCase().includes('contact')));

                if (memberNameKey && row[memberNameKey]) {
                    participantPairs.push({
                        name: String(row[memberNameKey]).trim(),
                        email: (memberEmailKey && row[memberEmailKey]) ? String(row[memberEmailKey]).trim() : '',
                        phone: (memberPhoneKey && row[memberPhoneKey]) ? String(row[memberPhoneKey]).trim() : null,
                        course: null,
                        section: null,
                        system_id: null,
                        year: null,
                        college: sharedCollege,
                        role: 'Member'
                    })
                }
            }

            // Semicolon-separated members column: "Team members name(separated by ;)"
            if (participantPairs.length <= 1) {
                const memberNamesKey = keys.find(k => {
                    const clean = cleanStr(k);
                    return (clean.includes('member') && clean.includes('name') && (clean.includes('separated') || clean.includes('affiliation'))) ||
                           (clean.includes('teammember') && clean.includes('name'));
                });
                if (memberNamesKey && row[memberNamesKey]) {
                    const rawMembers = String(row[memberNamesKey]).split(';').map(s => s.trim()).filter(Boolean);
                    for (const memberEntry of rawMembers) {
                        const parts = memberEntry.split('-').map(s => s.trim());
                        const memberName = parts[0] || memberEntry;
                        const memberCollege = parts.length > 1 ? parts.slice(1).join('-').trim() : sharedCollege;
                        if (memberName && !participantPairs.some(p => p.name.toLowerCase() === memberName.toLowerCase())) {
                            participantPairs.push({
                                name: memberName,
                                email: '',
                                phone: null,
                                course: null,
                                section: null,
                                system_id: null,
                                year: null,
                                college: memberCollege || sharedCollege,
                                role: 'Member'
                            });
                        }
                    }
                }
            }

            // Insert Participants
            if (participantPairs.length > 0) {
                const participantsToInsert = participantPairs.map(p => ({
                    team_id: team.id,
                    name: p.name,
                    email: p.email,
                    phone: p.phone,
                    course: p.course,
                    section: p.section,
                    system_id: p.system_id,
                    year: p.year,
                    college: p.college,
                    role: p.role,
                    is_checked_in: false,
                    food_count: 0
                }))

                const { error: partError } = await supabase
                    .from('hackathon_participants')
                    .insert(participantsToInsert)

                if (!partError) {
                    participantsAdded += participantsToInsert.length
                } else {
                    console.error("Error inserting participants:", partError)
                }
            }
        }

        revalidatePath('/admin/hackathon')
        return { success: true, message: `Successfully imported ${teamsAdded} teams and ${participantsAdded} participants.` }

    } catch (error: any) {
        console.error("Upload Error:", error)
        return { error: "Failed to process file: " + error.message }
    }
}

export async function updateHackathonTeamDetails(teamId: string, data: {
    teamName: string,
    ideaTitle: string,
    teamCode?: string,
    theme?: string,
    projectObjective?: string,
    leader?: { id?: string, name: string, email: string, phone: string, course?: string, section?: string, system_id?: string, year?: string, college?: string },
    members?: { id?: string, name: string, email?: string, phone?: string, course?: string, section?: string, system_id?: string, year?: string, college?: string }[]
}) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) {
        return { error: "Unauthorized" }
    }

    try {
        const supabase = await getSupabase()

        // 1. Update Team Info
        const { error } = await supabase
            .from('hackathon_teams')
            .update({
                name: data.teamName,
                idea_title: data.ideaTitle || 'TBD',
                team_code: data.teamCode || null,
                theme: data.theme || null,
                project_objective: data.projectObjective || null,
            })
            .eq('id', teamId)

        if (error) {
            return { error: error.message || "Failed to update team details" }
        }

        // 2. Clear existing participants for this team
        await supabase.from('hackathon_participants').delete().eq('team_id', teamId)

        // 3. Prepare Participants to re-insert
        const participantsToInsert = []

        // Leader
        if (data.leader && data.leader.name) {
            participantsToInsert.push({
                team_id: teamId,
                name: data.leader.name,
                email: data.leader.email,
                phone: data.leader.phone,
                course: data.leader.course || null,
                section: data.leader.section || null,
                system_id: data.leader.system_id || null,
                year: data.leader.year || null,
                college: data.leader.college || null,
                role: 'Leader',
                is_checked_in: false,
                food_count: 0
            })
        }

        // Members
        if (data.members && data.members.length > 0) {
            for (const member of data.members) {
                if (member.name && member.name.trim() !== "") {
                    participantsToInsert.push({
                        team_id: teamId,
                        name: member.name,
                        email: member.email || '',
                        phone: member.phone || null,
                        course: member.course || null,
                        section: member.section || null,
                        system_id: member.system_id || null,
                        year: member.year || null,
                        college: member.college || null,
                        role: 'Member',
                        is_checked_in: false,
                        food_count: 0
                    })
                }
            }
        }

        // 4. Re-insert Participants
        if (participantsToInsert.length > 0) {
            const { error: partError } = await supabase
                .from('hackathon_participants')
                .insert(participantsToInsert)

            if (partError) {
                return { error: "Team updated, but failed to reconstruct members: " + partError.message }
            }
        }

        revalidatePath('/admin/hackathon')
        revalidatePath('/hackathon-portal')
        return { success: true }
    } catch (e: any) {
        return { error: e.message }
    }
}


export async function addHackathonTeamManually(data: {
    teamName: string,
    ideaTitle: string,
    teamCode?: string,
    theme?: string,
    projectObjective?: string,
    leader: { name: string, email: string, phone: string, course?: string, section?: string, system_id?: string, year?: string, college?: string },
    members: { name: string, email?: string, phone?: string, course?: string, section?: string, system_id?: string, year?: string, college?: string }[]
}) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) {
        return { error: "Unauthorized" }
    }

    try {
        const supabase = await getSupabase()

        // 1. Insert Team
        const { data: team, error: teamError } = await supabase
            .from('hackathon_teams')
            .insert({
                name: data.teamName,
                idea_title: data.ideaTitle || 'TBD',
                team_code: data.teamCode || null,
                theme: data.theme || null,
                project_objective: data.projectObjective || null,
                status: 'pending'
            })
            .select()
            .single()

        if (teamError || !team) {
            return { error: teamError?.message || "Failed to create team" }
        }

        // 2. Prepare Participants
        const participantsToInsert = []

        // Leader
        if (data.leader && data.leader.name) {
            participantsToInsert.push({
                team_id: team.id,
                name: data.leader.name,
                email: data.leader.email,
                phone: data.leader.phone,
                course: data.leader.course || null,
                section: data.leader.section || null,
                system_id: data.leader.system_id || null,
                year: data.leader.year || null,
                college: data.leader.college || null,
                role: 'leader',
                is_checked_in: false,
                food_count: 0
            })
        }

        // Members
        if (data.members && data.members.length > 0) {
            for (const member of data.members) {
                if (member.name && member.name.trim() !== "") {
                    participantsToInsert.push({
                        team_id: team.id,
                        name: member.name,
                        email: member.email || '',
                        phone: member.phone || null,
                        course: member.course || null,
                        section: member.section || null,
                        system_id: member.system_id || null,
                        year: member.year || null,
                        college: member.college || null,
                        role: 'member',
                        is_checked_in: false,
                        food_count: 0
                    })
                }
            }
        }

        // 3. Insert Participants
        if (participantsToInsert.length > 0) {
            const { error: partError } = await supabase
                .from('hackathon_participants')
                .insert(participantsToInsert)

            if (partError) {
                return { error: "Team created, but failed to add members: " + partError.message }
            }
        }

        revalidatePath('/admin/hackathon')
        return { success: true, message: "Team created successfully" }
    } catch (error: any) {
        return { error: "An unexpected error occurred: " + error.message }
    }
}


export async function deleteAllHackathonTeams() {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) {
        throw new Error("Unauthorized")
    }

    try {
        const supabase = await getSupabase()
        // Delete all teams. Cascading deletes will remove participants and evaluations.
        const { error } = await supabase
            .from('hackathon_teams')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000') // Dummy condition to delete all rows

        if (error) throw error

        revalidatePath('/admin/hackathon')
        return { success: true, message: "All teams have been successfully deleted." }
    } catch (error: any) {
        console.error("Delete All Teams Error:", error)
        return { error: "Failed to delete teams: " + error.message }
    }
}

export async function getHackathonTeams() {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return []

    const supabase = await getSupabase()
    const { data: teams } = await supabase
        .from('hackathon_teams')
        .select(`
            *,
            hackathon_participants (*),
            hackathon_evaluations (evaluator_id, total_score, evaluation_round, edit_requested, edit_granted)
        `)
        .order('created_at', { ascending: false })

    return teams || []
}

export async function updateTeamStatus(teamId: string, status: string) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    const { error } = await supabase
        .from('hackathon_teams')
        .update({ status })
        .eq('id', teamId)

    if (error) return { error: error.message }

    revalidatePath('/admin/hackathon')
    return { success: true }
}

export async function approveScoreEdit(teamId: string, round: number) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    const { error } = await supabase
        .from('hackathon_evaluations')
        .update({ edit_granted: true, edit_requested: false })
        .eq('team_id', teamId)
        .eq('evaluation_round', round)
        .eq('edit_requested', true)

    if (error) return { error: error.message }
    
    revalidatePath('/admin/hackathon')
    return { success: true }
}

export async function getEditRequests() {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return []

    const supabase = await getSupabase()
    const { data: requests, error } = await supabase
        .from('hackathon_evaluations')
        .select(`
            id, team_id, evaluation_round, total_score, edit_requested, created_at,
            hackathon_evaluators (name, email),
            hackathon_teams (name, team_code)
        `)
        .eq('edit_requested', true)
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching edit requests:", error)
        return []
    }
    return requests || []
}

// Evaluator Management
export async function getEvaluators() {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return []

    const supabase = await getSupabase()
    const { data: evaluators } = await supabase
        .from('hackathon_evaluators')
        .select('*')
        .order('created_at', { ascending: false })

    return evaluators || []
}

export async function addEvaluator(email: string, name: string = 'Evaluator') {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    if (!email) return { error: "Email is required" }

    const supabase = await getSupabase()

    // Check if evaluator already exists first to avoid duplicate email errors
    const { data: existing } = await supabase
        .from('hackathon_evaluators')
        .select('id, magic_token')
        .eq('email', email)
        .maybeSingle()

    let magicToken = existing?.magic_token;

    if (!existing) {
        const { data, error } = await supabase
            .from('hackathon_evaluators')
            .insert({ email, name })
            .select('magic_token')
            .single()

        if (error) return { error: error.message }
        magicToken = data.magic_token;
    }

    revalidatePath('/admin/hackathon')
    return { success: true }
}

export async function sendEvaluatorInvite(id?: string) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    if (!process.env.RESEND_API_KEY) return { error: "Mailing is not configured on the server." }

    const supabase = await getSupabase()
    let query = supabase.from('hackathon_evaluators').select('id, email, name, magic_token')
    
    if (id) {
        query = query.eq('id', id)
    }

    const { data: evaluators, error } = await query
    
    if (error || !evaluators || evaluators.length === 0) {
        return { error: "No evaluators found to email." }
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    let count = 0;

    for (const ev of evaluators) {
        try {
            const magicLink = `https://www.technovashardauniversity.in/evaluate?token=${ev.magic_token}`;
            await sendEmailOrThrow(resend, {
                from: "Technova Society <no-reply@technovashardauniversity.in>",
                to: ev.email,
                subject: "Invitation: Official Evaluator - CodeMania Hackathon",
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #000; color: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #333;">
                        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
                            <h1 style="margin: 0; color: #000; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">CodeMania Hackathon</h1>
                            <p style="margin: 5px 0 0; color: #000; font-weight: bold; opacity: 0.8;">Official Evaluator Invitation</p>
                        </div>
                        <div style="padding: 40px 30px; line-height: 1.6;">
                            <h2 style="color: #f59e0b; margin-top: 0;">Welcome, ${ev.name}!</h2>
                            <p style="color: #ccc; font-size: 16px;">
                                You have been selected as an official evaluator for the CodeMania Hackathon. Your expertise will be invaluable in identifying the most innovative projects.
                            </p>
                            
                            <div style="background-color: #111; border: 1px solid #222; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
                                <p style="margin: 0 0 15px; color: #888; font-size: 14px;">Use the button below for direct access to your dashboard:</p>
                                <a href="${magicLink}" style="display: inline-block; background-color: #f59e0b; color: #000; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; transition: transform 0.2s;">
                                    Enter Evaluator Portal
                                </a>
                                <p style="margin: 15px 0 0; color: #555; font-size: 12px;">Login Email: ${ev.email}</p>
                            </div>

                            <p style="color: #666; font-size: 14px; margin-top: 30px;">
                                If you have any trouble with the link above, you can copy and paste this URL into your browser:<br/>
                                <span style="color: #f59e0b; word-break: break-all;">${magicLink}</span>
                            </p>
                        </div>
                        <div style="background-color: #0a0a0a; padding: 20px; text-align: center; border-top: 1px solid #1a1a1a;">
                            <p style="margin: 0; color: #444; font-size: 12px;">&copy; 2026 TechNova | Sharda University</p>
                        </div>
                    </div>
                `
            })
            count++;
            // Basic rate limiting for bulk
            if (evaluators.length > 3) {
                await new Promise(res => setTimeout(res, 300));
            }
        } catch (e) {
            console.error(`Failed to send evaluator email to ${ev.email}`, e);
        }
    }

    return { success: true, message: `Successfully sent ${count} invitation(s).` }
}

export async function removeEvaluator(id: string) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    const { error } = await supabase
        .from('hackathon_evaluators')
        .delete()
        .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/admin/hackathon')
    return { success: true }
}

// Timer & Settings Management
export async function getHackathonSettings() {
    const supabase = await getSupabase()
    const { data: settings } = await supabase
        .from('hackathon_settings')
        .select('*')
        .limit(1)
        .maybeSingle()
    return settings
}

export async function startTimer(durationHours: number = 24) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()

    // Check if settings row exists, if not create it
    const { data: existing } = await supabase.from('hackathon_settings').select('id').limit(1).maybeSingle()

    const payload = {
        timer_start: new Date().toISOString(),
        duration_hours: durationHours,
        is_running: true,
        updated_at: new Date().toISOString()
    }

    let error;
    if (existing) {
        const { error: updateError } = await supabase.from('hackathon_settings').update(payload).eq('id', existing.id)
        error = updateError
    } else {
        const { error: insertError } = await supabase.from('hackathon_settings').insert(payload)
        error = insertError
    }

    if (error) return { error: error.message }

    revalidatePath('/admin/hackathon')
    revalidatePath('/live')
    return { success: true }
}

export async function updateCustomMeals(meals: string[]) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    const { data: existing } = await supabase.from('hackathon_settings').select('id').limit(1).maybeSingle()

    if (existing) {
        const { error } = await supabase.from('hackathon_settings').update({ custom_meals: meals }).eq('id', existing.id)
        if (error) return { error: error.message }
    } else {
        const { error } = await supabase.from('hackathon_settings').insert({ custom_meals: meals })
        if (error) return { error: error.message }
    }

    revalidatePath('/admin/hackathon')
    revalidatePath('/hackathon-portal')
    return { success: true }
}

export async function updateHackathonName(name: string) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    const { data: existing } = await supabase.from('hackathon_settings').select('id').limit(1).maybeSingle()

    if (existing) {
        const { error } = await supabase.from('hackathon_settings').update({ hackathon_name: name }).eq('id', existing.id)
        if (error) return { error: error.message }
    } else {
        const { error } = await supabase.from('hackathon_settings').insert({ hackathon_name: name })
        if (error) return { error: error.message }
    }

    revalidatePath('/admin/hackathon')
    revalidatePath('/hackathon-portal')
    return { success: true }
}

export async function pushAnnouncement(message: string) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    const { data: existing } = await supabase.from('hackathon_settings').select('id').limit(1).maybeSingle()

    if (existing) {
        const { error } = await supabase.from('hackathon_settings').update({
            active_announcement: message,
            updated_at: new Date().toISOString()
        }).eq('id', existing.id)
        if (error) return { error: error.message }
    } else {
        const { error } = await supabase.from('hackathon_settings').insert({
            active_announcement: message,
            duration_hours: 24
        })
        if (error) return { error: error.message }
    }

    revalidatePath('/admin/hackathon')
    revalidatePath('/live')
    return { success: true }
}

export async function stopTimer() {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    const { data: existing } = await supabase.from('hackathon_settings').select('id').limit(1).maybeSingle()

    if (!existing) return { error: "No timer found" }

    const { error } = await supabase.from('hackathon_settings').update({
        is_running: false,
        updated_at: new Date().toISOString()
    }).eq('id', existing.id)

    if (error) return { error: error.message }

    revalidatePath('/admin/hackathon')
    revalidatePath('/live')
    return { success: true }
}

export async function updateEvaluationRounds(rounds: number) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()

    // Check if settings row exists
    const { data: existing } = await supabase.from('hackathon_settings').select('id').limit(1).maybeSingle()

    let error;
    if (existing) {
        const { error: updateError } = await supabase.from('hackathon_settings').update({ evaluation_rounds: rounds, updated_at: new Date().toISOString() }).eq('id', existing.id)
        error = updateError
    } else {
        const { error: insertError } = await supabase.from('hackathon_settings').insert({ evaluation_rounds: rounds, timer_start: new Date().toISOString(), duration_hours: 24, is_running: false, updated_at: new Date().toISOString() })
        error = insertError
    }

    if (error) return { error: error.message }

    revalidatePath('/admin/hackathon')
    return { success: true }
}

export async function clearAnnouncement() {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    const { data: existing } = await supabase.from('hackathon_settings').select('id').limit(1).maybeSingle()

    if (!existing) return { error: "No settings found" }

    const { error } = await supabase.from('hackathon_settings').update({
        active_announcement: null,
        updated_at: new Date().toISOString()
    }).eq('id', existing.id)

    if (error) return { error: error.message }

    revalidatePath('/admin/hackathon')
    revalidatePath('/live')
    return { success: true }
}

// Schedule Management
export async function getSchedule() {
    const supabase = await getSupabase()
    const { data: schedule } = await supabase
        .from('hackathon_schedule')
        .select('*')
        .order('start_time', { ascending: true })

    return schedule || []
}

export async function addScheduleItem(data: { title: string, description?: string, start_time: string, end_time?: string, event_type: string }) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead', 'organizer'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    const { error } = await supabase
        .from('hackathon_schedule')
        .insert(data)

    if (error) return { error: error.message }

    revalidatePath('/admin/hackathon')
    revalidatePath('/live')
    return { success: true }
}

export async function deleteScheduleItem(id: string) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead', 'organizer'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    const { error } = await supabase
        .from('hackathon_schedule')
        .delete()
        .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/admin/hackathon')
    revalidatePath('/live')
    return { success: true }
}

// ==========================================
// EVALUATOR PORTAL ACTIONS
// ==========================================

export async function checkEvaluatorAccess() {
    const session = await auth()
    if (!session || !session.user || !session.user.email) return null

    const supabase = await getSupabase()
    const { data } = await supabase
        .from('hackathon_evaluators')
        .select('id, name, email')
        .eq('email', session.user.email)
        .single()

    return data || null
}

export async function getTeamsForEvaluation(round: number = 1) {
    const session = await auth()
    if (!session || !session.user) return []
    const isAdmin = session.user.role === 'admin' || session.user.role === 'super_admin'

    const evaluator = await checkEvaluatorAccess()
    if (!evaluator && !isAdmin) return []

    const supabase = await getSupabase()

    // Fetch teams that are in 'evaluating' or 'pending' state
    let query = supabase
        .from('hackathon_teams')
        .select(`
            id, name, idea_title, project_objective, team_code, table_number, status, total_score, theme,
            hackathon_participants (name, email, phone, role, college),
            hackathon_evaluations (evaluator_id, total_score, evaluation_round, edit_requested, edit_granted, score_innovation, score_feasibility, score_impact, score_ux, score_presentation, feedback)
        `)

    if (round === 1) {
        // Use only valid enum values: pending, evaluating, shortlisted, rejected
        query = query.in('status', ['pending', 'evaluating', 'shortlisted', 'rejected'])
    } else {
        query = query.in('status', ['shortlisted'])
    }

    const { data: teams, error } = await query.order('created_at', { ascending: true })

    if (error) {
        console.error("Supabase Error in getTeamsForEvaluation:", error);
        return [];
    }


    if (!teams) return []

    // Map to indicate if this specific evaluator has already scored this team for this round
    return teams.map(team => {
        const evaluations = team.hackathon_evaluations || [];
        const myEval = evaluator ? evaluations.find((e: any) => e.evaluator_id === evaluator.id && e.evaluation_round === round) : null;

        // Calculate the total score for this SPECIFIC round
        // Now using Average instead of Sum, so multiple panels evaluating the same team won't inflate scores over teams evaluated by fewer panels
        const roundSpecificEvals = evaluations.filter((e: any) => e.evaluation_round === round);

        let roundSpecificTotal = 0;
        if (roundSpecificEvals.length > 0) {
            const sum = roundSpecificEvals.reduce((acc: number, curr: any) => acc + Number(curr.total_score), 0);
            // Return average, rounded to 1 decimal place
            roundSpecificTotal = Math.round((sum / roundSpecificEvals.length) * 10) / 10;
        }

        return {
            ...team,
            total_score: roundSpecificTotal, // Override generic total score with ROUND SPECIFIC total score
            has_evaluated: myEval ? !myEval.edit_granted : false,
            my_score: myEval ? myEval.total_score : null,
            edit_requested: myEval ? myEval.edit_requested : false,
            edit_granted: myEval ? myEval.edit_granted : false,
            my_eval_details: myEval ? {
                innovation: myEval.score_innovation ?? null,
                feasibility: myEval.score_feasibility ?? null,
                impact: myEval.score_impact ?? null,
                ux: myEval.score_ux ?? null,
                presentation: myEval.score_presentation ?? null,
                feedback: myEval.feedback || ""
            } : null
        }
    })
}

export type EvaluationScores = {
    innovation: number;
    feasibility: number;
    impact: number;
    ux: number;
    presentation: number;
    feedback: string;
}

export async function submitEvaluation(teamId: string, round: number, scores: EvaluationScores, token?: string) {
    let evaluator;
    if (token) {
        const supabase = await getSupabase()
        const { data } = await supabase
            .from('hackathon_evaluators')
            .select('id, name, email')
            .eq('magic_token', token)
            .maybeSingle()
        evaluator = data
    }

    if (!evaluator) {
        evaluator = await checkEvaluatorAccess()
    }

    if (!evaluator) return { error: "Unauthorized Evaluator Access" }

    // Validate scores (0-10 range for 5 factors)
    const scoreValues = [scores.innovation, scores.feasibility, scores.impact, scores.ux, scores.presentation];
    if (scoreValues.some(s => s < 0 || s > 10)) {
        return { error: "Scores must be between 0 and 10 for each category." }
    }

    // Weights: Innovation(25%), Feasibility(20%), Impact(20%), UX(15%), Presentation(20%)
    // Each is out of 10. Max possible points: (10*2.5=25) + (10*2=20) + (10*2=20) + (10*1.5=15) + (10*2=20) = 100.
    const totalScore = (scores.innovation * 2.5) + (scores.feasibility * 2) + (scores.impact * 2) + (scores.ux * 1.5) + (scores.presentation * 2);
    
    const supabase = await getSupabase()

    // Check if evaluation is open
    const { data: settings } = await supabase.from('hackathon_settings').select('evaluation_open').limit(1).maybeSingle()
    if (!settings?.evaluation_open) {
        return { error: "Evaluation period is currently closed. You can no longer submit scores." }
    }

    const { data: existingEval } = await supabase
        .from('hackathon_evaluations')
        .select('id, edit_granted')
        .eq('team_id', teamId)
        .eq('evaluator_id', evaluator.id)
        .eq('evaluation_round', round)
        .maybeSingle()

    if (existingEval) {
        if (!existingEval.edit_granted) {
            return { error: `You have already evaluated this team for Round ${round}. Request an edit if you need to change your score.` }
        }
        
        const { error: evalError } = await supabase
            .from('hackathon_evaluations')
            .update({
                score_innovation: scores.innovation,
                score_feasibility: scores.feasibility,
                score_impact: scores.impact,
                score_ux: scores.ux,
                score_presentation: scores.presentation,
                total_score: totalScore,
                feedback: scores.feedback,
                edit_requested: false,
                edit_granted: false
            })
            .eq('id', existingEval.id)
            
        if (evalError) return { error: evalError.message }
    } else {
        const { error: evalError } = await supabase
            .from('hackathon_evaluations')
            .insert({
                team_id: teamId,
                evaluator_id: evaluator.id,
                evaluation_round: round,
                score_innovation: scores.innovation,
                score_feasibility: scores.feasibility,
                score_impact: scores.impact,
                score_ux: scores.ux,
                score_presentation: scores.presentation,
                total_score: totalScore,
                feedback: scores.feedback
            })

        if (evalError) return { error: evalError.code === '23505' ? `You have already evaluated this team for Round ${round}.` : evalError.message }
    }

    // Aggregate all scores for this team to update the teams table for the specific round
    const { data: allEvals } = await supabase
        .from('hackathon_evaluations')
        .select('total_score, evaluation_round')
        .eq('team_id', teamId)

    if (allEvals) {
        const round1Evals = allEvals.filter(e => e.evaluation_round === 1);
        const round1Sum = round1Evals.reduce((acc, curr) => acc + Number(curr.total_score), 0);
        const round1Avg = round1Evals.length > 0 ? Math.round((round1Sum / round1Evals.length) * 10) / 10 : 0;

        const round2Evals = allEvals.filter(e => e.evaluation_round === 2);
        const round2Sum = round2Evals.reduce((acc, curr) => acc + Number(curr.total_score), 0);
        const round2Avg = round2Evals.length > 0 ? Math.round((round2Sum / round2Evals.length) * 10) / 10 : 0;

        // We update the total_score to reflect the AVERAGE score of the CURRENT round so sorting works out of the box in the generic dashboard.
        const teamTotal = round === 1 ? round1Avg : round2Avg;

        await supabase
            .from('hackathon_teams')
            .update({
                total_score: teamTotal, // Holds the active round's total (Averaged across panels)
                status: 'evaluating'
            })
            .eq('id', teamId)
    }

    revalidatePath('/admin/hackathon/evaluate')
    revalidatePath('/admin/hackathon')
    return { success: true }
}

export async function requestEvaluationEdit(teamId: string, round: number, token?: string) {
    let evaluator;
    if (token) {
        const supabase = await getSupabase()
        const { data } = await supabase
            .from('hackathon_evaluators')
            .select('id')
            .eq('magic_token', token)
            .maybeSingle()
        evaluator = data
    } else {
        evaluator = await checkEvaluatorAccess()
    }

    if (!evaluator) return { error: "Unauthorized Evaluator Access" }

    const supabase = await getSupabase()
    const { error } = await supabase
        .from('hackathon_evaluations')
        .update({ edit_requested: true })
        .eq('team_id', teamId)
        .eq('evaluator_id', evaluator.id)
        .eq('evaluation_round', round)

    if (error) return { error: error.message }
    
    revalidatePath('/admin/hackathon/evaluate')
    return { success: true }
}

export async function toggleEvaluationPeriod(isOpen: boolean) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) {
        return { error: "Unauthorized" }
    }

    const supabase = await getSupabase()
    const { data: existing } = await supabase.from('hackathon_settings').select('id').limit(1).maybeSingle()

    if (existing) {
        const { error } = await supabase.from('hackathon_settings').update({
            evaluation_open: isOpen
        }).eq('id', existing.id)
        if (error) return { error: error.message }
    } else {
        const { error } = await supabase.from('hackathon_settings').insert({
            duration_hours: 24,
            evaluation_open: isOpen
        })
        if (error) return { error: error.message }
    }

    revalidatePath('/admin/hackathon')
    return { success: true }
}

export async function getTeamEvaluations(teamId: string, round: number) {
    const session = await auth()
    if (!session || !session.user) return []
    const isAdmin = session.user.role === 'admin' || session.user.role === 'super_admin'

    const evaluator = await checkEvaluatorAccess()
    if (!evaluator && !isAdmin) return []

    const supabase = await getSupabase()

    const { data: evaluations } = await supabase
        .from('hackathon_evaluations')
        .select(`
            id, total_score, score_idea, score_tools, score_impact, score_sustainability, score_feasibility, score_communication, feedback, evaluation_round, created_at,
            hackathon_evaluators (name, email)
        `)
        .eq('team_id', teamId)
        .eq('evaluation_round', round)
        .order('created_at', { ascending: false })

    return evaluations || []
}

export async function getPublicShortlistedTeams() {
    const supabase = await getSupabase()
    const { data: teams, error } = await supabase
        .from('hackathon_teams')
        .select(`
            id, name, idea_title, table_number, total_score
        `)
        // status is an enum, so ILIKE errored ("operator does not exist") and the public
        // shortlist was always empty. It would also have matched 'not_shortlisted'.
        .eq('status', 'shortlisted')
        .order('total_score', { ascending: false })

    if (error) {
        console.error('[getPublicShortlistedTeams] Supabase error:', error)
    }

    return teams || []
}

export async function emailShortlistedTeams() {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }
    if (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string)) return { error: "Unauthorized" }

    if (!process.env.RESEND_API_KEY) return { error: "Email service not configured" }

    const supabase = await getSupabase()

    // Get all shortlisted teams with their participants
    const { data: teams } = await supabase
        .from('hackathon_teams')
        .select('id, name, idea_title, team_code, hackathon_participants(name, email, role)')
        .eq('status', 'shortlisted')

    if (!teams || teams.length === 0) return { error: "No shortlisted teams found to email." }

    const resend = new Resend(process.env.RESEND_API_KEY)
    let sentCount = 0
    let failCount = 0

    for (const team of teams) {
        const participants = team.hackathon_participants || []
        const emails = participants.map((p: any) => p.email).filter(Boolean)

        if (emails.length === 0) continue

        for (const participant of participants) {
            if (!participant.email) continue
            try {
                await sendEmailOrThrow(resend, {
                    from: "Technova Society <no-reply@technovashardauniversity.in>",
                    to: participant.email,
                    subject: "🎉 Congratulations! Your Team has been Shortlisted - CodeMania Hackathon",
                    html: `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #000; color: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #333;">
                            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
                                <h1 style="margin: 0; color: #fff; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">🎉 Congratulations!</h1>
                                <p style="margin: 5px 0 0; color: rgba(255,255,255,0.9); font-weight: bold;">CodeMania Hackathon</p>
                            </div>
                            <div style="padding: 40px 30px; line-height: 1.6;">
                                <h2 style="color: #10b981; margin-top: 0;">Dear ${participant.name},</h2>
                                <p style="color: #ccc; font-size: 16px;">
                                    We are thrilled to inform you that your team <strong style="color: #f59e0b;">${team.name}</strong> has been <strong style="color: #10b981;">shortlisted</strong> for the Grand Finale of the CodeMania Hackathon!
                                </p>

                                <div style="background-color: #111; border: 1px solid #222; border-radius: 8px; padding: 20px; margin: 25px 0;">
                                    <p style="margin: 0 0 10px; color: #888; font-size: 14px;">Team Details:</p>
                                    <p style="margin: 0; font-size: 16px; color: #fff;"><strong>Team:</strong> ${team.name}</p>
                                    <p style="margin: 5px 0 0; font-size: 14px; color: #f59e0b;"><strong>Team Code:</strong> ${team.team_code || 'N/A'}</p>
                                    <p style="margin: 5px 0 0; font-size: 14px; color: #aaa;"><strong>Project:</strong> ${team.idea_title || 'N/A'}</p>
                                </div>

                                <div style="background-color: #0a2e1e; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
                                    <p style="margin: 0; color: #10b981; font-size: 18px; font-weight: bold;">🏆 You're in the Grand Finale!</p>
                                    <p style="margin: 10px 0 0; color: #aaa; font-size: 14px;">
                                        The 24-Hour Offline Hackathon awaits you at Sharda University. More details about the event schedule, venue, and logistics will be shared soon.
                                    </p>
                                </div>

                                <p style="color: #ccc; font-size: 14px;">
                                    Stay tuned for further updates. For any queries, reach out to the Technova Society team.
                                </p>

                                <div style="text-align: center; margin-top: 25px;">
                                    <a href="https://www.technovashardauniversity.in/hackathon" style="display: inline-block; background-color: #10b981; color: #000; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                                        View Hackathon Details
                                    </a>
                                </div>
                            </div>
                            <div style="background-color: #0a0a0a; padding: 20px; text-align: center; border-top: 1px solid #1a1a1a;">
                                <p style="margin: 0; color: #444; font-size: 12px;">&copy; 2026 TechNova | Sharda University</p>
                            </div>
                        </div>
                    `
                })
                sentCount++
                // Throttle: Resend allows max 2 requests/sec
                await new Promise(resolve => setTimeout(resolve, 600))
            } catch (e) {
                console.error(`Failed to send email to ${participant.email}`, e)
                failCount++
            }
        }

        // Team stays as 'shortlisted' after notification
        // (no status change needed — DB enum doesn't support 'shortlisted_notified')
    }

    revalidatePath('/hackathon-portal/manage')
    revalidatePath('/hackathon')
    return { success: true, message: `✅ Emails sent to ${sentCount} participant(s) across ${teams.length} team(s).${failCount > 0 ? ` ${failCount} failed.` : ''}` }
}

export async function emailSingleTeam(teamId: string) {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }
    if (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string)) return { error: "Unauthorized" }

    if (!process.env.RESEND_API_KEY) return { error: "Email service not configured" }

    const supabase = await getSupabase()

    const { data: team, error: teamError } = await supabase
        .from('hackathon_teams')
        .select('id, name, idea_title, team_code, status, hackathon_participants(name, email, role)')
        .eq('id', teamId)
        .single()

    if (teamError || !team) return { error: "Team not found" }

    const participants = (team.hackathon_participants || []) as any[]
    const emails = participants.filter((p: any) => p.email).map((p: any) => ({ name: p.name, email: p.email }))

    if (emails.length === 0) return { error: "No participant emails found for this team." }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const sentTo: string[] = []
    const failedTo: string[] = []

    for (const participant of emails) {
        try {
            await sendEmailOrThrow(resend, {
                from: "Technova Society <no-reply@technovashardauniversity.in>",
                to: participant.email,
                subject: "🎉 Congratulations! Your Team has been Shortlisted - CodeMania Hackathon",
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #000; color: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #333;">
                        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
                            <h1 style="margin: 0; color: #fff; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">🎉 Congratulations!</h1>
                            <p style="margin: 5px 0 0; color: rgba(255,255,255,0.9); font-weight: bold;">CodeMania Hackathon</p>
                        </div>
                        <div style="padding: 40px 30px; line-height: 1.6;">
                            <h2 style="color: #10b981; margin-top: 0;">Dear ${participant.name},</h2>
                            <p style="color: #ccc; font-size: 16px;">
                                We are thrilled to inform you that your team <strong style="color: #f59e0b;">${team.name}</strong> has been <strong style="color: #10b981;">shortlisted</strong> for the Grand Finale of the CodeMania Hackathon!
                            </p>
                            <div style="background-color: #111; border: 1px solid #222; border-radius: 8px; padding: 20px; margin: 25px 0;">
                                <p style="margin: 0 0 10px; color: #888; font-size: 14px;">Team Details:</p>
                                <p style="margin: 0; font-size: 16px; color: #fff;"><strong>Team:</strong> ${team.name}</p>
                                <p style="margin: 5px 0 0; font-size: 14px; color: #f59e0b;"><strong>Team Code:</strong> ${team.team_code || 'N/A'}</p>
                                <p style="margin: 5px 0 0; font-size: 14px; color: #aaa;"><strong>Project:</strong> ${team.idea_title || 'N/A'}</p>
                            </div>
                            <div style="background-color: #0a2e1e; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
                                <p style="margin: 0; color: #10b981; font-size: 18px; font-weight: bold;">🏆 You're in the Grand Finale!</p>
                                <p style="margin: 10px 0 0; color: #aaa; font-size: 14px;">
                                    The 24-Hour Offline Hackathon awaits you at Sharda University. More details about the event schedule, venue, and logistics will be shared soon.
                                </p>
                            </div>
                            <p style="color: #ccc; font-size: 14px;">
                                Please update your team details at <a href="https://www.technovashardauniversity.in/hackathon/update" style="color: #10b981;">this link</a> before the event. For any queries, reach out to the Technova Society team.
                            </p>
                            <div style="text-align: center; margin-top: 25px;">
                                <a href="https://www.technovashardauniversity.in/hackathon" style="display: inline-block; background-color: #10b981; color: #000; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                                    View Hackathon Details
                                </a>
                            </div>
                        </div>
                        <div style="background-color: #0a0a0a; padding: 20px; text-align: center; border-top: 1px solid #1a1a1a;">
                            <p style="margin: 0; color: #444; font-size: 12px;">&copy; 2026 TechNova | Sharda University</p>
                        </div>
                    </div>
                `
            })
            sentTo.push(participant.email)
            await new Promise(resolve => setTimeout(resolve, 600))
        } catch (e) {
            console.error(`Failed to send email to ${participant.email}`, e)
            failedTo.push(participant.email)
        }
    }

    // Update team status to shortlisted if not already
    if (sentTo.length > 0 && (team.status === 'pending' || team.status === 'evaluating')) {
        await supabase
            .from('hackathon_teams')
            .update({ status: 'shortlisted' })
            .eq('id', teamId)
    }

    revalidatePath('/hackathon-portal/manage')
    revalidatePath('/hackathon')

    if (failedTo.length > 0 && sentTo.length === 0) {
        return { success: false, error: `All emails failed for ${team.name}.`, sentTo, failedTo }
    }

    return {
        success: true,
        message: `✉️ Sent to ${sentTo.length} of ${emails.length} participant(s) for team "${team.name}".${failedTo.length > 0 ? ` ${failedTo.length} failed.` : ''}`,
        sentTo,
        failedTo,
        teamName: team.name
    }
}

export async function blastCustomEmail(subject: string, htmlBody: string, target: 'all' | 'shortlisted') {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) {
        return { error: "Unauthorized" }
    }

    if (!process.env.RESEND_API_KEY) return { error: "Email service not configured" }
    
    // Safety check
    if (!subject || !htmlBody) return { error: "Subject and body are required." }

    const supabase = await getSupabase()
    
    let emails = new Set<string>()
    let participants: any[] = []

    if (target === 'shortlisted') {
        const { data } = await supabase
            .from('hackathon_teams')
            .select(`
                id,
                status,
                hackathon_participants ( email )
            `)
            .in('status', ['shortlisted'])
            
        if (data) {
            data.forEach(team => {
                team.hackathon_participants?.forEach((p: any) => {
                    if (p.email) emails.add(p.email)
                })
            })
        }
    } else {
        const { data } = await supabase
            .from('hackathon_participants')
            .select('email')
            
        if (data) {
            data.forEach(p => {
                if (p.email) emails.add(p.email)
            })
        }
    }

    const uniqueEmails = Array.from(emails).filter(Boolean)
    if (uniqueEmails.length === 0) return { error: "No participants found for the selected target." }

    const resend = new Resend(process.env.RESEND_API_KEY)
    let sentCount = 0
    let failCount = 0

    for (const email of uniqueEmails) {
        try {
            await sendEmailOrThrow(resend, {
                from: "Technova Society <no-reply@technovashardauniversity.in>",
                to: email,
                subject: subject,
                html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                </head>
                <body style="margin:0; padding:0; background-color:#0a0a0a; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a; padding:40px 10px;">
                        <tr>
                            <td align="center">
                                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#111; border-radius:16px; border:1px solid #222; overflow:hidden; margin:0 auto;">
                                    <!-- Header -->
                                    <tr>
                                        <td style="background: linear-gradient(135deg, #f97316, #10b981); padding:32px 40px; text-align:center;">
                                            <h1 style="margin:0; color:#fff; font-size:26px; font-weight:800; letter-spacing:-0.5px; text-transform: uppercase;">
                                                🚀 CodeMania Hackathon
                                            </h1>
                                            <p style="margin:8px 0 0; color:rgba(255,255,255,0.9); font-size:14px; font-weight:600; font-family: monospace; letter-spacing: 2px;">
                                                BY TECHNOVA SOCIETY
                                            </p>
                                        </td>
                                    </tr>
                                    
                                    <!-- Body -->
                                    <tr>
                                        <td style="padding:40px; color:#e5e7eb; font-size:16px; line-height:1.6;">
                                            ${htmlBody.replace(/\n/g, '<br />')}
                                        </td>
                                    </tr>
                                    
                                    <!-- Footer -->
                                    <tr>
                                        <td style="padding:24px 40px; background:#0d0d0d; border-top:1px solid #222; text-align:center;">
                                            <p style="margin:0 0 8px; color:#4b5563; font-size:12px;">
                                                © ${new Date().getFullYear()} Technova — Technical Society, Sharda University
                                            </p>
                                            <p style="margin:0; color:#3a3f47; font-size:10px; font-family: monospace;">
                                                This is an official transmission from the Hackathon Administration.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>`
            })
            sentCount++
            // Throttle: Resend allows max 2 requests/sec (600ms is safe)
            await new Promise(resolve => setTimeout(resolve, 600))
        } catch (e) {
            console.error(`Failed to send custom blast to ${email}`, e)
            failCount++
        }
    }

    return { success: true, message: `✅ Sent to ${sentCount} recipient(s).${failCount > 0 ? ` ${failCount} failed.` : ''}` }
}
// ==========================================
// LOGISTICS & QR ACTIONS
// ==========================================

export async function processHackathonQrScan(participantId: string, actionUrl: 'checkin' | 'checkout' | 'food' | 'food_unlog', mealRound?: string) {
    const { role } = await checkHackathonRole()
    if (role !== 'organizer' && role !== 'volunteer') return { error: "Unauthorized" }

    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    const supabase = await getSupabase()

    // First try participant
    let qrTarget: any = null
    let targetType: 'participant' | 'volunteer' = 'participant'

    const { data: participant } = await supabase
        .from('hackathon_participants')
        .select('*, hackathon_teams(name, team_code)')
        .eq('id', participantId)
        .maybeSingle()

    if (participant) {
        qrTarget = participant
    } else {
        // Try volunteer
        const { data: volTarget } = await supabase
            .from('hackathon_volunteers')
            .select('*')
            .eq('id', participantId)
            .maybeSingle()
        if (volTarget) {
            qrTarget = volTarget
            qrTarget.role = 'Staff Volunteer'
            targetType = 'volunteer'
        }
    }

    if (!qrTarget) return { error: "Invalid QR Code: Person not found." }

    if (targetType === 'volunteer' && session.user.role !== 'super_admin') {
        return { error: "Unauthorized: Only super_admin can scan volunteers." }
    }

    const tableStr = targetType === 'participant' ? 'hackathon_participants' : 'hackathon_volunteers'

    if (actionUrl === 'checkin') {
        if (qrTarget.is_checked_in) return { message: "Already checked in", participant: qrTarget }

        const updateData: any = { is_checked_in: true }
        if (targetType === 'volunteer') {
            updateData.check_in_time = new Date().toISOString()
        }

        const { error } = await supabase
            .from(tableStr)
            .update(updateData)
            .eq('id', participantId)

        if (error) return { error: error.message }
        revalidatePath('/admin/hackathon')
        return { success: true, participant: qrTarget, message: `✅ ${qrTarget.name} — Checked in successfully` }
    }

    if (actionUrl === 'checkout') {
        if (!qrTarget.is_checked_in) return { message: "Not checked in", participant: qrTarget }

        const { error } = await supabase
            .from(tableStr)
            .update({ is_checked_in: false })
            .eq('id', participantId)

        if (error) return { error: error.message }
        revalidatePath('/admin/hackathon')
        return { success: true, participant: qrTarget, message: `👋 ${qrTarget.name} — Checked out successfully` }
    }

    if (actionUrl === 'food') {
        const mealType = mealRound || 'default'

        // Check if this person already scanned for this meal round
        let query = supabase.from('hackathon_food_logs').select('id').eq('meal_type', targetType === 'participant' ? mealType : mealType + `_vol_${participantId}`)
        if (targetType === 'participant') {
            query = query.eq('participant_id', participantId)
        } else {
            query = query.eq('volunteer_id', participantId)
        }
        const { data: existingLog } = await query.maybeSingle()

        if (existingLog) {
            return { error: `${qrTarget.name} has already scanned for "${mealType}". Each person can only scan once per meal round.` }
        }

        const logPayload: any = { meal_type: mealType }
        if (targetType === 'participant') {
            logPayload.participant_id = participantId
        } else {
            // Because our foreign key is to participants, technically food logs might fail if there's no FK constraint on volunteers.
            // Wait, we need to bypass FK or drop it. Or we just keep track in a different table.
            // Let's just bypass the log for a second, and only inc the food_count to be simple.
            // Even better, alter FK on hackathon_food_logs to not enforce participant, or keep participant_id null for volunteers and add volunteer_id.
        }

        // To make it safe without changing FK, if it's a volunteer, we'll just increment food_count directly if they haven't scanned (we can't use logs easily without schema changes, but let's just increment count for volunteers to avoid FK issues).
        // Actually, let's use the standard logs. We will drop the FK constraint on the food log table just for safety in a moment.

        const { error: logError } = await supabase
            .from('hackathon_food_logs')
            .insert({
                participant_id: targetType === 'participant' ? participantId : null,
                meal_type: mealType + (targetType === 'volunteer' ? `_vol_${participantId}` : ''), // hacky way to prevent unique violation
                // We'll fix the DB schema to have volunteer_id. Let's assume we do that next.
                volunteer_id: targetType === 'volunteer' ? participantId : null
            })

        if (logError) return { error: logError.message }

        const { error: updateError } = await supabase
            .from(tableStr)
            .update({ food_count: (qrTarget.food_count || 0) + 1 })
            .eq('id', participantId)

        if (updateError) return { error: updateError.message }

        return { success: true, participant: qrTarget, message: `✅ ${qrTarget.name} — "${mealType}" logged! (Total meals: ${(qrTarget.food_count || 0) + 1})` }
    }

    if (actionUrl === 'food_unlog') {
        // Food unlog removed as per requirements
        return { error: "Food unlog is disabled." }
    }

    return { error: "Invalid action" }
}

export async function manualCheckInParticipant(participantId: string, isCheckedIn: boolean) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    
    // Check if participant exists
    const { data: p } = await supabase.from('hackathon_participants').select('id').eq('id', participantId).maybeSingle()
    if (p) {
        const { error } = await supabase.from('hackathon_participants').update({ is_checked_in: isCheckedIn }).eq('id', participantId)
        if (error) return { error: error.message }
    } else {
        // Evaluate volunteer
        const { error } = await supabase.from('hackathon_volunteers').update({ is_checked_in: isCheckedIn, check_in_time: isCheckedIn ? new Date().toISOString() : null }).eq('id', participantId)
        if (error) return { error: error.message }
    }
    
    revalidatePath('/admin/hackathon')
    return { success: true }
}

// ==========================================
// DATA DOWNLOADS
// ==========================================

export async function getCheckedInParticipantsData() {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized", data: [] }

    const supabase = await getSupabase()
    const { data: participants } = await supabase
        .from('hackathon_participants')
        .select('name, email, phone, role, is_checked_in, food_count, hackathon_teams(name, team_code)')
        .order('is_checked_in', { ascending: false })

    return {
        data: (participants || []).map((p: any) => ({
            'Participant Name': p.name,
            'Email': p.email,
            'Phone': p.phone || '',
            'Role': p.role,
            'Team Name': p.hackathon_teams?.name || '',
            'Team ID': p.hackathon_teams?.team_code || '',
            'Checked In': p.is_checked_in ? 'Yes' : 'No',
            'Meals Taken': p.food_count,
        }))
    }
}

export async function getFoodLogsData() {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized", data: [] }

    const supabase = await getSupabase()
    const { data: logs } = await supabase
        .from('hackathon_food_logs')
        .select('meal_type, scanned_at, hackathon_participants(name, email, phone, hackathon_teams(name, team_code))')
        .order('scanned_at', { ascending: false })

    return {
        data: (logs || []).map((log: any) => ({
            'Participant Name': log.hackathon_participants?.name || '',
            'Email': log.hackathon_participants?.email || '',
            'Phone': log.hackathon_participants?.phone || '',
            'Team Name': log.hackathon_participants?.hackathon_teams?.name || '',
            'Team ID': log.hackathon_participants?.hackathon_teams?.team_code || '',
            'Meal Type': log.meal_type || '',
            // Explicit IST: the server runs in UTC
            'Scanned At': log.scanned_at ? new Date(log.scanned_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
        }))
    }
}

// ==========================================
// SEARCH PARTICIPANTS (for manual check-in)
// ==========================================

export async function searchParticipants(query: string) {
    const session = await auth()
    if (!session || !session.user) return []

    // Allow super_admin, admin, or volunteers
    const isAdmin = session.user.role === 'admin' || session.user.role === 'super_admin'
    const volunteer = await checkVolunteerAccess()
    if (!isAdmin && !volunteer) return []

    if (!query || query.length < 2) return []

    const supabase = await getSupabase()

    // First search by name/email/phone
    const { data: byFields } = await supabase
        .from('hackathon_participants')
        .select('id, name, email, phone, role, is_checked_in, food_count, hackathon_teams(name, team_code)')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(20)

    // Also search by team_code or team name
    const { data: byTeam } = await supabase
        .from('hackathon_participants')
        .select('id, name, email, phone, role, is_checked_in, food_count, hackathon_teams!inner(name, team_code)')
        .or(`hackathon_teams.team_code.ilike.%${query}%,hackathon_teams.name.ilike.%${query}%`)
        .limit(20)

    // Merge and deduplicate
    const merged = [...(byFields || []), ...(byTeam || [])]
    const seen = new Set<string>()
    const unique = merged.filter(p => {
        if (seen.has(p.id)) return false
        seen.add(p.id)
        return true
    })

    return unique.slice(0, 20)
}

export async function getAllParticipantsForScan(page: number = 1, pageSize: number = 20) {
    const session = await auth()
    if (!session || !session.user) return { participants: [], total: 0 }

    const isAdmin = session.user.role === 'admin' || session.user.role === 'super_admin'
    const volunteer = await checkVolunteerAccess()
    if (!isAdmin && !volunteer) return { participants: [], total: 0 }

    const supabase = await getSupabase()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data: participants, count } = await supabase
        .from('hackathon_participants')
        .select('id, name, email, phone, role, is_checked_in, food_count, hackathon_teams(name, team_code)', { count: 'exact' })
        .order('name', { ascending: true })
        .range(from, to)

    // Also fetch all volunteers and merge them in, but only on page 1 so we don't duplicate them across pages
    let finalParticipants: any[] = participants || []
    
    if (page === 1 && isAdmin) {
        let qs = supabase.from('hackathon_volunteers').select('*')
        // Only return volunteers for super_admin
        if (session.user.role === 'super_admin') {
            const { data: vols } = await qs
            
            if (vols && vols.length > 0) {
                const mappedVols = vols.map(v => ({
                    id: v.id,
                    name: v.name,
                    email: v.email,
                    phone: v.mobile || null,
                    role: 'Staff Volunteer',
                    shift: v.shift || null,
                    department: v.department || null,
                    section: v.section || null,
                    system_id: v.system_id || null,
                    year: v.year || null,
                    is_checked_in: v.is_checked_in || false,
                    food_count: v.food_count || 0,
                    hackathon_teams: { name: v.team_name || 'Volunteer', team_code: 'VOLUNTEER' },
                    is_volunteer: true
                }))
                finalParticipants = [...mappedVols, ...finalParticipants]
            }
        }
    }

    return { participants: finalParticipants, total: (count || 0) + (page === 1 ? (finalParticipants.length - (participants?.length || 0)) : 0) }
}

// ==========================================
// VOLUNTEER MANAGEMENT
// ==========================================

export async function getScannerStats(mode: 'checkin' | 'food', mealRound?: string) {
    const session = await auth()
    if (!session || !session.user) return null

    const supabase = await getSupabase()

    let pTotal = 0, pScanned = 0
    let vTotal = 0, vScanned = 0

    // Participants count
    const { count: partTotal } = await supabase.from('hackathon_participants').select('id', { count: 'exact', head: true })
    pTotal = partTotal || 0

    // Volunteers count
    const { count: volTotalRes } = await supabase.from('hackathon_volunteers').select('id', { count: 'exact', head: true })
    vTotal = volTotalRes || 0

    if (mode === 'checkin') {
        const { count: partIn } = await supabase.from('hackathon_participants').select('id', { count: 'exact', head: true }).eq('is_checked_in', true)
        const { count: volIn } = await supabase.from('hackathon_volunteers').select('id', { count: 'exact', head: true }).eq('is_checked_in', true)
        pScanned = partIn || 0
        vScanned = volIn || 0
    } else if (mode === 'food' && mealRound) {
        const mealType = mealRound || 'default'
        
        // Participants who took meal
        const { count: pMealCount } = await supabase.from('hackathon_food_logs').select('id', { count: 'exact', head: true })
            .eq('meal_type', mealType)
            .not('participant_id', 'is', null)
        pScanned = pMealCount || 0

        // Volunteers who took meal (meal_type starts with mealType + '_vol_')
        // actually easier: volunteer_id is not null? We don't have volunteer_id populated accurately in all iterations. But we can just use `not volunteer_id is null` if we added it, wait.
        // We do: `volunteer_id: targetType === 'volunteer' ? participantId : null` in insert. 
        const { count: vMealCount } = await supabase.from('hackathon_food_logs').select('id', { count: 'exact', head: true })
            .like('meal_type', `${mealType}_vol_%`)
        vScanned = vMealCount || 0
    }

    return { pTotal, pScanned, vTotal, vScanned }
}

export async function checkVolunteerAccess() {
    const session = await auth()
    if (!session || !session.user || !session.user.email) return null

    const supabase = await getSupabase()
    const { data } = await supabase
        .from('hackathon_volunteers')
        .select('id, name')
        .eq('email', session.user.email)
        .single()

    return data || null
}

export async function getVolunteers() {
    const session = await auth()
    if (!session || session.user.role !== 'super_admin') return []

    const supabase = await getSupabase()
    const { data: volunteers } = await supabase
        .from('hackathon_volunteers')
        .select('*')
        .order('created_at', { ascending: false })

    return volunteers || []
}

export async function addVolunteer(email: string, name: string = 'Volunteer', teamName: string = 'Registration & Stage Team', shift?: string, assignedTeamId?: string, extraFields?: { system_id?: string, section?: string, year?: string, mobile?: string, department?: string }) {
    const session = await auth()
    if (!session || !['super_admin', 'admin', 'student_lead'].includes(session.user.role as string)) return { error: 'Unauthorized' }

    const supabase = await getSupabase()
    const emailLower = email.trim().toLowerCase()
    const { error } = await supabase
        .from('hackathon_volunteers')
        .insert({ 
            email: emailLower, 
            name: name.trim(), 
            team_name: teamName,
            shift: shift || null,
            assigned_team_id: assignedTeamId || null,
            system_id: extraFields?.system_id || null,
            section: extraFields?.section || null,
            year: extraFields?.year || null,
            mobile: extraFields?.mobile || null,
            department: extraFields?.department || null
        })

    if (error) {
        if (error.code === '23505') return { error: "Volunteer already exists" }
        return { error: error.message }
    }

    // Auto-assign role: if teamName indicates Student Lead, assign student_lead role; otherwise volunteer
    const isStudentLead = teamName.toLowerCase().includes('student lead') || teamName.toLowerCase().includes('lead')
    const roleToAssign = isStudentLead ? 'student_lead' : 'volunteer'
    await supabase
        .from('hackathon_roles')
        .upsert({ email: emailLower, role: roleToAssign }, { onConflict: 'email' })

    revalidatePath('/hackathon-portal')
    return { success: true }
}

export async function uploadVolunteersData(formData: FormData) {
    const session = await auth()
    if (!session || !['admin', 'super_admin', 'student_lead'].includes(session.user.role as string)) {
        return { error: "Unauthorized" }
    }

    const file = formData.get('file') as File
    if (!file) return { error: "No file provided" }

    try {
        const buffer = await file.arrayBuffer()
        const workbook = xlsx.read(buffer, { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        let rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: '' })

        if (rows.length === 0) return { error: "No data found in file" }

        // Handle merged title rows (e.g. "Volunteers" spanning the whole first row).
        // When xlsx parses this, Row 1 becomes keys like __EMPTY, __EMPTY_1, etc.
        // and Row 2 (the real headers: S.No, Name, Team...) becomes data row 0.
        // Detect this by checking if the first row's VALUES look like column headers.
        const firstRowValues = Object.values(rows[0]).map((v: any) => String(v).trim().toLowerCase());
        const headerIndicators = ['name', 'email', 'team', 'system id', 'section', 'year', 'mobile', 'department', 's.no'];
        const looksLikeHeaders = headerIndicators.filter(h => firstRowValues.some(v => v.includes(h))).length >= 3;

        if (looksLikeHeaders) {
            // First row is the real header row — remap all subsequent rows
            const realHeaders = Object.values(rows[0]).map((v: any) => String(v).trim());
            const oldKeys = Object.keys(rows[0]);
            rows = rows.slice(1).map(row => {
                const remapped: any = {};
                oldKeys.forEach((oldKey, idx) => {
                    if (idx < realHeaders.length) {
                        remapped[realHeaders[idx]] = row[oldKey] ?? '';
                    }
                });
                return remapped;
            });
        }

        if (rows.length === 0) return { error: "No data rows found after header detection" }

        const supabase = await getSupabase()
        let insertedCount = 0
        let skippedCount = 0

        const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

        for (const row of rows) {
            const keys = Object.keys(row);
            const findKey = (...patterns: string[]) => keys.find(k => {
                const c = cleanStr(k);
                return patterns.some(p => c.includes(p));
            });

            const nameKey = findKey('name');
            const emailKey = findKey('email');
            const teamKey = findKey('team', 'role');
            const systemIdKey = findKey('systemid', 'system');
            const sectionKey = findKey('section');
            const yearKey = findKey('year');
            const mobileKey = findKey('mobilenumber', 'mobile', 'phone');
            const departmentKey = findKey('department', 'dept');
            const shiftKey = findKey('desiredslot', 'shift', 'slot');

            const name = nameKey ? String(row[nameKey]).trim() : '';
            const email = emailKey ? String(row[emailKey]).trim().toLowerCase() : '';
            const teamName = teamKey ? String(row[teamKey]).trim() : 'Volunteer';
            const systemId = systemIdKey ? String(row[systemIdKey]).trim() : '';
            const section = sectionKey ? String(row[sectionKey]).trim() : '';
            const year = yearKey ? String(row[yearKey]).trim() : '';
            const mobile = mobileKey ? String(row[mobileKey]).trim() : '';
            const department = departmentKey ? String(row[departmentKey]).trim() : '';
            const shift = shiftKey ? String(row[shiftKey]).trim() : '';

            if (!email || !name) { skippedCount++; continue }

            const { error } = await supabase
                .from('hackathon_volunteers')
                .upsert({
                    email,
                    name,
                    team_name: teamName || 'Volunteer',
                    system_id: systemId || null,
                    section: section || null,
                    year: year || null,
                    mobile: mobile || null,
                    department: department || null,
                    shift: shift || null,
                    assigned_team_id: null
                }, { onConflict: 'email' })

            if (error) { skippedCount++; continue }

            // Auto-assign role
            const isStudentLead = teamName.toLowerCase().includes('student lead') || teamName.toLowerCase().includes('lead') || teamName.toLowerCase().includes('overall head') || teamName.toLowerCase().includes('head')
            const roleToAssign = isStudentLead ? 'student_lead' : 'volunteer'
            await supabase
                .from('hackathon_roles')
                .upsert({ email, role: roleToAssign }, { onConflict: 'email' })

            insertedCount++
        }

        revalidatePath('/hackathon-portal')
        return { success: true, message: `✅ Uploaded ${insertedCount} volunteer(s). ${skippedCount > 0 ? `${skippedCount} skipped.` : ''}` }
    } catch (err: any) {
        return { error: err.message || "Failed to process file" }
    }
}

export async function updateVolunteerShift(volunteerId: string, shift: string) {
    const session = await auth()
    if (!session || !['admin', 'super_admin', 'student_lead'].includes(session.user.role as string)) {
        return { error: "Unauthorized" }
    }
    const supabase = await getSupabase()
    const { error } = await supabase
        .from('hackathon_volunteers')
        .update({ shift: shift || null })
        .eq('id', volunteerId)
    if (error) return { error: error.message }
    return { success: true }
}

// ==========================================
// VOLUNTEER SCANNER ACTIONS
// ==========================================

export async function getAllVolunteersForScan() {
    const session = await auth()
    if (!session || !session.user) return { volunteers: [], total: 0 }

    const isAdmin = ['admin', 'super_admin', 'student_lead'].includes(session.user.role as string)
    if (!isAdmin) return { volunteers: [], total: 0 }

    const supabase = await getSupabase()
    const { data, count } = await supabase
        .from('hackathon_volunteers')
        .select('*', { count: 'exact' })
        .order('name', { ascending: true })

    return { volunteers: data || [], total: count || 0 }
}

export async function processVolunteerQrScan(volunteerId: string, action: 'checkin' | 'checkout') {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    const isAdmin = ['admin', 'super_admin', 'student_lead'].includes(session.user.role as string)
    if (!isAdmin) return { error: "Unauthorized" }

    const supabase = await getSupabase()

    const { data: volunteer } = await supabase
        .from('hackathon_volunteers')
        .select('*')
        .eq('id', volunteerId)
        .maybeSingle()

    if (!volunteer) return { error: "Volunteer not found. Invalid QR Code." }

    if (action === 'checkin') {
        if (volunteer.is_checked_in) return { message: "Already checked in", volunteer }
        const { error } = await supabase
            .from('hackathon_volunteers')
            .update({ is_checked_in: true, check_in_time: new Date().toISOString() })
            .eq('id', volunteerId)
        if (error) return { error: error.message }
        return { success: true, volunteer, message: `✅ ${volunteer.name} — Checked in successfully` }
    }

    if (action === 'checkout') {
        if (!volunteer.is_checked_in) return { message: "Not checked in", volunteer }
        const { error } = await supabase
            .from('hackathon_volunteers')
            .update({ is_checked_in: false })
            .eq('id', volunteerId)
        if (error) return { error: error.message }
        return { success: true, volunteer, message: `👋 ${volunteer.name} — Checked out successfully` }
    }

    return { error: "Invalid action" }
}

export async function removeVolunteer(id: string) {
    const session = await auth()
    if (!session || session.user.role !== 'super_admin') return { error: 'Unauthorized' }

    const supabase = await getSupabase()
    const { error } = await supabase
        .from('hackathon_volunteers')
        .delete()
        .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/hackathon-portal')
    return { success: true }
}

// ==========================================
// ROLES MANAGEMENT
// ==========================================

export async function getHackathonRoles() {
    const session = await auth()
    if (!session || session.user.role !== 'super_admin') return []

    const supabase = await getSupabase()
    const { data: roles } = await supabase
        .from('hackathon_roles')
        .select('*')
        .order('created_at', { ascending: false })

    return roles || []
}

export async function addHackathonRole(email: string, role: string) {
    const session = await auth()
    if (!session || session.user.role !== 'super_admin') return { error: 'Unauthorized' }

    const supabase = await getSupabase()
    const { error } = await supabase
        .from('hackathon_roles')
        .insert({ 
            email: email.trim().toLowerCase(), 
            role: role
        })

    if (error) {
        if (error.code === '23505') return { error: "User already has a role assigned" }
        return { error: error.message }
    }
    revalidatePath('/admin/hackathon')
    return { success: true }
}

export async function removeHackathonRole(id: string) {
    const session = await auth()
    if (!session || session.user.role !== 'super_admin') return { error: 'Unauthorized' }

    const supabase = await getSupabase()
    const { error } = await supabase
        .from('hackathon_roles')
        .delete()
        .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/admin/hackathon')
    return { success: true }
}

// ==========================================
// HACKATHON ROLE CHECK (for portal access)
// ==========================================

export type HackathonRole = 'organizer' | 'evaluator' | 'volunteer' | 'none'

export async function checkHackathonRole(): Promise<{ role: HackathonRole, user: any }> {
    const session = await auth()
    if (!session || !session.user) return { role: 'none', user: null }

    // Admins, Super admins, and Student Leads are organizers
    if (session.user.role === 'super_admin' || session.user.role === 'admin' || session.user.role === 'student_lead') {
        return { role: 'organizer', user: session.user }
    }

    // Check evaluator table
    const evaluator = await checkEvaluatorAccess()
    if (evaluator) return { role: 'evaluator', user: session.user }

    // Check volunteer table
    const volunteer = await checkVolunteerAccess()
    if (volunteer) return { role: 'volunteer', user: session.user }

    // Check hackathon_roles table (people assigned roles in Settings get volunteer/organizer-level access based on their assigned role)
    const supabase = await getSupabase()
    const { data: roleEntry } = await supabase
        .from('hackathon_roles')
        .select('role')
        .eq('email', (session.user.email || '').toLowerCase())
        .maybeSingle()
    if (roleEntry) {
        if (roleEntry.role === 'admin' || roleEntry.role === 'super_admin' || roleEntry.role === 'organizer') return { role: 'organizer', user: session.user }
        if (roleEntry.role === 'evaluator') return { role: 'evaluator', user: session.user }
        return { role: 'volunteer', user: session.user }
    }

    return { role: 'none', user: session.user }
}

// Check if an email has hackathon access (for login gating)
export async function isHackathonEmail(email: string): Promise<boolean> {
    const supabase = await getSupabase()

    // 1. Role explicit allows
    const { data: roleData } = await supabase
        .from('hackathon_roles')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle()
    if (roleData) return true

    // 2. Evaluator check
    const { data: evaluator } = await supabase
        .from('hackathon_evaluators')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle()

    if (evaluator) return true

    // 3. Volunteer check
    const { data: volunteer } = await supabase
        .from('hackathon_volunteers')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle()

    return !!volunteer
}

// ==========================================
// EVENT ATTENDANCE TRACKING
// ==========================================

export async function importEventAttendees(rows: any[], eventTag: string = 'general') {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    let imported = 0
    let skipped = 0

    for (const row of rows) {
        const name = row['Name'] || row['name'] || row['Student Name'] || ''
        const email = row['Email'] || row['email'] || row['Email ID'] || row['Email Id'] || row['Email Address'] || row['email address'] || row['EmailAddress'] || row['email_address'] || ''
        const mobile = row['Mobile'] || row['mobile'] || row['Phone'] || row['Mobile Number'] || row['Contact'] || row['Phone Number'] || row['phone'] || ''
        const systemId = row['System ID'] || row['system_id'] || row['System Id'] || row['SID'] || row['Enrollment No'] || ''
        const section = row['Section'] || row['section'] || ''
        const department = row['Department'] || row['department'] || row['Course'] || row['Branch'] || ''
        const year = row['Year'] || row['year'] || row['Yr'] || ''
        const college = row['College'] || row['college'] || row['University'] || 'Sharda University'

        if (!name.trim()) { skipped++; continue }

        const { error } = await supabase.from('event_attendees').insert({
            name: name.trim(),
            email: email.trim() || null,
            mobile: String(mobile).trim() || null,
            system_id: String(systemId).trim() || null,
            section: section.trim() || null,
            department: department.trim() || null,
            college: college.trim(),
            year: year.toString().trim() || null,
            event_tag: eventTag
        })

        if (error) {
            console.error(`Failed to import attendee ${name}:`, error.message)
            skipped++
        } else {
            imported++
        }
    }

    revalidatePath('/hackathon-portal/manage')
    return { success: true, imported, skipped, message: `Imported ${imported} attendees. ${skipped > 0 ? `${skipped} skipped.` : ''}` }
}

export async function getEventAttendees(eventTag?: string) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return []

    const supabase = await getSupabase()
    let query = supabase.from('event_attendees').select('*, event_attendance_scans(checkpoint, scanned_at)').order('created_at', { ascending: false })

    if (eventTag) {
        query = query.eq('event_tag', eventTag)
    }

    const { data, error } = await query
    if (error) {
        console.error("Error fetching attendees:", error)
        return []
    }
    return data || []
}

export async function deleteEventAttendees(eventTag: string) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    const { error } = await supabase.from('event_attendees').delete().eq('event_tag', eventTag)
    if (error) return { error: error.message }

    revalidatePath('/hackathon-portal/manage')
    return { success: true, message: 'Attendees deleted.' }
}

export async function updateSingleAttendee(attendeeId: string, fields: {
    name?: string, email?: string, mobile?: string, system_id?: string, section?: string, department?: string, year?: string
}) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    const updateData: any = {}
    if (fields.name !== undefined) updateData.name = fields.name.trim()
    if (fields.email !== undefined) updateData.email = fields.email.trim() || null
    if (fields.mobile !== undefined) updateData.mobile = fields.mobile.trim() || null
    if (fields.system_id !== undefined) updateData.system_id = fields.system_id.trim() || null
    if (fields.section !== undefined) updateData.section = fields.section.trim() || null
    if (fields.department !== undefined) updateData.department = fields.department.trim() || null
    if (fields.year !== undefined) updateData.year = fields.year.trim() || null

    const { error } = await supabase.from('event_attendees').update(updateData).eq('id', attendeeId)
    if (error) return { error: error.message }
    return { success: true }
}

export async function sendAttendeeQrEmails(eventTag: string, eventName: string = 'Event') {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    if (!process.env.RESEND_API_KEY) return { error: "Email service not configured (RESEND_API_KEY)" }

    const supabase = await getSupabase()

    // Get all attendees for this event that haven't been emailed
    const { data: attendees } = await supabase
        .from('event_attendees')
        .select('*')
        .eq('event_tag', eventTag)
        .eq('qr_emailed', false)
        .not('email', 'is', null)

    if (!attendees || attendees.length === 0) return { error: "No un-emailed attendees found.", sent: 0, failed: 0, failedEmails: [] }

    const resend = new Resend(process.env.RESEND_API_KEY)
    let sent = 0
    const failedEmails: string[] = []

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.technovashardauniversity.in'

    for (const attendee of attendees) {
        if (!attendee.email) continue
        try {
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(attendee.qr_code)}`

            await sendEmailOrThrow(resend, {
                from: "Technova Society <no-reply@technovashardauniversity.in>",
                to: attendee.email,
                subject: `🎫 Your Attendance QR Code — ${eventName}`,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #000; color: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #333;">
                        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center;">
                            <h1 style="margin: 0; color: #fff; font-size: 22px; letter-spacing: 1px;">🎫 Your Attendance QR</h1>
                            <p style="margin: 5px 0 0; color: rgba(255,255,255,0.9); font-weight: bold;">${eventName}</p>
                        </div>
                        <div style="padding: 30px; text-align: center; line-height: 1.6;">
                            <h2 style="color: #a78bfa; margin-top: 0;">Hi ${attendee.name},</h2>
                            <p style="color: #ccc; font-size: 15px;">
                                Please show this QR code at each checkpoint during the event. Your attendance will be recorded automatically.
                            </p>
                            <div style="background-color: #fff; border-radius: 12px; padding: 20px; margin: 20px auto; display: inline-block;">
                                <img src="${qrImageUrl}" alt="QR Code" style="width: 250px; height: 250px;" />
                            </div>
                            <div style="background-color: #111; border: 1px solid #222; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: left;">
                                <p style="margin: 0 0 5px; color: #888; font-size: 13px;">Your Details:</p>
                                <p style="margin: 0; color: #fff; font-size: 15px;"><strong>${attendee.name}</strong></p>
                                ${attendee.system_id ? `<p style="margin: 3px 0 0; color: #a78bfa; font-size: 13px;">System ID: ${attendee.system_id}</p>` : ''}
                                ${attendee.department ? `<p style="margin: 3px 0 0; color: #aaa; font-size: 13px;">${attendee.department}${attendee.section ? ` — Section ${attendee.section}` : ''}</p>` : ''}
                            </div>
                            <div style="margin: 20px auto; text-align: center;">
                                <a href="${baseUrl}/attendance/register" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 12px 30px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 14px;">📝 Complete Your Registration</a>
                                <p style="color: #888; font-size: 12px; margin-top: 8px;">Fill in your System ID, Section, Department &amp; Year</p>
                            </div>
                            <p style="color: #666; font-size: 12px; margin-top: 20px;">
                                Please keep this email handy. You can also take a screenshot of the QR code.
                            </p>
                        </div>
                        <div style="background-color: #0a0a0a; padding: 15px; text-align: center; border-top: 1px solid #1a1a1a;">
                            <p style="margin: 0; color: #444; font-size: 11px;">&copy; 2026 TechNova | Sharda University</p>
                        </div>
                    </div>
                `
            })

            // Mark as emailed
            await supabase.from('event_attendees').update({ qr_emailed: true }).eq('id', attendee.id)
            sent++

            // Throttle: 2 req/sec limit
            await new Promise(resolve => setTimeout(resolve, 600))
        } catch (e) {
            console.error(`Failed to email ${attendee.email}:`, e)
            failedEmails.push(attendee.email)
        }
    }

    revalidatePath('/hackathon-portal/manage')
    return {
        success: true,
        sent,
        failed: failedEmails.length,
        failedEmails,
        message: `✅ Sent ${sent} QR emails.${failedEmails.length > 0 ? ` ${failedEmails.length} failed — retry these.` : ''}`
    }
}

export async function processAttendanceScan(qrCode: string, checkpoint: string) {
    const { role } = await checkHackathonRole()
    if (role !== 'organizer' && role !== 'volunteer') return { error: "Unauthorized" }

    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    const supabase = await getSupabase()

    // Find the attendee by QR code
    const { data: attendee, error: findError } = await supabase
        .from('event_attendees')
        .select('*')
        .eq('qr_code', qrCode.trim())
        .maybeSingle()

    if (findError || !attendee) return { error: "Invalid QR Code: Attendee not found." }

    // Check if already scanned for this checkpoint
    const { data: existing } = await supabase
        .from('event_attendance_scans')
        .select('id')
        .eq('attendee_id', attendee.id)
        .eq('checkpoint', checkpoint)
        .maybeSingle()

    if (existing) {
        return { already: true, attendee, message: `${attendee.name} already scanned for "${checkpoint}".` }
    }

    // Record the scan
    const { error: insertError } = await supabase.from('event_attendance_scans').insert({
        attendee_id: attendee.id,
        checkpoint,
        scanned_by: session.user.email || 'unknown'
    })

    if (insertError) return { error: insertError.message }

    return {
        success: true,
        attendee,
        message: `✅ ${attendee.name} — ${checkpoint} recorded${attendee.system_id ? ` (${attendee.system_id})` : ''}`
    }
}

export async function getAttendanceReport(eventTag: string) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return []

    const supabase = await getSupabase()
    const { data, error } = await supabase
        .from('event_attendees')
        .select('*, event_attendance_scans(checkpoint, scanned_at, scanned_by)')
        .eq('event_tag', eventTag)
        .order('name', { ascending: true })

    if (error) {
        console.error("Error fetching attendance report:", error)
        return []
    }
    return data || []
}

export async function getAttendanceCheckpoints() {
    const supabase = await getSupabase()
    const { data } = await supabase.from('hackathon_settings').select('attendance_checkpoints').single()
    return data?.attendance_checkpoints || ['Registration', 'Food', 'Exit']
}

export async function updateAttendanceCheckpoints(checkpoints: string[]) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    const { error } = await supabase.from('hackathon_settings').update({ attendance_checkpoints: checkpoints }).not('id', 'is', null)

    if (error) return { error: error.message }
    revalidatePath('/hackathon-portal/manage')
    return { success: true }
}

export async function getAllAttendeesForScan(eventTag?: string) {
    const session = await auth()
    if (!session || !session.user) return { attendees: [], total: 0 }

    const isAdmin = ['admin', 'super_admin', 'student_lead'].includes(session.user.role as string)
    const volunteer = await checkVolunteerAccess()
    if (!isAdmin && !volunteer) return { attendees: [], total: 0 }

    const supabase = await getSupabase()
    let query = supabase.from('event_attendees').select('*, event_attendance_scans(checkpoint, scanned_at)', { count: 'exact' }).order('name', { ascending: true })

    if (eventTag) {
        query = query.eq('event_tag', eventTag)
    }

    const { data, count, error } = await query
    if (error) return { attendees: [], total: 0 }
    return { attendees: data || [], total: count || 0 }
}

export async function saveAttendanceEventSettings(eventTag: string, eventName: string) {
    const session = await auth()
    if (!session || !session.user || (!['admin', 'super_admin', 'student_lead'].includes(session.user.role as string))) return { error: "Unauthorized" }

    const supabase = await getSupabase()
    const { error } = await supabase.from('hackathon_settings').update({
        attendance_event_tag: eventTag,
        attendance_event_name: eventName
    }).not('id', 'is', null)

    if (error) return { error: error.message }
    return { success: true }
}

export async function getAttendanceEventSettings() {
    const supabase = await getSupabase()
    const { data } = await supabase.from('hackathon_settings').select('attendance_event_tag, attendance_event_name, attendance_checkpoints').single()
    return {
        eventTag: data?.attendance_event_tag || 'general',
        eventName: data?.attendance_event_name || 'Event',
        checkpoints: data?.attendance_checkpoints || ['Registration', 'Food', 'Exit']
    }
}

// ------------------------------------------------------------------
// Public attendance kiosk (/attendance/register) — no login by design.
// Hardening, since anyone can call these:
//  - emails must match exactly; `%`, `*` (pattern wildcards) are rejected,
//    otherwise "%@gmail.com" would return a stranger's details
//  - updates require the attendee's email as well as their id
//  - per-IP rate limits slow down guessing
// A full fix (email one-time code) is tracked in BUGS.md.
// ------------------------------------------------------------------

const KIOSK_EMAIL_PATTERN = /^[^\s@%*]+@[^\s@%*]+\.[^\s@%*]+$/
const KIOSK_MAX_FIELD_LENGTH = 100

async function kioskRateLimited(action: string, limit: number) {
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
    return !checkRateLimit(`attendance-kiosk:${action}:ip:${ip}`, { limit, windowSeconds: 60 }).success
}

/** Exact, case-insensitive lookup without LIKE-wildcard surprises. */
async function findAttendeeByExactEmail(email: string) {
    const normalized = email.trim().toLowerCase()
    const supabase = await getSupabase()
    const { data, error } = await supabase
        .from('event_attendees')
        .select('id, name, email, system_id, section, department, year')
        .ilike('email', normalized)
        .limit(5)
    if (error) return { error: error.message, attendee: null }
    const attendee = (data || []).find(a => (a.email || '').trim().toLowerCase() === normalized) || null
    return { error: null, attendee }
}

function cleanKioskField(value: unknown): string {
    return typeof value === 'string' ? value.trim().slice(0, KIOSK_MAX_FIELD_LENGTH) : ''
}

// Public: student self-registration — lookup by email and update their details
export async function lookupAttendeeByEmail(email: string) {
    if (!email || !email.trim()) return { error: "Please enter your email." }
    if (!KIOSK_EMAIL_PATTERN.test(email.trim())) return { error: "Please enter a valid email address." }
    if (await kioskRateLimited('lookup', 15)) return { error: "Too many attempts. Please wait a minute and try again." }

    const { attendee } = await findAttendeeByExactEmail(email)
    if (!attendee) return { error: "No registration found with this email. Please contact the event organizers." }

    return { success: true, attendee }
}

export async function updateAttendeeDetails(attendeeId: string, details: { system_id: string, section: string, department: string, year?: string, email?: string }) {
    if (!attendeeId) return { error: "Invalid attendee" }
    const email = cleanKioskField(details.email)
    if (!email || !KIOSK_EMAIL_PATTERN.test(email)) return { error: "Please look up your registration again." }
    if (await kioskRateLimited('update', 10)) return { error: "Too many attempts. Please wait a minute and try again." }

    // The id alone isn't proof of identity; the attendee's email must match too
    const { attendee } = await findAttendeeByExactEmail(email)
    if (!attendee || attendee.id !== attendeeId) return { error: "Could not verify your registration. Please look it up again." }

    const supabase = await getSupabase()
    const { error } = await supabase
        .from('event_attendees')
        .update({
            system_id: cleanKioskField(details.system_id) || null,
            section: cleanKioskField(details.section) || null,
            department: cleanKioskField(details.department) || null,
            year: cleanKioskField(details.year) || null
        })
        .eq('id', attendee.id)

    if (error) return { error: error.message }
    return { success: true, message: "Your details have been updated successfully!" }
}

export async function registerNewAttendee(details: { name: string, email: string, mobile: string, system_id: string, section: string, department: string, year: string }) {
    if (!details.name || !details.email || !details.system_id || !details.section || !details.department || !details.year) {
        return { error: "Please fill in all required fields." }
    }
    if (!KIOSK_EMAIL_PATTERN.test(details.email.trim())) return { error: "Please enter a valid email address." }
    if (await kioskRateLimited('register', 5)) return { error: "Too many attempts. Please wait a minute and try again." }

    const { eventTag } = await getAttendanceEventSettings()
    const supabase = await getSupabase()

    // Check if already exists
    const { attendee: existing } = await findAttendeeByExactEmail(details.email)
    if (existing) {
        return { error: "An attendee with this email is already registered. Please use the lookup feature instead." }
    }

    const { data, error } = await supabase.from('event_attendees').insert({
        name: cleanKioskField(details.name),
        email: cleanKioskField(details.email),
        mobile: cleanKioskField(details.mobile) || null,
        system_id: cleanKioskField(details.system_id),
        section: cleanKioskField(details.section),
        department: cleanKioskField(details.department),
        year: cleanKioskField(details.year),
        event_tag: eventTag,
        qr_code: crypto.randomUUID()
    }).select('id, name, email, system_id, section, department, year').single()

    if (error) return { error: error.message }
    return { success: true, message: "Registration successful!", attendee: data }
}

export async function getHackathonTeamUpdates() {
    const session = await auth();
    if (!session || !session.user || (!['admin', 'super_admin'].includes(session.user.role as string))) return [];

    const supabase = await getSupabase();
    const { data } = await supabase
        .from('hackathon_team_updates')
        .select(`
            id, created_at, update_data,
            hackathon_teams (name, team_code, theme)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
        
    return data || [];
}
// ==========================================
// GATE ENTRY/EXIT SCANNER
// ==========================================

export async function processGateScan(participantId: string) {
    const { role } = await checkHackathonRole()
    if (role !== 'organizer' && role !== 'volunteer') return { error: "Unauthorized" }

    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    const supabase = await getSupabase()

    // Look up the participant
    const { data: participant } = await supabase
        .from('hackathon_participants')
        .select('id, name, email, role, hackathon_teams(name, team_code)')
        .eq('id', participantId)
        .maybeSingle()

    if (!participant) return { error: "Invalid QR Code: Person not found." }

    // Get the last gate log for this participant to auto-toggle direction
    const { data: lastLog } = await supabase
        .from('hackathon_gate_logs')
        .select('direction, scanned_at')
        .eq('participant_id', participantId)
        .order('scanned_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    // Everyone starts INSIDE. First scan = exit (going out), then toggle.
    const direction = lastLog?.direction === 'exit' ? 'entry' : 'exit'

    // Insert the gate log
    const { error: insertError } = await supabase
        .from('hackathon_gate_logs')
        .insert({
            participant_id: participantId,
            direction,
            scanned_by: session.user.email || session.user.name || 'unknown'
        })

    if (insertError) return { error: insertError.message }

    const teamInfo = (participant as any).hackathon_teams

    // Calculate time outside if this is an ENTRY (coming back)
    let timeOutside = ''
    if (direction === 'entry' && lastLog?.scanned_at) {
        const exitTime = new Date(lastLog.scanned_at).getTime()
        const entryTime = Date.now()
        const diffMs = entryTime - exitTime
        const mins = Math.floor(diffMs / 60000)
        if (mins < 60) {
            timeOutside = `${mins} min outside`
        } else {
            const hrs = Math.floor(mins / 60)
            const remMins = mins % 60
            timeOutside = `${hrs}h ${remMins}m outside`
        }
    }

    const dirLabel = direction === 'exit' ? '🟠 EXIT' : '🟢 ENTRY'

    return {
        success: true,
        direction,
        participant: {
            name: participant.name,
            role: participant.role,
            teamName: teamInfo?.name || '',
            teamCode: teamInfo?.team_code || '',
        },
        timeOutside,
        message: `${dirLabel} — ${participant.name} (${teamInfo?.team_code || 'N/A'})${timeOutside ? `\n${timeOutside}` : ''}`
    }
}

export async function getGateStats() {
    const { role } = await checkHackathonRole()
    if (role !== 'organizer' && role !== 'volunteer') return null

    const supabase = await getSupabase()

    // Total participants
    const { count: totalParticipants } = await supabase
        .from('hackathon_participants')
        .select('id', { count: 'exact', head: true })

    // Total gate scans
    const { count: totalScans } = await supabase
        .from('hackathon_gate_logs')
        .select('id', { count: 'exact', head: true })

    // Get the latest gate log per participant to determine who is currently outside
    // (paged: a single response stops at 1000 rows, which a busy hackathon passes)
    const { data: allLogs } = await fetchAllRows<{ participant_id: string; direction: string; scanned_at: string }>((from, to) =>
        supabase
            .from('hackathon_gate_logs')
            .select('participant_id, direction, scanned_at')
            .order('scanned_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to)
    )

    // Build a map: participantId -> latest direction
    const latestDirection = new Map<string, string>()
    for (const log of (allLogs || [])) {
        if (!latestDirection.has(log.participant_id)) {
            latestDirection.set(log.participant_id, log.direction)
        }
    }

    // Everyone starts INSIDE. Only those whose last log is 'exit' are outside.
    let outsideCount = 0
    latestDirection.forEach((dir) => {
        if (dir === 'exit') outsideCount++
    })

    const total = totalParticipants || 0
    const insideCount = total - outsideCount

    return {
        totalParticipants: total,
        totalScans: totalScans || 0,
        insideCount,
        outsideCount,
        trackedCount: latestDirection.size,
    }
}

export async function getOverdueParticipants() {
    const { role } = await checkHackathonRole()
    if (role !== 'organizer' && role !== 'volunteer') return []

    const supabase = await getSupabase()

    // Paged: a single response stops at 1000 rows
    const { data: allLogs, error: logsError } = await fetchAllRows<any>((from, to) =>
        supabase
            .from('hackathon_gate_logs')
            .select(`
                participant_id, 
                direction, 
                scanned_at,
                hackathon_participants (name, phone, hackathon_teams(name, team_code))
            `)
            .order('scanned_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to)
    )

    if (logsError) return []

    const latestLogs = new Map<string, any>()
    for (const log of allLogs) {
        if (!latestLogs.has(log.participant_id)) {
            latestLogs.set(log.participant_id, log)
        }
    }

    const overdue: any[] = []
    const now = Date.now()

    latestLogs.forEach((log) => {
        if (log.direction === 'exit') {
            const exitTime = new Date(log.scanned_at).getTime()
            const diffMs = now - exitTime
            const mins = Math.floor(diffMs / 60000)
            
            // If outside for more than 30 mins
            if (mins >= 30) {
                const p = log.hackathon_participants
                const team = (p as any)?.hackathon_teams
                overdue.push({
                    id: log.participant_id,
                    name: p?.name || 'Unknown',
                    phone: p?.phone || 'N/A',
                    teamName: team?.name || 'N/A',
                    teamCode: team?.team_code || 'N/A',
                    minsOutside: mins,
                    scannedAt: log.scanned_at
                })
            }
        }
    })

    return overdue.sort((a, b) => b.minsOutside - a.minsOutside)
}

export async function getGateLogs() {
    const { role } = await checkHackathonRole()
    if (role !== 'organizer') {
        return { error: "Unauthorized — organizer access required", data: [] }
    }

    const supabase = await getSupabase()

    // Paged: the CSV export used to stop silently at 1000 rows
    const { data: logs, error } = await fetchAllRows<any>((from, to) =>
        supabase
            .from('hackathon_gate_logs')
            .select(`
                id, direction, scanned_by, scanned_at,
                hackathon_participants (
                    name, email, role,
                    hackathon_teams (name, team_code)
                )
            `)
            .order('scanned_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to)
    )

    if (error) {
        console.error('[getGateLogs] error:', error)
        return { error, data: [] }
    }

    // Group logs by participant to compute time-outside per exit→entry pair
    const participantLogs = new Map<string, any[]>()
    for (const log of (logs || [])) {
        const pid = (log as any).hackathon_participants?.email || log.id
        const pName = (log as any).hackathon_participants?.name || ''
        const key = pName + '_' + pid
        if (!participantLogs.has(key)) participantLogs.set(key, [])
        participantLogs.get(key)!.push(log)
    }

    // Build CSV rows with time-outside calculated
    const rows = (logs || []).map((log: any) => {
        let timeOutside = ''

        // If this is an ENTRY, find the previous EXIT for this participant to compute duration
        if (log.direction === 'entry') {
            const pid = log.hackathon_participants?.email || ''
            const pName = log.hackathon_participants?.name || ''
            const key = pName + '_' + pid

            const pLogs = participantLogs.get(key) || []
            const currentIdx = pLogs.findIndex((l: any) => l.id === log.id)
            if (currentIdx > 0) {
                const prevLog = pLogs[currentIdx - 1]
                if (prevLog.direction === 'exit') {
                    const exitTime = new Date(prevLog.scanned_at).getTime()
                    const entryTime = new Date(log.scanned_at).getTime()
                    const diffMs = entryTime - exitTime
                    const mins = Math.floor(diffMs / 60000)
                    if (mins < 60) {
                        timeOutside = `${mins} min`
                    } else {
                        const hrs = Math.floor(mins / 60)
                        const remMins = mins % 60
                        timeOutside = `${hrs}h ${remMins}m`
                    }
                }
            }
        }

        return {
            'Participant Name': log.hackathon_participants?.name || '',
            'Email': log.hackathon_participants?.email || '',
            'Role': log.hackathon_participants?.role || '',
            'Team Name': log.hackathon_participants?.hackathon_teams?.name || '',
            'Team Code': log.hackathon_participants?.hackathon_teams?.team_code || '',
            'Direction': log.direction === 'entry' ? 'ENTRY' : 'EXIT',
            'Time Outside': timeOutside,
            'Timestamp': log.scanned_at ? new Date(log.scanned_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
            'Scanned By': log.scanned_by || '',
        }
    })

    return { data: rows }
}
