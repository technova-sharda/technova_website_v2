import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { applyEcrEdits, buildEcrData, ecrFieldsOf, ECR_SECTION_POSITIONS, EVENT_TYPE_COLUMNS } from "@/lib/reports/ecr-data"
import { renderEcrDocx } from "@/lib/reports/ecr-docx"
import { renderEcrPdf } from "@/lib/reports/ecr-pdf"
import { renderEcrWithAnalytics } from "@/lib/reports/ecr-full"
import { buildEventAnalytics } from "@/lib/reports/event-analytics"
import { eventAiWriteUp } from "@/lib/reports/event-analytics-ai"
import { loadReportLogos } from "@/lib/reports/analytics-pdf"
import { getAnalyticsDataset } from "@/lib/analytics/dataset"

export const maxDuration = 60
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Format = "docx" | "pdf" | "full"

async function guard(params: Promise<{ id: string }>) {
    const session = await auth()
    if (!session || !["admin", "super_admin"].includes(session.user.role)) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
    const { id } = await params
    if (!UUID.test(id)) return { error: NextResponse.json({ error: "Event not found" }, { status: 404 }) }
    return { id }
}

/**
 * Event Completion Report in the Sharda University format. Admins only (it lists participants). Read-only.
 * GET ?format=json            → prefilled fields for the download popup (no images, fast)
 * GET ?format=docx|pdf|full   → file with the website's data as-is
 * POST { format, fields, ai } → file with the popup's edits; "full" = ECR + analytics PDF
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const g = await guard(params)
    if (g.error) return g.error
    const format = req.nextUrl.searchParams.get("format")
    if (format === "json") {
        const data = await buildEcrData(g.id, { images: false })
        if (!data) return NextResponse.json({ error: "Event not found" }, { status: 404 })
        return NextResponse.json({ fields: ecrFieldsOf(data), meta: data.meta, eventTypes: EVENT_TYPE_COLUMNS, sectionPositions: ECR_SECTION_POSITIONS }, { headers: { "Cache-Control": "private, no-store" } })
    }
    return render(g.id, format === "docx" ? "docx" : format === "full" ? "full" : "pdf", null, true)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const g = await guard(params)
    if (g.error) return g.error
    const body = await req.json().catch(() => ({}))
    const format: Format = body?.format === "docx" ? "docx" : body?.format === "full" ? "full" : "pdf"
    return render(g.id, format, body?.fields ?? null, body?.ai !== false)
}

async function render(id: string, format: Format, edits: unknown, useAi: boolean) {
    const [base, analytics] = await Promise.all([
        buildEcrData(id),
        format === "full" ? getAnalyticsDataset().then(ds => buildEventAnalytics(ds, id)) : Promise.resolve(null),
    ])
    if (!base) return NextResponse.json({ error: "Event not found" }, { status: 404 })
    const data = applyEcrEdits(base, edits)

    let body: Uint8Array | Buffer
    if (format === "docx") body = await renderEcrDocx(data)
    else if (format === "pdf" || !analytics) body = await renderEcrPdf(data)
    else {
        const [ai, logos] = await Promise.all([useAi ? eventAiWriteUp(analytics) : Promise.resolve(null), loadReportLogos(analytics)])
        body = await renderEcrWithAnalytics(data, analytics, ai, logos)
    }
    const ext = format === "docx" ? "docx" : "pdf"
    const name = format === "full" ? `${data.fileBase}-with-Analytics` : data.fileBase
    return new Response(new Uint8Array(body), {
        headers: {
            "Content-Type": format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf",
            "Content-Disposition": `attachment; filename="${name}.${ext}"`,
            "Cache-Control": "private, no-store",
        },
    })
}
