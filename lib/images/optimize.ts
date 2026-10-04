import sharp from "sharp"

/** Formats worth re-encoding. GIF (may be animated) and SVG (vector) are uploaded as-is. */
const RESIZABLE = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"])

export type PreparedUpload = { body: File | Buffer; contentType: string; fileName: string }

/**
 * Shrinks an uploaded banner/photo before it goes to storage.
 *
 * Phone photos arrive at 3–5 MB and were served at full size to every visitor.
 * This applies the EXIF rotation, caps the width (no upscaling), and re-encodes as
 * WebP. Aspect ratio is unchanged, so saved focal points (banner_position) still
 * line up. If anything goes wrong, or the result isn't smaller, the original file
 * is used, so an upload never fails because of this step.
 */
export async function prepareImageUpload(file: File, maxWidth = 1920): Promise<PreparedUpload> {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_")
    const original: PreparedUpload = { body: file, contentType: file.type || "application/octet-stream", fileName: safeName }
    if (!RESIZABLE.has(file.type)) return original

    try {
        const input = Buffer.from(await file.arrayBuffer())
        const output = await sharp(input, { failOn: "none" })
            .rotate()
            .resize({ width: maxWidth, withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer()
        if (output.length >= input.length) return original
        return { body: output, contentType: "image/webp", fileName: safeName.replace(/\.[^.]*$/, "") + ".webp" }
    } catch (error) {
        console.warn("Image optimisation skipped:", error)
        return original
    }
}

/** Uploaded file names are unique (timestamped), so browsers and the CDN can keep them for a year. */
export const IMMUTABLE_CACHE_CONTROL = "31536000"
