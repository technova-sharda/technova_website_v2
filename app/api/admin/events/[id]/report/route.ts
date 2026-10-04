import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { getAnalyticsDataset } from "@/lib/analytics/dataset"
import { buildEventReport, reportFactsForAi } from "@/lib/reports/event-report"
import { aiConfigured, nvidiaChat, stripThinking } from "@/lib/ai/nvidia"

export const maxDuration = 60
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/admin/events/<id>/report[?ai=1] → event report PDF (admins). Read-only. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || !["admin", "super_admin"].includes(session.user.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { id } = await params
    if (!UUID.test(id)) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const { data: ev } = await createAdminClient()
        .from("events")
        .select("id, title, venue, is_virtual, start_time, end_time, description, club:clubs!events_club_id_fkey(name)")
        .eq("id", id)
        .maybeSingle()
    if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const club = Array.isArray(ev.club) ? ev.club[0] : ev.club
    const info = {
        id: ev.id, title: ev.title, venue: ev.venue, is_virtual: !!ev.is_virtual, start_time: ev.start_time,
        end_time: ev.end_time, description: ev.description, club: (club as any)?.name ?? null,
    }
    const ds = await getAnalyticsDataset()

    let aiSummary: string | null = null
    if (req.nextUrl.searchParams.get("ai") === "1" && aiConfigured()) {
        try {
            const facts = reportFactsForAi(ds, info)
            const res = await nvidiaChat({
                maxTokens: 700,
                timeoutMs: 25_000,
                thinking: false,
                messages: [
                    { role: "system", content: "You write short, factual event summaries for a university department head. Use only the numbers given. At most 4 sentences and 90 words, plain English, no headings, no bullet points, no hype. Year and course counts are registered students, not attendees. If attendance is 'not recorded', say so instead of guessing turnout." },
                    { role: "user", content: `Event data (JSON):\n${JSON.stringify(facts)}` },
                ],
            })
            aiSummary = stripThinking(res.message.content).slice(0, 1200) || null
        } catch (e: any) {
            console.warn("[report] AI summary skipped:", e?.message)
        }
    }

    const pdf = await buildEventReport(ds, info, aiSummary)
    const fileName = `${info.title.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "event"}-report.pdf`
    return new Response(Buffer.from(pdf), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Cache-Control": "private, no-store",
        },
    })
}
