/**
 * Event Completion Report (ECR): the Sharda University format we used to fill in
 * by hand. This gathers everything once; ecr-docx.ts and ecr-pdf.ts render it.
 *
 * Contains student names / system IDs / emails (the participant list is part of
 * the official format), so it's only served to admins.
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { createAdminClient } from "@/lib/supabase/server"
import { fetchAllRows, fetchInChunks } from "@/lib/supabase/fetch-all"

// ── Defaults for the fixed parts of the format (conveners updated 4 Oct 2026).
// They can be changed per report in the download popup.
export const ECR_CONFIG = {
    university: "Sharda University",
    address: "Plot No. 32, 34, Knowledge Park-III, Greater Noida- 201306, UP",
    department: "Department of Computing Science and Engineering",
    school: "Sharda School of Computing Science & Engineering",
    conveners: [
        { name: "Prof. (Dr.) Geetha Ganeshan", phone: "+91 8427474600", email: "dean.set@sharda.ac.in" },
        { name: "Prof. (Dr.) Jayant Shekher", phone: "+91 9873257466", email: "jayant.shekhar@sharda.ac.in" },
        { name: "Prof.(Dr.) Rani Astya", phone: "+91 8470922024", email: "rani.astya@sharda.ac.in" },
    ],
}

export const EVENT_TYPE_COLUMNS = [
    "Conference", "Seminar", "Workshop", "Symposium", "Guest Lecture (Invited talk)", "FDP/MDP/EDP",
    "Quiz", "Cultural/ Celebration/ Sports", "Industrial Visit", "Extension and Outreach programs",
] as const

/** Where an extra section can go. The first 8 are rows of the main table; the rest come after a whole part. */
export const ECR_SECTION_POSITIONS = [
    { id: "eventName", label: "After Name of the Event" },
    { id: "date", label: "After Date of the Event" },
    { id: "location", label: "After Location" },
    { id: "sponsor", label: "After Sponsoring Organization" },
    { id: "summary", label: "After Event Summary" },
    { id: "highlights", label: "After Notes and Highlights" },
    { id: "photos", label: "After Images / Photos" },
    { id: "videos", label: "After Videos" },
    { id: "conveners", label: "After Department and Conveners" },
    { id: "speakers", label: "After Speaker details" },
    { id: "eventType", label: "After Type of the Event" },
    { id: "participants", label: "After List of Participants" },
    { id: "pamphlet", label: "After Event Pamphlet" },
    { id: "feedback", label: "After Event Feedback" },
    { id: "end", label: "At the end" },
] as const
export type EcrSectionPosition = (typeof ECR_SECTION_POSITIONS)[number]["id"]
export type EcrCustomSection = { title: string; body: string; after: EcrSectionPosition }

export type EcrImage = { data: Buffer; width: number; height: number; caption: string }
export type EcrParticipant = { name: string; systemId: string; email: string; course: string }
export type EcrConvener = { name: string; phone: string; email: string }
export type EcrSpeaker = { name: string; affiliation: string; area: string }
export type EcrEventType = (typeof EVENT_TYPE_COLUMNS)[number]

/** The text parts of the ECR: prefilled from the website, editable in the download popup. */
export type EcrFields = {
    eventName: string
    dateText: string
    location: string
    sponsor: string
    summary: string
    highlights: string[]
    videoText: string
    eventTypeColumn: EcrEventType
    eventScope: "National" | "International"
    department: string
    school: string
    conveners: EcrConvener[]
    speakers: EcrSpeaker[]
    feedback: string[]
    certificateText: string
    /** Extra sections added in the popup, each placed after a chosen part. */
    customSections: EcrCustomSection[]
}

export type EcrData = EcrFields & {
    photos: EcrImage[]
    participants: EcrParticipant[]
    participantsNote: string
    pamphlet: EcrImage | null
    shardaLogo: EcrImage | null
    fileBase: string
}

/** What the popup shows about the parts it can't edit (they come from the event itself). */
export type EcrMeta = { photoCount: number; hasPamphlet: boolean; participantCount: number; participantsNote: string; clubName: string | null }

const IST = "Asia/Kolkata"
function ordinal(n: number) {
    const s = ["th", "st", "nd", "rd"], v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
}
function istParts(iso: string) {
    const d = new Date(iso)
    return {
        day: Number(d.toLocaleString("en-IN", { timeZone: IST, day: "numeric" })),
        month: d.toLocaleString("en-IN", { timeZone: IST, month: "long" }),
        year: d.toLocaleString("en-IN", { timeZone: IST, year: "numeric" }),
    }
}
/** "4th September 2025" or "4th September to 5th September 2025" */
export function ecrDate(startIso: string, endIso: string) {
    const a = istParts(startIso), b = istParts(endIso)
    const first = `${ordinal(a.day)} ${a.month}`
    if (a.day === b.day && a.month === b.month && a.year === b.year) return `${first} ${a.year}`
    return a.year === b.year ? `${first} to ${ordinal(b.day)} ${b.month} ${b.year}` : `${first} ${a.year} to ${ordinal(b.day)} ${b.month} ${b.year}`
}

function platformFromLink(link: string | null | undefined) {
    if (!link) return null
    if (/teams\.(microsoft|live)\.com/i.test(link)) return "Microsoft Teams"
    if (/meet\.google\.com/i.test(link)) return "Google Meet"
    if (/zoom\.us/i.test(link)) return "Zoom"
    if (/youtube\.com|youtu\.be/i.test(link)) return "YouTube Live"
    return null
}

async function imageFrom(source: string | Buffer, caption: string, maxWidth = 1400): Promise<EcrImage | null> {
    try {
        const input = typeof source === "string"
            ? Buffer.from(await (await fetch(source, { signal: AbortSignal.timeout(10_000) })).arrayBuffer())
            : source
        const out = await sharp(input, { failOn: "none" }).rotate().resize({ width: maxWidth, withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true })
        return { data: out.data, width: out.info.width, height: out.info.height, caption }
    } catch {
        return null
    }
}

export async function buildEcrData(eventId: string, opts: { images?: boolean } = {}): Promise<(EcrData & { meta: EcrMeta }) | null> {
    const withImages = opts.images !== false
    const sb = createAdminClient()
    const { data: ev } = await sb
        .from("events")
        .select("id, title, slug, description, venue, is_virtual, meeting_link, start_time, end_time, event_type, banner, gallery, club:clubs!events_club_id_fkey(name)")
        .eq("id", eventId)
        .maybeSingle()
    if (!ev) return null

    const [regsRes, checkinsRes, formsRes, certsRes] = await Promise.all([
        fetchAllRows<any>((f, t) => sb.from("registrations").select("id, user_id, attended").eq("event_id", eventId).order("created_at").order("id").range(f, t)),
        fetchAllRows<any>((f, t) => sb.from("daily_checkins").select("id, user_id").eq("event_id", eventId).order("id").range(f, t)),
        sb.from("event_feedback_forms").select("id").eq("event_id", eventId),
        sb.from("certificates").select("status").eq("event_id", eventId),
    ])
    const regs = regsRes.data
    const checkedIn = new Set(checkinsRes.data.map(c => c.user_id))
    const attendedIds = new Set(regs.filter(r => r.attended || checkedIn.has(r.user_id)).map(r => r.user_id))
    const attendanceRecorded = attendedIds.size > 0
    const participantIds = attendanceRecorded ? [...attendedIds] : regs.map(r => r.user_id)

    const { data: users } = await fetchInChunks<any>(participantIds, chunk =>
        sb.schema("next_auth").from("users").select("id, name, email, system_id, course, branch").in("id", chunk))
    const participants: EcrParticipant[] = users
        .map(u => ({ name: (u.name || "").trim(), systemId: u.system_id || "", email: u.email || "", course: [u.course, u.branch].filter(Boolean).join(" ") || "" }))
        .sort((a, b) => a.name.localeCompare(b.name))

    // Feedback: written comments only (long-answer questions), the ones people actually wrote something in
    const formIds = (formsRes.data ?? []).map(f => f.id)
    let feedback: string[] = []
    let ratingAvg: number | null = null, ratingCount = 0
    if (formIds.length) {
        const [{ data: qs }, { data: responses }] = await Promise.all([
            sb.from("feedback_questions").select("id, question_type").in("form_id", formIds),
            sb.from("feedback_responses").select("answers").in("form_id", formIds).limit(1000),
        ])
        const comment = new Set((qs ?? []).filter(q => q.question_type === "textarea").map(q => q.id))
        const rating = new Set((qs ?? []).filter(q => q.question_type === "rating").map(q => q.id))
        const seen = new Set<string>()
        let sum = 0
        for (const r of responses ?? []) {
            for (const [qid, v] of Object.entries((r.answers ?? {}) as Record<string, unknown>)) {
                if (rating.has(qid) && Number.isFinite(Number(v))) { sum += Number(v); ratingCount++ }
                if (!comment.has(qid) || typeof v !== "string") continue
                const text = v.replace(/\s+/g, " ").trim()
                const key = text.toLowerCase()
                if (text.length < 25 || seen.has(key)) continue
                seen.add(key)
                feedback.push(text.length > 300 ? text.slice(0, 297) + "..." : text)
            }
        }
        if (ratingCount) ratingAvg = Math.round((sum / ratingCount) * 10) / 10
        feedback = feedback.sort((a, b) => b.length - a.length).slice(0, 8)
    }

    const club = (Array.isArray(ev.club) ? ev.club[0] : ev.club) as { name?: string } | null
    const platform = platformFromLink(ev.meeting_link)
    const location = ev.is_virtual ? `ONLINE${platform ? ` (${platform})` : ""}` : (ev.venue || "Sharda University")
    const validCerts = (certsRes.data ?? []).filter(c => c.status === "valid").length
    const days = Math.max(1, Math.round((new Date(ev.end_time).getTime() - new Date(ev.start_time).getTime()) / 86_400_000) + (ecrDate(ev.start_time, ev.end_time).includes(" to ") ? 1 : 0))

    const highlights = [
        `Organised by ${club?.name && !/^technova/i.test(club.name) ? `${club.name} under Technova` : "Technova"}${ev.is_virtual ? ", conducted online" : ""}.`,
        `${regs.length} students registered${attendanceRecorded ? `; ${attendedIds.size} attended (${Math.round((attendedIds.size / Math.max(regs.length, 1)) * 100)}% turnout)` : ""}.`,
        ...(days > 1 ? [`${days}-day event.`] : []),
        ...(ratingAvg !== null ? [`Average feedback rating ${ratingAvg} / 5 from ${ratingCount} ratings.`] : []),
        ...(validCerts ? [`${validCerts} certificates issued.`] : []),
    ]

    const gallery = ((ev.gallery as string[] | null) ?? []).slice(0, 4)
    const [logo, pamphlet, photos] = withImages
        ? await Promise.all([
            readFile(path.join(process.cwd(), "public/assets/logo/sharda.png")).then(b => imageFrom(b, "Sharda University", 600)).catch(() => null),
            ev.banner ? imageFrom(ev.banner, "Event Pamphlet", 1200) : Promise.resolve(null),
            Promise.all(gallery.map((url, i) => imageFrom(url, `Figure ${i + 1}`))).then(list => list.filter(Boolean) as EcrImage[]),
        ])
        : [null, null, [] as EcrImage[]]

    const title = String(ev.title).trim()
    const isTalk = /talk|lecture|keynote/i.test(title)
    const eventTypeColumn: EcrEventType = ev.event_type === "workshop" ? "Workshop" : isTalk ? "Guest Lecture (Invited talk)" : "Seminar"
    const participantsNote = attendanceRecorded ? "" : "Attendance was not recorded on the website for this event, so this list shows all registered students."

    return {
        eventName: `TECHNOVA SOCIETY - ${title.toUpperCase()}`,
        dateText: ecrDate(ev.start_time, ev.end_time),
        location,
        sponsor: "NA",
        summary: (ev.description || "").trim() || title,
        highlights,
        photos,
        videoText: "",
        eventTypeColumn,
        eventScope: "National",
        department: ECR_CONFIG.department,
        school: ECR_CONFIG.school,
        conveners: ECR_CONFIG.conveners.map(c => ({ ...c })),
        speakers: [],
        customSections: [],
        participants,
        participantsNote,
        pamphlet,
        feedback,
        certificateText: validCerts ? `Issued to ${validCerts} participants. Each can be verified at technovashardauniversity.in/verify/<certificate ID>.` : "Not applicable",
        shardaLogo: logo,
        fileBase: `ECR-${title.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "event"}`,
        meta: { photoCount: gallery.length, hasPamphlet: !!ev.banner, participantCount: participants.length, participantsNote, clubName: club?.name ?? null },
    }
}

export function ecrFieldsOf(d: EcrData): EcrFields {
    const { eventName, dateText, location, sponsor, summary, highlights, videoText, eventTypeColumn, eventScope, department, school, conveners, speakers, feedback, certificateText, customSections } = d
    return { eventName, dateText, location, sponsor, summary, highlights, videoText, eventTypeColumn, eventScope, department, school, conveners, speakers, feedback, certificateText, customSections }
}

/** Applies the popup's edits. Everything is length-capped; unknown keys are ignored. */
export function applyEcrEdits<T extends EcrData>(d: T, raw: unknown): T {
    if (!raw || typeof raw !== "object") return d
    const e = raw as Record<string, unknown>
    const str = (v: unknown, fallback: string, max = 600) => (typeof v === "string" ? v.replace(/\r/g, "").slice(0, max).trim() : fallback)
    const lines = (v: unknown, fallback: string[], maxItems: number, max = 400) =>
        Array.isArray(v) ? v.map(x => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, max)).filter(Boolean).slice(0, maxItems) : fallback
    const rows = <K extends string>(v: unknown, keys: K[], fallback: Record<K, string>[], maxItems: number) =>
        Array.isArray(v)
            ? v.slice(0, maxItems).map(r => Object.fromEntries(keys.map(k => [k, str((r as any)?.[k], "", 200)])) as Record<K, string>).filter(r => keys.some(k => r[k]))
            : fallback
    return {
        ...d,
        eventName: str(e.eventName, d.eventName, 200),
        dateText: str(e.dateText, d.dateText, 120),
        location: str(e.location, d.location, 200),
        sponsor: str(e.sponsor, d.sponsor, 200),
        summary: str(e.summary, d.summary, 6000),
        highlights: lines(e.highlights, d.highlights, 20),
        videoText: str(e.videoText, d.videoText, 500),
        eventTypeColumn: (EVENT_TYPE_COLUMNS as readonly string[]).includes(e.eventTypeColumn as string) ? (e.eventTypeColumn as EcrEventType) : d.eventTypeColumn,
        eventScope: e.eventScope === "International" ? "International" : e.eventScope === "National" ? "National" : d.eventScope,
        department: str(e.department, d.department, 200),
        school: str(e.school, d.school, 200),
        conveners: rows(e.conveners, ["name", "phone", "email"], d.conveners, 8),
        speakers: rows(e.speakers, ["name", "affiliation", "area"], d.speakers, 10),
        feedback: lines(e.feedback, d.feedback, 15, 600),
        certificateText: str(e.certificateText, d.certificateText, 400),
        customSections: Array.isArray(e.customSections)
            ? e.customSections.slice(0, 12).map((c: any) => ({
                title: str(c?.title, "", 120),
                body: str(c?.body, "", 4000),
                after: (ECR_SECTION_POSITIONS.some(p => p.id === c?.after) ? c.after : "end") as EcrSectionPosition,
            })).filter(c => c.title || c.body)
            : d.customSections,
    }
}

/** Extra sections for one position. Body lines starting with "-", "*" or "•" become bullet points. */
export function sectionsAt(d: Pick<EcrFields, "customSections">, at: EcrSectionPosition) {
    return d.customSections.filter(c => c.after === at).map(c => ({
        title: c.title || "Additional details",
        lines: c.body.split(/\n/).map(l => l.trim()).filter(Boolean).map(l => {
            const m = /^[-*•]\s*(.*)$/.exec(l)
            return m ? { text: m[1], bullet: true } : { text: l, bullet: false }
        }),
    }))
}

/** The speaker table always has at least 5 rows, like the paper format; filled rows come first. */
export function speakerRows(d: Pick<EcrFields, "speakers">): EcrSpeaker[] {
    const blank = { name: "", affiliation: "", area: "" }
    return [...d.speakers, ...Array.from({ length: Math.max(0, 5 - d.speakers.length) }, () => blank)]
}
