'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { TeamPhoto } from "@/components/ui/team-photo"

const clubs = [
    {
        name: "AI & Robotics",
        slug: "ai-robotics",
        logo: "/assets/logo/AI_&_Robotics_logo.png",
        desc: "Innovating the future with Intelligence. Exploring AI, Machine Learning, and Robotics.",
    },
    {
        name: "CyberPirates",
        slug: "cyber-pirates",
        logo: "/assets/logo/cyberpirates.png",
        desc: "Guide individuals about Information security and cyber awareness to arm against modern exploits.",
    },
    {
        name: "Datapool",
        slug: "datapool",
        logo: "/assets/logo/datapool.png",
        desc: "Focusing on data insights, Database Management Systems, and languages like MySQL.",
    },
    {
        name: "Game Drifters",
        slug: "game-drifters",
        logo: "/assets/logo/Game Drifters.png",
        desc: "A community for exploring and developing new games. Connect, share, and build.",
    },
    {
        name: "GDG on Campus",
        slug: "gdg",
        logo: "/assets/logo/gdg_on_campus.jpg",
        desc: "Google Developer Group. Peer-to-peer learning to build solutions for local communities.",
    },
    {
        name: "GitHub Club",
        slug: "github",
        logo: "/assets/logo/github.png",
        desc: "Promotes open-source contribution and technical skills. A community for developers.",
    },
    {
        name: "PiXelance",
        slug: "pixelance",
        logo: "/assets/logo/pixelance_logo.png",
        desc: "For photography/videography enthusiasts to share passion and explore new subjects.",
    }
]

export function ClubsCarousel() {
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(true)

    const checkScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
            setCanScrollLeft(scrollLeft > 0)
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
        }
    }

    useEffect(() => {
        checkScroll()
        window.addEventListener('resize', checkScroll)
        return () => window.removeEventListener('resize', checkScroll)
    }, [])

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 380
            scrollContainerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            })
            setTimeout(checkScroll, 350)
        }
    }

    // Auto-scroll
    useEffect(() => {
        const interval = setInterval(() => {
            if (scrollContainerRef.current) {
                const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
                if (scrollLeft + clientWidth >= scrollWidth - 10) {
                    scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' })
                } else {
                    scrollContainerRef.current.scrollBy({ left: 350, behavior: 'smooth' })
                }
                setTimeout(checkScroll, 350)
            }
        }, 5000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="relative group w-full">

            {/* Left Button */}
            <button
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-lg bg-[var(--sig-surface)] border border-[var(--sig-border)] flex items-center justify-center text-[var(--sig-text-secondary)] hover:bg-[var(--sig-surface-hover)] hover:text-[var(--sig-text)] transition-all duration-200 spring-btn ${!canScrollLeft ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                style={{ transitionTimingFunction: 'var(--ease-out)' }}
                aria-label="Scroll left"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Right Button */}
            <button
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
                className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-lg bg-[var(--sig-surface)] border border-[var(--sig-border)] flex items-center justify-center text-[var(--sig-text-secondary)] hover:bg-[var(--sig-surface-hover)] hover:text-[var(--sig-text)] transition-all duration-200 spring-btn ${!canScrollRight ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                style={{ transitionTimingFunction: 'var(--ease-out)' }}
                aria-label="Scroll right"
            >
                <ChevronRight className="w-5 h-5" />
            </button>

            {/* Scroll Container */}
            <div
                ref={scrollContainerRef}
                onScroll={checkScroll}
                className="flex gap-5 overflow-x-auto snap-x snap-mandatory py-4 px-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {clubs.map((club) => (
                    <div
                        key={club.slug}
                        className="snap-center shrink-0 w-[300px] md:w-[340px]"
                    >
                        <Link
                            href={`/clubs/${club.slug}`}
                            className="block h-full group/card"
                        >
                            <div
                                className="h-full bg-[var(--sig-surface)] border border-[var(--sig-border)] rounded-lg p-7 flex flex-col items-center text-center transition-all duration-200 hover:border-[var(--sig-border-hover)] hover:-translate-y-1"
                                style={{ transitionTimingFunction: 'var(--ease-out)' }}
                            >
                                {/* Logo */}
                                <div className="h-28 w-28 mb-6 relative flex items-center justify-center rounded-xl bg-white shadow-sm group-hover/card:shadow-md transition-shadow duration-300 overflow-hidden">
                                    <span className="relative block w-20 h-20"><TeamPhoto src={club.logo} name={club.name} sizes="80px" className="object-contain" /></span>
                                </div>

                                <h3 className="text-xl font-heading font-bold mb-3 text-[var(--sig-text)] group-hover/card:text-[var(--sig-amber)] transition-colors duration-200">
                                    {club.name}
                                </h3>

                                <p className="text-[var(--sig-text-secondary)] text-sm leading-relaxed mb-6 line-clamp-3 font-medium">
                                    {club.desc}
                                </p>

                                <div className="mt-auto w-full pt-5 border-t border-[var(--sig-border)] group-hover/card:border-[var(--sig-amber)]/20 transition-colors duration-200">
                                    <span className="inline-flex items-center gap-2 text-[var(--sig-amber)] font-semibold text-sm group-hover/card:gap-3 transition-all duration-200" style={{ transitionTimingFunction: 'var(--ease-out)' }}>
                                        View Details <ArrowRight className="w-4 h-4" />
                                    </span>
                                </div>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>

            {/* Edge fade indicators */}
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[var(--sig-bg)] to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[var(--sig-bg)] to-transparent pointer-events-none z-10" />
        </div>
    )
}
