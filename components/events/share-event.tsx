'use client'

import { useState } from "react"
import { Check, Link2, Share2 } from "lucide-react"
import { toast } from "sonner"

/** Plain share row for every visitor (registered students also get the referral "Share & Earn XP"). */
export function ShareEvent({ title, url }: { title: string; url: string }) {
    const [copied, setCopied] = useState(false)
    const text = `${title}: register on Technova ${url}`
    const btn = "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("Couldn't copy. Long-press the address bar to copy the link.")
        }
    }

    const nativeShare = async () => {
        if (!navigator.share) return copy()
        try {
            await navigator.share({ title, text: `${title} on Technova`, url })
        } catch {
            // cancelled
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="w-full sm:w-auto flex items-center gap-1.5 text-sm text-gray-500 mr-1">
                <Share2 className="w-4 h-4" /> Share:
            </span>
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={btn}>
                WhatsApp
            </a>
            <button onClick={copy} className={btn}>
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Link2 className="w-4 h-4" />}
                {copied ? "Copied" : "Copy link"}
            </button>
            <button onClick={nativeShare} className={`${btn} sm:hidden`}>More…</button>
        </div>
    )
}
