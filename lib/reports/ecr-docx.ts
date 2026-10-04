/** ECR as a Word document (.docx): editable, same layout as the Sharda format. */
import {
    AlignmentType, BorderStyle, Document, Header, ImageRun, Packer, Paragraph, ShadingType, Table, TableCell,
    TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType,
} from "docx"
import { ECR_CONFIG, EVENT_TYPE_COLUMNS, sectionsAt, speakerRows, type EcrData, type EcrImage, type EcrSectionPosition } from "./ecr-data"

const FONT = "Times New Roman"
const GREY = "D9D9D9"
const LIGHT = "F3F3F3"
const CONTENT_PX = 640 // usable width at 96 dpi with the margins below

const run = (text: string, opts: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}) =>
    new TextRun({ text, font: FONT, size: (opts.size ?? 11) * 2, bold: opts.bold, italics: opts.italics, color: opts.color })

const para = (text: string, opts: { bold?: boolean; italics?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; color?: string; after?: number; bullet?: boolean } = {}) =>
    new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        spacing: { after: opts.after ?? 60 },
        ...(opts.bullet ? { bullet: { level: 0 } } : {}),
        children: [run(text, opts)],
    })

const placeholder = (text: string) => para(text, { italics: true, color: "808080", size: 10 })

function image(img: EcrImage, maxWidthPx: number) {
    const width = Math.min(maxWidthPx, img.width)
    const height = Math.round((img.height / img.width) * width)
    return new ImageRun({ type: "jpg", data: img.data, transformation: { width, height } })
}

function cell(children: Paragraph[], opts: { width?: number; label?: boolean; shade?: string; span?: number; tight?: boolean } = {}) {
    return new TableCell({
        children,
        columnSpan: opts.span,
        verticalAlign: VerticalAlign.CENTER,
        width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
        shading: opts.label || opts.shade ? { type: ShadingType.CLEAR, color: "auto", fill: opts.shade ?? GREY } : undefined,
        margins: opts.tight ? { top: 60, bottom: 60, left: 30, right: 30 } : { top: 80, bottom: 80, left: 100, right: 100 },
    })
}

const label = (text: string) => cell([para(text, { bold: true, align: AlignmentType.CENTER })], { width: 22, label: true })
// Content width is 9906 twips (A4 minus 1000 + 1000 margins); every table uses the same left label column.
const TOTAL = 9906, LABEL = 2180
const split = (n: number) => { const w = Math.floor((TOTAL - LABEL) / n); return [LABEL, ...Array.from({ length: n }, (_, i) => (i === n - 1 ? TOTAL - LABEL - w * (n - 1) : w))] }
const table = (rows: TableRow[], columnWidths: number[] = split(1)) =>
    new Table({ rows, columnWidths, layout: TableLayoutType.FIXED, width: { size: TOTAL, type: WidthType.DXA } })

export async function renderEcrDocx(d: EcrData): Promise<Buffer> {
    const valueWidthPx = Math.round(CONTENT_PX * 0.74)

    const header = new Header({
        children: [
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
                rows: [new TableRow({
                    children: [
                        new TableCell({ width: { size: 22, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: d.shardaLogo ? [image(d.shardaLogo, 130)] : [] })] }),
                        new TableCell({
                            width: { size: 78, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
                            children: [para(ECR_CONFIG.university, { bold: true, size: 24, align: AlignmentType.CENTER, after: 0 }), para(ECR_CONFIG.address, { size: 10, align: AlignmentType.CENTER })],
                        }),
                    ],
                })],
            }),
        ],
    })

    const summaryParas = d.summary.split(/\n{2,}|\r?\n/).map(t => t.trim()).filter(Boolean).map(t => para(t, { align: AlignmentType.JUSTIFIED, after: 100 }))
    const photos = d.photos.length
        ? d.photos.flatMap(p => [new Paragraph({ alignment: AlignmentType.CENTER, children: [image(p, valueWidthPx - 20)] }), para(p.caption, { italics: true, size: 9, align: AlignmentType.CENTER, color: "44546A", after: 160 })])
        : [placeholder("[Insert event photos here, with captions such as \"Figure 1: Day 1 session\"]")]

    // Extra sections from the popup: same label | value rows as the main table
    const customRows = (at: EcrSectionPosition) => sectionsAt(d, at).map(c => new TableRow({
        children: [label(c.title), cell(c.lines.length ? c.lines.map(l => para(l.text, { bullet: l.bullet })) : [para("")])],
    }))
    const customBlock = (at: EcrSectionPosition) => {
        const rows = customRows(at)
        return rows.length ? [table(rows), gap()] : []
    }
    const gap = () => new Paragraph({ spacing: { after: 200 }, children: [] })

    const main = table([
        new TableRow({ children: [label("Name of the Event"), cell([para(d.eventName, { bold: true, align: AlignmentType.CENTER })])] }), ...customRows("eventName"),
        new TableRow({ children: [label("Date of the Event"), cell([para(d.dateText, { align: AlignmentType.CENTER })])] }), ...customRows("date"),
        new TableRow({ children: [label("Location of the Event"), cell([para(d.location, { align: AlignmentType.CENTER })])] }), ...customRows("location"),
        new TableRow({ children: [label("Sponsoring Organization (if Any sponsor)"), cell([para(d.sponsor, { align: AlignmentType.CENTER })])] }), ...customRows("sponsor"),
        new TableRow({ children: [label("Event Caption/ Conference Summary /"), cell(summaryParas.length ? summaryParas : [para("")])] }), ...customRows("summary"),
        new TableRow({ children: [label("Notes, Highlights & dialogs with representative, speakers, and exhibitors"), cell(d.highlights.length ? d.highlights.map(h => para(h, { bullet: true })) : [placeholder("[Add day-wise highlights: sessions, speakers and activities]")])] }), ...customRows("highlights"),
        new TableRow({ children: [label("Images/Photos Of representative, speakers, and exhibitors"), cell(photos)] }), ...customRows("photos"),
        new TableRow({ children: [label("Videos representative, speakers, and exhibitors"), cell([d.videoText ? para(d.videoText, { align: AlignmentType.CENTER }) : placeholder("[Add recording link]")])] }), ...customRows("videos"),
    ])

    const org = table([
        new TableRow({ children: [label("Name of the Organizing Department / School"), cell([para("Department", { bold: true, align: AlignmentType.CENTER })], { shade: GREY }), cell([para("School", { bold: true, align: AlignmentType.CENTER })], { shade: GREY })] }),
        new TableRow({ children: [cell([para("")], { label: true }), cell([para(d.department, { align: AlignmentType.CENTER })]), cell([para(d.school, { align: AlignmentType.CENTER })])] }),
    ], split(2))

    const conveners = table([
        new TableRow({ children: [label("Convener details"), cell([para("Name", { bold: true, align: AlignmentType.CENTER })], { shade: GREY }), cell([para("Contact Number", { bold: true, align: AlignmentType.CENTER })], { shade: GREY }), cell([para("Email ID", { bold: true, align: AlignmentType.CENTER })], { shade: GREY })] }),
        ...d.conveners.map(c => new TableRow({ children: [cell([para("")], { label: true }), cell([para(c.name, { align: AlignmentType.CENTER })]), cell([para(c.phone, { align: AlignmentType.CENTER })]), cell([para(c.email, { align: AlignmentType.CENTER, color: "1155CC" })])] })),
    ], split(3))

    const speakers = table([
        new TableRow({ children: ["Speaker details", "Name of the Speaker", "Affiliation", "AREA [Academics/ Industry/ Research Organization/ Others (Please specify)]"].map(h => cell([para(h, { bold: true, align: AlignmentType.CENTER, size: 10 })], { shade: GREY })) }),
        ...speakerRows(d).map((sp, i) => new TableRow({ children: [cell([para(`Speaker - ${i + 1}`, { bold: true, size: 10 })], { shade: GREY }), cell([para(sp.name, { align: AlignmentType.CENTER })]), cell([para(sp.affiliation, { align: AlignmentType.CENTER })]), cell([para(sp.area, { align: AlignmentType.CENTER })])] })),
    ], split(3))

    const types = table([
        new TableRow({ children: [cell([para("Type of the Event", { bold: true, size: 10 })], { shade: GREY }), cell([para("(Write 'Yes' where applicable in the respective event column)", { bold: true, align: AlignmentType.CENTER, size: 10 })], { shade: GREY, span: EVENT_TYPE_COLUMNS.length })] }),
        new TableRow({ children: [cell([para("")], { shade: GREY }), ...EVENT_TYPE_COLUMNS.map(c => cell([para(c, { bold: true, size: 7, align: AlignmentType.CENTER })], { shade: GREY, tight: true }))] }),
        ...(["National", "International"] as const).map(scope => new TableRow({ children: [cell([para(scope, { bold: true, size: scope === "National" ? 10 : 9, align: AlignmentType.CENTER })], { shade: GREY }), ...EVENT_TYPE_COLUMNS.map(c => cell([para(c === d.eventTypeColumn && scope === d.eventScope ? "Yes" : "", { size: 10, align: AlignmentType.CENTER })]))] })),
    ], [1106, ...Array.from({ length: EVENT_TYPE_COLUMNS.length }, () => 880)])

    const participants = table([
        new TableRow({ tableHeader: true, children: ["Name", "System ID", "Email ID", "Course"].map(h => cell([para(h, { bold: true, size: 10 })], { shade: GREY })) }),
        ...d.participants.map((p, i) => new TableRow({ children: [p.name, p.systemId, p.email, p.course].map(v => cell([para(v, { size: 10, color: v === p.email ? "1155CC" : undefined })], { shade: i % 2 ? undefined : LIGHT })) })),
    ], [2700, 1500, 3700, 2006])

    const feedback = d.feedback.length
        ? table(d.feedback.map((f, i) => new TableRow({ children: [cell([para(`${i + 1}.`, { align: AlignmentType.CENTER })]), cell([para(f)])] })), [800, TOTAL - 800])
        : placeholder("[No written feedback was collected on the website for this event]")

    const heading = (text: string) => para(text, { bold: true, size: 12, after: 120 })

    const doc = new Document({
        creator: "Technova, Sharda University",
        title: d.eventName,
        styles: { default: { document: { run: { font: FONT, size: 22 } } } },
        sections: [{
            properties: { page: { margin: { top: 1600, bottom: 1000, left: 1000, right: 1000, header: 500 } } },
            headers: { default: header },
            children: [
                main, gap(), org, conveners, gap(), ...customBlock("conveners"),
                speakers, gap(), ...customBlock("speakers"),
                types, gap(), ...customBlock("eventType"),
                heading("List of Participants:"),
                ...(d.participantsNote ? [placeholder(d.participantsNote)] : []),
                participants, gap(), ...customBlock("participants"),
                heading("Event Pamphlet:"),
                d.pamphlet ? new Paragraph({ alignment: AlignmentType.CENTER, children: [image(d.pamphlet, 360)] }) : placeholder("[Insert event poster]"),
                gap(), ...customBlock("pamphlet"),
                heading("Event Feedback:"),
                feedback, gap(), ...customBlock("feedback"),
                new Paragraph({ children: [run("Certificate(sample): ", { bold: true, size: 12 }), run(d.certificateText, { size: 12 })] }),
                ...(customRows("end").length ? [gap(), table(customRows("end"))] : []),
            ],
        }],
    })
    return Packer.toBuffer(doc)
}
