import type { CreateEmailOptions, Resend } from "resend"

/**
 * The Resend SDK returns API failures (rate limits, invalid addresses, outages) as
 * `{ error }` instead of throwing. Code written as `await resend.emails.send(...)`
 * inside try/catch therefore counts failed emails as sent. This helper throws on
 * a returned error so existing try/catch blocks see the failure.
 */
export async function sendEmailOrThrow(resend: Resend, email: CreateEmailOptions): Promise<string> {
    const { data, error } = await resend.emails.send(email)
    if (error) {
        throw Object.assign(new Error(error.message), {
            name: error.name,
            statusCode: error.statusCode,
        })
    }
    return data?.id ?? ""
}

export interface BatchSendResult {
    /** Indexes (into the input array) that Resend accepted. */
    sentIndexes: number[]
    /** Indexes that failed, with Resend's reason. */
    failed: { index: number; message: string }[]
}

const BATCH_LIMIT = 100 // Resend's maximum emails per batch request
const PAUSE_BETWEEN_REQUESTS_MS = 600 // Resend's default limit is 2 requests/second

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Sends many emails using Resend's batch endpoint (up to 100 per request) so a
 * large send finishes in a few requests instead of one request per student.
 * Validation is permissive: one bad address doesn't block the rest of its batch.
 * A batch that fails as a whole (rate limit, outage) is retried once.
 */
export async function sendEmailBatch(resend: Resend, emails: CreateEmailOptions[]): Promise<BatchSendResult> {
    const result: BatchSendResult = { sentIndexes: [], failed: [] }

    for (let start = 0; start < emails.length; start += BATCH_LIMIT) {
        if (start > 0) await sleep(PAUSE_BETWEEN_REQUESTS_MS)

        const chunk = emails.slice(start, start + BATCH_LIMIT)
        let response = await resend.batch.send(chunk, { batchValidation: "permissive" })
        if (response.error) {
            await sleep(2000)
            response = await resend.batch.send(chunk, { batchValidation: "permissive" })
        }

        if (response.error || !response.data) {
            const message = response.error?.message || "Batch send failed"
            chunk.forEach((_, i) => result.failed.push({ index: start + i, message }))
            continue
        }

        const failedInChunk = new Map<number, string>()
        for (const failure of response.data.errors ?? []) {
            failedInChunk.set(failure.index, failure.message)
        }
        chunk.forEach((_, i) => {
            const message = failedInChunk.get(i)
            if (message === undefined) result.sentIndexes.push(start + i)
            else result.failed.push({ index: start + i, message })
        })
    }

    return result
}
