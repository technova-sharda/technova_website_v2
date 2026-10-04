'use client'

import { useState } from "react"
import Image from "next/image"

const OPTIMIZABLE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i

/**
 * Person photo / logo that fills its (positioned, sized) parent.
 * Local and Supabase images go through Next's optimiser (right size, AVIF/WebP);
 * a missing photo falls back to a generated initials avatar.
 */
export function TeamPhoto({ src, name, sizes, className = "object-cover", priority = false }: {
    src?: string | null; name: string; sizes: string; className?: string; priority?: boolean
}) {
    const [failed, setFailed] = useState(false)
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=256`
    if (src && !failed && (src.startsWith("/") || OPTIMIZABLE.test(src))) {
        return <Image src={src} alt={name} fill sizes={sizes} priority={priority} className={className} onError={() => setFailed(true)} />
    }
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={!src || failed ? fallback : src}
            alt={name}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className={`absolute inset-0 w-full h-full ${className}`}
            onError={() => setFailed(true)}
        />
    )
}
