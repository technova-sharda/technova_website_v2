/**
 * The colour analytics part of the "ECR + Analytics" PDF: cover with all logos,
 * engagement score, comparisons, promotion and reach, attendance, feedback, and
 * findings. Drawn with pdf-lib (standard fonts, no external services). The ECR
 * pages are appended after these by renderEcrWithAnalytics().
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { LineCapStyle, PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib"
import { CLUB_LOGO_FILES } from "@/lib/constants/club-slugs"
import type { EventAnalytics } from "./event-analytics"
import type { EventAiWriteUp } from "./event-analytics-ai"

const A4 = { w: 595.28, h: 841.89 }
const M = 40
const W = A4.w - 2 * M
const FOOT = 56

const C = {
    dark: rgb(0.043, 0.043, 0.051), ink: rgb(0.07, 0.08, 0.1), text: rgb(0.2, 0.22, 0.26), muted: rgb(0.43, 0.46, 0.51),
    line: rgb(0.89, 0.9, 0.92), soft: rgb(0.972, 0.976, 0.982), white: rgb(1, 1, 1), track: rgb(0.93, 0.94, 0.95),
    amber: rgb(0.961, 0.62, 0.043), indigo: rgb(0.388, 0.4, 0.945), emerald: rgb(0.063, 0.66, 0.46), rose: rgb(0.91, 0.23, 0.35),
    sky: rgb(0.055, 0.6, 0.86), violet: rgb(0.545, 0.361, 0.965), teal: rgb(0.08, 0.6, 0.6), orange: rgb(0.96, 0.45, 0.12),
    amberSoft: rgb(1, 0.965, 0.89), emeraldSoft: rgb(0.91, 0.98, 0.945), roseSoft: rgb(1, 0.935, 0.945), indigoSoft: rgb(0.935, 0.94, 1),
    skySoft: rgb(0.91, 0.965, 1),
}
const SERIES = [C.indigo, C.amber, C.emerald, C.sky, C.rose, C.violet, C.teal, C.orange]

export type ReportLogos = { technova: Buffer | null; club: Buffer | null; coHost: Buffer | null; sharda: Buffer | null }

/** Logos as PNG (transparency kept). Uploaded club logo first, then the bundled file. */
export async function loadReportLogos(a: EventAnalytics): Promise<ReportLogos> {
    const local = (p: string | undefined) => (p ? readFile(path.join(process.cwd(), "public", p)) : Promise.reject(new Error("none")))
    const png = async (src: Promise<Buffer>) => {
        try { return await sharp(await src, { failOn: "none" }).resize(320, 320, { fit: "inside", withoutEnlargement: true }).png().toBuffer() } catch { return null }
    }
    const remote = async (url: string) => Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(8_000) })).arrayBuffer())
    const clubLogo = async (name: string | null, url: string | null) => {
        if (!name || /^technova/i.test(name)) return null
        return (url ? await png(remote(url)) : null) ?? png(local(CLUB_LOGO_FILES[name]))
    }
    const [technova, club, coHost, sharda] = await Promise.all([
        png(local("/assets/logo/technova.png")),
        clubLogo(a.event.club, a.event.clubLogoUrl),
        clubLogo(a.event.coHost, a.event.coHostLogoUrl),
        png(local("/assets/logo/sharda.png")),
    ])
    return { technova, club, coHost, sharda }
}

/** Standard PDF fonts only cover Latin-1; replace anything else so pdf-lib doesn't throw. */
export function clean(t: string) {
    return String(t ?? "").normalize("NFKC").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/₹/g, "Rs ").replace(/→/g, "->").replace(/≥/g, ">=").replace(/≤/g, "<=")
        .replace(/[^\x20-\x7E\xA0-\xFF–—•…]/g, "")
}

const istDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" })
const istTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })
const dayLabel = (key: string) => new Date(`${key}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
const addDays = (key: string, n: number) => new Date(new Date(`${key}T12:00:00+05:30`).getTime() + n * 86_400_000).toISOString().slice(0, 10)
const fmt = (v: number | null, unit = "") => (v === null || v === undefined ? "–" : `${Number.isInteger(v) ? v : v.toFixed(1)}${unit}`)

function roundRect(w: number, h: number, r: number) {
    r = Math.min(r, w / 2, h / 2)
    return `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`
}

export async function renderAnalyticsPages(pdf: PDFDocument, a: EventAnalytics, ai: EventAiWriteUp | null, logos: ReportLogos) {
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const italic = await pdf.embedFont(StandardFonts.HelveticaOblique)
    const embed = async (b: Buffer | null) => (b ? pdf.embedPng(b).catch(() => null) : null)
    const img = {
        technova: await embed(logos.technova), club: await embed(logos.club), coHost: await embed(logos.coHost), sharda: await embed(logos.sharda),
    }

    let page!: PDFPage
    let y = 0
    const pages: PDFPage[] = []

    // ── primitives ──
    const text = (s: string, x: number, yy: number, size: number, f: PDFFont = font, color: RGB = C.text) => page.drawText(clean(s), { x, y: yy, size, font: f, color })
    const width = (s: string, size: number, f: PDFFont = font) => f.widthOfTextAtSize(clean(s), size)
    const textRight = (s: string, xRight: number, yy: number, size: number, f: PDFFont = font, color: RGB = C.text) => text(s, xRight - width(s, size, f), yy, size, f, color)
    const textCenter = (s: string, cx: number, yy: number, size: number, f: PDFFont = font, color: RGB = C.text) => text(s, cx - width(s, size, f) / 2, yy, size, f, color)
    const wrap = (s: string, size: number, max: number, f: PDFFont = font) => {
        const out: string[] = []
        for (const para of clean(s).split(/\n+/)) {
            let line = ""
            for (const word of para.split(/\s+/).filter(Boolean)) {
                const next = line ? `${line} ${word}` : word
                if (f.widthOfTextAtSize(next, size) > max && line) { out.push(line); line = word } else line = next
            }
            if (line) out.push(line)
        }
        return out
    }
    const fit = (s: string, size: number, max: number, f: PDFFont = font) => {
        let t = clean(s)
        if (f.widthOfTextAtSize(t, size) <= max) return t
        while (t.length > 1 && f.widthOfTextAtSize(t + "…", size) > max) t = t.slice(0, -1)
        return t + "…"
    }
    const box = (x: number, top: number, w: number, h: number, fill: RGB, border?: RGB, r = 8) =>
        page.drawSvgPath(roundRect(w, h, r), { x, y: top, color: fill, ...(border ? { borderColor: border, borderWidth: 0.7 } : {}) })
    const logoTile = (image: PDFImage | null, x: number, top: number, w: number, h: number) => {
        if (!image) return
        box(x, top, w, h, C.white, undefined, 8)
        const s = Math.min((w - 10) / image.width, (h - 10) / image.height)
        page.drawImage(image, { x: x + (w - image.width * s) / 2, y: top - h + (h - image.height * s) / 2, width: image.width * s, height: image.height * s })
    }

    const newPage = () => {
        page = pdf.addPage([A4.w, A4.h]); pages.push(page)
        // slim header on continuation pages
        page.drawRectangle({ x: 0, y: A4.h - 34, width: A4.w, height: 34, color: C.dark })
        page.drawRectangle({ x: 0, y: A4.h - 36, width: A4.w, height: 2, color: C.amber })
        text("TECHNOVA  ·  EVENT ANALYTICS", M, A4.h - 21, 8, bold, C.amber)
        textRight(fit(a.event.title, 8.5, 300), A4.w - M, A4.h - 21, 8.5, font, rgb(0.85, 0.85, 0.87))
        y = A4.h - 60
    }
    const ensure = (h: number) => { if (y - h < FOOT) newPage() }
    const section = (title: string, sub: string | null, contentH: number) => {
        ensure(46 + contentH)
        page.drawRectangle({ x: M, y: y - 16, width: 4, height: 16, color: C.amber })
        text(title, M + 12, y - 13, 13, bold, C.ink)
        if (sub) text(sub, M + 12 + width(title, 13, bold) + 10, y - 13, 8.5, font, C.muted)
        y -= 32
    }

    // ── Cover ──
    page = pdf.addPage([A4.w, A4.h]); pages.push(page)
    const bandH = 232
    page.drawRectangle({ x: 0, y: A4.h - bandH, width: A4.w, height: bandH, color: C.dark })
    page.drawRectangle({ x: 0, y: A4.h - bandH - 4, width: A4.w, height: 4, color: C.amber })
    let lx = M
    for (const im of [img.technova, img.club, img.coHost]) { if (im) { logoTile(im, lx, A4.h - 26, 56, 56); lx += 64 } }
    if (img.sharda) logoTile(img.sharda, A4.w - M - 126, A4.h - 26, 126, 56)
    text("EVENT COMPLETION REPORT  ·  ANALYTICS", M, A4.h - 112, 9, bold, C.amber)
    const titleLines = wrap(a.event.title, 24, W, bold).slice(0, 2)
    titleLines.forEach((l, i) => text(l, M, A4.h - 142 - i * 28, 24, bold, C.white))
    const sameDay = istDate(a.event.start) === istDate(a.event.end)
    const when = sameDay ? `${istDate(a.event.start)}  ·  ${istTime(a.event.start)} – ${istTime(a.event.end)} IST` : `${istDate(a.event.start)} – ${istDate(a.event.end)}`
    const where = a.event.isVirtual ? "Online" : (a.event.venue || "Sharda University")
    const clubs = [a.event.club && !/^technova/i.test(a.event.club) ? a.event.club : null, a.event.coHost].filter(Boolean).join(" and ")
    const by = clubs ? `${clubs} under Technova` : "Technova"
    const metaY = A4.h - bandH + 40
    text(when, M, metaY, 10, font, rgb(0.86, 0.86, 0.88))
    text(`${where}   ·   Organised by ${by}`, M, metaY - 16, 10, font, rgb(0.86, 0.86, 0.88))
    y = A4.h - bandH - 26

    // Score card + KPI tiles
    const k = a.kpi
    const cardH = 196, scoreW = 172
    box(M, y, scoreW, cardH, C.soft, C.line, 10)
    text("ENGAGEMENT SCORE", M + 14, y - 20, 7.5, bold, C.muted)
    const gcx = M + scoreW / 2, gcy = y - 110, gr = 56
    page.drawSvgPath(`M ${-gr} 0 A ${gr} ${gr} 0 0 1 ${gr} 0`, { x: gcx, y: gcy, borderColor: C.track, borderWidth: 14, borderLineCap: LineCapStyle.Round })
    if (a.score) {
        const v = a.score.value / 100, ang = Math.PI + Math.PI * Math.max(0.005, v)
        const col = a.score.value >= 80 ? C.emerald : a.score.value >= 65 ? C.indigo : a.score.value >= 45 ? C.amber : C.rose
        page.drawSvgPath(`M ${-gr} 0 A ${gr} ${gr} 0 0 1 ${gr * Math.cos(ang)} ${gr * Math.sin(ang)}`, { x: gcx, y: gcy, borderColor: col, borderWidth: 14, borderLineCap: LineCapStyle.Round })
        textCenter(String(a.score.value), gcx, gcy + 4, 30, bold, C.ink)
        textCenter("out of 100", gcx, gcy - 10, 7.5, font, C.muted)
        box(gcx - 42, gcy - 20, 84, 20, col, undefined, 10)
        textCenter(a.score.grade, gcx, gcy - 34, 9, bold, C.white)
        const partsLine = a.score.parts.map(p => `${p.label} ${p.value}`).join("  ·  ")
        wrap(partsLine, 7, scoreW - 24).forEach((l, i) => textCenter(l, gcx, y - cardH + 26 - i * 9, 7, font, C.muted))
    } else {
        textCenter("–", gcx, gcy + 4, 30, bold, C.muted)
        textCenter(k.registered ? "Not enough data yet" : "No registrations yet", gcx, gcy - 14, 8, font, C.muted)
    }

    const kpis: { label: string; value: string; hint: string; color: RGB }[] = [
        { label: "Registered", value: String(k.registered), hint: a.event.capacity ? `of ${a.event.capacity} seats` : "students", color: C.indigo },
        { label: "Attended", value: k.attendanceRecorded ? String(k.attended) : "Not recorded", hint: k.attendanceRecorded ? "checked in" : "no check-ins saved", color: C.emerald },
        { label: "Turnout", value: fmt(k.turnoutPct, "%"), hint: "of registered came", color: C.emerald },
        { label: "Seats filled", value: fmt(k.fillPct, "%"), hint: a.event.capacity ? "of capacity" : "no seat limit", color: C.sky },
        { label: "Average rating", value: k.avgRating !== null ? `${k.avgRating} / 5` : "–", hint: k.ratings ? `${k.ratings} ratings` : "no ratings yet", color: C.amber },
        { label: "Feedback given", value: String(k.feedbackResponses), hint: k.feedbackRatePct !== null ? `${k.feedbackRatePct}% responded` : "–", color: C.amber },
        { label: "First-time students", value: String(k.firstTimers), hint: `${k.firstTimerPct}% of total`, color: C.violet },
        { label: "Certificates", value: String(k.certificates), hint: k.certificates ? `${k.certificatesEmailed} emailed` : "none issued", color: C.rose },
    ]
    const gx = M + scoreW + 10, gw = (W - scoreW - 10 - 8) / 2, th = (cardH - 3 * 6) / 4
    kpis.forEach((t, i) => {
        const x = gx + (i % 2) * (gw + 8), top = y - Math.floor(i / 2) * (th + 6)
        box(x, top, gw, th, C.white, C.line, 8)
        page.drawRectangle({ x: x + 0.5, y: top - th + 8, width: 3, height: th - 16, color: t.color })
        text(t.label.toUpperCase(), x + 12, top - 13, 6.8, bold, C.muted)
        const vs = t.value.length > 9 ? 11 : 16
        text(t.value, x + 12, top - 31, vs, bold, C.ink)
        textRight(fit(t.hint, 7, gw - 34 - width(t.value, vs, bold)), x + gw - 10, top - 30, 7, font, C.muted)
    })
    y -= cardH + 22

    // At a glance (AI summary, or the top findings)
    {
        const summary = ai?.summary || [a.findings.worked[0], a.findings.lacked[0]].filter(Boolean).join(" ")
        if (summary) {
            const lines = wrap(summary, 9.5, W - 28)
            const h = lines.length * 13.5 + 34
            ensure(h)
            box(M, y, W, h, C.indigoSoft, undefined, 10)
            text("AT A GLANCE", M + 14, y - 17, 7.5, bold, C.indigo)
            if (ai?.summary) textRight("Written by AI from the numbers in this report", M + W - 14, y - 17, 6.8, italic, C.muted)
            lines.forEach((l, i) => text(l, M + 14, y - 33 - i * 13.5, 9.5, font, C.ink))
            y -= h + 22
        }
    }

    // Highlights: the top findings, so page 1 alone tells the story
    {
        const cols: [string, string[], RGB, RGB][] = [["Went well", a.findings.worked.slice(0, 3), C.emerald, C.emeraldSoft], ["Needs attention", a.findings.lacked.slice(0, 3), C.rose, C.roseSoft]]
        const cw = (W - 10) / 2
        const laid = cols.map(([, items]) => (items.length ? items : ["Nothing stood out in the data."]).map(it => wrap(it, 8.5, cw - 34)))
        const h = Math.max(...laid.map(l => l.reduce((s, lines) => s + lines.length * 11 + 5, 0))) + 32
        if (y - h >= FOOT && (a.findings.worked.length || a.findings.lacked.length)) {
            cols.forEach(([title, , c, soft], i) => {
                const x = M + i * (cw + 10)
                box(x, y, cw, h, soft, undefined, 10)
                text(title.toUpperCase(), x + 14, y - 17, 7.5, bold, c)
                let ty = y - 33
                laid[i].forEach(lines => {
                    page.drawCircle({ x: x + 17, y: ty + 2.8, size: 2.4, color: c })
                    lines.forEach((l, j) => text(l, x + 25, ty - j * 11, 8.5, font, C.ink))
                    ty -= lines.length * 11 + 5
                })
            })
            y -= h + 22
        }
    }

    // ── Compared with other events ──
    {
        const rows = a.benchmarks.filter(b => b.value !== null || b.technova !== null)
        const rowH = a.comparedWith.club > 0 && a.event.club ? 44 : 34
        section("Compared with other Technova events", `${a.comparedWith.technova} past events${a.event.club && a.comparedWith.club ? `, ${a.comparedWith.club} by ${a.event.club}` : ""}`, rows.length * rowH + 20)
        const showClub = a.comparedWith.club > 0 && !!a.event.club
        const legend: [string, RGB][] = [["This event", C.amber], ...(showClub ? [[`${a.event.club} average`, C.indigo] as [string, RGB]] : []), ["Technova average", rgb(0.7, 0.72, 0.76)]]
        let lgx = M
        legend.forEach(([l, c]) => { page.drawRectangle({ x: lgx, y: y - 7, width: 8, height: 8, color: c }); text(l, lgx + 12, y - 7, 7.5, font, C.muted); lgx += width(l, 7.5) + 30 })
        y -= 18
        for (const b of rows) {
            const max = Math.max(b.unit === "%" ? 100 : b.unit === "/5" ? 5 : 0, b.value ?? 0, b.technova ?? 0, b.club ?? 0, 1)
            text(b.label, M, y - 10, 9, bold, C.ink)
            const bars: [number | null, RGB][] = [[b.value, C.amber], ...(showClub ? [[b.club, C.indigo] as [number | null, RGB]] : []), [b.technova, rgb(0.7, 0.72, 0.76)]]
            const bx = M + 110, bw = W - 110 - 60
            bars.forEach(([v, c], i) => {
                const yy = y - 4 - i * 12
                page.drawRectangle({ x: bx, y: yy - 8, width: bw, height: 8, color: C.track })
                if (v !== null) page.drawRectangle({ x: bx, y: yy - 8, width: Math.max(1.5, (v / max) * bw), height: 8, color: c })
                text(fmt(v, b.unit === "/5" ? "" : b.unit), bx + bw + 8, yy - 7.5, 7.5, i === 0 ? bold : font, i === 0 ? C.ink : C.muted)
            })
            if (b.value !== null && b.technova !== null) {
                const diff = b.value - b.technova
                const better = diff >= 0
                const tag = Math.abs(diff) < 0.05 ? "same as average" : `${better ? "+" : ""}${b.unit === "%" ? diff.toFixed(1) + " pts" : b.unit === "/5" ? diff.toFixed(1) : Math.round(diff)} vs average`
                text(tag, M, y - 22, 7.5, bold, Math.abs(diff) < 0.05 ? C.muted : better ? C.emerald : C.rose)
            }
            y -= rowH
        }
        if (a.rank) text(`Ranked #${a.rank.registrations} of ${a.rank.of} events by registrations.`, M, y - 2, 8, italic, C.muted)
        y -= 20
    }

    // ── Promotion and reach ──
    if (a.timeline.length) {
        const chartH = 130
        section("Promotion: when students registered", null, chartH + 110)
        const regsByDay = new Map(a.timeline.map(d => [d.day, d.count]))
        const startKey = new Date(a.event.start).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
        let from = a.timeline[0].day
        const lastReg = a.timeline[a.timeline.length - 1].day
        const to = lastReg > startKey ? lastReg : startKey
        const days: string[] = []
        for (let d = from; d <= to && days.length < 400; d = addDays(d, 1)) days.push(d)
        const shown = days.slice(-45)
        const clipped = shown.length < days.length
        from = shown[0]
        let running = a.timeline.filter(d => d.day < from).reduce((s, d) => s + d.count, 0)
        const series = shown.map(d => ({ day: d, count: regsByDay.get(d) ?? 0, total: (running += regsByDay.get(d) ?? 0) }))
        const maxBar = Math.max(...series.map(s => s.count), 1), maxTotal = Math.max(...series.map(s => s.total), 1)
        const cx = M + 26, cw = W - 26 - 30, base = y - chartH
        ;[0, 0.5, 1].forEach(f => {
            page.drawLine({ start: { x: cx, y: base + f * (chartH - 10) }, end: { x: cx + cw, y: base + f * (chartH - 10) }, thickness: 0.4, color: C.line })
            textRight(String(Math.round(maxBar * f)), cx - 5, base + f * (chartH - 10) - 3, 7, font, C.muted)
            text(String(Math.round(maxTotal * f)), cx + cw + 5, base + f * (chartH - 10) - 3, 7, font, C.indigo)
        })
        const step = cw / series.length, bw = Math.max(2, Math.min(18, step * 0.7))
        series.forEach((s, i) => {
            const h = (s.count / maxBar) * (chartH - 10)
            if (s.count) page.drawRectangle({ x: cx + i * step + (step - bw) / 2, y: base, width: bw, height: Math.max(1.5, h), color: s.day >= startKey ? C.emerald : C.amber })
        })
        for (let i = 1; i < series.length; i++) {
            page.drawLine({
                start: { x: cx + (i - 0.5) * step, y: base + (series[i - 1].total / maxTotal) * (chartH - 10) },
                end: { x: cx + (i + 0.5) * step, y: base + (series[i].total / maxTotal) * (chartH - 10) }, thickness: 1.6, color: C.indigo,
            })
        }
        const ei = shown.indexOf(startKey)
        if (ei >= 0) {
            const ex = cx + (ei + 0.5) * step
            page.drawLine({ start: { x: ex, y: base }, end: { x: ex, y: base + chartH }, thickness: 1, color: C.rose, dashArray: [3, 2] })
            text("Event day", Math.min(ex + 4, cx + cw - 40), base + chartH - 6, 7.5, bold, C.rose)
        }
        text(dayLabel(shown[0]), cx, base - 12, 7.5, font, C.muted)
        textRight(dayLabel(shown[shown.length - 1]), cx + cw, base - 12, 7.5, font, C.muted)
        const legendY = base - 26
        page.drawRectangle({ x: cx, y: legendY, width: 8, height: 8, color: C.amber }); text("Registrations per day (left)", cx + 12, legendY + 1, 7.5, font, C.muted)
        page.drawRectangle({ x: cx + 140, y: legendY + 3, width: 14, height: 2, color: C.indigo }); text("Running total (right)", cx + 158, legendY + 1, 7.5, font, C.muted)
        page.drawRectangle({ x: cx + 260, y: legendY, width: 8, height: 8, color: C.emerald }); text("On/after event day", cx + 272, legendY + 1, 7.5, font, C.muted)
        if (clipped) textRight("Showing the last 45 days", cx + cw, legendY + 1, 7, italic, C.muted)
        y = legendY - 16

        const p = a.promo
        const tiles: [string, string, string][] = [
            ["Registrations opened", p.firstDay ? dayLabel(p.firstDay) : "–", p.windowDays !== null ? `${p.windowDays} days before the event` : ""],
            ["Busiest day", p.peak ? dayLabel(p.peak.day) : "–", p.peak ? `${p.peak.count} registrations` : ""],
            ["Last 48 hours", fmt(p.last48hPct, "%"), "of registrations came in the 2 days before"],
            ["Registered late", String(p.afterStart), "after the event had started"],
        ]
        const tw = (W - 3 * 8) / 4
        tiles.forEach(([l, v, h], i) => {
            const x = M + i * (tw + 8)
            box(x, y, tw, 52, C.amberSoft, undefined, 8)
            text(l.toUpperCase(), x + 10, y - 14, 6.6, bold, rgb(0.6, 0.4, 0.05))
            text(v, x + 10, y - 31, 13, bold, C.ink)
            wrap(h, 6.6, tw - 18).slice(0, 2).forEach((line, j) => text(line, x + 10, y - 41 - j * 7.5, 6.6, font, C.muted))
        })
        y -= 52 + 24
    }

    // ── Who registered ──
    if (a.years.length || a.courses.length) {
        const rowsH = Math.max(150, a.courses.length * 16 + 24)
        section("Who registered", "distinct students", rowsH + 50)
        // Donut by year
        const total = a.years.reduce((s, r) => s + r.count, 0)
        const dcx = M + 62, dcy = y - 68, dr = 50
        if (a.years.length === 1) page.drawCircle({ x: dcx, y: dcy, size: dr, borderColor: SERIES[0], borderWidth: 18 })
        let ang = -Math.PI / 2
        a.years.forEach((r, i) => {
            if (a.years.length === 1) return
            const sweep = (r.count / Math.max(total, 1)) * Math.PI * 2
            const a2 = ang + sweep
            page.drawSvgPath(`M ${dr * Math.cos(ang)} ${dr * Math.sin(ang)} A ${dr} ${dr} 0 ${sweep > Math.PI ? 1 : 0} 1 ${dr * Math.cos(a2)} ${dr * Math.sin(a2)}`, { x: dcx, y: dcy, borderColor: SERIES[i % SERIES.length], borderWidth: 18 })
            ang = a2
        })
        textCenter(String(total), dcx, dcy - 2, 16, bold, C.ink)
        textCenter("students", dcx, dcy - 13, 7, font, C.muted)
        text("BY YEAR", M, y + 2, 7.5, bold, C.muted)
        a.years.slice(0, 7).forEach((r, i) => {
            const ly = y - 14 - i * 15
            page.drawRectangle({ x: M + 128, y: ly - 1, width: 8, height: 8, color: SERIES[i % SERIES.length] })
            text(r.label, M + 141, ly, 8.5, font, C.text)
            textRight(`${r.count}  (${Math.round((r.count / Math.max(total, 1)) * 100)}%)`, M + 238, ly, 8.5, bold, C.ink)
        })
        // Courses
        const bx = M + 268, bwid = W - 268
        text("TOP COURSES", bx, y + 2, 7.5, bold, C.muted)
        const maxC = Math.max(...a.courses.map(c => c.count), 1)
        a.courses.forEach((c, i) => {
            const ly = y - 14 - i * 16
            text(fit(c.label, 8, 84), bx, ly, 8, font, C.text)
            const w = Math.max(2, ((bwid - 90 - 28) * c.count) / maxC)
            page.drawRectangle({ x: bx + 88, y: ly - 1.5, width: w, height: 9, color: SERIES[(i + 1) % SERIES.length] })
            text(String(c.count), bx + 88 + w + 4, ly, 8, bold, C.ink)
        })
        y -= rowsH
        // New vs returning
        if (k.registered) {
            ensure(44)
            text("NEW VS RETURNING", M, y - 6, 7.5, bold, C.muted)
            const nb = M + 110, nw = W - 110
            const fw = (k.firstTimers / k.registered) * nw
            page.drawRectangle({ x: nb, y: y - 12, width: nw, height: 14, color: C.indigoSoft })
            if (fw > 0) page.drawRectangle({ x: nb, y: y - 12, width: fw, height: 14, color: C.violet })
            text(`${k.firstTimers} first-time (${k.firstTimerPct}%)`, nb, y - 26, 7.5, bold, C.violet)
            textRight(`${k.registered - k.firstTimers} had attended Technova events before`, nb + nw, y - 26, 7.5, font, C.indigo)
            y -= 50
        }
    }

    // ── Attendance ──
    {
        const funnel: [string, number | null, RGB][] = [
            ["Registered", k.registered, C.indigo],
            ["Attended", k.attendanceRecorded ? k.attended : null, C.emerald],
            ["Gave feedback", k.feedbackResponses, C.amber],
            ["Got a certificate", k.certificates, C.rose],
        ]
        section("From registration to certificate", k.attendanceRecorded ? null : "attendance not recorded", funnel.length * 30 + 10)
        const max = Math.max(k.registered, 1)
        funnel.forEach(([l, v, c], i) => {
            const yy = y - i * 30
            text(l, M, yy - 14, 9, bold, C.ink)
            const bx = M + 110, bw = W - 110 - 120
            const w = v === null ? 0 : Math.max(2, (v / max) * bw)
            const x = bx + (bw - w) / 2
            box(bx, yy - 2, bw, 22, C.soft, undefined, 6)
            if (v !== null && v > 0) box(x, yy - 2, w, 22, c, undefined, 6)
            const label = v === null ? "not recorded" : String(v)
            const inside = v !== null && w > width(label, 9, bold) + 12
            textCenter(label, bx + bw / 2, yy - 16, 9, bold, inside ? C.white : C.muted)
            if (i > 0 && v !== null) {
                const prev = funnel.slice(0, i).reverse().find(f => f[1] !== null)?.[1] ?? null
                if (prev) text(`${Math.round((v / prev) * 100)}% of previous step`, bx + bw + 10, yy - 14, 7.5, font, C.muted)
            }
        })
        y -= funnel.length * 30 + 14

        if (a.yearTurnout.length) {
            ensure(30 + a.yearTurnout.length * 18)
            text("TURNOUT BY YEAR", M, y - 4, 7.5, bold, C.muted)
            y -= 18
            a.yearTurnout.forEach(r => {
                text(r.label, M, y - 8, 8.5, font, C.text)
                const bx = M + 110, bw = W - 110 - 150
                page.drawRectangle({ x: bx, y: y - 10, width: bw, height: 10, color: C.track })
                page.drawRectangle({ x: bx, y: y - 10, width: Math.max(1.5, (r.pct / 100) * bw), height: 10, color: r.pct >= 60 ? C.emerald : r.pct >= 40 ? C.amber : C.rose })
                text(`${r.attended} of ${r.registered} attended  ·  ${r.pct}%`, bx + bw + 8, y - 8.5, 7.8, bold, C.ink)
                y -= 18
            })
            y -= 10
        }
        if (a.dayAttendance.length > 1) {
            const ch = 80
            ensure(ch + 40)
            text("ATTENDANCE BY DAY", M, y - 4, 7.5, bold, C.muted)
            y -= 14
            const max = Math.max(...a.dayAttendance.map(d => d.count), 1)
            const step = Math.min(70, W / a.dayAttendance.length), bw = step * 0.6
            a.dayAttendance.forEach((d, i) => {
                const h = (d.count / max) * (ch - 14)
                const x = M + i * step + (step - bw) / 2
                page.drawRectangle({ x, y: y - ch, width: bw, height: Math.max(1.5, h), color: C.emerald })
                textCenter(String(d.count), x + bw / 2, y - ch + h + 3, 8, bold, C.ink)
                textCenter(dayLabel(d.day), x + bw / 2, y - ch - 11, 7.5, font, C.muted)
            })
            y -= ch + 26
        }
        y -= 6
    }

    // ── Feedback ──
    const hasRatings = a.ratingDist.some(r => r.count > 0)
    if (hasRatings || a.questionRatings.length || a.choices.length || a.comments.length) {
        section("Feedback", `${k.feedbackResponses} responses`, hasRatings ? 110 : 40)
        if (hasRatings) {
            box(M, y, 120, 96, C.amberSoft, undefined, 10)
            textCenter(k.avgRating !== null ? k.avgRating.toFixed(1) : "–", M + 60, y - 46, 30, bold, C.ink)
            textCenter("average out of 5", M + 60, y - 62, 7.5, font, C.muted)
            textCenter(`${k.ratings} ratings`, M + 60, y - 78, 7.5, bold, rgb(0.6, 0.4, 0.05))
            const maxR = Math.max(...a.ratingDist.map(r => r.count), 1)
            const total = a.ratingDist.reduce((s, r) => s + r.count, 0)
            ;[...a.ratingDist].reverse().forEach((r, i) => {
                const yy = y - 8 - i * 18
                text(`${r.star} star${r.star > 1 ? "s" : ""}`, M + 136, yy - 8, 8.5, font, C.text)
                const bx = M + 186, bw = W - 186 - 70
                page.drawRectangle({ x: bx, y: yy - 10, width: bw, height: 10, color: C.track })
                if (r.count) page.drawRectangle({ x: bx, y: yy - 10, width: (r.count / maxR) * bw, height: 10, color: r.star >= 4 ? C.emerald : r.star === 3 ? C.amber : C.rose })
                text(`${r.count}  (${Math.round((r.count / Math.max(total, 1)) * 100)}%)`, bx + bw + 8, yy - 8.5, 7.8, bold, C.ink)
            })
            y -= 112
        }
        if (a.questionRatings.length > 1 || (a.questionRatings.length === 1 && !hasRatings)) {
            ensure(24 + a.questionRatings.length * 20)
            text("RATING BY QUESTION", M, y - 4, 7.5, bold, C.muted)
            y -= 18
            for (const q of a.questionRatings) {
                ensure(22)
                text(fit(q.label, 8.5, 250), M, y - 8, 8.5, font, C.text)
                const bx = M + 260, bw = W - 260 - 80
                page.drawRectangle({ x: bx, y: y - 10, width: bw, height: 10, color: C.track })
                page.drawRectangle({ x: bx, y: y - 10, width: Math.max(1.5, (q.avg / 5) * bw), height: 10, color: q.avg >= 4 ? C.emerald : q.avg >= 3 ? C.amber : C.rose })
                text(`${q.avg.toFixed(1)} / 5  (${q.count})`, bx + bw + 8, y - 8.5, 7.8, bold, C.ink)
                y -= 20
            }
            y -= 10
        }
        for (const q of a.choices) {
            const legendRows = Math.ceil(q.options.length / 3)
            ensure(52 + legendRows * 12)
            text(fit(q.label, 9, W - 70, bold), M, y - 8, 9, bold, C.ink)
            textRight(`${q.total} answers`, M + W, y - 8, 7.5, font, C.muted)
            y -= 16
            let x = M
            q.options.forEach((o, i) => {
                const w = (o.count / Math.max(q.total, 1)) * W
                if (w <= 0) return
                page.drawRectangle({ x, y: y - 14, width: w, height: 14, color: SERIES[i % SERIES.length] })
                const pctLabel = `${Math.round((o.count / q.total) * 100)}%`
                if (w > width(pctLabel, 7.5, bold) + 6) textCenter(pctLabel, x + w / 2, y - 10, 7.5, bold, C.white)
                x += w
            })
            y -= 26
            q.options.forEach((o, i) => {
                const col = i % 3, row = Math.floor(i / 3)
                const lx = M + col * (W / 3), ly = y - row * 12
                page.drawRectangle({ x: lx, y: ly - 1, width: 7, height: 7, color: SERIES[i % SERIES.length] })
                text(fit(`${o.label}: ${o.count}`, 7.8, W / 3 - 14), lx + 11, ly, 7.8, font, C.text)
            })
            y -= legendRows * 12 + 14
        }
        // Themes from the AI, or a few comments
        if (ai && (ai.praise.length || ai.complaints.length || ai.suggestions.length)) {
            const cols: [string, string[], RGB, RGB][] = [["What students liked", ai.praise, C.emerald, C.emeraldSoft], ["What they didn't like", ai.complaints, C.rose, C.roseSoft], ["What they asked for", ai.suggestions, C.sky, C.skySoft]]
            const cw = (W - 16) / 3
            const laid = cols.map(([, items]) => (items.length ? items : ["Nothing mentioned"]).map(it => wrap(it, 8, cw - 30)))
            const h = Math.max(...laid.map(l => l.reduce((s, lines) => s + lines.length * 10.5 + 5, 0))) + 34
            ensure(h + 14)
            cols.forEach(([title, , c, soft], i) => {
                const x = M + i * (cw + 8)
                box(x, y, cw, h, soft, undefined, 8)
                text(title.toUpperCase(), x + 10, y - 16, 7, bold, c)
                let ty = y - 32
                laid[i].forEach(lines => {
                    page.drawCircle({ x: x + 13, y: ty + 2.5, size: 2, color: c })
                    lines.forEach((l, j) => text(l, x + 20, ty - j * 10.5, 8, font, C.ink))
                    ty -= lines.length * 10.5 + 5
                })
            })
            y -= h + 6
            text(`Themes grouped by AI from ${a.comments.length} written comments.`, M, y - 4, 6.8, italic, C.muted)
            y -= 20
        }
        const quotes = a.comments.filter(c => c.length >= 30).slice(0, ai ? 4 : 6)
        if (quotes.length) {
            ensure(40)
            text("IN THEIR WORDS", M, y - 4, 7.5, bold, C.muted)
            y -= 18
            for (const q of quotes) {
                const lines = wrap(`"${q.length > 260 ? q.slice(0, 257) + "..." : q}"`, 8.5, W - 16, italic)
                ensure(lines.length * 11.5 + 8)
                page.drawRectangle({ x: M, y: y - lines.length * 11.5 + 4, width: 2, height: lines.length * 11.5, color: C.amber })
                lines.forEach((l, i) => text(l, M + 10, y - 6 - i * 11.5, 8.5, italic, C.text))
                y -= lines.length * 11.5 + 8
            }
            y -= 8
        }
    }

    // ── Findings ──
    {
        const recs = ai?.recommendations.length ? ai.recommendations : a.findings.recommendations
        const lists: [string, string[], RGB, RGB, "dot" | "num"][] = [
            ["What worked", a.findings.worked, C.emerald, C.emeraldSoft, "dot"],
            ["Where it fell short", a.findings.lacked, C.rose, C.roseSoft, "dot"],
            ["What to do next time", recs, C.amber, C.amberSoft, "num"],
        ]
        section("Findings", "worked out from the numbers above", 80)
        for (const [title, items, c, soft, kind] of lists) {
            const body = items.length ? items : [title === "Where it fell short" ? "Nothing stood out as weak in the data." : "Not enough data to say."]
            const laid = body.map(it => wrap(it, 9, W - 48))
            const h = laid.reduce((s, l) => s + l.length * 12 + 6, 0) + 34
            ensure(Math.min(h, 220))
            box(M, y, W, h, soft, undefined, 10)
            page.drawRectangle({ x: M, y: y - h + 10, width: 3, height: h - 20, color: c })
            text(title.toUpperCase(), M + 16, y - 18, 8, bold, c)
            let ty = y - 36
            laid.forEach((lines, i) => {
                if (kind === "num") { page.drawCircle({ x: M + 22, y: ty + 3, size: 6.5, color: c }); textCenter(String(i + 1), M + 22, ty, 7.5, bold, C.white) }
                else page.drawCircle({ x: M + 22, y: ty + 3, size: 2.6, color: c })
                lines.forEach((l, j) => text(l, M + 34, ty - j * 12, 9, font, C.ink))
                ty -= lines.length * 12 + 6
            })
            y -= h + 12
        }
        if (ai?.recommendations.length) { text("Recommendations written by AI from the findings and comments.", M, y + 2, 6.8, italic, C.muted); y -= 12 }
    }

    // ── How to read ──
    {
        const notes = [
            "Attended = checked in by QR scan or marked in Bulk Attendance. Turnout = attended / registered.",
            "Feedback rate = feedback responses / attendees (or / registered students when attendance wasn't recorded).",
            "First-time students = this was the first Technova event they ever registered for.",
            "Engagement score (0-100) = turnout 35% + rating 25% + reach 25% (registrations vs the Technova average) + feedback rate 15%. Parts with no data are left out.",
            "Averages compare with all past Technova events that had registrations. Student details are not shown in this section.",
        ]
        const lines = notes.flatMap(n => wrap(n, 7.5, W - 14))
        ensure(lines.length * 10 + 30)
        y -= 6
        text("HOW TO READ THIS REPORT", M, y - 4, 7.5, bold, C.muted)
        y -= 16
        notes.forEach(n => wrap(n, 7.5, W - 14).forEach((l, i) => { if (i === 0) text("•", M, y - 4, 7.5, font, C.muted); text(l, M + 10, y - 4, 7.5, font, C.muted); y -= 10 }))
    }

    return pages.length
}

/** Footer with page numbers on every page of the finished document. */
export async function addFooters(pdf: PDFDocument, title: string) {
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const generated = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })
    const pages = pdf.getPages()
    pages.forEach((p, i) => {
        const left = clean(`Technova, SSCSE Technical Society · Sharda University  ·  ${title.length > 50 ? title.slice(0, 49) + "…" : title}  ·  Generated ${generated} IST`)
        p.drawText(left, { x: M, y: 22, size: 6.5, font, color: C.muted })
        const right = `Page ${i + 1} of ${pages.length}`
        p.drawText(right, { x: A4.w - M - font.widthOfTextAtSize(right, 7), y: 22, size: 7, font, color: C.muted })
    })
}
