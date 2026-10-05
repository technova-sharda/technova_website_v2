import { API_URL } from './config'

/**
 * Resized, compressed copy of an image through the website's optimizer
 * (WebP/AVIF, cached for a month), instead of downloading full-size uploads.
 * Widths must be ones the site allows: 64, 96, 128, 256, 384, 640, 750, 828, 1080.
 * Quality must be one the site allows too: Next 16 accepts only q=75 by default and
 * answers anything else with 400 INVALID_IMAGE_OPTIMIZE_REQUEST (the dev server doesn't check).
 */
const QUALITY = 75
const SITE_ORIGIN = /^https?:\/\/(www\.)?technovashardauniversity\.in(?=\/)|^https?:\/\/localhost:3000(?=\/)/

export function optimized(url: string | null | undefined, width: 64 | 96 | 128 | 256 | 384 | 640 | 750 | 828 | 1080) {
  if (!url) return null
  // The site's own files (team photos, logos) go in as paths; the optimizer only fetches listed remote hosts
  const source = url.replace(SITE_ORIGIN, '') || url
  return `${API_URL}/_next/image?url=${encodeURIComponent(source)}&w=${width}&q=${QUALITY}`
}
