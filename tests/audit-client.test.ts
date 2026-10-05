import { beforeEach, describe, expect, it, vi } from "vitest"

const recorded: any[] = []
const storage: any[] = []
vi.mock("@/lib/audit/audit", () => ({
    shouldSkip: (t: string) => t === "admin_audit_log" || t === "sessions",
    labelBeforeDelete: vi.fn(async () => "Old name"),
    recordDbWrite: (w: any) => recorded.push(w),
    recordStorageWrite: (...a: any[]) => storage.push(a),
}))
const { withAudit } = await import("@/lib/audit/client")

/** Minimal stand-in for postgrest's builder: chainable, thenable, has url/body. */
function builder(result: any, body?: unknown) {
    const b: any = {
        url: new URL("https://x.supabase.co/rest/v1/events?id=eq.42"), body,
        eq() { return b }, select() { return b }, single() { return b },
        then(ok?: any, bad?: any) { return Promise.resolve(result).then(ok, bad) },
    }
    return b
}
function fakeClient(result: any) {
    const query = () => ({ insert: (v: unknown) => builder(result, v), update: (v: unknown) => builder(result, v), upsert: (v: unknown) => builder(result, v), delete: () => builder(result), select: () => builder(result) })
    return {
        from: query,
        schema: () => ({ from: query }),
        storage: { from: () => ({ upload: async () => ({ data: { path: "a.png" }, error: null }), remove: async () => ({ data: [], error: null }) }) },
    } as any
}

beforeEach(() => { recorded.length = 0; storage.length = 0 })

describe("withAudit", () => {
    it("returns exactly what the write returned and records it", async () => {
        const res = { data: { id: 42, title: "PyStart" }, error: null }
        const out = await withAudit(fakeClient(res)).from("events").update({ title: "PyStart" }).eq("id", 42).select().single()
        expect(out).toBe(res)
        expect(recorded).toHaveLength(1)
        expect(recorded[0]).toMatchObject({ action: "update", schema: "public", table: "events", body: { title: "PyStart" } })
    })

    it("does not record failed writes, and passes the error through", async () => {
        const res = { data: null, error: { message: "nope" } }
        const out = await withAudit(fakeClient(res)).from("events").insert({ title: "x" })
        expect(out.error?.message).toBe("nope")
        expect(recorded).toHaveLength(0)
    })

    it("does not touch reads", async () => {
        await withAudit(fakeClient({ data: [], error: null })).from("events").select()
        expect(recorded).toHaveLength(0)
    })

    it("reads the name before a delete, and covers other schemas", async () => {
        await withAudit(fakeClient({ data: null, error: null })).schema("next_auth").from("users").delete().eq("id", 42)
        expect(recorded[0]).toMatchObject({ action: "delete", schema: "next_auth", table: "users", label: "Old name" })
    })

    it("skips auth plumbing and the log table itself", async () => {
        const c = withAudit(fakeClient({ data: null, error: null }))
        await c.from("admin_audit_log").insert({})
        await c.schema("next_auth").from("sessions").update({})
        expect(recorded).toHaveLength(0)
    })

    it("records storage uploads and removals", async () => {
        const c = withAudit(fakeClient({}))
        await c.storage.from("events").upload("clubs/logos/x.webp", new Uint8Array())
        await c.storage.from("events").remove(["a.png", "b.png"])
        expect(storage).toEqual([["upload", "events", ["clubs/logos/x.webp"]], ["remove", "events", ["a.png", "b.png"]]])
    })

    it("works with Promise.all and rejections still reject", async () => {
        const bad = builder(null); bad.then = (ok?: any, no?: any) => Promise.reject(new Error("network")).then(ok, no)
        const c = fakeClient({ data: null, error: null }); c.from = () => ({ insert: () => bad })
        await expect(withAudit(c).from("events").insert({})).rejects.toThrow("network")
        expect(recorded).toHaveLength(0)
    })
})
