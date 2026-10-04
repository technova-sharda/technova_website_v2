'use client'

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, MotionConfig, motion, useScroll, useTransform } from "framer-motion"
import {
    ArrowRight, ArrowUpRight, Award, BookOpen, CalendarDays, ChevronRight, Code2, Cpu, Database, Globe,
    MapPin, Rocket, Sparkle, Target, Trophy, Users, Video, Zap,
} from "lucide-react"
import { ClubsCarousel } from "@/components/ui/clubs-carousel"
import { AnimatedBackground } from "@/components/ui/animated-background"
import { Footer } from "@/components/layout/footer"
import { ParticleConstellation } from "./particle-constellation"
import { useSessionUser } from "@/components/auth/use-session-user"
import { BannerImage } from "@/components/ui/banner-image"
import {
    EASE_OUT, MagneticLink, Marquee, Reveal, ScrollProgress, ScrubText, SectionHeading, SplitWords, TiltCard,
} from "./motion-primitives"

export type LandingEvent = {
    id: string
    slug: string | null
    title: string
    banner: string | null
    start_time: string
    end_time: string
    is_virtual: boolean | null
    venue: string | null
    clubName: string | null
    state: "live" | "upcoming" | "past"
}

export type LandingStat = { value: number; suffix: string; label: string }

// ─────────────────────────────────────────────────────────────
// Hero pieces
// ─────────────────────────────────────────────────────────────
function TextCycle({ words }: { words: string[] }) {
    const [index, setIndex] = useState(0)
    useEffect(() => {
        const t = setInterval(() => setIndex(i => (i + 1) % words.length), 2600)
        return () => clearInterval(t)
    }, [words.length])
    const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "")
    return (
        <span className="relative inline-block align-bottom overflow-hidden">
            {/* reserves the width of the longest word so the line never jumps */}
            <span className="invisible">{longest}</span>
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                    key={index}
                    className="absolute left-0 top-0 whitespace-nowrap text-[var(--sig-amber)]"
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: "0%", opacity: 1 }}
                    exit={{ y: "-100%", opacity: 0 }}
                    transition={{ duration: 0.55, ease: EASE_OUT }}
                >
                    {words[index]}
                </motion.span>
            </AnimatePresence>
        </span>
    )
}

function HeroTitle() {
    const letters = "TECHNOVA.".split("")
    const isAmber = (i: number) => i >= letters.length - 2
    // Same per-letter boxes in both layers, so the sheen lines up with the letters exactly.
    const row = (animated: boolean) => letters.map((ch, i) => (
        <span
            key={i}
            className={animated ? `letter-rise ${isAmber(i) ? "text-[var(--sig-amber)]" : ""}` : "inline-block"}
            style={animated ? { animationDelay: `${80 + i * 45}ms` } : undefined}
        >
            {ch}
        </span>
    ))
    return (
        <h1 aria-label="Technova" className="relative text-[clamp(2.9rem,12.5vw,11rem)] font-heading font-extrabold tracking-[-0.055em] leading-[0.85] uppercase whitespace-nowrap">
            {/* breathing amber light behind "A." */}
            <span aria-hidden className="amber-breathe pointer-events-none absolute right-[-4%] top-1/2 -translate-y-1/2 w-[2.2em] h-[1.6em] rounded-full bg-[radial-gradient(closest-side,rgba(245,166,35,0.35),transparent)] blur-2xl" />
            <span aria-hidden className="relative">{row(true)}</span>
            {/* light band that sweeps across the word */}
            <span aria-hidden className="title-sheen pointer-events-none absolute inset-0">{row(false)}</span>
        </h1>
    )
}

function Hero({ stats }: { stats: LandingStat[] }) {
    const ref = useRef<HTMLElement>(null)
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
    // Scroll-linked only (no entrance state), so the server HTML is fully visible.
    const contentY = useTransform(scrollYProgress, [0, 1], [0, -120])
    const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0])
    const canvasOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0])

    return (
        <section ref={ref} className="relative min-h-[100svh] flex items-center overflow-hidden pt-24 pb-16">
            <motion.div style={{ opacity: canvasOpacity }} className="absolute inset-0 z-0">
                <div className="hero-fade absolute inset-0 opacity-80" style={{ animationDelay: "300ms" }}>
                    <ParticleConstellation />
                </div>
            </motion.div>

            {/* soft amber light behind the title */}
            <div
                aria-hidden
                className="hero-fade absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] max-w-[140vw] h-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(245,166,35,0.14),transparent)] z-0"
            />
            <div aria-hidden className="absolute bottom-0 inset-x-0 h-[35vh] bg-gradient-to-t from-[var(--sig-bg)] to-transparent z-[2] pointer-events-none" />

            <motion.div style={{ y: contentY, opacity: contentOpacity }} className="container mx-auto px-6 lg:px-16 relative z-10">
                <div className="max-w-6xl">
                    <p className="hero-rise flex items-center gap-3 mb-8 md:mb-10 text-sm md:text-base text-[var(--sig-text-secondary)]">
                        <span aria-hidden className="h-px w-10 bg-[var(--sig-amber)]" />
                        The technical society of Sharda University
                    </p>

                    <HeroTitle />

                    <p className="hero-rise mt-8 text-xl md:text-2xl font-medium text-[var(--sig-text-secondary)] max-w-xl leading-relaxed" style={{ animationDelay: "200ms" }}>
                        We build <TextCycle words={["Engineers", "Innovators", "Problem Solvers", "Designers", "Leaders"]} />
                        <br />
                        for the future of technology.
                    </p>

                    <div className="hero-rise mt-10 flex flex-wrap gap-3 sm:gap-4" style={{ animationDelay: "300ms" }}>
                        <MagneticLink href="/events" className="bg-[var(--sig-amber)] text-black font-heading font-bold px-7 sm:px-8 py-4 rounded-xl uppercase tracking-wider text-sm shadow-[0_10px_40px_-12px_rgba(245,166,35,0.55)]">
                            Explore Events <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                        </MagneticLink>
                        <MagneticLink href="/clubs" className="border border-[var(--sig-border)] bg-black/40 text-[var(--sig-text)] font-heading font-bold px-7 sm:px-8 py-4 rounded-xl uppercase tracking-wider text-sm hover:border-[var(--sig-border-hover)] transition-colors">
                            View Clubs
                        </MagneticLink>
                    </div>

                    <dl className="hero-rise mt-14 md:mt-20 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 border-t border-[var(--sig-border)] pt-8 md:pt-10" style={{ animationDelay: "400ms" }}>
                        {stats.map(s => (
                            <div key={s.label} className="flex flex-col-reverse">
                                <dt className="text-[11px] font-semibold text-[var(--sig-text-secondary)] uppercase tracking-[0.2em] mt-2">{s.label}</dt>
                                <dd className="text-4xl md:text-5xl font-heading font-black text-[var(--sig-amber)] tabular-nums">
                                    {s.value.toLocaleString("en-IN")}{s.suffix}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </motion.div>

            {/* scroll cue */}
            <motion.div
                aria-hidden
                style={{ opacity: contentOpacity }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[var(--sig-text-secondary)]"
            >
                <span className="hero-fade flex flex-col items-center gap-2" style={{ animationDelay: "900ms" }}>
                    Scroll
                    <span className="relative h-10 w-px overflow-hidden bg-[var(--sig-border)]">
                        <motion.span
                            className="absolute inset-x-0 top-0 h-1/2 bg-[var(--sig-amber)]"
                            animate={{ y: ["-100%", "200%"] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                        />
                    </span>
                </span>
            </motion.div>
        </section>
    )
}

// ─────────────────────────────────────────────────────────────
// Marquee band
// ─────────────────────────────────────────────────────────────
const TOPICS = ["Artificial Intelligence", "Cyber Security", "Cloud", "Open Source", "Data Science", "Game Dev", "Design", "Hackathons", "Robotics", "Web3"]
const CLUB_NAMES = ["AI & Robotics", "CyberPirates", "Datapool", "Game Drifters", "GDG on Campus", "GitHub Club", "PiXelance", "AWS Cloud"]

function MarqueeBand() {
    return (
        <section aria-label="What we work on" className="relative py-10 md:py-14 border-y border-[var(--sig-border)] bg-[var(--sig-surface)]/40 overflow-hidden">
            <Marquee speed={45}>
                {TOPICS.map(t => (
                    <span key={t} className="flex items-center gap-10 text-4xl md:text-6xl font-heading font-black uppercase tracking-tight text-white/[0.14] hover:text-[var(--sig-amber)] transition-colors duration-300 whitespace-nowrap">
                        {t}
                        <Sparkle className="w-6 h-6 md:w-8 md:h-8 text-[var(--sig-amber)] shrink-0" strokeWidth={1.5} />
                    </span>
                ))}
            </Marquee>
            <Marquee speed={35} reverse className="mt-6">
                {CLUB_NAMES.map(c => (
                    <span key={c} className="whitespace-nowrap rounded-full border border-[var(--sig-border)] bg-black/40 px-5 py-2 text-sm font-semibold text-[var(--sig-text-secondary)]">
                        {c}
                    </span>
                ))}
            </Marquee>
        </section>
    )
}

// ─────────────────────────────────────────────────────────────
// Up next: real events
// ─────────────────────────────────────────────────────────────
function EventDate({ iso }: { iso: string }) {
    const d = new Date(iso)
    const day = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit" })
    const month = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short" })
    return (
        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-black/70 backdrop-blur border border-white/10 text-white">
            <span className="text-lg font-heading font-black leading-none">{day}</span>
            <span className="text-[10px] uppercase tracking-widest text-[var(--sig-amber)] mt-0.5">{month}</span>
        </div>
    )
}

function UpNext({ events }: { events: LandingEvent[] }) {
    if (events.length === 0) return null
    const allPast = events.every(e => e.state === "past")
    return (
        <section className="relative py-16 md:py-28">
            <div className="container mx-auto px-6 lg:px-16">
                <SectionHeading eyebrow={allPast ? "Recently at Technova" : "Happening at Technova"} title={allPast ? "Latest Events" : "Up Next"} highlight={["Next"]}>
                    <Link href="/events" className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--sig-text-secondary)] hover:text-[var(--sig-amber)] transition-colors">
                        All events <ChevronRight className="w-4 h-4" />
                    </Link>
                </SectionHeading>

                <div className="mt-12 grid gap-5 md:grid-cols-3">
                    {events.map((e, i) => (
                        <Reveal key={e.id} delay={i * 0.1}>
                            <TiltCard className="h-full" tilt={4}>
                                <Link href={`/events/${e.slug || e.id}`} className="group block h-full rounded-2xl overflow-hidden border border-[var(--sig-border)] bg-[var(--sig-surface)]">
                                    <div className="relative aspect-[16/9] overflow-hidden bg-black">
                                        {e.banner ? (
                                            <BannerImage src={e.banner} alt="" sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-110" />
                                        ) : (
                                            <div className="w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(245,166,35,0.25),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(99,102,241,0.25),transparent_60%)]" />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                                        <div className="absolute top-3 left-3"><EventDate iso={e.start_time} /></div>
                                        {e.state === "live" && (
                                            <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                                                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Live
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-5 md:p-6">
                                        {e.clubName && <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--sig-amber)] mb-2">{e.clubName}</p>}
                                        <h3 className="text-lg md:text-xl font-heading font-bold text-white leading-snug line-clamp-2">{e.title}</h3>
                                        <div className="mt-4 flex items-center justify-between text-sm text-[var(--sig-text-secondary)]">
                                            <span className="flex items-center gap-1.5 min-w-0">
                                                {e.is_virtual ? <Video className="w-4 h-4 shrink-0" /> : <MapPin className="w-4 h-4 shrink-0" />}
                                                <span className="truncate">{e.is_virtual ? "Online" : (e.venue || "On campus")}</span>
                                            </span>
                                            <span className="flex items-center gap-1 font-semibold text-white shrink-0 transition-transform duration-300 group-hover:translate-x-1">
                                                {e.state === "past" ? "Details" : "Register"} <ArrowUpRight className="w-4 h-4" />
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            </TiltCard>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    )
}

// ─────────────────────────────────────────────────────────────
// Vision & Mission: words light up while scrolling
// ─────────────────────────────────────────────────────────────
function VisionMission() {
    const items = [
        {
            n: "01", title: "Our Vision", icon: Target, color: "var(--sig-amber)",
            text: "To become a front-runner in preparing graduates to be efficient problem solvers, researchers, innovators and entrepreneurs, making them competent professionals ready to take on any challenge in the IT industry.",
        },
        {
            n: "02", title: "Our Mission", icon: Zap, color: "var(--sig-indigo)",
            text: "Elevating technical skillsets to match industry standards through intensive sessions, real interactions, and propelling students to pursue their passion with uncompromising support from our alumni network.",
        },
    ]
    return (
        <section className="relative py-16 md:py-24 lg:py-28">
            <div className="container mx-auto px-6 lg:px-16">
                <SectionHeading eyebrow="Who We Are" title="Vision & Mission" />
                <div className="mt-14 md:mt-20 grid md:grid-cols-2 gap-14 lg:gap-24">
                    {items.map((it, i) => (
                        <div key={it.n} className={`relative ${i === 1 ? "md:pt-28" : ""}`}>
                            <motion.span
                                aria-hidden
                                className="absolute -top-10 -left-2 text-[7rem] md:text-[9rem] font-heading font-black leading-none text-white/[0.035] select-none"
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 1, ease: EASE_OUT }}
                            >
                                {it.n}
                            </motion.span>
                            <div className="relative">
                                <motion.div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-7 border"
                                    style={{ background: `color-mix(in srgb, ${it.color} 12%, transparent)`, borderColor: `color-mix(in srgb, ${it.color} 30%, transparent)` }}
                                    initial={{ scale: 0, rotate: -45 }}
                                    whileInView={{ scale: 1, rotate: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
                                >
                                    <it.icon className="w-5 h-5" style={{ color: it.color }} />
                                </motion.div>
                                <h3 className="text-2xl md:text-3xl font-heading font-bold mb-5">{it.title}</h3>
                                <ScrubText text={it.text} className="text-lg md:text-xl leading-relaxed font-medium text-[var(--sig-text)]" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

// ─────────────────────────────────────────────────────────────
// Why join: tilt + spotlight bento
// ─────────────────────────────────────────────────────────────
function BentoItem({ icon: Icon, title, description, tags, href, className = "", glow, delay }: {
    icon: React.ElementType; title: string; description: string; tags?: string[]; href?: string; className?: string; glow?: string; delay: number
}) {
    const body = (
        <div className="relative h-full flex flex-col justify-between p-7 md:p-9 rounded-2xl border border-[var(--sig-border)] bg-[var(--sig-surface)] overflow-hidden group">
            <div>
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-[var(--sig-border)] flex items-center justify-center mb-6 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                    <Icon className="w-6 h-6 text-[var(--sig-amber)]" />
                </div>
                <h3 className="text-xl md:text-2xl font-heading font-bold text-[var(--sig-text)] mb-3 flex items-center gap-2">
                    {title}
                    {href && <ArrowUpRight className="w-5 h-5 text-[var(--sig-text-secondary)] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />}
                </h3>
                <p className="text-sm md:text-[15px] text-[var(--sig-text-secondary)] leading-relaxed font-medium max-w-prose">{description}</p>
            </div>
            {tags && (
                <div className="flex gap-2 mt-7 flex-wrap">
                    {tags.map(tag => (
                        <span key={tag} className="px-2.5 py-1 bg-white/5 border border-[var(--sig-border)] text-[10px] font-bold uppercase tracking-wider text-[var(--sig-text-secondary)] rounded-md">{tag}</span>
                    ))}
                </div>
            )}
        </div>
    )
    return (
        <Reveal delay={delay} className={className}>
            <TiltCard className="h-full min-h-[240px]" glow={glow}>
                {href ? <Link href={href} className="block h-full">{body}</Link> : body}
            </TiltCard>
        </Reveal>
    )
}

function WhyJoin() {
    return (
        <section className="relative py-16 md:py-24 lg:py-28 overflow-hidden">
            <div aria-hidden className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] max-w-[150vw] h-[900px] bg-[radial-gradient(closest-side,rgba(99,102,241,0.08),transparent)] pointer-events-none" />
            <div className="container mx-auto px-6 lg:px-16 relative">
                <SectionHeading eyebrow="What We Offer" title="Why Join Us" accent="indigo">
                    <p className="text-[var(--sig-text-secondary)] font-medium text-base">
                        We provide the framework. You provide the execution. Open doors to personal growth, leadership, and real engineering.
                    </p>
                </SectionHeading>
                <div className="mt-12 md:mt-16 grid gap-4 md:grid-cols-6">
                    <BentoItem className="md:col-span-4" delay={0} icon={BookOpen} title="Workshops & Bootcamps" href="/events"
                        description="Intensive, hands-on sessions covering cloud architecture, machine learning, cybersecurity, and full-stack development."
                        tags={["AWS", "AI/ML", "DevOps", "Security"]} />
                    <BentoItem className="md:col-span-2" delay={0.08} icon={Users} title="The Network" glow="99,102,241"
                        description="Connect with like-minded students, high-achieving alumni, and industry professionals through exclusive meetups." />
                    <BentoItem className="md:col-span-3" delay={0.16} icon={Code2} title="Open Source & DevSpace" href="/community" glow="99,102,241"
                        description="Contribute to real projects, find hackathon teammates, showcase your work, and access curated resources."
                        tags={["Community", "Buddy Finder", "Showcase", "Resources"]} />
                    <BentoItem className="md:col-span-3" delay={0.24} icon={Trophy} title="XP, Leaderboard & Certificates" href="/leaderboard"
                        description="Every event you attend earns XP. Climb the leaderboard and collect verified certificates you can add to LinkedIn."
                        tags={["XP", "Leaderboard", "Verified certificates"]} />
                </div>
            </div>
        </section>
    )
}

// ─────────────────────────────────────────────────────────────
// Clubs, DevSpace hub, calendar
// ─────────────────────────────────────────────────────────────
function Clubs() {
    return (
        <section className="relative py-16 md:py-24 lg:py-28 border-t border-[var(--sig-border)]">
            <div className="container mx-auto px-6 lg:px-16">
                <SectionHeading eyebrow="Divisions" title="Our Clubs">
                    <Link href="/clubs" className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--sig-text-secondary)] hover:text-[var(--sig-amber)] transition-colors">
                        View all clubs <ChevronRight className="w-4 h-4" />
                    </Link>
                </SectionHeading>
                <Reveal className="mt-12 md:mt-16" delay={0.1}>
                    <ClubsCarousel />
                </Reveal>
            </div>
        </section>
    )
}

const HUB = [
    { title: "Community", desc: "Discuss ideas, ask questions, share knowledge.", icon: Users, href: "/community" },
    { title: "Buddy Finder", desc: "Find teammates for hackathons and projects.", icon: Rocket, href: "/buddy-finder" },
    { title: "Showcase", desc: "Show off your projects and get feedback.", icon: Code2, href: "/showcase" },
    { title: "Resources", desc: "PYQs, notes and study material from seniors.", icon: Database, href: "/resources" },
]

function DevSpaceAndCalendar() {
    return (
        <section className="relative py-16 md:py-24 lg:py-28 border-t border-[var(--sig-border)]">
            <div className="container mx-auto px-6 lg:px-16">
                <SectionHeading eyebrow="For builders" title="DevSpace Hub" highlight={["Hub"]} accent="indigo" />
                <div className="mt-10 md:mt-14 grid sm:grid-cols-2 md:grid-cols-4 border border-[var(--sig-border)] rounded-2xl overflow-hidden">
                    {HUB.map((item, i) => (
                        <motion.div
                            key={item.href}
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-60px" }}
                            transition={{ duration: 0.7, ease: EASE_OUT, delay: i * 0.08 }}
                            className="border-b sm:border-r border-[var(--sig-border)] last:border-b-0 sm:[&:nth-child(2)]:border-r-0 md:[&:nth-child(2)]:border-r sm:[&:nth-child(n+3)]:border-b-0 md:last:border-r-0"
                        >
                            <Link href={item.href} className="group relative flex flex-col justify-between min-h-[190px] md:min-h-[220px] p-7 md:p-8 overflow-hidden">
                                <span aria-hidden className="absolute inset-0 bg-[var(--sig-amber)] origin-bottom scale-y-0 group-hover:scale-y-100 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]" />
                                <div className="relative z-10 flex items-start justify-between">
                                    <item.icon className="w-6 h-6 text-[var(--sig-text-secondary)] group-hover:text-black transition-colors duration-300" />
                                    <ArrowUpRight className="w-5 h-5 text-[var(--sig-text-secondary)] group-hover:text-black transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                </div>
                                <div className="relative z-10">
                                    <h3 className="text-lg font-heading font-bold group-hover:text-black transition-colors duration-300 mb-1.5">{item.title}</h3>
                                    <p className="text-sm text-[var(--sig-text-secondary)] group-hover:text-black/70 font-medium transition-colors duration-300">{item.desc}</p>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                <Reveal className="mt-12 md:mt-20" delay={0.05}>
                    <div className="rounded-2xl border border-[var(--sig-border)] bg-[var(--sig-surface)] p-7 md:p-12 overflow-hidden relative group">
                        <div aria-hidden className="absolute -right-32 -top-32 w-96 h-96 rounded-full bg-[radial-gradient(closest-side,rgba(245,166,35,0.12),transparent)]" />
                        <div className="relative flex flex-col md:flex-row gap-10 md:gap-12 items-center">
                            <div className="md:w-1/3">
                                <CalendarDays className="w-8 h-8 text-[var(--sig-amber)] mb-5" />
                                <h3 className="text-3xl lg:text-4xl font-heading font-black tracking-tight mb-4">
                                    Schedule <span className="text-[var(--sig-amber)]">Sync</span>
                                </h3>
                                <p className="text-[var(--sig-text-secondary)] font-medium mb-8 text-sm leading-relaxed">
                                    Never miss an event. Subscribe to the official Technova calendar and stay in sync.
                                </p>
                                <MagneticLink href="https://calendar.google.com/calendar/u/0?cid=dGVjaG5vdmFAc2hhcmRhLmFjLmlu" external strength={0.2}
                                    className="text-black bg-[var(--sig-amber)] px-6 py-3 font-heading font-bold uppercase tracking-wider text-sm rounded-xl">
                                    Add to Calendar <ArrowRight className="w-4 h-4" />
                                </MagneticLink>
                            </div>
                            <div className="md:w-2/3 w-full bg-black border border-[var(--sig-border)] rounded-xl p-2 md:p-4 opacity-85 group-hover:opacity-100 transition-opacity duration-500">
                                <iframe
                                    title="Technova events calendar"
                                    src="https://calendar.google.com/calendar/embed?src=technova%40sharda.ac.in&ctz=Asia%2FKolkata&bgcolor=%23000000&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&showTz=1"
                                    loading="lazy"
                                    style={{ border: 0, filter: "invert(0.9) hue-rotate(180deg) grayscale(1) contrast(1.2)" }}
                                    width="100%"
                                    height="380"
                                    className="w-full mix-blend-screen rounded"
                                />
                            </div>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    )
}

// ─────────────────────────────────────────────────────────────
// Closing call to action
// ─────────────────────────────────────────────────────────────
function FinalCta() {
    const isSignedIn = !!useSessionUser()
    return (
        <section className="relative py-20 md:py-32 overflow-hidden border-t border-[var(--sig-border)]">
            {/* still glow (a rotating blurred layer here cost frames on phones) */}
            <div
                aria-hidden
                className="absolute left-1/2 top-1/2 w-[1000px] h-[600px] max-w-[160vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
                style={{ background: "radial-gradient(closest-side, rgba(245,166,35,0.12), rgba(99,102,241,0.08) 55%, transparent)" }}
            />
            <div className="container mx-auto px-6 lg:px-16 relative text-center">
                <Reveal>
                    <p className="flex items-center justify-center gap-3 mb-8 text-sm md:text-base text-[var(--sig-text-secondary)]">
                        <span aria-hidden className="h-px w-10 bg-[var(--sig-amber)]" />
                        Open to every Sharda student
                        <span aria-hidden className="h-px w-10 bg-[var(--sig-amber)]" />
                    </p>
                </Reveal>
                <h2 className="text-[clamp(2.6rem,8vw,6.5rem)] font-heading font-black tracking-tight leading-[0.95] max-w-5xl mx-auto">
                    <SplitWords text="Your next build starts here." highlight={["build"]} stagger={0.08} />
                </h2>
                <Reveal delay={0.35}>
                    <p className="mt-6 text-lg text-[var(--sig-text-secondary)] max-w-xl mx-auto">
                        Workshops, hackathons, clubs and a community that ships. Pick an event and show up.
                    </p>
                </Reveal>
                <Reveal delay={0.5} className="mt-10 flex flex-wrap justify-center gap-3 sm:gap-4">
                    <MagneticLink href="/events" className="bg-[var(--sig-amber)] text-black font-heading font-bold px-8 py-4 rounded-xl uppercase tracking-wider text-sm shadow-[0_10px_40px_-10px_rgba(245,166,35,0.6)]">
                        Find an event <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </MagneticLink>
                    <MagneticLink href={isSignedIn ? "/dashboard" : "/login"} className="border border-[var(--sig-border)] bg-black/40 text-[var(--sig-text)] font-heading font-bold px-8 py-4 rounded-xl uppercase tracking-wider text-sm">
                        {isSignedIn ? <>My dashboard <Award className="w-4 h-4" /></> : <>Sign in <Globe className="w-4 h-4" /></>}
                    </MagneticLink>
                </Reveal>
                <Reveal delay={0.6}>
                    <div className="mt-14 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-[var(--sig-text-secondary)]">
                        {[[Cpu, "Hands-on workshops"], [Trophy, "Hackathons & prizes"], [Award, "Verified certificates"]].map(([Icon, label]: any) => (
                            <span key={label} className="inline-flex items-center gap-2"><Icon className="w-4 h-4 text-[var(--sig-amber)]" />{label}</span>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    )
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export function LandingClient({ stats, events }: { stats: LandingStat[]; events: LandingEvent[] }) {
    return (
        <MotionConfig reducedMotion="user">
            <div className="relative flex flex-col min-h-screen bg-[var(--sig-bg)] text-[var(--sig-text)] selection:bg-[var(--sig-amber)] selection:text-black overflow-x-clip font-sans">
                <ScrollProgress />
                <AnimatedBackground />
                <Hero stats={stats} />
                <MarqueeBand />
                <UpNext events={events} />
                <VisionMission />
                <WhyJoin />
                <Clubs />
                <DevSpaceAndCalendar />
                <FinalCta />
                <Footer />
            </div>
        </MotionConfig>
    )
}
