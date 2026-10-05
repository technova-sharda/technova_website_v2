/**
 * Wraps a Supabase client so successful writes are recorded in the admin
 * activity log (see lib/audit/audit.ts). Reads are untouched, the write itself
 * is unchanged, and logging happens after the response is sent.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { labelBeforeDelete, recordDbWrite, recordStorageWrite, shouldSkip, type DbWrite } from "./audit"

const WRITES = ["insert", "update", "upsert", "delete"] as const

function hookBuilder(builder: any, schema: string, table: string, action: DbWrite["action"]) {
    const originalThen = builder.then.bind(builder)
    builder.then = (onFulfilled?: (v: any) => any, onRejected?: (e: any) => any) => {
        const run = async () => {
            const label = action === "delete" ? await labelBeforeDelete(schema, table, builder.url) : null
            const res = await originalThen()
            if (!res?.error) recordDbWrite({ action, schema, table, url: builder.url, body: builder.body, data: res?.data, label })
            return res
        }
        return run().then(onFulfilled, onRejected)
    }
    return builder
}

function hookQuery(query: any, schema: string, table: string) {
    if (shouldSkip(table)) return query
    for (const action of WRITES) {
        if (typeof query?.[action] !== "function") continue
        const original = query[action].bind(query)
        query[action] = (...args: unknown[]) => hookBuilder(original(...args), schema, table, action)
    }
    return query
}

function hookStorage(storage: any) {
    const originalFrom = storage.from.bind(storage)
    storage.from = (bucket: string) => {
        const api = originalFrom(bucket)
        const wrap = (name: "upload" | "remove" | "move" | "copy" | "update", paths: (args: any[]) => string[]) => {
            const original = api[name]?.bind(api)
            if (!original) return
            api[name] = async (...args: any[]) => {
                const res = await original(...args)
                if (!res?.error) recordStorageWrite(name === "update" ? "upload" : name, bucket, paths(args))
                return res
            }
        }
        wrap("upload", a => [String(a[0])])
        wrap("update", a => [String(a[0])])
        wrap("remove", a => (Array.isArray(a[0]) ? a[0].map(String) : []))
        wrap("move", a => [`${a[0]} → ${a[1]}`])
        wrap("copy", a => [`${a[0]} → ${a[1]}`])
        return api
    }
}

export function withAudit<T extends SupabaseClient<any, any, any>>(client: T): T {
    const c = client as any
    const from = c.from.bind(c)
    c.from = (relation: string) => hookQuery(from(relation), "public", relation)
    const schema = c.schema.bind(c)
    c.schema = (name: string) => {
        const pg = schema(name)
        const pgFrom = pg.from.bind(pg)
        pg.from = (relation: string) => hookQuery(pgFrom(relation), name, relation)
        return pg
    }
    if (c.storage) hookStorage(c.storage)
    return client
}
