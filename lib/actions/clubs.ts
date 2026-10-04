"use server";

import { createClient as createServerClient } from "@supabase/supabase-js";

async function getSupabase() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function getClubs() {
    const supabase = await getSupabase();
    // Sort clubs alphabetically by name
    const { data } = await supabase.from('clubs').select('*').order('name', { ascending: true });
    return data || [];
}

export async function getClubMembers(clubId: string) {
    const supabase = await getSupabase();
    const { data } = await supabase.from('club_members').select('*').eq('club_id', clubId)
    if (!data) return []
    return sortMembersByRole(data)
}

export async function getClubMembersByName(clubName: string) {
    const supabase = await getSupabase();
    // First get club ID
    const { data: club } = await supabase.from('clubs').select('id').eq('name', clubName).single();
    if (!club) return [];

    // Then get members
    // Then get members
    const { data } = await supabase.from('club_members').select('*').eq('club_id', club.id)

    if (!data) return []
    return sortMembersByRole(data)
}

export async function getClubWithMembers(clubName: string) {
    const supabase = await getSupabase();
    // Get club details
    const { data: club } = await supabase.from('clubs').select('*').eq('name', clubName).single();
    if (!club) return null;

    // Get members
    const { data: members } = await supabase.from('club_members').select('*').eq('club_id', club.id);

    return {
        club,
        members: members ? sortMembersByRole(members) : []
    }
}

function sortMembersByRole(members: any[]) {
    const getPriority = (role: string) => {
        const r = (role || "").toLowerCase()
        // Executives
        if (r.includes('president') && !r.includes('vice')) return 1
        if (r.includes('vice president')) return 2
        if (r.includes('secretary')) return 3
        if (r.includes('pr head')) return 4
        if (r.includes('pr co-head') || r.includes('pr cohead')) return 5
        if (r.includes('pr editor')) return 6

        // Club Leads - Organizer first (GDG uses Organizer as primary role)
        if (r.includes('organizer') || r.includes('organiser')) return 7
        if (r.includes('lead') && !r.includes('co-') && !r.includes('vice')) return 8
        if (r.includes('captain')) return 8
        if (r.includes('head') && !r.includes('pr')) return 8

        // Second in Command
        if (r.includes('co-lead') || r.includes('colead') || r.includes('vice')) return 9

        // Members
        if (r.includes('technical')) return 10
        if (r.includes('pr') || r.includes('marketing')) return 11
        if (r.includes('design')) return 12
        if (r.includes('doc') || r.includes('content')) return 13
        if (r.includes('coordinator') || r.includes('executive')) return 14

        return 99
    }

    return members.sort((a, b) => {
        const pa = getPriority(a.role)
        const pb = getPriority(b.role)
        if (pa !== pb) return pa - pb
        return a.name.localeCompare(b.name)
    })
}
