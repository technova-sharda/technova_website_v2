import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkRateLimit } from "@/lib/rate-limit"
import { aiConfigured } from "@/lib/ai/nvidia"
import { answerQuestion } from "@/lib/ai/insights"

// Up to 6 model rounds per question
export const maxDuration = 60

/** POST { question, history? } → answer with summary, chart (numbers from the DB) and the tools used. Super admins only. */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (session?.user?.role !== "super_admin") {
        return NextResponse.json({ error: "Only super admins can use Ask Technova" }, { status: 403 })
    }
    if (!aiConfigured()) {
        return NextResponse.json({ error: "The NVIDIA API key (NAPI_KEY) isn't set on the server." }, { status: 503 })
    }
    // Stays well under NVIDIA's free-tier limit, which all admins share
    const limit = checkRateLimit(`insights:${session.user.id}`, { limit: 40, windowSeconds: 3600, bucket: "insights" })
    if (!limit.success) {
        return NextResponse.json({ error: "You've asked a lot of questions in the last hour. Try again a bit later." }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const question = typeof body.question === "string" ? body.question.trim() : ""
    if (question.length < 3) return NextResponse.json({ error: "Ask a question first." }, { status: 400 })
    const history = Array.isArray(body.history)
        ? body.history.filter((h: any) => typeof h?.q === "string" && typeof h?.a === "string").slice(-3)
        : []

    try {
        const answer = await answerQuestion(question, history)
        return NextResponse.json(answer)
    } catch (e: any) {
        console.error("[insights] failed:", e?.message)
        return NextResponse.json({ error: "The AI service didn't respond. Please try again in a moment." }, { status: 502 })
    }
}
