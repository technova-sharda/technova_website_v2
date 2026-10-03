/**
 * Supabase returns at most 1000 rows per request, so "select everything" queries
 * silently drop rows once a table grows past that. This pages through a query
 * until a short page comes back.
 *
 * The query passed in MUST have a deterministic order ending in a unique column
 * (e.g. `.order('scanned_at').order('id')`), or rows can repeat or go missing
 * between pages.
 */
export async function fetchAllRows<T>(
    page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
    pageSize = 1000,
    maxRows = 200_000
): Promise<{ data: T[]; error: string | null }> {
    const rows: T[] = []
    for (let from = 0; from < maxRows; from += pageSize) {
        const { data, error } = await page(from, from + pageSize - 1)
        if (error) return { data: rows, error: error.message }
        const batch = data ?? []
        rows.push(...batch)
        if (batch.length < pageSize) break
    }
    return { data: rows, error: null }
}

/**
 * Runs an `.in(column, ids)` lookup in chunks. A single `in (...)` list with
 * hundreds of UUIDs makes the request URL too long for the API gateway.
 */
export async function fetchInChunks<T>(
    ids: string[],
    fetchChunk: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
    chunkSize = 150
): Promise<{ data: T[]; error: string | null }> {
    const rows: T[] = []
    for (let i = 0; i < ids.length; i += chunkSize) {
        const { data, error } = await fetchChunk(ids.slice(i, i + chunkSize))
        if (error) return { data: rows, error: error.message }
        rows.push(...(data ?? []))
    }
    return { data: rows, error: null }
}
