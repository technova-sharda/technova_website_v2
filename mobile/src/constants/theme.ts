/**
 * Technova app look, taken from the website's signature palette
 * (--sig-bg #0A0A0B, --sig-amber #F5A623, --sig-indigo #6366F1) and its
 * fonts (Sora for headings, DM Sans for text). Soft rounded surfaces, amber
 * for the main action and selection, status colours only where they mean
 * something.
 */
export const C = {
  bg: '#0A0A0B',
  surface: '#141416',
  surface2: '#1C1C1F',
  hover: '#232327',
  border: 'rgba(255,255,255,0.075)',
  borderStrong: 'rgba(255,255,255,0.15)',
  text: '#FAFAF9',
  textDim: '#A1A1AA',
  textMuted: '#71717A',
  accent: '#F5A623',
  accentText: '#1A1203',
  accentSoft: 'rgba(245,166,35,0.13)',
  indigo: '#818CF8',
  indigoSoft: 'rgba(99,102,241,0.16)',
  green: '#22C55E',
  greenSoft: 'rgba(34,197,94,0.13)',
  amber: '#FBBF24',
  amberSoft: 'rgba(251,191,36,0.13)',
  red: '#F43F5E',
  redSoft: 'rgba(244,63,94,0.13)',
  blue: '#60A5FA',
  blueSoft: 'rgba(96,165,250,0.13)',
  violet: '#A78BFA',
  violetSoft: 'rgba(167,139,250,0.14)',
} as const

/** Font families (each weight is its own family; never combine with fontWeight). */
export const F = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
  display: 'Sora_700Bold',
  displaySemi: 'Sora_600SemiBold',
  displayHeavy: 'Sora_800ExtraBold',
} as const

export const R = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 32 } as const
export const HAIRLINE = 1
