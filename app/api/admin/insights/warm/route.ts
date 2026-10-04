import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getAnalyticsDataset } from "@/lib/analytics/dataset"
import { aiConfigured, nvidiaChat } from "@/lib/ai/nvidia"

export const maxDuration = 30

// One warm-up per server instance per few minutes is enough.
let lastWarm = 0

/**
 * POST: warm the slow parts before an admin asks a question. Fills the analytics
 * dataset cache and sends a 1-token request so the model connection is open.
 * Called when Ask Technova opens or its sidebar link is hovered.
 */
export async function POST() {
    const session = await auth()
    if (session?.user?.role !== "super_admin") return NextResponse.json({ ok: false }, { status: 403 })

    const started = Date.now()
    const tasks: Promise<unknown>[] = [getAnalyticsDataset()]
    if (aiConfigured() && Date.now() - lastWarm > 4 * 60_000) {
        lastWarm = Date.now()
        tasks.push(
            nvidiaChat({ messages: [{ role: "user", content: "ok" }], maxTokens: 1, thinking: false, timeoutMs: 15_000 }).catch(() => null)
        )
    }
    await Promise.all(tasks)
    return NextResponse.json({ ok: true, ms: Date.now() - started })
}
