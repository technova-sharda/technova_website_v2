import { PDFDocument, rgb, StandardFonts, PDFImage, PDFFont, PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFile } from 'fs/promises'
import path from 'path'
import { generateCertificateQRBuffer } from '@/lib/qr/generate'
import type { QRRegion, TextRegion, TextFieldType } from '@/types/custom'
import { CERTIFICATE_FONT_DIR, DISABLED_FONT_FEATURES, FONT_BASELINE_HEIGHT, getCertificateFont, getFontFileName } from '@/lib/certificates/fonts'
import { downloadCertificateFile } from '@/lib/certificates/storage'

// ==========================================
// Types
// ==========================================

export interface CertificateData {
    participantName: string
    eventName: string
    eventDate: string
    certificateId: string
    organizerName?: string
    roleTitle?: string
}

export interface CertificateGenerationOptions {
    templateUrl?: string
    qrRegion: QRRegion
    textRegions: TextRegion[]
    data: CertificateData
    baseUrl?: string
}

// ==========================================
// Legacy Certificate Generation (Fallback)
// ==========================================

export async function generateCertificate(
    userName: string,
    eventTitle: string,
    eventDate: string,
    certificateId?: string
): Promise<Uint8Array> {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create()

    // Add a page (A4 landscape)
    const page = pdfDoc.addPage([842, 595]) // A4 landscape in points

    // Get fonts
    const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman)

    const { width, height } = page.getSize()

    // Draw border
    page.drawRectangle({
        x: 30,
        y: 30,
        width: width - 60,
        height: height - 60,
        borderColor: rgb(0.1, 0.3, 0.6),
        borderWidth: 3,
    })

    // Inner border
    page.drawRectangle({
        x: 40,
        y: 40,
        width: width - 80,
        height: height - 80,
        borderColor: rgb(0.6, 0.7, 0.8),
        borderWidth: 1,
    })

    // Title
    page.drawText('CERTIFICATE OF PARTICIPATION', {
        x: width / 2 - 200,
        y: height - 120,
        size: 28,
        font: timesRomanBold,
        color: rgb(0.1, 0.2, 0.5),
    })

    // Subtitle
    page.drawText('This is to certify that', {
        x: width / 2 - 80,
        y: height - 200,
        size: 16,
        font: timesRoman,
        color: rgb(0.3, 0.3, 0.3),
    })

    // User Name
    const nameWidth = timesRomanBold.widthOfTextAtSize(userName, 36)
    page.drawText(userName, {
        x: (width - nameWidth) / 2,
        y: height - 260,
        size: 36,
        font: timesRomanBold,
        color: rgb(0, 0, 0),
    })

    // Line under name
    page.drawLine({
        start: { x: width / 2 - 150, y: height - 275 },
        end: { x: width / 2 + 150, y: height - 275 },
        thickness: 1,
        color: rgb(0.3, 0.3, 0.3),
    })

    // Participation text
    page.drawText('has successfully participated in', {
        x: width / 2 - 100,
        y: height - 320,
        size: 16,
        font: timesRoman,
        color: rgb(0.3, 0.3, 0.3),
    })

    // Event Title
    const eventWidth = timesRomanBold.widthOfTextAtSize(eventTitle, 24)
    page.drawText(eventTitle, {
        x: (width - eventWidth) / 2,
        y: height - 370,
        size: 24,
        font: timesRomanBold,
        color: rgb(0.1, 0.3, 0.6),
    })

    // Date
    page.drawText(`held on ${eventDate}`, {
        x: width / 2 - 60,
        y: height - 420,
        size: 14,
        font: timesRoman,
        color: rgb(0.4, 0.4, 0.4),
    })

    // Add QR Code if certificate ID is provided
    if (certificateId) {
        try {
            const qrBuffer = await generateCertificateQRBuffer(certificateId, 100)
            const qrImage = await pdfDoc.embedPng(qrBuffer)

            page.drawImage(qrImage, {
                x: width - 140,
                y: 50,
                width: 80,
                height: 80,
            })

            // Certificate ID text below QR
            page.drawText(`ID: ${certificateId}`, {
                x: width - 140,
                y: 35,
                size: 8,
                font: timesRoman,
                color: rgb(0.5, 0.5, 0.5),
            })
        } catch (error) {
            console.error('Failed to embed QR code:', error)
        }
    }

    // Footer
    page.drawText('Technova - SET Technical Society', {
        x: width / 2 - 100,
        y: 80,
        size: 12,
        font: timesRoman,
        color: rgb(0.5, 0.5, 0.5),
    })

    page.drawText('Sharda University', {
        x: width / 2 - 50,
        y: 60,
        size: 10,
        font: timesRoman,
        color: rgb(0.6, 0.6, 0.6),
    })

    // Serialize the PDF to bytes
    return await pdfDoc.save()
}

// ==========================================
// Shared helpers
// ==========================================

// Small in-memory caches. Generating a ZIP for a whole event used to download the
// same template image (and re-read the same fonts) once per student.
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_MAX_ENTRIES = 8
const assetCache = new Map<string, { at: number; bytes: Promise<ArrayBuffer | Uint8Array> }>()

function cached(key: string, load: () => Promise<ArrayBuffer | Uint8Array>): Promise<ArrayBuffer | Uint8Array> {
    const now = Date.now()
    const hit = assetCache.get(key)
    if (hit && now - hit.at < CACHE_TTL_MS) return hit.bytes

    const bytes = load()
    // Don't keep failed loads around
    bytes.catch(() => assetCache.delete(key))
    assetCache.set(key, { at: now, bytes })
    if (assetCache.size > CACHE_MAX_ENTRIES) {
        const oldest = assetCache.keys().next().value
        if (oldest !== undefined) assetCache.delete(oldest)
    }
    return bytes
}

/** Signed URLs carry a changing token; cache by the stable path part. */
function cacheKeyForUrl(url: string): string {
    try {
        const u = new URL(url)
        return `url:${u.origin}${u.pathname}`
    } catch {
        return `url:${url}`
    }
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`)
    }
    return await response.arrayBuffer()
}

/** Embeds a PNG/JPG background as a page sized to the image's aspect ratio (max A4 landscape). */
async function addImagePage(pdfDoc: PDFDocument, buffer: ArrayBuffer | Uint8Array, hint: string): Promise<PDFPage> {
    const lower = hint.toLowerCase().split('?')[0]
    let image: PDFImage
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
        image = await pdfDoc.embedJpg(buffer)
    } else {
        try {
            image = await pdfDoc.embedPng(buffer)
        } catch {
            image = await pdfDoc.embedJpg(buffer)
        }
    }

    const maxWidth = 842
    const maxHeight = 595
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height)
    const pageWidth = image.width * scale
    const pageHeight = image.height * scale

    const page = pdfDoc.addPage([pageWidth, pageHeight])
    page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight })
    return page
}

async function drawQRCode(pdfDoc: PDFDocument, page: PDFPage, qrRegion: QRRegion, certificateId: string, baseUrl?: string) {
    const { width: pageWidth, height: pageHeight } = page.getSize()
    // QR is square; its size is a percentage of the page width (same as the editor)
    const qrSize = (qrRegion.width / 100) * pageWidth

    const qrBuffer = await generateCertificateQRBuffer(certificateId, Math.round(qrSize * 3), baseUrl)
    const qrImage = await pdfDoc.embedPng(qrBuffer)

    const qrX = (qrRegion.x / 100) * pageWidth
    const qrY = pageHeight - ((qrRegion.y / 100) * pageHeight) - qrSize // PDF origin is bottom-left

    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })
}

/**
 * How fonts are embedded on this attempt:
 *  - 'auto': each bundled font's verified mode (full embed unless the font says subset)
 *  - 'subset': embed only used glyphs (retry when a full embed fails to save)
 *  - 'helvetica': last resort so a certificate is always produced
 */
type FontMode = 'auto' | 'subset' | 'helvetica'

interface RegionFont {
    pdf: PDFFont
    /** fontkit font used to lay out text (kerning, no ligatures); null for Helvetica */
    layout: any | null
}

// Parsed fontkit fonts are read-only and reusable across certificates
const layoutFontCache = new Map<string, any>()

function getLayoutFont(key: string, bytes: ArrayBuffer | Uint8Array) {
    let font = layoutFontCache.get(key)
    if (!font) {
        font = (fontkit as any).create(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
        layoutFontCache.set(key, font)
        if (layoutFontCache.size > 20) {
            const oldest = layoutFontCache.keys().next().value
            if (oldest !== undefined) layoutFontCache.delete(oldest)
        }
    }
    return font
}

/** Loads the font for a text region: bundled TTF, admin-uploaded font, or Helvetica. */
async function loadRegionFont(pdfDoc: PDFDocument, region: TextRegion, cache: Map<string, RegionFont>, mode: FontMode): Promise<RegionFont> {
    const bold = region.fontWeight === 'bold'
    const helveticaKey = bold ? 'helvetica-bold' : 'helvetica'
    const helvetica = async (): Promise<RegionFont> => {
        const existing = cache.get(helveticaKey)
        if (existing) return existing
        const font = { pdf: await pdfDoc.embedFont(bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica), layout: null }
        cache.set(helveticaKey, font)
        return font
    }

    if (mode === 'helvetica') return helvetica()

    let key: string
    let loadBytes: () => Promise<ArrayBuffer | Uint8Array>
    let subset = mode === 'subset'

    if (region.fontFamily === 'custom' && region.customFontPath) {
        key = `custom:${region.customFontPath}`
        loadBytes = () => cached(`storage:${region.customFontPath}`, () => downloadCertificateFile(region.customFontPath!))
    } else {
        const font = getCertificateFont(region.fontFamily)
        if (!font) return helvetica()
        const fileName = getFontFileName(font, bold)
        key = fileName
        loadBytes = () => readBundledFont(fileName)
        subset = subset || !!font.subset
    }

    const alreadyEmbedded = cache.get(key)
    if (alreadyEmbedded) return alreadyEmbedded

    try {
        const bytes = await loadBytes()
        const embedded: RegionFont = {
            pdf: await pdfDoc.embedFont(bytes, { subset }),
            layout: getLayoutFont(key, bytes),
        }
        cache.set(key, embedded)
        return embedded
    } catch (error) {
        console.error(`Failed to load font ${key}, falling back to Helvetica:`, error)
        return helvetica()
    }
}

interface PlacedGlyph { text: string; x: number; y: number }

/**
 * Lays out text the way a browser would (kerning applied, ligatures and contextual
 * alternates off) and returns where each character goes. pdf-lib's own drawText
 * ignores kerning, which made letters collide or drift apart in script fonts.
 */
function layoutText(text: string, font: RegionFont, size: number, letterSpacing: number): { width: number; glyphs: PlacedGlyph[] } {
    const glyphs: PlacedGlyph[] = []
    let x = 0

    if (font.layout) {
        const run = font.layout.layout(text, DISABLED_FONT_FEATURES)
        const scale = size / font.layout.unitsPerEm
        run.glyphs.forEach((glyph: any, i: number) => {
            const position = run.positions[i]
            const chars = glyph.codePoints?.length ? String.fromCodePoint(...glyph.codePoints) : ''
            if (chars) glyphs.push({ text: chars, x: x + position.xOffset * scale, y: position.yOffset * scale })
            x += position.xAdvance * scale + (i < run.glyphs.length - 1 ? letterSpacing : 0)
        })
        return { width: x, glyphs }
    }

    // Standard fonts throw on characters outside WinAnsi; strip them instead of failing
    const chars = Array.from(text.replace(/[^\x20-\x7E\xA0-\xFF]/g, ''))
    chars.forEach((char, i) => {
        glyphs.push({ text: char, x, y: 0 })
        x += font.pdf.widthOfTextAtSize(char, size) + (i < chars.length - 1 ? letterSpacing : 0)
    })
    return { width: x, glyphs }
}

async function readBundledFont(fileName: string): Promise<Uint8Array | ArrayBuffer> {
    return cached(`font:${fileName}`, () => readBundledFontUncached(fileName))
}

async function readBundledFontUncached(fileName: string): Promise<Uint8Array | ArrayBuffer> {
    try {
        return await readFile(path.join(process.cwd(), 'public', 'fonts', 'certificates', fileName))
    } catch {
        // Serverless bundles may not include /public; fetch the static asset instead
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.technovashardauniversity.in'
        return await fetchBuffer(`${baseUrl}${CERTIFICATE_FONT_DIR}/${fileName}`)
    }
}

// ==========================================
// Template-Based Certificate Generation (Participation)
// ==========================================

export async function generateCertificateFromTemplate(
    options: CertificateGenerationOptions
): Promise<Uint8Array> {
    const { templateUrl, data } = options

    const fallback = () => generateCertificate(data.participantName, data.eventName, data.eventDate, data.certificateId)

    if (!templateUrl) return fallback()

    let templateBytes: ArrayBuffer | Uint8Array
    try {
        templateBytes = await cached(cacheKeyForUrl(templateUrl), () => fetchBuffer(templateUrl))
    } catch (error) {
        console.error('Failed to load template, using fallback:', error)
        return fallback()
    }

    // A font problem must never stop a student from getting their certificate:
    // retry with subsetting, then with Helvetica, before the plain fallback.
    for (const mode of ['auto', 'subset', 'helvetica'] as const) {
        try {
            return await renderTemplateCertificate(options, templateUrl, templateBytes, mode)
        } catch (error) {
            console.error(`Certificate render failed with font mode "${mode}":`, error)
        }
    }
    return fallback()
}

async function renderTemplateCertificate(
    options: CertificateGenerationOptions,
    templateUrl: string,
    templateBytes: ArrayBuffer | Uint8Array,
    mode: FontMode
): Promise<Uint8Array> {
    const { qrRegion, textRegions, data, baseUrl } = options

    const pdfDoc = await PDFDocument.create()
    pdfDoc.registerFontkit(fontkit)

    const page = await addImagePage(pdfDoc, templateBytes, templateUrl)
    const { width: pageWidth, height: pageHeight } = page.getSize()

    const getFieldValue = (field: TextFieldType): string => {
        switch (field) {
            case 'participant_name':
                return data.participantName
            case 'event_name':
                return data.eventName
            case 'event_date':
                return data.eventDate
            case 'certificate_id':
                return data.certificateId
            case 'organizer_name':
                return data.organizerName || 'Technova'
            case 'role_title':
                return data.roleTitle || ''
            default:
                return ''
        }
    }

    const fontCache = new Map<string, RegionFont>()

    for (const region of textRegions) {
        const text = getFieldValue(region.field)
        if (!text) continue

        const font = await loadRegionFont(pdfDoc, region, fontCache, mode)
        const color = hexToRgb(region.color || '#000000')

        // fontSize is relative to an 800px-tall template (the editor uses the same scale)
        const scaleFactor = pageHeight / FONT_BASELINE_HEIGHT
        const fontSize = (region.fontSize || 24) * scaleFactor
        const letterSpacing = (region.letterSpacing || 0) * scaleFactor

        const { width: textWidth, glyphs } = layoutText(text, font, fontSize, letterSpacing)

        const anchorX = (region.x / 100) * pageWidth
        const centerY = pageHeight - (region.y / 100) * pageHeight // PDF origin is bottom-left

        let textX = anchorX
        if (region.alignment === 'center') textX = anchorX - textWidth / 2
        else if (region.alignment === 'right') textX = anchorX - textWidth

        // Vertically center the line box on the anchor, matching the editor's translate(-50%)
        const ascent = font.pdf.heightAtSize(fontSize, { descender: false })
        const descent = font.pdf.heightAtSize(fontSize) - ascent
        const baselineY = centerY - (ascent - descent) / 2

        const fill = rgb(color.r, color.g, color.b)
        for (const glyph of glyphs) {
            page.drawText(glyph.text, { x: textX + glyph.x, y: baselineY + glyph.y, size: fontSize, font: font.pdf, color: fill })
        }
    }

    if (data.certificateId && qrRegion) {
        try {
            await drawQRCode(pdfDoc, page, qrRegion, data.certificateId, baseUrl)
        } catch (error) {
            console.error('Failed to embed QR code:', error)
        }
    }

    return await pdfDoc.save()
}

// ==========================================
// Ready-Made Certificate (Positions) - only the QR is added
// ==========================================

export async function generatePositionCertificate(
    fileUrl: string,
    qrRegion: QRRegion,
    certificateId: string,
    baseUrl?: string
): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create()
    const page = await addImagePage(pdfDoc, await cached(`storage:${fileUrl}`, () => downloadCertificateFile(fileUrl)), fileUrl)
    await drawQRCode(pdfDoc, page, qrRegion, certificateId, baseUrl)
    return await pdfDoc.save()
}

// ==========================================
// Utility Functions
// ==========================================

function hexToRgb(hex: string): { r: number, g: number, b: number } {
    // Remove # if present
    hex = hex.replace(/^#/, '')

    // Parse hex values
    const bigint = parseInt(hex, 16)
    const r = ((bigint >> 16) & 255) / 255
    const g = ((bigint >> 8) & 255) / 255
    const b = (bigint & 255) / 255

    return { r, g, b }
}

// Generate certificate with all options
export async function generateCertificateWithTemplate(
    templateUrl: string | null,
    qrRegion: QRRegion | null,
    textRegions: TextRegion[],
    data: CertificateData,
    baseUrl?: string
): Promise<Uint8Array> {
    if (templateUrl && qrRegion) {
        return generateCertificateFromTemplate({
            templateUrl,
            qrRegion,
            textRegions,
            data,
            baseUrl
        })
    }

    // Fallback to legacy generation
    return generateCertificate(
        data.participantName,
        data.eventName,
        data.eventDate,
        data.certificateId
    )
}
