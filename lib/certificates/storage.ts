import { createClient } from '@supabase/supabase-js'

const BUCKET = 'certificates'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

/** Accepts a storage public URL or a bare object path and returns the object path. */
export function getCertificateStoragePath(urlOrPath: string): string {
    try {
        const url = new URL(urlOrPath)
        const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/certificates\/(.+)/)
        return match ? decodeURIComponent(match[1]) : urlOrPath
    } catch {
        return urlOrPath
    }
}

/** Signed URL for a file in the (private) certificates bucket. Falls back to the original URL. */
export async function getSignedCertificateUrl(urlOrPath: string, expiresIn = 3600): Promise<string> {
    const path = getCertificateStoragePath(urlOrPath)
    const { data } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, expiresIn)
    return data?.signedUrl || urlOrPath
}

export async function downloadCertificateFile(urlOrPath: string): Promise<ArrayBuffer> {
    const path = getCertificateStoragePath(urlOrPath)
    const { data, error } = await getSupabase().storage.from(BUCKET).download(path)
    if (error || !data) throw new Error(`Failed to download ${path}: ${error?.message}`)
    return await data.arrayBuffer()
}
