/** "ECR + Analytics": the colour analytics pages first, then the ECR in the Sharda format, one PDF. */
import { PDFDocument } from "pdf-lib"
import type { EcrData } from "./ecr-data"
import { renderEcrPdf } from "./ecr-pdf"
import type { EventAnalytics } from "./event-analytics"
import type { EventAiWriteUp } from "./event-analytics-ai"
import { addFooters, clean, renderAnalyticsPages, type ReportLogos } from "./analytics-pdf"

export async function renderEcrWithAnalytics(ecr: EcrData, a: EventAnalytics, ai: EventAiWriteUp | null, logos: ReportLogos) {
    const pdf = await PDFDocument.create()
    pdf.setTitle(clean(`${a.event.title} – ECR and Analytics`))
    pdf.setAuthor("Technova, Sharda University")
    await renderAnalyticsPages(pdf, a, ai, logos)
    const ecrDoc = await PDFDocument.load(await renderEcrPdf(ecr))
    for (const p of await pdf.copyPages(ecrDoc, ecrDoc.getPageIndices())) pdf.addPage(p)
    await addFooters(pdf, a.event.title)
    return pdf.save()
}
