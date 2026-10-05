/**
 * Shared building blocks for admin pages, so every page has the same header,
 * cards, badges and empty states. Server-safe (no hooks). The admin shell
 * already adds page padding, so pages shouldn't add their own.
 */
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { PHASE_LABEL, type EventPhase } from "@/lib/events/phase"

export type Tone = "amber" | "blue" | "emerald" | "violet" | "rose" | "sky" | "gray"

// Full class names (Tailwind can't see classes built from variables)
export const TONE: Record<Tone, { text: string; bg: string; border: string; bar: string }> = {
    amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25", bar: "bg-amber-500" },
    blue: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25", bar: "bg-blue-500" },
    emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", bar: "bg-emerald-500" },
    violet: { text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/25", bar: "bg-violet-500" },
    rose: { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/25", bar: "bg-rose-500" },
    sky: { text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/25", bar: "bg-sky-500" },
    gray: { text: "text-gray-400", bg: "bg-white/5", border: "border-white/10", bar: "bg-gray-500" },
}

export function PageHeader({ icon: Icon, title, description, actions, tone = "amber" }: {
    icon: LucideIcon; title: string; description?: React.ReactNode; actions?: React.ReactNode; tone?: Tone
}) {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                <h1 className="flex items-center gap-3 text-2xl font-bold text-white sm:text-3xl">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE[tone].bg} ${TONE[tone].text}`}><Icon className="h-5 w-5" /></span>
                    <span className="truncate">{title}</span>
                </h1>
                {description && <p className="mt-2 text-sm text-gray-400">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    )
}

export function StatCard({ label, value, hint, icon: Icon, tone = "gray", href }: {
    label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; tone?: Tone; href?: string
}) {
    const body = (
        <div className={`h-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors ${href ? "hover:border-white/20 hover:bg-white/[0.05]" : ""}`}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-gray-400">{label}</p>
                {Icon && <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONE[tone].bg} ${TONE[tone].text}`}><Icon className="h-4 w-4" /></span>}
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{value}</p>
            {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
        </div>
    )
    return href ? <Link href={href} className="block">{body}</Link> : body
}

export function Panel({ title, icon: Icon, action, children, className = "", tone = "gray" }: {
    title?: string; icon?: LucideIcon; action?: React.ReactNode; children: React.ReactNode; className?: string; tone?: Tone
}) {
    return (
        <section className={`min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] ${className}`}>
            {title && (
                <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 sm:px-5">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                        {Icon && <Icon className={`h-4 w-4 ${TONE[tone].text}`} />} {title}
                    </h2>
                    {action}
                </div>
            )}
            <div className="p-4 sm:p-5">{children}</div>
        </section>
    )
}

const PHASE_STYLE: Record<EventPhase, string> = {
    live: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    upcoming: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    draft: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    ended: "bg-white/5 text-gray-400 border-white/10",
    cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
}

export function PhaseBadge({ phase }: { phase: EventPhase }) {
    return (
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${PHASE_STYLE[phase]}`}>
            {phase === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
            {PHASE_LABEL[phase]}
        </span>
    )
}

export function EmptyState({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: string; action?: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-gray-500"><Icon className="h-6 w-6" /></span>
            <p className="mt-3 text-sm font-medium text-gray-300">{title}</p>
            {hint && <p className="mt-1 max-w-sm text-xs text-gray-500">{hint}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    )
}

/** Thin progress bar, e.g. registrations / capacity. */
export function Meter({ value, max, tone = "amber" }: { value: number; max: number; tone?: Tone }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full ${TONE[tone].bar}`} style={{ width: `${pct}%` }} />
        </div>
    )
}

export const buttonCls = {
    primary: "inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400",
    secondary: "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-white/[0.07]",
    ghost: "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white",
}
