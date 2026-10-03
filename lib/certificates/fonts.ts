// Fonts available for certificate text. Shared by the editor (preview via @font-face)
// and the PDF generator (embedded via fontkit), so both render the same glyphs.
// Files live in public/fonts/certificates/<id>-<weight>.ttf

export type FontCategory = 'script' | 'serif' | 'sans'

export interface CertificateFont {
    id: string
    label: string
    category: FontCategory
    hasBold: boolean
    /**
     * Embed only the glyphs used. Off by default: subsetting garbles some fonts
     * (EB Garamond, Great Vibes, Inter lose most letters). On only for fonts whose
     * full embed crashes pdf-lib (Dancing Script). Verified per font, Oct 2026.
     */
    subset?: boolean
}

export const CERTIFICATE_FONT_DIR = '/fonts/certificates'

// Text sizes are authored against an 800px-tall template; the editor and PDF both scale from this
export const FONT_BASELINE_HEIGHT = 800

/**
 * Ligatures and contextual alternates are switched off for certificate names:
 * the PDF writer (pdf-lib) can't position those glyphs correctly, which left a
 * gap in "Studen t" and collided "Pr" in Great Vibes. The editor preview turns the
 * same features off (CSS below), so preview and PDF still match.
 */
export const DISABLED_FONT_FEATURES = { liga: false, clig: false, dlig: false, calt: false } as const
export const PREVIEW_FONT_FEATURE_SETTINGS = '"liga" 0, "clig" 0, "dlig" 0, "calt" 0'

export const CERTIFICATE_FONTS: CertificateFont[] = [
    // Script
    { id: 'great-vibes', label: 'Great Vibes', category: 'script', hasBold: false },
    { id: 'alex-brush', label: 'Alex Brush', category: 'script', hasBold: false },
    { id: 'pinyon-script', label: 'Pinyon Script', category: 'script', hasBold: false },
    { id: 'allura', label: 'Allura', category: 'script', hasBold: false },
    { id: 'parisienne', label: 'Parisienne', category: 'script', hasBold: false },
    { id: 'sacramento', label: 'Sacramento', category: 'script', hasBold: false },
    { id: 'dancing-script', label: 'Dancing Script', category: 'script', hasBold: true, subset: true },
    { id: 'tangerine', label: 'Tangerine', category: 'script', hasBold: true },
    // Serif
    { id: 'playfair-display', label: 'Playfair Display', category: 'serif', hasBold: true },
    { id: 'cinzel', label: 'Cinzel', category: 'serif', hasBold: true },
    { id: 'eb-garamond', label: 'EB Garamond', category: 'serif', hasBold: true },
    { id: 'cormorant-garamond', label: 'Cormorant Garamond', category: 'serif', hasBold: true },
    { id: 'lora', label: 'Lora', category: 'serif', hasBold: true },
    { id: 'merriweather', label: 'Merriweather', category: 'serif', hasBold: true },
    { id: 'libre-baskerville', label: 'Libre Baskerville', category: 'serif', hasBold: true },
    // Sans
    { id: 'poppins', label: 'Poppins', category: 'sans', hasBold: true },
    { id: 'montserrat', label: 'Montserrat', category: 'sans', hasBold: true },
    { id: 'inter', label: 'Inter', category: 'sans', hasBold: true },
    { id: 'roboto', label: 'Roboto', category: 'sans', hasBold: true },
    { id: 'open-sans', label: 'Open Sans', category: 'sans', hasBold: true },
    { id: 'raleway', label: 'Raleway', category: 'sans', hasBold: true },
]

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
    script: 'Script',
    serif: 'Serif',
    sans: 'Sans Serif',
}

export function getCertificateFont(id?: string): CertificateFont | undefined {
    return CERTIFICATE_FONTS.find(f => f.id === id)
}

/** File name for a bundled font, falling back to regular when bold isn't available. */
export function getFontFileName(font: CertificateFont, bold: boolean): string {
    return `${font.id}-${bold && font.hasBold ? 700 : 400}.ttf`
}

/** CSS font-family name used for the editor preview. */
export function getPreviewFontFamily(id?: string): string {
    if (!id) return 'Helvetica, Arial, sans-serif'
    if (id === 'custom') return 'CertCustomFont'
    return `Cert-${id}`
}

/** @font-face rules for every bundled font, injected by the editor. */
export function buildFontFaceCss(): string {
    return CERTIFICATE_FONTS.flatMap(font => {
        const weights = font.hasBold ? [400, 700] : [400]
        return weights.map(w => `@font-face{font-family:'Cert-${font.id}';font-weight:${w};font-display:swap;src:url('${CERTIFICATE_FONT_DIR}/${font.id}-${w}.ttf') format('truetype');}`)
    }).join('\n')
}
