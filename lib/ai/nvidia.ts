/**
 * NVIDIA hosted models (build.nvidia.com), OpenAI-compatible chat completions.
 * Server-only: the key is read from NAPI_KEY (or NVIDIA_API_KEY) and never sent to the browser.
 *
 * Models change on NVIDIA's side (several were retired in 2026), so both are
 * configurable; the fallback is tried when the main model is gone, rate-limited,
 * erroring or slow.
 */

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } }
export type ChatMessage =
    | { role: "system" | "user"; content: string }
    | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
    | { role: "tool"; tool_call_id: string; content: string }

export type ToolSpec = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }

const BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
// Read at call time so a config change takes effect without a code change.
const model = () => process.env.NVIDIA_MODEL || "nvidia/nemotron-3-super-120b-a12b"
const fallbackModel = () => process.env.NVIDIA_FALLBACK_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"

export function aiConfigured() {
    return !!(process.env.NAPI_KEY || process.env.NVIDIA_API_KEY)
}

/** Some reasoning models put their thinking in <think> tags; only the answer is shown. */
export function stripThinking(text: string | null | undefined) {
    return (text ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim()
}

async function call(model: string, body: Record<string, unknown>, timeoutMs: number) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
        const res = await fetch(BASE_URL, {
            method: "POST",
            signal: ctrl.signal,
            headers: { Authorization: `Bearer ${process.env.NAPI_KEY || process.env.NVIDIA_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model, ...body }),
        })
        const json: any = await res.json().catch(() => ({}))
        if (!res.ok) {
            const err = new Error(json?.error?.message || json?.detail || `NVIDIA API ${res.status}`) as Error & { retryable?: boolean }
            err.retryable = [404, 408, 410, 429].includes(res.status) || res.status >= 500
            throw err
        }
        const message = json?.choices?.[0]?.message
        if (!message) throw Object.assign(new Error("Empty response from the model"), { retryable: true })
        return { message: message as { content: string | null; tool_calls?: ToolCall[] }, model }
    } catch (e: any) {
        if (e?.name === "AbortError") throw Object.assign(new Error("The model took too long to answer"), { retryable: true })
        throw e
    } finally {
        clearTimeout(timer)
    }
}

export async function nvidiaChat({ messages, tools, temperature = 0.1, maxTokens = 3000, timeoutMs = 40_000, thinking = true }: {
    messages: ChatMessage[]; tools?: ToolSpec[]; temperature?: number; maxTokens?: number; timeoutMs?: number
    /** Nemotron models "think" first, and those tokens count toward maxTokens. Turn off for plain writing tasks. */
    thinking?: boolean
}) {
    if (!aiConfigured()) throw new Error("NVIDIA API key is not set (NAPI_KEY)")
    const body = {
        messages, temperature, max_tokens: maxTokens,
        ...(tools ? { tools, tool_choice: "auto" } : {}),
        ...(thinking ? {} : { chat_template_kwargs: { enable_thinking: false } }),
    }
    try {
        return await call(model(), body, timeoutMs)
    } catch (e: any) {
        if (!e?.retryable || fallbackModel() === model()) throw e
        return await call(fallbackModel(), body, timeoutMs)
    }
}
