import Image from "next/image"

// Hosts next/image is configured for (next.config.mjs → images.remotePatterns).
const OPTIMIZABLE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i

/**
 * Event banners and other uploaded images.
 *
 * Supabase-hosted and local images go through Next's optimiser (resized per
 * screen, served as AVIF/WebP, cached). A banner pasted from any other site
 * falls back to a plain lazy <img>, because next/image throws on unknown hosts.
 * The parent must be positioned (relative/absolute) and sized.
 */
export function BannerImage({ src, alt, sizes, className = "", priority = false, style }: {
    src: string
    alt: string
    sizes: string
    className?: string
    priority?: boolean
    style?: React.CSSProperties
}) {
    if (src.startsWith("/") || OPTIMIZABLE.test(src)) {
        return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={className} style={style} />
    }
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" className={`absolute inset-0 w-full h-full ${className}`} style={style} />
    )
}
