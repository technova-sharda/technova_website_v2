'use client'

import Link from "next/link"
import { motion } from "framer-motion"
import { Calendar, MapPin, Clock, ArrowRight, Home, ChevronRight, Sparkles, History, CalendarDays, Search, X } from "lucide-react"
import { useMemo, useState } from "react"
import { formatDateShort, formatDateRange } from "@/lib/utils"
import { AnimatedBackground } from "@/components/ui/animated-background"
import { RevealOnScroll, StaggerContainer, StaggerItem } from "@/components/ui/reveal-on-scroll"
import { BannerImage } from "@/components/ui/banner-image"


type Mode = 'all' | 'online' | 'campus'

export function PublicEventsClient({ events }: { events: any[] }) {
    const [query, setQuery] = useState('')
    const [club, setClub] = useState('all')
    const [mode, setMode] = useState<Mode>('all')
    const [showAllPast, setShowAllPast] = useState(false)

    const clubs = useMemo(
        () => Array.from(new Set(events.map((e: any) => e.club?.name).filter(Boolean))).sort() as string[],
        [events]
    )
    const filtering = query.trim() !== '' || club !== 'all' || mode !== 'all'
    const allEvents = useMemo(() => {
        const q = query.trim().toLowerCase()
        return events.filter((e: any) =>
            (!q || [e.title, e.club?.name, e.venue].some((v: string | undefined) => v?.toLowerCase().includes(q))) &&
            (club === 'all' || e.club?.name === club) &&
            (mode === 'all' || (mode === 'online' ? !!e.is_virtual : !e.is_virtual))
        )
    }, [events, query, club, mode])

    const now = new Date()

    const upcomingEvents = allEvents.filter((event: any) =>
        !event.is_past_event && event.status !== 'completed' && new Date(event.start_time) > now
    ).sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    const ongoingEvents = allEvents.filter((event: any) =>
        !event.is_past_event &&
        event.status !== 'completed' &&
        new Date(event.start_time) <= now &&
        new Date(event.end_time) > now
    ).sort((a: any, b: any) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime())

    const pastEvents = allEvents.filter((event: any) =>
        event.is_past_event || event.status === 'completed' || new Date(event.end_time) <= now
    ).sort((a: any, b: any) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())

    return (
        <div className="min-h-screen bg-[var(--sig-bg)] text-[var(--sig-text)] overflow-hidden">
            <AnimatedBackground />

            {/* Hero Section */}
            <section className="relative py-14 md:py-24 overflow-hidden">
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
                        <span className="text-[var(--sig-amber)] font-medium">Events</span>
                    </motion.nav>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center max-w-3xl mx-auto"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--sig-amber)]/30 bg-[var(--sig-amber)]/10 backdrop-blur-xl mb-6">
                            <CalendarDays className="w-4 h-4 text-[var(--sig-amber)]" />
                            <span className="text-[var(--sig-amber)] font-medium text-sm tracking-wider uppercase font-mono">Upcoming & Past Events</span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                            Events & Workshops
                        </h1>
                        <p className="text-[var(--sig-text-secondary)] text-lg">
                            Join our workshops, hackathons, and tech talks. Learn, collaborate, and grow.
                        </p>
                    </motion.div>
                </div>
            </section>

            <div className="container mx-auto px-4 relative z-10 pb-24">
                {/* Search & filters */}
                <div className="mb-12 md:mb-16 flex flex-col md:flex-row gap-3 md:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--sig-text-secondary)]" />
                        <input
                            type="search"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search events, clubs or venues"
                            aria-label="Search events"
                            className="w-full h-12 pl-11 pr-4 rounded-xl bg-[var(--sig-surface)] border border-[var(--sig-border)] text-[var(--sig-text)] placeholder:text-[var(--sig-text-secondary)] focus:outline-none focus:border-[var(--sig-amber)]/50"
                        />
                    </div>
                    <select
                        value={club}
                        onChange={e => setClub(e.target.value)}
                        aria-label="Filter by club"
                        className="h-12 px-4 rounded-xl bg-[var(--sig-surface)] border border-[var(--sig-border)] text-[var(--sig-text)] focus:outline-none focus:border-[var(--sig-amber)]/50"
                    >
                        <option value="all">All clubs</option>
                        {clubs.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div className="flex rounded-xl border border-[var(--sig-border)] bg-[var(--sig-surface)] p-1" role="group" aria-label="Event format">
                        {([['all', 'All'], ['online', 'Online'], ['campus', 'On campus']] as const).map(([value, label]) => (
                            <button
                                key={value}
                                onClick={() => setMode(value)}
                                aria-pressed={mode === value}
                                className={`flex-1 md:flex-none px-4 h-10 rounded-lg text-sm font-medium transition-colors ${mode === value ? 'bg-[var(--sig-amber)] text-black' : 'text-[var(--sig-text-secondary)] hover:text-white'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {filtering && (
                        <button
                            onClick={() => { setQuery(''); setClub('all'); setMode('all') }}
                            className="h-12 px-4 rounded-xl text-sm text-[var(--sig-text-secondary)] hover:text-white inline-flex items-center justify-center gap-1.5"
                        >
                            <X className="w-4 h-4" /> Clear
                        </button>
                    )}
                </div>

                {filtering && allEvents.length === 0 && (
                    <p className="text-center text-[var(--sig-text-secondary)] py-16">No events match your search.</p>
                )}

                {(
                    <>
                        {/* ONGOING EVENTS */}
                        {ongoingEvents.length > 0 && (
                            <section className="mb-20">
                                <RevealOnScroll>
                                    <div className="flex flex-wrap items-center gap-3 mb-8">
                                        <div className="w-10 h-10 bg-[var(--sig-amber)]/20 rounded-xl flex items-center justify-center relative">
                                            <Clock className="w-5 h-5 text-[var(--sig-amber)]" />
                                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--sig-green)] rounded-full animate-live-pulse" />
                                        </div>
                                        <h2 className="text-2xl font-bold">Happening Now</h2>
                                        <span className="px-2.5 py-1 bg-[var(--sig-green)]/10 text-[var(--sig-green)] text-xs font-semibold rounded-full border border-[var(--sig-green)]/20 font-mono tracking-wider">
                                            LIVE
                                        </span>
                                        <div className="flex-1 h-px bg-gradient-to-r from-[var(--sig-amber)]/30 to-transparent ml-4 hidden sm:block" />
                                    </div>
                                </RevealOnScroll>

                                <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                    {ongoingEvents.map((event: any) => (
                                        <StaggerItem key={event.id}>
                                            <EventCard event={event} isOngoing />
                                        </StaggerItem>
                                    ))}
                                </StaggerContainer>
                            </section>
                        )}

                        {/* UPCOMING EVENTS */}
                        <section className="mb-20">
                            <RevealOnScroll>
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-10 h-10 bg-[var(--sig-indigo)]/20 rounded-xl flex items-center justify-center">
                                        <Sparkles className="w-5 h-5 text-[var(--sig-indigo)]" />
                                    </div>
                                    <h2 className="text-2xl font-bold">Upcoming Events</h2>
                                    <div className="flex-1 h-px bg-gradient-to-r from-[var(--sig-indigo)]/30 to-transparent ml-4 hidden sm:block" />
                                </div>
                            </RevealOnScroll>

                            {upcomingEvents.length === 0 ? (
                                <RevealOnScroll>
                                    <div className="text-center py-12 sm:py-16 bg-[var(--sig-surface)] backdrop-blur-xl rounded-2xl border border-[var(--sig-border)]">
                                        <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-[var(--sig-text-secondary)] mx-auto mb-4" />
                                        <p className="text-[var(--sig-text-secondary)]">No upcoming events scheduled.</p>
                                        <p className="text-[var(--sig-text-secondary)]/60 text-sm mt-2">Check back soon for new events!</p>
                                    </div>
                                </RevealOnScroll>
                            ) : (
                                <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                    {upcomingEvents.map((event: any) => (
                                        <StaggerItem key={event.id}>
                                            <EventCard event={event} />
                                        </StaggerItem>
                                    ))}
                                </StaggerContainer>
                            )}
                        </section>

                        {/* PAST EVENTS - Timeline */}
                        <section className="mb-20">
                            <RevealOnScroll>
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-10 h-10 bg-[var(--sig-border)]/40 rounded-xl flex items-center justify-center">
                                        <History className="w-5 h-5 text-[var(--sig-text-secondary)]" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-300">Past Events</h2>
                                    <div className="flex-1 h-px bg-gradient-to-r from-[var(--sig-border)] to-transparent ml-4" />
                                </div>
                            </RevealOnScroll>

                            {pastEvents.length === 0 ? (
                                <RevealOnScroll>
                                    <div className="text-center py-16 bg-[var(--sig-surface)] backdrop-blur-xl rounded-2xl border border-[var(--sig-border)]">
                                        <Clock className="w-12 h-12 text-[var(--sig-text-secondary)] mx-auto mb-4" />
                                        <p className="text-[var(--sig-text-secondary)]">No past events yet.</p>
                                    </div>
                                </RevealOnScroll>
                            ) : (
                                <div className="relative">
                                    <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-[var(--sig-amber)]/50 via-[var(--sig-indigo)]/30 to-transparent" />

                                    <div className="space-y-8">
                                        {(showAllPast || filtering ? pastEvents : pastEvents.slice(0, 6)).map((event: any, idx: number) => (
                                            <RevealOnScroll key={event.id} delay={idx * 0.1}>
                                                <TimelineEventCard event={event} index={idx} />
                                            </RevealOnScroll>
                                        ))}
                                    </div>

                                    {pastEvents.length > 6 && !showAllPast && !filtering && (
                                        <div className="text-center mt-12">
                                            <button
                                                onClick={() => setShowAllPast(true)}
                                                className="px-6 h-11 rounded-xl border border-[var(--sig-border)] bg-[var(--sig-surface)] text-sm font-medium hover:border-[var(--sig-amber)]/50 transition-colors"
                                            >
                                                Show all {pastEvents.length} past events
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        {/* CALENDAR SECTION */}
                        <section className="pt-12 border-t border-[var(--sig-border)]">
                            <RevealOnScroll>
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-10 h-10 bg-[var(--sig-green)]/20 rounded-xl flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-[var(--sig-green)]" />
                                    </div>
                                    <h2 className="text-2xl font-bold">Event Calendar</h2>
                                    <div className="flex-1 h-px bg-gradient-to-r from-[var(--sig-green)]/30 to-transparent ml-4" />
                                </div>
                            </RevealOnScroll>

                            <RevealOnScroll delay={0.2}>
                                <div className="bg-[var(--sig-surface)] backdrop-blur-2xl p-6 rounded-3xl border border-[var(--sig-border)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
                                    <iframe
                                        src="https://calendar.google.com/calendar/embed?src=technova%40sharda.ac.in&ctz=Asia%2FKolkata&bgcolor=%23000000&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&showTz=1"
                                        style={{ border: 0 }}
                                        width="100%"
                                        height="600"
                                        frameBorder="0"
                                        scrolling="no"
                                        className="rounded-2xl w-full"
                                    ></iframe>
                                </div>
                            </RevealOnScroll>

                            <div className="text-center mt-8">
                                <Link href="https://calendar.google.com/calendar/u/0?cid=dGVjaG5vdmFAc2hhcmRhLmFjLmlu" target="_blank" className="spring-btn inline-flex items-center gap-2 text-[var(--sig-amber)] hover:text-[var(--sig-amber)]/80 font-medium transition-colors">
                                    Add to your Google Calendar <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    )
}

function EventCard({ event, isOngoing }: { event: any; isOngoing?: boolean }) {
    return (
        <Link href={`/events/${event.slug || event.id}`} className="block h-full">
            <motion.div
                className={`sig-card rounded-2xl overflow-hidden group relative h-full shadow-[0_8px_32px_rgba(0,0,0,0.3)] ${isOngoing
                    ? 'border-[var(--sig-green)]/30 hover:border-[var(--sig-green)]/50 hover:shadow-[0_8px_40px_rgba(34,197,94,0.15)]'
                    : ''
                    }`}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            >
                {/* LIVE Badge */}
                {isOngoing && (
                    <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-2.5 py-1 bg-[var(--sig-green)]/90 backdrop-blur-sm rounded-full">
                        <span className="w-2 h-2 bg-white rounded-full animate-live-pulse" />
                        <span className="text-xs font-bold text-white font-mono tracking-wider">LIVE</span>
                    </div>
                )}

                {/* Club Badge */}
                <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-xl px-3 py-1.5 rounded-full border border-[var(--sig-border)] flex items-center gap-2 z-10 shadow-lg">
                    {event.club?.logo_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img loading="lazy" decoding="async" src={event.club.logo_url} alt={event.club.name} className="w-4 h-4 object-contain rounded-full" />
                    )}
                    <span className="text-xs font-medium text-white max-w-[100px] truncate">
                        {event.club?.name || 'Technova'}
                    </span>
                </div>

                {/* Banner */}
                <div className="h-44 bg-gradient-to-br from-[var(--sig-amber)]/10 to-[var(--sig-indigo)]/10 flex items-center justify-center overflow-hidden relative">
                    {event.banner ? (
                        <BannerImage
                            src={event.banner}
                            alt={event.title}
                            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                            style={{ objectPosition: event.banner_position || 'center' }}
                        />
                    ) : (
                        <Calendar className="w-12 h-12 text-[var(--sig-amber)]/40" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </div>

                {/* Content */}
                <div className="p-6">
                    <h3 className="text-xl font-bold mb-3 group-hover:text-[var(--sig-amber)] transition-colors line-clamp-2">
                        {event.title}
                    </h3>

                    {/* Tags */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-mono tracking-wider ${event.price === 0 ? "bg-[var(--sig-green)]/10 text-[var(--sig-green)] border border-[var(--sig-green)]/20" : "bg-[var(--sig-amber)]/10 text-[var(--sig-amber)] border border-[var(--sig-amber)]/20"}`}>
                            {event.price === 0 ? "Free" : `₹${event.price}`}
                        </span>
                        {event.is_virtual && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--sig-indigo)]/10 text-[var(--sig-indigo)] border border-[var(--sig-indigo)]/20 font-mono tracking-wider">
                                {event.venue && event.venue.toLowerCase() !== 'online' ? 'Hybrid' : 'Virtual'}
                            </span>
                        )}
                        {event.is_multi_day && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--sig-amber)]/10 text-[var(--sig-amber)] border border-[var(--sig-amber)]/20 font-mono tracking-wider">
                                Multi-Day
                            </span>
                        )}
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-sm text-[var(--sig-text-secondary)]">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-[var(--sig-amber)]" />
                            {event.is_multi_day ? formatDateRange(event.start_time, event.end_time) : formatDateShort(event.start_time)}
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[var(--sig-indigo)]" />
                            <span className="truncate">{event.venue}</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    )
}

function TimelineEventCard({ event, index }: { event: any; index: number }) {
    const isLeft = index % 2 === 0

    return (
        <div className={`relative flex items-center ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'} flex-row`}>
            {/* Timeline dot */}
            <div className="absolute left-4 md:left-1/2 w-3 h-3 bg-[var(--sig-amber)] rounded-full transform md:-translate-x-1/2 z-10 shadow-[0_0_10px_var(--sig-amber-dim)]" />

            {/* Content */}
            <div className={`w-full md:w-[45%] ${isLeft ? 'md:pr-8 md:text-right' : 'md:pl-8'} pl-12 md:pl-0`}>
                <Link href={`/events/${event.slug || event.id}`}>
                    <motion.div
                        className="sig-card rounded-xl p-5 group"
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                    >
                        <div className={`flex items-center gap-3 mb-3 ${isLeft ? 'md:justify-end' : ''}`}>
                            {event.club?.logo_url && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img loading="lazy" decoding="async" src={event.club.logo_url} alt={event.club?.name} className="w-6 h-6 rounded-full" />
                            )}
                            <span className="text-xs text-[var(--sig-text-secondary)] font-mono">
                                {formatDateShort(event.start_time)}
                            </span>
                        </div>
                        <h3 className="font-bold text-lg group-hover:text-[var(--sig-amber)] transition-colors mb-2">
                            {event.title}
                        </h3>
                        <div className={`flex items-center gap-2 text-sm text-[var(--sig-text-secondary)] ${isLeft ? 'md:justify-end' : ''}`}>
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{event.venue}</span>
                        </div>
                    </motion.div>
                </Link>
            </div>
        </div>
    )
}
