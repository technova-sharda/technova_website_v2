'use client'

import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft, Zap, Trophy, ShieldAlert, Cpu, HeartPulse, BookOpen, LineChart, Globe, GraduationCap, Download, Users, Award, Star, ArrowUpRight, CheckCircle, Sparkles, ChevronDown, MapPin, Wifi, Coffee, ArrowRight, Phone, User, Clock, DoorOpen, Flag, PartyPopper, ClipboardList, Lock, Search, Rocket, Medal } from 'lucide-react'
import { VenueCarousel } from '@/components/hackathon/venue-carousel'
import { Footer } from '@/components/layout/footer'
import { useEffect, useState, useRef, useMemo } from 'react'

/* ─── Ease curves ─── */
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

/* ─── Floating orb component ─── */
function FloatingOrbs() {
    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
            <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-indigo-600/[0.04] blur-[120px] animate-[drift_25s_ease-in-out_infinite]" />
            <div className="absolute top-[50%] right-[10%] w-[600px] h-[600px] rounded-full bg-violet-500/[0.03] blur-[150px] animate-[drift_30s_ease-in-out_infinite_reverse]" />
            <div className="absolute bottom-[10%] left-[30%] w-[400px] h-[400px] rounded-full bg-cyan-500/[0.03] blur-[100px] animate-[drift_20s_ease-in-out_infinite]" />
        </div>
    )
}

/* ─── Animated counter ─── */
function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
    const [count, setCount] = useState(0)
    const ref = useRef<HTMLSpanElement>(null)
    const hasAnimated = useRef(false)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true
                    const duration = 1500
                    const startTime = performance.now()
                    const step = (timestamp: number) => {
                        const progress = Math.min((timestamp - startTime) / duration, 1)
                        const eased = 1 - Math.pow(1 - progress, 3)
                        setCount(Math.floor(eased * value))
                        if (progress < 1) requestAnimationFrame(step)
                    }
                    requestAnimationFrame(step)
                }
            },
            { threshold: 0.5 }
        )
        if (ref.current) observer.observe(ref.current)
        return () => observer.disconnect()
    }, [value])

    return <span ref={ref} className="tabular-nums">{count}{suffix}</span>
}

/* ─── Section wrapper ─── */
function Section({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE_OUT, delay }}
            className={className}
        >
            {children}
        </motion.section>
    )
}

/* ─── Prize Reveal Card ─── */
function PrizeRevealCard({ place, amount, accent, delay, medalClass }: { place: string; amount: string; accent: string; delay: number; medalClass: string }) {
    const [revealed, setRevealed] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setRevealed(true) },
            { threshold: 0.6 }
        )
        if (ref.current) observer.observe(ref.current)
        return () => observer.disconnect()
    }, [])

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay, duration: 0.5, ease: EASE_OUT }}
            className="relative bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden group hover:bg-white/15 transition-all duration-300 active:scale-[0.97]"
        >
            {/* Curtain reveal */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-b from-indigo-900 to-violet-900 z-10 flex items-center justify-center"
                initial={{ clipPath: "inset(0 0 0 0)" }}
                animate={revealed ? { clipPath: "inset(0 0 100% 0)" } : {}}
                transition={{ duration: 0.8, ease: EASE_OUT, delay: delay + 0.3 }}
            >
                <Medal className={`w-12 h-12 ${medalClass}`} strokeWidth={1.5} />
            </motion.div>

            <div className="p-5 sm:p-8 text-center relative z-0">
                <div className={`text-xs font-semibold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r ${accent} mb-3`}>
                    {place}
                </div>
                <motion.div
                    className="text-3xl sm:text-4xl font-heading font-black text-white mb-1"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={revealed ? { scale: 1, opacity: 1 } : {}}
                    transition={{ delay: delay + 0.8, type: "spring", stiffness: 200, damping: 15 }}
                >
                    {amount}
                </motion.div>
            </div>
        </motion.div>
    )
}

export default function HackathonPage() {
    const [currentDate, setCurrentDate] = useState<Date | null>(null)
    const [revealedContacts, setRevealedContacts] = useState<number[]>([])
    const [activeTrack, setActiveTrack] = useState<number | null>(null)
    const [expandedTrack, setExpandedTrack] = useState<number | null>(null)
    const [liveData, setLiveData] = useState<{ settings: any; schedule: any[]; shortlistedTeams: any[] } | null>(null)
    const [openFaq, setOpenFaq] = useState<number | null>(null)
    const [shortlistPage, setShortlistPage] = useState(1)
    const ITEMS_PER_PAGE = 12

    const { scrollY } = useScroll()
    const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])
    const heroScale = useTransform(scrollY, [0, 400], [1, 0.96])
    const heroY = useTransform(scrollY, [0, 400], [0, 60])

    useEffect(() => {
        async function fetchLiveData() {
            try {
                const res = await fetch('/api/hackathon-live')
                if (res.ok) setLiveData(await res.json())
            } catch (e) { console.error('Failed to fetch live data', e) }
        }
        fetchLiveData()
        const liveInterval = setInterval(fetchLiveData, 15000)
        return () => clearInterval(liveInterval)
    }, [])

    useEffect(() => {
        setCurrentDate(new Date())
        const timer = setInterval(() => setCurrentDate(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const timelineEvents = [
        { date: "14 Feb 2026", title: "Registrations Open", timestamp: new Date("2026-02-14").getTime(), desc: "Team formation begins", icon: ClipboardList },
        { date: "14 Mar 2026", title: "Registration Closes", timestamp: new Date("2026-03-14").getTime(), desc: "Final submissions accepted", icon: Lock },
        { date: "16-18 Mar 2026", title: "1st Round Screening", timestamp: new Date("2026-03-16").getTime(), desc: "Idea evaluation phase", icon: Search },
        { date: "24 Mar 2026", title: "Shortlisted Teams", timestamp: new Date("2026-03-24").getTime(), desc: "Selected teams announced", icon: Star },
        { date: "10 Apr, 10:30", title: "Hackathon Begins", timestamp: new Date("2026-04-10T10:30:00").getTime(), desc: "The 24-hour clock officially starts. Start building!", icon: Rocket },
        { date: "11 Apr, 14:00", title: "Closing Ceremony & Awards", timestamp: new Date("2026-04-11T14:00:00").getTime(), desc: "Results announcement, prize distribution, and group photo.", icon: Trophy },
    ]

    const getTimerData = () => {
        if (!currentDate) return null
        const now = currentDate.getTime()
        const nextEvent = timelineEvents.find(e => e.timestamp > now)
        if (!nextEvent) return { phase: "CONCLUDED", days: '00', hours: '00', minutes: '00', seconds: '00', label: "Event Concluded", active: false }
        const diff = nextEvent.timestamp - now
        const pad = (n: number) => n.toString().padStart(2, '0')
        return {
            phase: nextEvent.title.toUpperCase(),
            days: pad(Math.floor(diff / (1000 * 60 * 60 * 24))),
            hours: pad(Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))),
            minutes: pad(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))),
            seconds: pad(Math.floor((diff % (1000 * 60)) / 1000)),
            label: `Until ${nextEvent.title}`,
            active: true
        }
    }

    const timerData = getTimerData()
    const isShortlistPopulated = liveData?.shortlistedTeams && liveData.shortlistedTeams.length > 0

    const sortedShortlist = useMemo(() => {
        if (!liveData?.shortlistedTeams) return []
        return [...liveData.shortlistedTeams].sort((a: any, b: any) => a.name.localeCompare(b.name))
    }, [liveData?.shortlistedTeams])

    const paginatedShortlist = sortedShortlist.slice((shortlistPage - 1) * ITEMS_PER_PAGE, shortlistPage * ITEMS_PER_PAGE)
    const totalPages = Math.ceil(sortedShortlist.length / ITEMS_PER_PAGE)

    const tracks = [
        { title: "AI & Intelligent Systems (AIIS)", icon: HeartPulse, gradient: "from-violet-500 to-fuchsia-500", problem: "AI-Driven Solutions for Smart India", type: "AI/ML", details: "Build intelligent systems using machine learning, NLP, computer vision, or generative AI. Focus on real-world applications that can transform Indian industries — healthcare diagnostics, agriculture optimization, smart city infrastructure." },
        { title: "Web Applications & Software (WASI)", icon: BookOpen, gradient: "from-blue-500 to-cyan-500", problem: "Next-Gen Digital Platforms", type: "Fullstack", details: "Create innovative web/mobile platforms that solve pressing digital challenges. Think fintech solutions, edtech platforms, government service portals, or accessibility-first tools that bridge the digital divide." },
        { title: "Cybersecurity & Blockchain (CSBC)", icon: ShieldAlert, gradient: "from-emerald-500 to-teal-500", problem: "Secure Digital Ecosystems", type: "Security", details: "Design security solutions, blockchain-based systems, or privacy-preserving technologies. From zero-trust architectures to decentralized identity systems, build the trust layer of India's digital future." },
        { title: "Data Science and Smart Analysis (DSSA)", icon: LineChart, gradient: "from-amber-500 to-orange-500", problem: "Data-Driven Insights", type: "Data", details: "Harness the power of data to derive actionable insights. Build dashboards, predictive models, or visualization tools that help organizations make better decisions with their data assets." },
        { title: "Social Impact and Smart India Solutions (SISIS)", icon: Globe, gradient: "from-rose-500 to-pink-500", problem: "Tech for Inclusive Growth", type: "Social", details: "Technology for societal good — accessibility tools, environmental monitoring, rural connectivity, disaster response, mental health support, or solutions that uplift underserved communities." },
        { title: "School Students Innovation (SCHI)", icon: GraduationCap, gradient: "from-sky-500 to-indigo-500", problem: "Empowering Young Minds", type: "Junior", details: "A special track for school students to showcase creativity. Build projects that solve problems in education, campus life, student safety, or local community development." }
    ]

    const faqs = [
        { q: "Who can participate?", a: "Students of B.Tech and all bachelor degree programs." },
        { q: "Cross-college teams allowed?", a: "Cross colleges team is not allowed, but cross departments are allowed and other department students can participate also." },
        { q: "Can I be part of multiple teams?", a: "A student can be part of 2 teams, but if more than one is selected for finals, they must choose one." },
        { q: "What is the team size?", a: "2–5 members recommended per team." },
        { q: "Is the hackathon online or offline?", a: "The Grand Finale is fully on-site (offline) at Sharda University." },
        { q: "Will Wi-Fi be provided?", a: "Yes, secure Wi-Fi access will be arranged. Teams may also use personal hotspots as backup." },
        { q: "What should I bring?", a: "Your laptop, charger, ID card, and any hardware you need. Food and refreshments will be provided." },
        { q: "When should we arrive?", a: "All teams must arrive by 9:30 AM on 10th April. The hackathon starts at 10:30 AM sharp." }
    ]


    return (
        <div className="min-h-screen bg-[#050510] text-white/90 font-sans overflow-x-hidden selection:bg-indigo-500/30 selection:text-white relative">
            <FloatingOrbs />

            {/* ═══ LIVE TIMER PANEL ═══ */}
            <div className="sticky top-0 z-50 w-full bg-[#050510]/90 backdrop-blur-2xl border-b border-indigo-500/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
                    <Link href="/hackathon/live" className="group flex items-center gap-2.5 shrink-0">
                        <div className="relative flex items-center justify-center">
                            <span className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-60" />
                            <span className="relative w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        </div>
                        <span className="text-[10px] sm:text-xs text-white/40 tracking-widest uppercase font-bold hidden sm:inline">
                            {timerData?.label || 'Event Status'}
                        </span>
                    </Link>
                    {timerData?.active && (
                        <div className="flex items-center gap-1.5">
                            {[
                                { val: timerData.days, label: 'Days' },
                                { val: timerData.hours, label: 'Hrs' },
                                { val: timerData.minutes, label: 'Min' },
                                { val: timerData.seconds, label: 'Sec' },
                            ].map((unit, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <div className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-2.5 py-1.5 sm:px-3.5 sm:py-2 flex flex-col items-center min-w-[40px] sm:min-w-[52px]">
                                        <span className="text-base sm:text-xl font-heading font-black tabular-nums text-white leading-none">{unit.val}</span>
                                        <span className="text-[7px] sm:text-[8px] text-white/25 uppercase tracking-widest mt-1 font-bold">{unit.label}</span>
                                    </div>
                                    {i < 3 && <span className="text-white/10 text-xs sm:text-base font-light">:</span>}
                                </div>
                            ))}
                        </div>
                    )}
                    <Link href="/hackathon/live" className="group flex items-center gap-2 px-3.5 py-2 sm:px-5 sm:py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 hover:border-indigo-500/50 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-300 hover:text-white transition-all duration-200 active:scale-[0.97] shrink-0">
                        <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span className="hidden sm:inline">Live Dashboard</span>
                        <ArrowUpRight className="w-3 h-3 sm:hidden" />
                    </Link>
                </div>
            </div>

            {/* ═══ HERO ═══ */}
            <motion.div style={{ opacity: heroOpacity, scale: heroScale, y: heroY }} className="relative z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-24 sm:pb-32">
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_OUT }} className="flex flex-wrap items-center gap-3 sm:gap-4 mb-12 sm:mb-16">
                        <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-xs font-medium tracking-wider uppercase"><ArrowLeft className="w-3.5 h-3.5" /> Home</Link>
                        <span className="w-px h-4 bg-white/10" />
                        <Link href="/hackathon/update" className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-xs font-medium tracking-wider uppercase"><Users className="w-3 h-3" /> Team Details</Link>
                    </motion.div>

                    <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-end">
                        <div className="lg:col-span-7 xl:col-span-8">
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }} className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-full text-white/60 text-xs font-medium tracking-wider uppercase mb-8">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> 8th Edition · 10-11 April 2026
                            </motion.div>
                            <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15, ease: EASE_OUT }} className="text-5xl sm:text-7xl lg:text-8xl xl:text-[7rem] font-heading font-black uppercase tracking-tighter leading-[0.88] mb-6 sm:mb-8">
                                <span className="block text-white">Innovate</span>
                                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400">Bharat</span>
                                <span className="block text-white/20">Hackathon</span>
                            </motion.h1>
                            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25, ease: EASE_OUT }} className="max-w-lg text-base sm:text-lg text-white/50 leading-relaxed">
                                The ultimate test of endurance, creativity, and raw technical skill. 24 hours to build solutions that power the future of India&apos;s digital ecosystem.
                            </motion.p>
                        </div>
                        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3, ease: EASE_OUT }} className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
                            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center">
                                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">Grand Finale Loading</span>
                                <div className="text-sm text-white/50 mb-6 leading-relaxed">Registrations have officially <strong className="text-white/80">closed</strong>. We are gearing up for the ultimate 24-hour showdown.</div>
                                <a href="https://drive.google.com/file/d/1hTMH6CHzvjqZ9pWRB2wRnHlwBS_EpDdh/view?usp=sharing" target="_blank" rel="noopener noreferrer" className="group w-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] hover:border-white/[0.2] text-white/80 hover:text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.97]">
                                    <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform duration-200" />
                                    <span className="text-sm uppercase tracking-wider font-bold">Download Brochure</span>
                                </a>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 text-center flex flex-col justify-center min-h-[110px]">
                                    <div className="text-3xl sm:text-4xl font-heading font-black text-white tracking-tight"><AnimatedCounter value={309} /></div>
                                    <div className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-widest mt-2 font-bold leading-tight">Registered<br />Teams</div>
                                </div>
                                <div className="bg-indigo-500/[0.05] border border-indigo-500/20 rounded-xl p-5 text-center shadow-[0_0_20px_rgba(99,102,241,0.05)] flex flex-col justify-center min-h-[110px]">
                                    <div className="text-3xl sm:text-4xl font-heading font-black text-indigo-400 tracking-tight"><AnimatedCounter value={98} /></div>
                                    <div className="text-[9px] sm:text-[10px] text-indigo-400/70 uppercase tracking-widest mt-2 font-bold leading-tight">Selected For<br />Finals</div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-32">

                {/* ═══ SHORTLISTED TEAMS ═══ */}
                {isShortlistPopulated && liveData && (
                    <Section className="mb-24 sm:mb-32">
                        <div className="relative rounded-3xl border border-white/[0.06] bg-[#0A0A1A]/80 backdrop-blur-sm p-6 sm:p-10 md:p-16 overflow-hidden">
                            <div className="absolute top-0 right-0 w-full h-[400px] bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_50%)] pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-full h-[400px] bg-[radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.06),transparent_50%)] pointer-events-none" />
                            <div className="relative z-10 mb-10 sm:mb-14 text-center">
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.4, ease: EASE_OUT }} className="inline-flex items-center gap-2 text-indigo-400 text-xs sm:text-sm font-medium tracking-widest uppercase mb-5 border border-indigo-500/20 bg-indigo-500/5 px-4 py-1.5 rounded-full">
                                    <Trophy className="w-3.5 h-3.5" /> Grand Finale Selections
                                </motion.div>
                                <h2 className="text-4xl sm:text-5xl md:text-7xl font-heading font-black tracking-tight text-white mb-4 uppercase">
                                    The <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Shortlist</span>
                                </h2>
                                <p className="text-white/40 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">These elite squads have cleared screening and will battle it out in the 24-hour offline crucible.</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 relative z-10 min-h-[300px]">
                                <AnimatePresence mode="popLayout" initial={false}>
                                    {paginatedShortlist.map((team: any, i: number) => (
                                        <motion.div key={team.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.03, duration: 0.3, ease: EASE_OUT }} layout className="group relative p-[1px] rounded-xl overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent group-hover:from-indigo-500/30 group-hover:to-violet-500/10 transition-all duration-500 rounded-xl" />
                                            <div className="relative bg-[#0c0c1a] hover:bg-[#0e0e1e] p-4 sm:p-5 rounded-xl transition-colors duration-300 h-full flex flex-col">
                                                <div className="flex items-center justify-between mb-3 sm:mb-4">
                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
                                                        <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                                                        <span className="text-[9px] sm:text-[10px] font-semibold text-white/60 uppercase tracking-wider">Selected</span>
                                                    </div>
                                                    {team.table_number && (<span className="text-[9px] sm:text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">TBL-{team.table_number}</span>)}
                                                </div>
                                                <h3 className="font-heading font-bold text-sm sm:text-base text-white/90 group-hover:text-white transition-colors line-clamp-2 mt-auto leading-snug">{team.name}</h3>
                                                {team.idea_title && (<p className="text-[11px] sm:text-xs text-white/30 group-hover:text-white/50 transition-colors mt-2 line-clamp-2 leading-relaxed">{team.idea_title}</p>)}
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                            {totalPages > 1 && (
                                <div className="mt-10 flex flex-col items-center justify-center gap-4 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setShortlistPage(p => Math.max(1, p - 1))} disabled={shortlistPage === 1} className={`pg-btn flex items-center gap-1 ${shortlistPage === 1 ? 'pg-btn--disabled' : 'pg-btn--inactive'}`}><ChevronDown className="w-3.5 h-3.5 rotate-90" /> Prev</button>
                                        <div className="flex items-center gap-1.5 px-2">
                                            {Array.from({ length: totalPages }).map((_, i) => (
                                                <button key={i} onClick={() => setShortlistPage(i + 1)} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center ${shortlistPage === i + 1 ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.08] hover:text-white/80 border border-white/[0.05]'}`}>{i + 1}</button>
                                            ))}
                                        </div>
                                        <button onClick={() => setShortlistPage(p => Math.min(totalPages, p + 1))} disabled={shortlistPage === totalPages} className={`pg-btn flex items-center gap-1 ${shortlistPage === totalPages ? 'pg-btn--disabled' : 'pg-btn--inactive'}`}>Next <ChevronDown className="w-3.5 h-3.5 -rotate-90" /></button>
                                    </div>
                                    <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Showing {(shortlistPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(shortlistPage * ITEMS_PER_PAGE, sortedShortlist.length)} of {sortedShortlist.length} Squads</div>
                                </div>
                            )}
                        </div>
                    </Section>
                )}

                {/* ═══ INNOVATION TRACKS (Enhanced) ═══ */}
                <Section className="mb-24 sm:mb-32">
                    <div className="mb-8 sm:mb-12">
                        <h2 className="text-3xl sm:text-5xl md:text-6xl font-heading font-black tracking-tight text-white uppercase mb-3 sm:mb-4">
                            Innovation <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Tracks</span>
                        </h2>
                        <p className="text-white/40 max-w-lg text-sm sm:text-base leading-relaxed">Choose your battlefield. Six specialized domains, each with unique prize incentives.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {tracks.map((track, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.06, duration: 0.4, ease: EASE_OUT }}
                                onClick={() => setExpandedTrack(expandedTrack === i ? null : i)}
                                onMouseEnter={() => setActiveTrack(i)}
                                onMouseLeave={() => setActiveTrack(null)}
                                className="group relative bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-6 sm:p-8 transition-all duration-300 active:scale-[0.98] cursor-pointer min-h-[200px] sm:min-h-[240px] flex flex-col overflow-hidden"
                            >
                                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${track.gradient} blur-3xl`} style={{ opacity: activeTrack === i ? 0.04 : 0 }} />
                                <div className="absolute -right-2 -bottom-6 text-[80px] sm:text-[100px] font-heading font-black text-white/[0.02] group-hover:text-white/[0.05] leading-none pointer-events-none transition-colors duration-500">0{i + 1}</div>
                                <div className="flex justify-between items-center mb-auto relative z-10">
                                    <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${track.gradient} flex items-center justify-center group-hover:scale-105 transition-transform duration-300 shadow-lg`}>
                                        <track.icon className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white" />
                                    </div>
                                    <span className="px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-full text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-white/40">{track.type}</span>
                                </div>
                                <div className="relative z-10 mt-auto pt-6">
                                    <h3 className="text-lg sm:text-xl font-heading font-bold text-white/90 group-hover:text-white mb-1.5 leading-tight transition-colors">{track.title}</h3>
                                    <p className="text-xs sm:text-sm text-white/30 group-hover:text-white/50 transition-colors">{track.problem}</p>
                                </div>
                                {/* Expanded details */}
                                <AnimatePresence>
                                    {expandedTrack === i && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: EASE_OUT }}
                                            className="overflow-hidden relative z-10"
                                        >
                                            <p className="text-sm text-white/40 mt-4 pt-4 border-t border-white/[0.06] leading-relaxed">{track.details}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </div>
                </Section>

                {/* ═══ PRIZES (Interactive Reveal) ═══ */}
                <Section className="mb-24 sm:mb-32">
                    <div className="relative rounded-3xl overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-700" />
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-40" />
                        <div className="relative z-10 p-8 sm:p-12 md:p-16">
                            <div className="text-center mb-10">
                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60 mb-3 flex items-center justify-center gap-2"><Award className="w-4 h-4" /> Prize Pool</div>
                                <h2 className="text-6xl sm:text-7xl md:text-8xl font-heading font-black tracking-tighter leading-none text-white mb-3">₹2.05L</h2>
                                <p className="text-base sm:text-lg text-white/70 max-w-md mx-auto">Total verified prize pool for the strongest solutions.</p>
                            </div>

                            {/* Podium */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-2xl mx-auto mb-8">
                                <PrizeRevealCard place="1st Place" amount="₹1 Lakh" accent="from-amber-400 to-yellow-300" delay={0} medalClass="text-amber-300" />
                                <PrizeRevealCard place="2nd Place" amount="₹50K" accent="from-cyan-400 to-blue-500" delay={0.15} medalClass="text-slate-200" />
                                <PrizeRevealCard place="3rd Place" amount="₹25K" accent="from-amber-600 to-amber-400" delay={0.3} medalClass="text-orange-400" />
                            </div>

                            {/* Theme prize banner */}
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.5, duration: 0.4, ease: EASE_OUT }}
                                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 sm:p-5 text-center max-w-lg mx-auto"
                            >
                                <div className="flex items-center justify-center gap-2 text-amber-300 text-sm sm:text-base font-bold">
                                    <Trophy className="w-4 h-4" />
                                    Winner of each theme will receive ₹5,000
                                </div>
                                <div className="text-white/50 text-xs mt-1">6 tracks × ₹5,000 = ₹30,000 in track-specific prizes</div>
                            </motion.div>
                        </div>
                    </div>
                </Section>

                {/* ═══ THE ARENA (Interactive Transport) ═══ */}
                <Section className="mb-24 sm:mb-32">
                    <div className="mb-8 sm:mb-12">
                        <h2 className="text-3xl sm:text-5xl md:text-6xl font-heading font-black tracking-tight text-white uppercase mb-3">
                            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Arena</span>
                        </h2>
                        <p className="text-white/40 max-w-lg text-sm sm:text-base leading-relaxed">Your battlefield awaits at Sharda University. Here&apos;s how to get there.</p>
                    </div>

                    {/* Venue features */}
                    <div className="grid lg:grid-cols-2 gap-3 sm:gap-4 mb-6">
                        {[
                            { icon: Cpu, title: "Dedicated Center", desc: "A massive, purpose-built space designed purely for 24-hr productivity — high-speed network, uninterrupted power.", gradient: "from-violet-500 to-indigo-500" },
                            { icon: Coffee, title: "Complete Provisioning", desc: "3-time meals, late-night caffeine stations, separate resting lounges, and medical teams on site.", gradient: "from-emerald-500 to-teal-500" },
                            { icon: Wifi, title: "Tech Infrastructure", desc: "Enterprise-grade Wi-Fi, dedicated power outlets, and ergonomic workstations for every team.", gradient: "from-blue-500 to-cyan-500" },
                            { icon: MapPin, title: "Easy Access", desc: "Direct Metro (Aqua Line) to Pari Chowk/KP-II. Smooth highway connections from IGI Airport.", gradient: "from-rose-500 to-pink-500" },
                        ].map((feature, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.4, ease: EASE_OUT }} className="group bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-6 sm:p-8 transition-all duration-300">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300`}><feature.icon className="w-5 h-5 text-white" /></div>
                                <h3 className="text-lg sm:text-xl font-heading font-bold text-white mb-2">{feature.title}</h3>
                                <p className="text-sm text-white/40 group-hover:text-white/60 transition-colors leading-relaxed">{feature.desc}</p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Venue Carousel */}
                    <div className="mt-8"><VenueCarousel /></div>
                </Section>

                {/* ═══ EVENT LOGISTICS BANNER ═══ */}
                <Section className="mb-24 sm:mb-32">
                    <div className="relative rounded-2xl overflow-hidden border border-amber-500/20 bg-amber-500/[0.04]">
                        <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.08),transparent_60%)] pointer-events-none" />
                        <div className="p-6 sm:p-8 md:p-10">
                            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-6">
                                <Clock className="w-4 h-4" /> Day-of Logistics · 10th April 2026
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                                {[
                                    { icon: DoorOpen, time: "8:30 AM", label: "Reporting Time", note: "All teams must report", color: "#FF6B00" },
                                    { icon: Flag, time: "10:30 AM", label: "Hackathon Starts", note: "10th April, sharp", color: "#00FF41" },
                                    { icon: Clock, time: "10:30 AM", label: "Hackathon Ends", note: "11th April", color: "#FF4136" },
                                    { icon: PartyPopper, time: "2:00 PM", label: "Closing Ceremony", note: "Evaluation + Felicitation", color: "#FFD700" }
                                ].map((item, i) => (
                                    <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.3, ease: EASE_OUT }} className="text-center sm:text-left">
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 mx-auto sm:mx-0" style={{ background: `${item.color}15`, border: `1px solid ${item.color}30` }}>
                                            <item.icon className="w-5 h-5" style={{ color: item.color }} />
                                        </div>
                                        <div className="text-2xl sm:text-3xl font-heading font-black text-white leading-none mb-1">{item.time}</div>
                                        <div className="text-xs font-bold text-white/60 uppercase tracking-wider">{item.label}</div>
                                        <div className="text-[10px] text-white/30 mt-0.5">{item.note}</div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Section>

                {/* ═══ EVENT TIMELINE (Vertical) ═══ */}
                <Section className="mb-24 sm:mb-32">
                    <div className="mb-10 sm:mb-14">
                        <h2 className="text-3xl sm:text-5xl font-heading font-black tracking-tight text-white uppercase mb-3">
                            Event <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Timeline</span>
                        </h2>
                        <p className="text-white/40 text-sm sm:text-base">The journey from idea to innovation.</p>
                    </div>
                    <div className="relative">
                        {/* Vertical connecting line */}
                        <div className="absolute left-6 sm:left-8 top-0 bottom-0 w-[2px] bg-white/[0.06]" />
                        <div className="space-y-0">
                            {timelineEvents.map((t, i) => {
                                const isPast = t.timestamp < (currentDate?.getTime() || 0)
                                const isCurrent = !isPast && (i === 0 || timelineEvents[i - 1].timestamp < (currentDate?.getTime() || 0))
                                return (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -16 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: i * 0.08, duration: 0.4, ease: EASE_OUT }}
                                        className="relative flex items-start gap-6 sm:gap-8 group"
                                    >
                                        {/* Timeline node */}
                                        <div className="relative z-10 flex flex-col items-center shrink-0 pt-6">
                                            <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl border-2 transition-all duration-300 ${isPast ? 'bg-indigo-500/10 border-indigo-500/40' : isCurrent ? 'bg-amber-500/10 border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'bg-white/[0.03] border-white/[0.08]'
                                                }`}>
                                                <t.icon className={`w-5 h-5 sm:w-7 sm:h-7 ${isPast ? "text-indigo-300" : isCurrent ? "text-amber-300" : "text-white/40"}`} />
                                            </div>
                                            {/* Filled line segment for past */}
                                            {isPast && i < timelineEvents.length - 1 && (
                                                <div className="absolute top-[72px] sm:top-[88px] left-1/2 -translate-x-1/2 w-[2px] h-[calc(100%)] bg-indigo-500/30" />
                                            )}
                                        </div>
                                        {/* Content card */}
                                        <div className={`flex-1 py-6 border-b border-white/[0.04] ${isCurrent ? '' : ''
                                            }`}>
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md ${isPast ? 'bg-indigo-500/10 text-indigo-400' : isCurrent ? 'bg-amber-500/10 text-amber-400 animate-pulse' : 'bg-white/[0.04] text-white/30'
                                                    }`}>
                                                    {isPast ? 'Completed' : isCurrent ? 'Current' : 'Upcoming'}
                                                </span>
                                                <span className="text-[10px] sm:text-xs text-white/30 font-medium tracking-wider">{t.date}</span>
                                            </div>
                                            <h3 className={`text-lg sm:text-xl font-heading font-bold leading-tight mb-1.5 ${isPast ? 'text-white/40' : isCurrent ? 'text-white' : 'text-white/60'
                                                }`}>{t.title}</h3>
                                            <p className="text-sm text-white/30">{t.desc}</p>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </div>
                </Section>



                {/* ═══ FAQ ═══ */}
                <Section className="mb-24 sm:mb-32">
                    <div className="mb-8 sm:mb-12">
                        <h2 className="text-3xl sm:text-4xl font-heading font-black tracking-tight text-white uppercase flex items-center gap-3">
                            Frequently <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Asked</span>
                        </h2>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                        {faqs.map((faq, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04, duration: 0.3, ease: EASE_OUT }}>
                                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full text-left bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] rounded-xl p-5 sm:p-6 transition-all duration-200 active:scale-[0.99] group">
                                    <div className="flex items-start justify-between gap-4">
                                        <span className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors leading-relaxed">{faq.q}</span>
                                        <ChevronDown className={`w-4 h-4 text-white/30 shrink-0 mt-0.5 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                                    </div>
                                    <AnimatePresence>
                                        {openFaq === i && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE_OUT }} className="overflow-hidden">
                                                <p className="text-sm text-white/40 mt-4 pt-4 border-t border-white/[0.06] leading-relaxed">{faq.a}</p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </Section>

                {/* ═══ CONTACT INFO ═══ */}
                <Section className="mb-24 sm:mb-32">
                    <h2 className="text-3xl sm:text-4xl font-heading font-black tracking-tight text-white uppercase mb-8 sm:mb-10">
                        Contact <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Info</span>
                    </h2>
                    <div className="text-sm text-white/50 mb-8 leading-relaxed max-w-sm">Have questions about the upcoming Grand Finale? Feel free to reach out to our organizing team.</div>

                    <div className="space-y-0">
                        {[
                            { name: "Mohammed Sameer", role: "Student Overall Organizer", p: "8603829005" },
                            { name: "Dr. Sandeep Gupta", role: "Faculty Coordinator", p: "9717577497" },
                            { name: "Dr. Ambuj Agarwal", role: "Faculty Coordinator", p: "9412246459" },
                            { name: "Dr. Gaurav Raj", role: "Faculty Coordinator", p: "8587010020" },
                            { name: "Ms. Harminder Kaur", role: "Faculty Coordinator", p: "9034664521" }
                        ].map((c, i) => (
                            <div key={i} className="flex justify-between items-center py-4 border-b border-white/[0.06] last:border-0">
                                <div>
                                    <span className="font-semibold text-sm text-white/80 block">{c.name}</span>
                                    <span className="text-[10px] text-white/30 uppercase tracking-widest font-medium">{c.role}</span>
                                </div>
                                {revealedContacts.includes(i) ? (
                                    <a href={`tel:+91${c.p}`} className="font-mono text-sm text-indigo-400 hover:text-indigo-300 transition-colors">+91 {c.p}</a>
                                ) : (
                                    <button onClick={() => setRevealedContacts(p => [...p, i])} className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-white/30 hover:text-indigo-400 transition-colors active:scale-[0.97]">Reveal</button>
                                )}
                            </div>
                        ))}
                    </div>
                </Section>

                {/* ═══ SPONSORS ═══ */}
                <Section className="mb-16">
                    <div className="text-center mb-10">
                        <h2 className="text-xl sm:text-2xl font-heading font-bold tracking-widest text-white/20 uppercase">Backed By</h2>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16">
                        <div className="hover:scale-105 transition-transform duration-300 flex flex-col items-center gap-3">
                            <img src="/images/chings-secret-logo.jpg" alt="Chings" className="h-16 sm:h-20 w-auto rounded-lg shadow-lg border border-white/10 p-1 bg-white" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--sig-amber)] bg-[var(--sig-amber-dim)] px-3 py-1 rounded-full border border-[var(--sig-amber)]">Title Partner</span>
                        </div>
                        <div className="hover:scale-105 transition-transform duration-300 flex flex-col items-center gap-3">
                            <img src="/images/prismatix-logo.jpg" alt="Prismatix" className="h-16 sm:h-20 w-auto rounded-lg shadow-lg border border-white/10 p-1 bg-white" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-500/30">Associate Partner</span>
                        </div>
                        <div className="hover:scale-105 transition-transform duration-300 flex flex-col items-center gap-3">
                            <img src="/images/sponsors/studyin.jpg" alt="StudyIn" className="h-16 sm:h-20 w-auto rounded-lg shadow-lg border border-white/10 p-2 sm:p-3 bg-white" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400 bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/30">Partner</span>
                        </div>
                        <div className="hover:scale-105 transition-transform duration-300 flex flex-col items-center gap-3">
                            <img src="/images/sponsors/carrymore.jpg" alt="Carrymore Hoists" className="h-16 sm:h-20 w-auto rounded-lg shadow-lg border border-white/10 p-2 sm:p-3 bg-white" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400 bg-sky-500/20 px-3 py-1 rounded-full border border-sky-500/30">Partner</span>
                        </div>
                    </div>
                </Section>
            </div>

            <Footer />

            {/* ═══ GLOBAL KEYFRAMES ═══ */}
            <style jsx global>{`
                @keyframes drift {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    25% { transform: translate(30px, -20px) scale(1.05); }
                    50% { transform: translate(-20px, 15px) scale(0.95); }
                    75% { transform: translate(15px, 25px) scale(1.02); }
                }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    )
}
