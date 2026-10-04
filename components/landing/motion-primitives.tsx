'use client'

/**
 * Motion building blocks for the landing page.
 *
 * Rules every piece follows:
 * - Only transform / opacity / clip-path animate (cheap on phones). Blur is used
 *   sparingly and never on large areas.
 * - Hover effects (tilt, magnet, spotlight) only run with a real mouse
 *   (`(hover: hover) and (pointer: fine)`), never on touch screens.
 * - The page is wrapped in <MotionConfig reducedMotion="user">, so people who
 *   ask their OS for less motion get instant, still content.
 */

import Link from "next/link"
import { useEffect, useRef, useState, type ReactNode } from "react"
import {
    motion, useInView, useMotionTemplate, useMotionValue, useScroll,
    useSpring, useTransform, type MotionValue,
} from "framer-motion"

// Created once at module level: creating it inside a component would remount the link on every render.
const MotionLink = motion.create(Link)

export const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]
export const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1]

/** True only for devices with a precise pointer that can hover (mouse/trackpad). */
export function useFinePointer() {
    const [fine, setFine] = useState(false)
    useEffect(() => {
        const mq = window.matchMedia("(hover: hover) and (pointer: fine)")
        const update = () => setFine(mq.matches)
        update()
        mq.addEventListener("change", update)
        return () => mq.removeEventListener("change", update)
    }, [])
    return fine
}

// ─────────────────────────────────────────────────────────────
// Scroll progress line (top of the viewport)
// ─────────────────────────────────────────────────────────────
export function ScrollProgress() {
    const { scrollYProgress } = useScroll()
    const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 })
    return (
        <motion.div
            aria-hidden
            style={{ scaleX }}
            className="fixed top-0 left-0 right-0 h-[2px] origin-left z-[60] bg-gradient-to-r from-[var(--sig-amber)] via-amber-300 to-[var(--sig-indigo)]"
        />
    )
}

// ─────────────────────────────────────────────────────────────
// Reveal: fade + rise (+ optional blur) when scrolled into view
// ─────────────────────────────────────────────────────────────
export function Reveal({
    children, className, delay = 0, y = 28, blur = false, once = true, as = "div",
}: {
    children: ReactNode; className?: string; delay?: number; y?: number; blur?: boolean; once?: boolean; as?: "div" | "li" | "section"
}) {
    const Tag = motion[as]
    return (
        <Tag
            className={className}
            initial={{ opacity: 0, y, ...(blur ? { filter: "blur(10px)" } : {}) }}
            whileInView={{ opacity: 1, y: 0, ...(blur ? { filter: "blur(0px)" } : {}) }}
            viewport={{ once, margin: "-80px" }}
            transition={{ duration: 0.8, ease: EASE_OUT, delay }}
        >
            {children}
        </Tag>
    )
}

// ─────────────────────────────────────────────────────────────
// Split-word headline: each word rises out of a mask, staggered
// ─────────────────────────────────────────────────────────────
export function SplitWords({ text, className, delay = 0, stagger = 0.06, highlight }: {
    text: string; className?: string; delay?: number; stagger?: number; highlight?: string[]
}) {
    const ref = useRef<HTMLSpanElement>(null)
    const inView = useInView(ref, { once: true, margin: "-60px" })
    const words = text.split(" ")
    return (
        <span ref={ref} className={className} aria-label={text}>
            {words.map((word, i) => (
                <span key={i} aria-hidden className="inline-block overflow-hidden align-bottom pb-[0.08em] -mb-[0.08em]">
                    <motion.span
                        className={`inline-block ${highlight?.includes(word) ? "text-[var(--sig-amber)]" : ""}`}
                        initial={{ y: "110%" }}
                        animate={inView ? { y: "0%" } : {}}
                        transition={{ duration: 0.9, ease: EASE_OUT, delay: delay + i * stagger }}
                    >
                        {word}
                    </motion.span>
                    {i < words.length - 1 && " "}
                </span>
            ))}
        </span>
    )
}

// ─────────────────────────────────────────────────────────────
// Section heading: eyebrow with a drawn line + split-word title
// ─────────────────────────────────────────────────────────────
export function SectionHeading({ eyebrow, title, highlight, accent = "amber", children, className = "" }: {
    eyebrow: string; title: string; highlight?: string[]; accent?: "amber" | "indigo"; children?: ReactNode; className?: string
}) {
    const color = accent === "amber" ? "var(--sig-amber)" : "var(--sig-indigo)"
    return (
        <div className={`flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-10 ${className}`}>
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <motion.span
                        className="h-px w-10 origin-left"
                        style={{ background: color }}
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: EASE_OUT }}
                    />
                    <motion.span
                        className="text-xs font-bold uppercase tracking-[0.25em]"
                        style={{ color }}
                        initial={{ opacity: 0, x: -8 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.2 }}
                    >
                        {eyebrow}
                    </motion.span>
                </div>
                <h2 className="text-4xl sm:text-5xl md:text-6xl font-heading font-black tracking-tight leading-[1.02]">
                    <SplitWords text={title} highlight={highlight} delay={0.1} />
                </h2>
            </div>
            {children && <Reveal delay={0.3} className="md:max-w-md">{children}</Reveal>}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// Magnetic button: drifts toward the cursor, with a light sweep on hover
// ─────────────────────────────────────────────────────────────
export function MagneticLink({ href, children, className = "", strength = 0.3, external = false }: {
    href: string; children: ReactNode; className?: string; strength?: number; external?: boolean
}) {
    const ref = useRef<HTMLAnchorElement>(null)
    const fine = useFinePointer()
    const x = useSpring(0, { stiffness: 250, damping: 18, mass: 0.4 })
    const y = useSpring(0, { stiffness: 250, damping: 18, mass: 0.4 })

    const onMove = (e: React.MouseEvent) => {
        if (!fine || !ref.current) return
        const r = ref.current.getBoundingClientRect()
        x.set((e.clientX - (r.left + r.width / 2)) * strength)
        y.set((e.clientY - (r.top + r.height / 2)) * strength)
    }
    const reset = () => { x.set(0); y.set(0) }

    return (
        <MotionLink
            ref={ref}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            onMouseMove={onMove}
            onMouseLeave={reset}
            style={{ x, y }}
            whileTap={{ scale: 0.96 }}
            className={`group relative inline-flex items-center justify-center overflow-hidden ${className}`}
        >
            {/* light sweep */}
            <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-120%] group-hover:translate-x-[420%] transition-transform duration-700 ease-out" />
            <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
        </MotionLink>
    )
}

// ─────────────────────────────────────────────────────────────
// Spotlight + 3D tilt card (mouse only)
// ─────────────────────────────────────────────────────────────
export function TiltCard({ children, className = "", tilt = 6, glow = "245,166,35" }: {
    children: ReactNode; className?: string; tilt?: number; glow?: string
}) {
    const ref = useRef<HTMLDivElement>(null)
    const fine = useFinePointer()
    const mx = useMotionValue(-1000)
    const my = useMotionValue(-1000)
    const rx = useSpring(0, { stiffness: 200, damping: 20 })
    const ry = useSpring(0, { stiffness: 200, damping: 20 })

    const spotlight = useMotionTemplate`radial-gradient(420px circle at ${mx}px ${my}px, rgba(${glow},0.10), transparent 70%)`
    const border = useMotionTemplate`radial-gradient(260px circle at ${mx}px ${my}px, rgba(${glow},0.55), transparent 70%)`

    const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!fine || !ref.current) return
        const r = ref.current.getBoundingClientRect()
        const px = e.clientX - r.left
        const py = e.clientY - r.top
        mx.set(px)
        my.set(py)
        ry.set(((px / r.width) - 0.5) * tilt * 2)
        rx.set(-((py / r.height) - 0.5) * tilt * 2)
    }
    const onLeave = () => { mx.set(-1000); my.set(-1000); rx.set(0); ry.set(0) }

    return (
        <motion.div
            ref={ref}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
            className={`relative rounded-2xl ${className}`}
        >
            {/* glowing border that follows the cursor */}
            <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl p-px [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [mask-composite:exclude]" style={{ background: border }} />
            <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: spotlight }} />
            {children}
        </motion.div>
    )
}

// ─────────────────────────────────────────────────────────────
// Infinite marquee (CSS animation, pauses on hover, edge fade)
// ─────────────────────────────────────────────────────────────
export function Marquee({ children, reverse = false, speed = 40, className = "" }: {
    children: ReactNode; reverse?: boolean; speed?: number; className?: string
}) {
    return (
        <div className={`group relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)] ${className}`}>
            {[0, 1].map(copy => (
                <div
                    key={copy}
                    aria-hidden={copy === 1}
                    className="flex shrink-0 items-center gap-10 pr-10 animate-marquee group-hover:[animation-play-state:paused]"
                    style={{ animationDuration: `${speed}s`, animationDirection: reverse ? "reverse" : "normal" }}
                >
                    {children}
                </div>
            ))}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// Scroll-scrubbed paragraph: words light up as you scroll past
// ─────────────────────────────────────────────────────────────
function ScrubWord({ word, progress, range }: { word: string; progress: MotionValue<number>; range: [number, number] }) {
    const opacity = useTransform(progress, range, [0.14, 1])
    return <motion.span style={{ opacity }} className="inline-block mr-[0.28em]">{word}</motion.span>
}

export function ScrubText({ text, className }: { text: string; className?: string }) {
    const ref = useRef<HTMLParagraphElement>(null)
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] })
    const words = text.split(" ")
    return (
        <p ref={ref} className={className} aria-label={text}>
            <span aria-hidden>
                {words.map((w, i) => (
                    <ScrubWord key={i} word={w} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} />
                ))}
            </span>
        </p>
    )
}
