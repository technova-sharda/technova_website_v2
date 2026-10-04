/**
 * Event report PDF for faculty (HOD / Dean): branded, one or two A4 pages,
 * all numbers from the analytics metrics (same definitions as the dashboard).
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import type { AnalyticsDataset } from "@/lib/analytics/dataset"
import { audience, eventSummaries, ratingDistribution, registrationsByDay } from "@/lib/analytics/metrics"

export type ReportEventInfo = { id: string; title: string; venue: string | null; is_virtual: boolean; start_time: string; end_time: string; club: string | null; description: string | null }

const A4 = { w: 595.28, h: 841.89 }
const M = 40 // page margin
const C = {
    ink: rgb(0.07, 0.07, 0.08), text: rgb(0.2, 0.2, 0.22), muted: rgb(0.45, 0.45, 0.5), line: rgb(0.88, 0.88, 0.9),
    amber: rgb(0.96, 0.65, 0.14), amberSoft: rgb(1, 0.95, 0.85), indigo: rgb(0.39, 0.4, 0.95), green: rgb(0.13, 0.65, 0.33),
    dark: rgb(0.04, 0.04, 0.045), white: rgb(1, 1, 1), soft: rgb(0.97, 0.97, 0.98),
}

/** Standard PDF fonts only cover Latin-1 (+ a few typographic marks); swap anything else so pdf-lib doesn't throw. */
function clean(text: string) {
    return text
        .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/₹/g, "Rs ")
        .replace(/[^\x20-\x7E -ÿ–—•…]/g, "")
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
    const lines: string[] = []
    for (const para of clean(text).split(/\n+/)) {
        let line = ""
        for (const word of para.split(/\s+/).filter(Boolean)) {
            const next = line ? `${line} ${word}` : word
            if (font.widthOfTextAtSize(next, size) > maxWidth && line) { lines.push(line); line = word } else line = next
        }
        if (line) lines.push(line)
    }
    return lines
}

const istDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" })
const istTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })

export async function buildEventReport(ds: AnalyticsDataset, info: ReportEventInfo, aiSummary?: string | null): Promise<Uint8Array> {
    const dsEvent = ds.events.find(e => e.id === info.id)
    const summary = eventSummaries(ds, dsEvent ? [dsEvent] : [])[0]
    const byDay = registrationsByDay(ds, info.id)
    const byYear = audience(ds, "year", info.id)
    const byCourse = audience(ds, "course", info.id).slice(0, 8)
    const ratings = ratingDistribution(ds, info.id)

    const pdf = await PDFDocument.create()
    pdf.setTitle(`${clean(info.title)} – Event Report`)
    pdf.setAuthor("Technova, Sharda University")
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    let logo: Awaited<ReturnType<typeof pdf.embedPng>> | null = null
    try { logo = await pdf.embedPng(await readFile(path.join(process.cwd(), "public/assets/logo/technova.png"))) } catch { logo = null }

    const pages: PDFPage[] = []
    let page = pdf.addPage([A4.w, A4.h]); pages.push(page)
    let y = A4.h

    const ensure = (needed: number) => {
        if (y - needed < 70) { page = pdf.addPage([A4.w, A4.h]); pages.push(page); y = A4.h - M }
    }
    const text = (s: string, x: number, yy: number, size: number, f = font, color = C.text) => page.drawText(clean(s), { x, y: yy, size, font: f, color })
    // Reserves room for the heading AND its content, so a heading never sits alone at the bottom of a page.
    const sectionTitle = (s: string, contentHeight = 0) => {
        ensure(40 + contentHeight)
        text(s.toUpperCase(), M, y - 14, 9, bold, C.muted)
        page.drawRectangle({ x: M, y: y - 20, width: 24, height: 2, color: C.amber })
        y -= 34
    }

    // ── Header band ──
    const bandH = 150
    page.drawRectangle({ x: 0, y: A4.h - bandH, width: A4.w, height: bandH, color: C.dark })
    page.drawRectangle({ x: 0, y: A4.h - bandH, width: A4.w, height: 3, color: C.amber })
    if (logo) {
        page.drawCircle({ x: A4.w - M - 30, y: A4.h - 52, size: 30, color: C.white })
        const s = 52 / Math.max(logo.width, logo.height)
        page.drawImage(logo, { x: A4.w - M - 30 - (logo.width * s) / 2, y: A4.h - 52 - (logo.height * s) / 2, width: logo.width * s, height: logo.height * s })
    }
    text("TECHNOVA  ·  EVENT REPORT", M, A4.h - 40, 9, bold, C.amber)
    const titleLines = wrap(info.title, bold, 22, A4.w - 2 * M - 80).slice(0, 2)
    titleLines.forEach((l, i) => text(l, M, A4.h - 70 - i * 26, 22, bold, C.white))
    const sameDay = istDate(info.start_time) === istDate(info.end_time)
    const when = sameDay ? `${istDate(info.start_time)}, ${istTime(info.start_time)} – ${istTime(info.end_time)} IST` : `${istDate(info.start_time)} – ${istDate(info.end_time)}`
    const meta = [when, info.is_virtual ? "Online" : (info.venue || "On campus"), info.club ? `Organised by ${info.club}` : null].filter(Boolean).join("   ·   ")
    text(meta, M, A4.h - bandH + 22, 9.5, font, rgb(0.8, 0.8, 0.82))
    y = A4.h - bandH - 24

    // ── KPI tiles ──
    const kpis: [string, string, string?][] = [
        ["Registered", String(summary?.registrations ?? 0), summary?.capacity ? `of ${summary.capacity} seats (${summary.fillPct}%)` : undefined],
        ["Attended", summary?.attendanceRecorded ? String(summary.attended) : "Not recorded", summary?.attendanceRecorded ? "checked in" : "no check-ins saved"],
        ["Turnout", summary?.attendanceRecorded ? `${summary.turnoutPct}%` : "–", "attended / registered"],
        ["Average rating", summary?.avgRating !== null && summary?.avgRating !== undefined ? `${summary.avgRating} / 5` : "–", summary?.ratings ? `${summary.ratings} ratings` : "no ratings yet"],
        ["Feedback responses", String(summary?.feedbackResponses ?? 0)],
        ["Certificates issued", String(summary?.certificates ?? 0), summary?.certificates ? `${summary.certificatesEmailed} emailed` : undefined],
    ]
    const colW = (A4.w - 2 * M - 2 * 10) / 3, tileH = 62
    kpis.forEach(([label, value, hint], i) => {
        const col = i % 3, row = Math.floor(i / 3)
        const x = M + col * (colW + 10), top = y - row * (tileH + 10)
        page.drawRectangle({ x, y: top - tileH, width: colW, height: tileH, color: C.soft, borderColor: C.line, borderWidth: 0.6 })
        text(label.toUpperCase(), x + 12, top - 17, 7.5, bold, C.muted)
        text(value, x + 12, top - 40, value.length > 8 ? 14 : 20, bold, C.ink)
        if (hint) text(hint, x + 12, top - 53, 7.5, font, C.muted)
    })
    y -= 2 * tileH + 10 + 24

    if (summary && !summary.attendanceRecorded && new Date(info.end_time).getTime() < Date.now()) {
        const note = "Attendance was not recorded for this event, so turnout can't be calculated. It can be added from the admin panel (Bulk Attendance) and this report regenerated."
        const lines = wrap(note, font, 8.5, A4.w - 2 * M - 24)
        const h = lines.length * 12 + 14
        page.drawRectangle({ x: M, y: y - h, width: A4.w - 2 * M, height: h, color: C.amberSoft, borderColor: C.amber, borderWidth: 0.6 })
        lines.forEach((l, i) => text(l, M + 12, y - 16 - i * 12, 8.5, font, C.text))
        y -= h + 20
    }

    // ── AI summary ──
    if (aiSummary) {
        const lines = wrap(aiSummary, font, 10, A4.w - 2 * M)
        sectionTitle("Summary", lines.length * 14 + 30)
        lines.forEach((l, i) => text(l, M, y - i * 14, 10, font, C.text))
        y -= lines.length * 14 + 6
        text("Written by AI (NVIDIA) from the numbers in this report.", M, y - 4, 7, font, C.muted)
        y -= 24
    }

    // ── Registrations over time ──
    if (byDay.length > 0) {
        const chartH = 120, chartW = A4.w - 2 * M
        sectionTitle("Registrations over time", chartH + 30)
        const days = byDay.slice(-30)
        const max = Math.max(...days.map(d => d.count), 1)
        const barW = Math.min(28, (chartW - 10) / days.length - 4)
        const step = (chartW - 10) / days.length
        page.drawLine({ start: { x: M, y: y - chartH }, end: { x: M + chartW, y: y - chartH }, thickness: 0.6, color: C.line })
        days.forEach((d, i) => {
            const h = Math.max(1.5, (d.count / max) * (chartH - 18))
            const x = M + 5 + i * step + (step - barW) / 2
            page.drawRectangle({ x, y: y - chartH, width: barW, height: h, color: C.amber })
            if (days.length <= 16 || d.count === max) text(String(d.count), x + barW / 2 - font.widthOfTextAtSize(String(d.count), 7) / 2, y - chartH + h + 3, 7, font, C.muted)
        })
        const first = days[0].day, last = days[days.length - 1].day
        const fmt = (k: string) => new Date(`${k}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
        text(fmt(first), M, y - chartH - 12, 7.5, font, C.muted)
        text(fmt(last), M + chartW - font.widthOfTextAtSize(fmt(last), 7.5), y - chartH - 12, 7.5, font, C.muted)
        text(`${byDay[byDay.length - 1].total} total`, M + chartW / 2 - 20, y - chartH - 12, 7.5, bold, C.muted)
        y -= chartH + 34
    }

    // ── Audience ──
    const hbars = (title: string, rows: { label: string; count: number }[], x: number, width: number, top: number, color = C.indigo) => {
        text(title, x, top, 9, bold, C.ink)
        const max = Math.max(...rows.map(r => r.count), 1)
        rows.forEach((r, i) => {
            const yy = top - 18 - i * 17
            text(r.label.length > 18 ? r.label.slice(0, 17) + "…" : r.label, x, yy, 8, font, C.text)
            const bx = x + 92, bw = Math.max(2, ((width - 92 - 30) * r.count) / max)
            page.drawRectangle({ x: bx, y: yy - 2, width: bw, height: 9, color })
            text(String(r.count), bx + bw + 4, yy, 8, font, C.muted)
        })
        return 18 + rows.length * 17
    }
    if (byYear.length || byCourse.length) {
        const rowsNeeded = Math.max(byYear.length, byCourse.length)
        sectionTitle("Who registered", rowsNeeded * 17 + 30)
        const half = (A4.w - 2 * M - 20) / 2
        const used = Math.max(hbars("By year", byYear, M, half, y), hbars("By course (top 8)", byCourse, M + half + 20, half, y, C.amber))
        y -= used + 20
    }

    // ── Ratings ──
    if (ratings.some(r => r.count > 0)) {
        sectionTitle("Feedback ratings", 5 * 17 + 30)
        y -= hbars(`${summary?.ratings ?? 0} ratings, average ${summary?.avgRating ?? "–"} / 5`, [...ratings].reverse().map(r => ({ label: `${r.star} star${r.star > 1 ? "s" : ""}`, count: r.count })), M, A4.w - 2 * M, y, C.green) + 16
    }

    // ── Footer on every page ──
    const generated = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })
    pages.forEach((p, i) => {
        p.drawLine({ start: { x: M, y: 44 }, end: { x: A4.w - M, y: 44 }, thickness: 0.5, color: C.line })
        p.drawText(clean(`Generated ${generated} IST  ·  Numbers from the Technova database  ·  technovashardauniversity.in`), { x: M, y: 30, size: 7, font, color: C.muted })
        p.drawText(`Page ${i + 1} of ${pages.length}`, { x: A4.w - M - font.widthOfTextAtSize(`Page ${i + 1} of ${pages.length}`, 7), y: 30, size: 7, font, color: C.muted })
    })

    return pdf.save()
}

/** Numbers handed to the AI for the optional summary paragraph: totals only, no people. */
export function reportFactsForAi(ds: AnalyticsDataset, info: ReportEventInfo) {
    const dsEvent = ds.events.find(e => e.id === info.id)
    const s = eventSummaries(ds, dsEvent ? [dsEvent] : [])[0]
    return {
        event: info.title, date: istDate(info.start_time), online: info.is_virtual, club: info.club,
        registered: s?.registrations ?? 0, capacity: s?.capacity ?? null,
        attended: s?.attendanceRecorded ? s.attended : "not recorded", turnout_pct: s?.attendanceRecorded ? s.turnoutPct : null,
        avg_rating: s?.avgRating ?? null, ratings: s?.ratings ?? 0, feedback_responses: s?.feedbackResponses ?? 0,
        certificates: s?.certificates ?? 0,
        registered_students_by_year: audience(ds, "year", info.id), registered_students_top_courses: audience(ds, "course", info.id).slice(0, 5),
        days_with_registrations: registrationsByDay(ds, info.id).length,
    }
}
