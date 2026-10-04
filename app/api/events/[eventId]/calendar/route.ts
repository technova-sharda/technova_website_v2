import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { icsContent, toCalendarEntry } from "@/lib/calendar/event-calendar"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLUMNS = "id, slug, title, description, venue, is_virtual, start_time, end_time, is_multi_day, daily_start_time, daily_end_time, status"

/** GET /api/events/<id or slug>/calendar → .ics file for Apple Calendar / Outlook / Google. Read-only. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params
    const supabase = createAdminClient()
    const query = supabase.from("events").select(COLUMNS)
    const { data: event } = await (UUID.test(eventId) ? query.eq("id", eventId) : query.eq("slug", eventId)).maybeSingle()

    if (!event || !["live", "completed"].includes(event.status)) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const fileName = (event.slug || event.id).replace(/[^\w-]+/g, "-")
    return new NextResponse(icsContent(toCalendarEntry(event)), {
        headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `attachment; filename="${fileName}.ics"`,
            "Cache-Control": "public, max-age=300, s-maxage=300",
        },
    })
}
