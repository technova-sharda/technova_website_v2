'use client'

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Home, ChevronRight, Sparkles, Users } from "lucide-react"
import { getClubs } from "@/lib/actions/clubs"
import { AnimatedBackground } from "@/components/ui/animated-background"
import { RevealOnScroll, StaggerContainer, StaggerItem } from "@/components/ui/reveal-on-scroll"
import { GlowCard } from "@/components/ui/glow-card"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import { useEffect, useState } from "react"

// Static assets mapping since these aren't in DB yet
const CLUB_ASSETS: Record<string, { slug: string, logo: string, color: string, glowColor: string }> = {
    "AI & Robotics": {
        slug: "ai-robotics",
        logo: "/assets/logo/AI_&_Robotics_logo.png",
        color: "indigo",
        glowColor: "rgba(99, 102, 241, 0.4)"
    },
    "CyberPirates": {
        slug: "cyber-pirates",
        logo: "/assets/logo/cyberpirates.png",
        color: "emerald",
        glowColor: "rgba(16, 185, 129, 0.4)"
    },
    "Datapool": {
        slug: "datapool",
        logo: "/assets/logo/datapool.png",
        color: "blue",
        glowColor: "rgba(59, 130, 246, 0.4)"
    },
    "Game Drifters": {
        slug: "game-drifters",
        logo: "/assets/logo/Game Drifters.png",
        color: "purple",
        glowColor: "rgba(147, 51, 234, 0.4)"
    },
    "GDG on Campus": {
        slug: "gdg",
        logo: "/assets/logo/gdg_on_campus.jpg",
        color: "red",
        glowColor: "rgba(239, 68, 68, 0.4)"
    },
    "GitHub Club": {
        slug: "github",
        logo: "/assets/logo/github.png",
        color: "gray",
        glowColor: "rgba(156, 163, 175, 0.4)"
    },
    "PiXelance": {
        slug: "pixelance",
        logo: "/assets/logo/pixelance_logo.png",
        color: "pink",
        glowColor: "rgba(236, 72, 153, 0.4)"
    }
}

export default function ClubsPage() {
    const [dbClubs, setDbClubs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchClubs() {
            const clubs = await getClubs()
            setDbClubs(clubs)
            setLoading(false)
        }
        fetchClubs()
    }, [])

    const clubCount = Object.keys(CLUB_ASSETS).length

    return (
        <div className="min-h-screen bg-[var(--sig-bg)] text-[var(--sig-text)] overflow-hidden">
            <AnimatedBackground />

            {/* Hero Section */}
            <section className="relative pt-28 pb-16 overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

                <div className="container mx-auto px-4 relative z-10">
                    {/* Breadcrumb */}
                    <motion.nav
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 text-sm mb-8"
                    >
                        <Link href="/" className="flex items-center gap-1.5 text-[var(--sig-text-secondary)] hover:text-white transition-colors">
                            <Home className="w-4 h-4" /> Home
                        </Link>
                        <ChevronRight className="w-4 h-4 text-[var(--sig-border-hover)]" />
                        <span className="text-[var(--sig-amber)] font-medium">Clubs</span>
                    </motion.nav>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center max-w-3xl mx-auto"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--sig-indigo)]/30 bg-[var(--sig-indigo)]/10 backdrop-blur-xl mb-6">
                            <Users className="w-4 h-4 text-[var(--sig-indigo)]" />
                            <span className="text-[var(--sig-indigo)] font-medium text-sm tracking-wider uppercase font-mono">Specialized Communities</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                            Explore Our Clubs
                        </h1>
                        <p className="text-[var(--sig-text-secondary)] text-lg mb-10">
                            Join specialized communities to master your craft, connect with peers, and build the future together.
                        </p>

                        {/* Stats */}
                        <div className="flex justify-center gap-12">
                            <AnimatedCounter value={clubCount} suffix="+" label="Active Clubs" className="text-[var(--sig-amber)]" />
                            <AnimatedCounter value={2500} suffix="+" label="Total Members" className="text-[var(--sig-indigo)]" />
                            <AnimatedCounter value={50} suffix="+" label="Events/Year" className="text-[var(--sig-green)]" />
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Clubs Grid */}
            <section className="pb-24 relative z-10">
                <div className="container mx-auto px-4">
                    {loading ? (
                        <div className="text-center py-20">
                            <div className="w-10 h-10 border-2 border-[var(--sig-amber)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-[var(--sig-text-secondary)]">Loading clubs...</p>
                        </div>
                    ) : (
                        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {dbClubs.map((club: any) => {
                                const assets = CLUB_ASSETS[club.name]
                                if (!assets) return null

                                return (
                                    <StaggerItem key={club.id}>
                                        <Link href={`/clubs/${assets.slug}`} className="block h-full">
                                            <GlowCard
                                                className="h-full"
                                                glowColor={assets.glowColor}
                                            >
                                                <div className="p-8 flex flex-col items-center text-center h-full">
                                                    {/* Logo */}
                                                    <motion.div
                                                        className="w-28 h-28 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                                                        whileHover={{ scale: 1.1, rotate: 3 }}
                                                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                                                    >
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={assets.logo}
                                                            alt={club.name}
                                                            className="w-20 h-20 object-contain"
                                                        />
                                                    </motion.div>

                                                    {/* Content */}
                                                    <h3 className="text-2xl font-bold mb-3">{club.name}</h3>
                                                    <p className="text-[var(--sig-text-secondary)] text-sm leading-relaxed mb-6 flex-1">
                                                        {club.description}
                                                    </p>

                                                    {/* CTA */}
                                                    <span className="spring-btn inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--sig-amber)] group-hover:text-[var(--sig-amber)]/80">
                                                        Explore Club
                                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                                                    </span>
                                                </div>
                                            </GlowCard>
                                        </Link>
                                    </StaggerItem>
                                )
                            })}
                        </StaggerContainer>
                    )}
                </div>
            </section>

            {/* Join CTA */}
            <section className="py-20 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--sig-amber)]/[0.03] to-transparent" />
                <div className="container mx-auto px-4 relative z-10">
                    <RevealOnScroll>
                        <div className="text-center max-w-2xl mx-auto">
                            <Sparkles className="w-10 h-10 text-[var(--sig-amber)] mx-auto mb-4" />
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Join?</h2>
                            <p className="text-[var(--sig-text-secondary)] mb-8">
                                Pick a club that matches your interests and start your journey towards becoming a tech leader.
                            </p>
                            <Link
                                href="/events"
                                className="spring-btn inline-flex items-center gap-2 bg-gradient-to-r from-[var(--sig-amber)] to-amber-500 px-8 py-4 rounded-xl font-bold text-black hover:opacity-90 transition-all shadow-[0_0_30px_var(--sig-amber-dim)] hover:shadow-[0_0_40px_var(--sig-amber-dim)]"
                            >
                                Browse Upcoming Events
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                        </div>
                    </RevealOnScroll>
                </div>
            </section>
        </div>
    )
}
