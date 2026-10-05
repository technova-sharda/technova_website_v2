'use client'

import { useEffect, useRef, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ArrowUp, ChevronDown, Database, Loader2, ShieldCheck, Sparkles } from "lucide-react"
import type { InsightAnswer, InsightChart } from "@/lib/ai/insights"
import { PageHeader } from "@/components/admin/ui"

const PALETTE = ["#F5A623", "#6366F1", "#22C55E", "#EC4899", "#06B6D4", "#A855F7", "#F97316", "#84CC16"]
const tooltipStyle = { background: "#0A0A0B", border: "1px solid #27272A", borderRadius: 12, color: "#FAFAF9", fontSize: 12 }
const axis = { stroke: "#71717A", fontSize: 11, tickLine: false, axisLine: false } as const

const SUGGESTIONS = [
    "How many students registered for Start2Code?",
    "Which 5 events had the highest turnout?",
    "Which year of students participates the most?",
    "Compare clubs by registrations",
    "How did registrations change month by month?",
    "How many students came to more than one event?",
]

type Turn = { q: string; a?: InsightAnswer; error?: string }

function Chart({ chart }: { chart: InsightChart }) {
    const label = (v: unknown) => (typeof v === "string" && v.length > 18 ? v.slice(0, 17) + "…" : String(v ?? ""))
    if (chart.type === "table" || chart.y.length === 0) {
        const cols = Object.keys(chart.data[0] ?? {}).filter(c => c !== "section")
        return (
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-gray-500 border-b border-white/10">{cols.map(c => <th key={c} className="py-2 pr-3 font-medium">{c.replace(/_/g, " ")}</th>)}</tr></thead>
                    <tbody className="divide-y divide-white/5">{chart.data.map((r, i) => <tr key={i}>{cols.map(c => <td key={c} className="py-2 pr-3 text-gray-300">{String(r[c] ?? "–")}</td>)}</tr>)}</tbody>
                </table>
            </div>
        )
    }
    return (
        <div className="h-64">
            <ResponsiveContainer>
                {chart.type === "pie" ? (
                    <PieChart>
                        <Pie data={chart.data} dataKey={chart.y[0]} nameKey={chart.x} innerRadius="50%" outerRadius="85%" paddingAngle={2} stroke="none">
                            {chart.data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                ) : chart.type === "line" ? (
                    <LineChart data={chart.data} margin={{ left: -20, right: 8 }}>
                        <CartesianGrid stroke="#27272A" vertical={false} />
                        <XAxis dataKey={chart.x} {...axis} tickFormatter={label} />
                        <YAxis {...axis} />
                        <Tooltip contentStyle={tooltipStyle} />
                        {chart.y.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={PALETTE[i]} strokeWidth={2} dot={false} />)}
                    </LineChart>
                ) : (
                    <BarChart data={chart.data} margin={{ left: -20, right: 8 }}>
                        <CartesianGrid stroke="#27272A" vertical={false} />
                        <XAxis dataKey={chart.x} {...axis} tickFormatter={label} interval={0} angle={chart.data.length > 5 ? -25 : 0} textAnchor={chart.data.length > 5 ? "end" : "middle"} height={chart.data.length > 5 ? 60 : 30} />
                        <YAxis {...axis} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                        {chart.y.map((k, i) => <Bar key={k} dataKey={k} fill={PALETTE[i]} radius={[4, 4, 0, 0]} />)}
                    </BarChart>
                )}
            </ResponsiveContainer>
        </div>
    )
}

function Answer({ a, onAsk }: { a: InsightAnswer; onAsk: (q: string) => void }) {
    const [open, setOpen] = useState(false)
    return (
        <div className="space-y-4">
            <p className="text-[15px] leading-relaxed text-gray-100 whitespace-pre-wrap">{a.summary}</p>
            {a.chart && (
                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                    <p className="text-sm font-medium text-white mb-3">{a.chart.title}</p>
                    <Chart chart={a.chart} />
                </div>
            )}
            {a.followUps.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {a.followUps.map(f => (
                        <button key={f} onClick={() => onAsk(f)} className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-gray-300 hover:border-amber-500/40 hover:text-white transition-colors">{f}</button>
                    ))}
                </div>
            )}
            {a.steps.length > 0 && (
                <div className="text-xs text-gray-500">
                    <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1 hover:text-gray-300">
                        <Database className="w-3.5 h-3.5" /> How I got this ({a.steps.length} {a.steps.length === 1 ? "lookup" : "lookups"})
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && (
                        <ul className="mt-2 space-y-1 font-mono">
                            {a.steps.map(s => <li key={s.resultId}>{s.resultId}: {s.tool}({Object.entries(s.args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")}) → {s.rowCount} rows</li>)}
                            <li className="font-sans">Model: {a.model}</li>
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}

export function AskTechnova({ configured }: { configured: boolean }) {
    const [turns, setTurns] = useState<Turn[]>([])
    const [input, setInput] = useState("")
    const [busy, setBusy] = useState(false)
    const endRef = useRef<HTMLDivElement>(null)

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }) }, [turns, busy])

    // Warm the data cache and the model connection while the admin is still reading the page.
    useEffect(() => {
        if (configured) fetch("/api/admin/insights/warm", { method: "POST" }).catch(() => {})
    }, [configured])

    const ask = async (question: string) => {
        const q = question.trim()
        if (!q || busy) return
        setInput("")
        setBusy(true)
        const history = turns.filter(t => t.a).map(t => ({ q: t.q, a: t.a!.summary }))
        setTurns(prev => [...prev, { q }])
        try {
            const res = await fetch("/api/admin/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, history }) })
            const json = await res.json()
            setTurns(prev => prev.map((t, i) => (i === prev.length - 1 ? (res.ok ? { q, a: json } : { q, error: json.error || "Something went wrong" }) : t)))
        } catch {
            setTurns(prev => prev.map((t, i) => (i === prev.length - 1 ? { q, error: "Network error. Try again." } : t)))
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
            <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col">
                <div>
                    <PageHeader icon={Sparkles} title="Ask Technova" description="Ask about events, registrations, turnout, feedback and clubs in plain English." />
                    <p className="text-xs text-gray-500 mt-2 flex items-start gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-400" />
                        Read-only. The AI only sees anonymous totals (no names, emails or phone numbers) through fixed lookups, and every number in a chart comes from the database. Questions go to NVIDIA&apos;s API.
                    </p>
                </div>

                {!configured && (
                    <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">Add <code>NAPI_KEY</code> to the server environment to turn this on.</div>
                )}

                <div className="flex-1 mt-8 space-y-8">
                    {turns.length === 0 && (
                        <div>
                            <p className="text-sm text-gray-500 mb-3">Try one of these:</p>
                            <div className="grid sm:grid-cols-2 gap-2">
                                {SUGGESTIONS.map(s => (
                                    <button key={s} onClick={() => ask(s)} disabled={!configured} className="text-left text-sm p-3 rounded-xl border border-white/10 bg-white/[0.02] text-gray-300 hover:border-amber-500/40 hover:text-white disabled:opacity-40 transition-colors">{s}</button>
                                ))}
                            </div>
                        </div>
                    )}
                    {turns.map((t, i) => (
                        <div key={i} className="space-y-4">
                            <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-amber-500/15 border border-amber-500/20 px-4 py-2.5 text-sm text-amber-50">{t.q}</div></div>
                            <div className="rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.02] p-4 sm:p-5">
                                {t.a ? <Answer a={t.a} onAsk={ask} /> : t.error ? <p className="text-sm text-red-300">{t.error}</p> : (
                                    <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Looking it up…</div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={endRef} />
                </div>

                <form onSubmit={e => { e.preventDefault(); ask(input) }} className="sticky bottom-4 mt-8">
                    <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl focus-within:border-amber-500/40">
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input) } }}
                            rows={1}
                            maxLength={500}
                            disabled={!configured}
                            placeholder="e.g. What was the turnout at PyStart?"
                            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none max-h-40"
                        />
                        <button type="submit" disabled={busy || !input.trim() || !configured} aria-label="Ask" className="h-10 w-10 shrink-0 rounded-xl bg-amber-500 text-black flex items-center justify-center disabled:opacity-40">
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
