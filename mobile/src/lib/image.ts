import { API_URL } from './config'

/**
 * Resized, compressed copy of an image through the website's optimizer
 * (WebP/AVIF, cached for a month), instead of downloading full-size uploads.
 * Widths must be ones the site allows: 64, 96, 128, 256, 384, 640, 750, 828, 1080.
 */
export function optimized(url: string | null | undefined, width: 64 | 96 | 128 | 256 | 384 | 640 | 750 | 828 | 1080) {
  if (!url) return null
  const source = url.startsWith(API_URL) ? url.slice(API_URL.length) : url
  return `${API_URL}/_next/image?url=${encodeURIComponent(source)}&w=${width}&q=70`
}
