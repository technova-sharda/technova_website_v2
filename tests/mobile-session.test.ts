import { beforeAll, describe, expect, it, vi } from "vitest"
import { createHash } from "node:crypto"

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => ({}) }))
let mod: typeof import("@/lib/mobile/session")
beforeAll(async () => { process.env.AUTH_SECRET = "test-secret"; mod = await import("@/lib/mobile/session") })

const challengeOf = (v: string) => createHash("sha256").update(v).digest("base64url")

describe("app sign-in code", () => {
    it("works once with the right verifier", () => {
        const code = mod.signCode("user-1", challengeOf("verifier-abc"))
        expect(mod.verifyCode(code, "verifier-abc")).toBe("user-1")
    })
    it("is useless without the app's verifier", () => {
        const code = mod.signCode("user-1", challengeOf("verifier-abc"))
        expect(mod.verifyCode(code, "someone-else")).toBeNull()
    })
    it("rejects a tampered code", () => {
        const [body, sig] = mod.signCode("user-1", challengeOf("v")).split(".")
        const forged = Buffer.from(JSON.stringify({ u: "admin", c: challengeOf("v"), x: Date.now() + 60000 })).toString("base64url")
        expect(mod.verifyCode(`${forged}.${sig}`, "v")).toBeNull()
        expect(mod.verifyCode(`${body}.AAAA`, "v")).toBeNull()
    })
    it("expires after two minutes", () => {
        vi.useFakeTimers()
        const code = mod.signCode("user-1", challengeOf("v"))
        vi.advanceTimersByTime(2 * 60 * 1000 + 1)
        expect(mod.verifyCode(code, "v")).toBeNull()
        vi.useRealTimers()
    })
    it("only sends people back to the app or Expo Go", () => {
        expect(mod.isAllowedAppRedirect("technova://auth")).toBe(true)
        expect(mod.isAllowedAppRedirect("exp://192.168.1.5:8081/--/auth")).toBe(true)
        expect(mod.isAllowedAppRedirect("https://evil.example/steal")).toBe(false)
        expect(mod.isAllowedAppRedirect("javascript:alert(1)")).toBe(false)
    })
})
