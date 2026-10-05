/** ECR as a PDF, drawn with pdf-lib in the same layout as the Sharda format (and the .docx version). */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib"
import { ECR_CONFIG, EVENT_TYPE_COLUMNS, sectionsAt, speakerRows, type EcrData, type EcrImage, type EcrSectionPosition } from "./ecr-data"

const A4 = { w: 595.28, h: 841.89 }
const M = { left: 50, right: 50, top: 108, bottom: 48 }
const WIDTH = A4.w - M.left - M.right
const PAD = 5
const GREY = rgb(0.85, 0.85, 0.85)
const LIGHT = rgb(0.955, 0.955, 0.955)
const INK = rgb(0, 0, 0)
const MUTED = rgb(0.45, 0.45, 0.45)
const LINK = rgb(0.07, 0.33, 0.8)

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont }
type TextBlock = { kind: "text"; text: string; bold?: boolean; italic?: boolean; size?: number; align?: "left" | "center"; color?: RGB; bullet?: boolean }
type ImageBlock = { kind: "image"; image: PDFImage; width: number; height: number; caption?: string }
type Block = TextBlock | ImageBlock
type Cell = { blocks: Block[]; fill?: RGB; valign?: "top" | "middle" }
type Item = { h: number; draw: (page: PDFPage, x: number, top: number, w: number) => void; spacer?: boolean }

/** Standard PDF fonts only cover Latin-1; replace anything else so pdf-lib doesn't throw. */
function clean(t: string) {
    // NFKC turns styled letters (𝗗𝗮𝘁𝗮, ｆｕｌｌｗｉｄｔｈ) into plain ones before the rest is filtered
    return t.normalize("NFKC").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/₹/g, "Rs ").replace(/[–—]/g, "-")
        .replace(/[^\x20-\x7E -ÿ•]/g, "")
}

function wrap(text: string, font: PDFFont, size: number, max: number) {
    const out: string[] = []
    for (const para of clean(text).split(/\r?\n/)) {
        let line = ""
        for (const word of para.split(/\s+/).filter(Boolean)) {
            const next = line ? `${line} ${word}` : word
            if (font.widthOfTextAtSize(next, size) <= max) { line = next; continue }
            if (line) out.push(line)
            // break words longer than the column (emails)
            let w = word
            while (font.widthOfTextAtSize(w, size) > max) {
                let i = w.length
                while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > max) i--
                out.push(w.slice(0, i)); w = w.slice(i)
            }
            line = w
        }
        out.push(line)
    }
    return out
}

export async function renderEcrPdf(d: EcrData): Promise<Uint8Array> {
    const pdf = await PDFDocument.create()
    pdf.setTitle(clean(d.eventName))
    pdf.setAuthor("Technova, Sharda University")
    const fonts: Fonts = {
        regular: await pdf.embedFont(StandardFonts.TimesRoman),
        bold: await pdf.embedFont(StandardFonts.TimesRomanBold),
        italic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    }
    const embed = async (img: EcrImage | null) => (img ? { img, pdfImage: await pdf.embedJpg(img.data) } : null)
    const logo = await embed(d.shardaLogo)
    const pamphlet = await embed(d.pamphlet)
    const photos = await Promise.all(d.photos.map(embed))

    let page!: PDFPage
    let y = 0
    const newPage = () => {
        page = pdf.addPage([A4.w, A4.h])
        if (logo) {
            const h = 34, w = (logo.img.width / logo.img.height) * h
            page.drawImage(logo.pdfImage, { x: M.left + 8, y: A4.h - 40 - h / 2 - 6, width: w, height: h })
        }
        const t = ECR_CONFIG.university, ts = 26
        page.drawText(t, { x: A4.w / 2 - fonts.bold.widthOfTextAtSize(t, ts) / 2 + 20, y: A4.h - 52, size: ts, font: fonts.bold, color: INK })
        const a = ECR_CONFIG.address, as = 10.5
        page.drawText(a, { x: A4.w / 2 - fonts.regular.widthOfTextAtSize(a, as) / 2 + 20, y: A4.h - 68, size: as, font: fonts.regular, color: INK })
        y = A4.h - M.top + 18
    }
    newPage()

    // ── layout helpers ──
    const fontOf = (b: TextBlock) => (b.bold ? fonts.bold : b.italic ? fonts.italic : fonts.regular)
    const items = (cell: Cell, width: number): Item[] => {
        const inner = width - 2 * PAD
        const out: Item[] = []
        for (const b of cell.blocks) {
            if (b.kind === "image") {
                const w = Math.min(inner, b.width), h = (b.height / b.width) * w
                out.push({ h: h + 4, draw: (p, x, top) => p.drawImage(b.image, { x: x + PAD + (inner - w) / 2, y: top - h, width: w, height: h }) })
                if (b.caption) {
                    const cap = b.caption
                    out.push({ h: 14, draw: (p, x, top) => p.drawText(clean(cap), { x: x + PAD + (inner - fonts.italic.widthOfTextAtSize(clean(cap), 9)) / 2, y: top - 10, size: 9, font: fonts.italic, color: rgb(0.27, 0.33, 0.42) }) })
                }
                continue
            }
            const font = fontOf(b), size = b.size ?? 10.5, lh = size * 1.3
            const indent = b.bullet ? 14 : 0
            const lines = wrap(b.text, font, size, inner - indent)
            lines.forEach((line, i) => out.push({
                h: lh,
                draw: (p, x, top) => {
                    if (b.bullet && i === 0) p.drawText("•", { x: x + PAD + 3, y: top - size, size, font: fonts.regular, color: INK })
                    const tx = b.align === "center" ? x + PAD + (inner - font.widthOfTextAtSize(line, size)) / 2 : x + PAD + indent
                    p.drawText(line, { x: tx, y: top - size, size, font, color: b.color ?? INK })
                },
            }))
            out.push({ h: 2, draw: () => {}, spacer: true })
        }
        // a trailing spacer must not spill onto the next page as an empty row
        while (out.length && out[out.length - 1].spacer) out.pop()
        return out
    }

    /** Draws one table row; rows taller than the space left continue on the next page. */
    const drawRow = (cells: Cell[], widths: number[], opts: { minH?: number; onNewPage?: () => void } = {}) => {
        const laid = cells.map((c, i) => items(c, widths[i]))
        const next = laid.map(() => 0)
        let first = true
        while (laid.some((it, i) => next[i] < it.length) || first) {
            const avail = y - M.bottom - 2 * PAD
            const take = laid.map((it, i) => {
                let h = 0, n = next[i]
                while (n < it.length && h + it[n].h <= avail) { h += it[n].h; n++ }
                return { h, n }
            })
            const fits = take.every((t, i) => t.n === laid[i].length) || take.some((t, i) => t.n > next[i])
            if (!fits || (take.every((t, i) => t.n === next[i]) && !first)) { newPage(); opts.onNewPage?.(); continue }
            const contentH = Math.max(...take.map(t => t.h))
            const rowH = Math.max(contentH + 2 * PAD, first ? opts.minH ?? 0 : 0)
            let x = M.left
            cells.forEach((c, i) => {
                page.drawRectangle({ x, y: y - rowH, width: widths[i], height: rowH, color: c.fill, borderColor: INK, borderWidth: 0.6 })
                const cellH = take[i].h
                let top = y - PAD - (c.valign === "middle" ? Math.max(0, (rowH - 2 * PAD - cellH) / 2) : 0)
                for (let k = next[i]; k < take[i].n; k++) { laid[i][k].draw(page, x, top, widths[i]); top -= laid[i][k].h }
                x += widths[i]
            })
            take.forEach((t, i) => (next[i] = t.n))
            y -= rowH
            first = false
            if (laid.every((it, i) => next[i] >= it.length)) break
            newPage(); opts.onNewPage?.()
        }
    }

    const T = (text: string, o: Partial<TextBlock> = {}): TextBlock => ({ kind: "text", text, ...o })
    const LABEL_W = 115
    const labelCell = (text: string): Cell => ({ blocks: [T(text, { bold: true, align: "center", size: 10.5 })], fill: GREY, valign: "middle" })
    const gap = (h = 16) => { y -= h; if (y < M.bottom + 40) newPage() }
    const heading = (text: string) => {
        if (y - 40 < M.bottom) newPage()
        page.drawText(text, { x: M.left, y: y - 14, size: 12, font: fonts.bold, color: INK })
        y -= 24
    }
    const placeholder = (text: string) => T(text, { italic: true, color: MUTED, size: 9.5 })
    // Extra sections from the popup: same label | value rows as the main table
    const customRows = (at: EcrSectionPosition) => {
        for (const c of sectionsAt(d, at)) {
            const blocks = c.lines.length ? c.lines.map(l => T(l.text, { bullet: l.bullet })) : [T("")]
            drawRow([labelCell(c.title), { blocks, valign: blocks.length <= 1 ? "middle" : "top" }], [LABEL_W, WIDTH - LABEL_W], { minH: 34 })
        }
    }
    const customBlock = (at: EcrSectionPosition, after = 16) => { if (sectionsAt(d, at).length) { customRows(at); gap(after) } }

    // ── 1. Main table ──
    const main: [string, Block[], EcrSectionPosition][] = [
        ["Name of the Event", [T(d.eventName, { bold: true, align: "center" })], "eventName"],
        ["Date of the Event", [T(d.dateText, { align: "center" })], "date"],
        ["Location of the Event", [T(d.location, { align: "center" })], "location"],
        ["Sponsoring Organization (if Any sponsor)", [T(d.sponsor, { align: "center" })], "sponsor"],
        ["Event Caption/ Conference Summary /", d.summary.split(/\r?\n/).map(t => t.trim()).filter(Boolean).map(t => T(t)), "summary"],
        ["Notes, Highlights & dialogs with representative, speakers, and exhibitors", d.highlights.length ? d.highlights.map(h => T(h, { bullet: true })) : [placeholder("[Add day-wise highlights: sessions, speakers and activities]")], "highlights"],
        ["Images/Photos Of representative, speakers, and exhibitors", photos.length
            ? photos.flatMap(p => (p ? [{ kind: "image", image: p.pdfImage, width: Math.min(p.img.width, 330), height: p.img.height * Math.min(1, 330 / p.img.width), caption: p.img.caption } as ImageBlock] : []))
            : [placeholder("[Insert event photos here, with captions such as \"Figure 1: Day 1 session\"]")], "photos"],
        ["Videos representative, speakers, and exhibitors", [d.videoText ? T(d.videoText, { align: "center" }) : placeholder("[Add recording link]")], "videos"],
    ]
    for (const [label, blocks, id] of main) {
        drawRow([labelCell(label), { blocks, valign: blocks.length <= 1 ? "middle" : "top" }], [LABEL_W, WIDTH - LABEL_W], { minH: 34 })
        customRows(id)
    }
    gap()

    // ── 2. Organising department, conveners ──
    const thirds = (n: number) => [LABEL_W, ...Array.from({ length: n }, () => (WIDTH - LABEL_W) / n)]
    drawRow([labelCell("Name of the Organizing Department / School"), { blocks: [T("Department", { bold: true, align: "center" })], fill: GREY, valign: "middle" }, { blocks: [T("School", { bold: true, align: "center" })], fill: GREY, valign: "middle" }], thirds(2))
    drawRow([{ blocks: [T("")], fill: GREY }, { blocks: [T(d.department, { align: "center" })], valign: "middle" }, { blocks: [T(d.school, { align: "center" })], valign: "middle" }], thirds(2))
    drawRow([labelCell("Convener details"), ...["Name", "Contact Number", "Email ID"].map(h => ({ blocks: [T(h, { bold: true, align: "center" })], fill: GREY, valign: "middle" as const }))], thirds(3))
    for (const c of d.conveners) {
        drawRow([{ blocks: [T("")], fill: GREY }, { blocks: [T(c.name, { align: "center" })] }, { blocks: [T(c.phone, { align: "center" })] }, { blocks: [T(c.email, { align: "center", color: LINK, size: 9.5 })] }], thirds(3))
    }
    gap()
    customBlock("conveners")

    // ── 3. Speakers ──
    drawRow(["Speaker details", "Name of the Speaker", "Affiliation", "AREA [Academics/ Industry/ Research Organization/ Others (Please specify)]"].map(h => ({ blocks: [T(h, { bold: true, align: "center", size: 9.5 })], fill: GREY, valign: "middle" as const })), thirds(3))
    speakerRows(d).forEach((sp, i) => drawRow([{ blocks: [T(`Speaker - ${i + 1}`, { bold: true, size: 9.5 })], fill: GREY }, ...[sp.name, sp.affiliation, sp.area].map(v => ({ blocks: [T(v, { align: "center" as const, size: 10 })], valign: "middle" as const }))], thirds(3), { minH: 18 }))
    gap()
    customBlock("speakers")

    // ── 4. Type of the event ──
    const tw = [58, ...EVENT_TYPE_COLUMNS.map(() => (WIDTH - 58) / EVENT_TYPE_COLUMNS.length)]
    drawRow([{ blocks: [T("Type of the Event", { bold: true, size: 8.5 })], fill: GREY, valign: "middle" }, { blocks: [T("(Write 'Yes' where applicable in the respective event column)", { bold: true, align: "center", size: 9.5 })], fill: GREY, valign: "middle" }], [58, WIDTH - 58])
    drawRow([{ blocks: [T("")], fill: GREY }, ...EVENT_TYPE_COLUMNS.map(c => ({ blocks: [T(c, { bold: true, align: "center", size: 6.4 })], fill: GREY, valign: "middle" as const }))], tw)
    for (const scope of ["National", "International"] as const) {
        drawRow([{ blocks: [T(scope, { bold: true, align: "center", size: scope === "National" ? 8.5 : 8 })], fill: GREY, valign: "middle" }, ...EVENT_TYPE_COLUMNS.map(c => ({ blocks: [T(c === d.eventTypeColumn && scope === d.eventScope ? "Yes" : "", { align: "center", size: 9.5 })], valign: "middle" as const }))], tw, { minH: 20 })
    }
    gap(22)
    customBlock("eventType", 22)

    // ── 5. Participants ──
    heading("List of Participants:")
    if (d.participantsNote) { drawRow([{ blocks: [placeholder(d.participantsNote)] }], [WIDTH]); gap(6) }
    const pw = [140, 72, 190, WIDTH - 402]
    const headerRow = () => drawRow(["Name", "System ID", "Email ID", "Course"].map(h => ({ blocks: [T(h, { bold: true, size: 9.5 })], fill: GREY })), pw)
    headerRow()
    d.participants.forEach((p, i) => {
        if (y - 22 < M.bottom) { newPage(); headerRow() }
        drawRow([p.name, p.systemId, p.email, p.course].map((v, k) => ({ blocks: [T(v, { size: 9, color: k === 2 ? LINK : INK })], fill: i % 2 ? undefined : LIGHT })), pw)
    })
    if (d.participants.length === 0) drawRow([{ blocks: [placeholder("No participants recorded on the website.")] }], [WIDTH])
    gap(22)
    customBlock("participants", 22)

    // ── 6. Pamphlet ──
    heading("Event Pamphlet:")
    if (pamphlet) {
        const w = Math.min(230, pamphlet.img.width), h = (pamphlet.img.height / pamphlet.img.width) * w
        if (y - h < M.bottom) newPage()
        page.drawImage(pamphlet.pdfImage, { x: A4.w / 2 - w / 2, y: y - h, width: w, height: h })
        y -= h + 18
    } else {
        drawRow([{ blocks: [placeholder("[Insert event poster]")] }], [WIDTH])
        gap()
    }
    customBlock("pamphlet")

    // ── 7. Feedback ──
    heading("Event Feedback:")
    if (d.feedback.length) d.feedback.forEach((f, i) => drawRow([{ blocks: [T(`${i + 1}.`, { align: "center" })] }, { blocks: [T(f)] }], [36, WIDTH - 36]))
    else drawRow([{ blocks: [placeholder("[No written feedback was collected on the website for this event]")] }], [WIDTH])
    gap(22)
    customBlock("feedback", 22)

    // ── 8. Certificate ──
    if (y - 20 < M.bottom) newPage()
    const label = "Certificate(sample): "
    page.drawText(label, { x: M.left, y: y - 12, size: 12, font: fonts.bold, color: INK })
    const certLines = wrap(d.certificateText, fonts.regular, 12, WIDTH - fonts.bold.widthOfTextAtSize(label, 12))
    certLines.forEach((l, i) => page.drawText(l, { x: M.left + fonts.bold.widthOfTextAtSize(label, 12), y: y - 12 - i * 15, size: 12, font: fonts.regular, color: INK }))
    if (sectionsAt(d, "end").length) { y -= certLines.length * 15 + 20; customRows("end") }

    return pdf.save()
}
