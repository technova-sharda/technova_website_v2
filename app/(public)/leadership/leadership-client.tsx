'use client'

import { useState, useEffect, useMemo } from "react"
import { Mail, Linkedin, Github, User, Award, TrendingUp, Users, Target, BookOpen, Star, Sparkles, Phone } from "lucide-react"
import Image from "next/image"
import { getMemberPhotoPath } from "@/lib/constants/team-photos"
import { AnimatedBackground } from "@/components/ui/animated-background"
import Link from "next/link"
import { Home, ChevronRight } from "lucide-react"
import { motion } from "framer-motion"
import { TeamPhoto } from "@/components/ui/team-photo"

const MENTORS = [
    {
        name: "Prof. (Dr.) Sibaram Khara",
        role: "Vice Chancellor",
        message: "It is my immense pleasure to welcome all the first year students to the Sharda University. Vision of Sharda University is to transform students through Outcome-Based Education, driven by research, innovations, modern tools and high-end placements. Sharda University has adopted National Education Policy for the holistic development of students and society together. Sharda University is committed towards academic excellence to provide high-quality education with the help of highly qualified, experienced and focused teaching faculty members. Sharda University adopts modern ICT tools and state-of-the-art infrastructure for imparting quality classroom and laboratory exposure. I wish you all a successful and meaningful period during your education with Department of Computer Science & Engineering, School of Computing Science & Engineering, Sharda University.",
        imagePath: "/assets/leadership/vc.png"
    },
    {
        name: "Prof. (Dr.) Parma Nand",
        role: "Pro-Vice Chancellor",
        message: "The goal of school, guided by the Sharda University vision, is to provide transformational education that produces a skilled workforce of professionals including researchers and innovators of tomorrow with intellectual and technological resources. Our commitment and dedication is to focus on experiential, cooperative and project-based learning that allows our students to continue to adapt, grow and succeed in solving real-world problems. The school provides funding to innovative ideas of the students to develop products, patents and startups. The school has collaborated with IIA, IEA, Greater Noida Authority and other industries to ensure benchmarking of programs and activities. The school thrives to establish a partnership with industries, government organizations & academia, and become a collaborative community of faculties, students, staff and alumni to fulfil societal needs with professional ethics.",
        quote: "By The Students, For The Students and With The Students",
        imagePath: "/assets/leadership/pvc.png"
    },
    {
        name: "Prof. (Dr.) Geetha",
        role: "Dean, SSCE",
        message: "The Technical Society at Sharda School of Computing Science & Engineering is a vibrant platform where innovation meets opportunity. It brings together talented students, encouraging them to explore new technologies, work on real-world projects, and take the lead in initiatives that drive meaningful change. Here, learning goes far beyond the classroom. Students design, execute, and lead projects that challenge their skills and creativity while building teamwork, communication, and problem-solving abilities. Through hackathons, workshops, industrial visits, and collaborations with global industry leaders, members gain exposure to the latest trends and hands-on experience that prepares them for the future. Many have gone on to win national and international competitions, secure prestigious internships, and even launch startups. The Technical Society is a community that transforms potential into achievement and passion into lasting impact.",
        imagePath: "/assets/leadership/dean.png"
    },
    {
        name: "Prof. (Dr.) Jayant Sekhar",
        role: "HoD, Dept. of CSE",
        message: "Computer Science & Engineering is one of the most vibrant department of Sharda University with varieties of specialized programs in Artificial Intelligence & Machine Learning, Cyber Security, Internet of Things, Data Science and Business Intelligence. To have holistic development of students of distinct programs of computer science and to grow the innovative culture among the students, Students Activity Clubs are functional. These clubs are headed by the team of students and they are performing in different dimensions of technology under the guidance of specialized faculty members. Several national and international students are contributing to develop themselves and other peers to excel among the multidisciplinary aspects. The club activities strengthens placements, startups, national/international competitions and research outcomes. We are proud to have high aimed and energetic students club performing exceptionally well since last five years.",
        quote: "Best Wishes to All My Students",
        imagePath: "/assets/leadership/jayant_sekhar.jpg"
    },
    {
        name: "Dr. Rani Astya",
        role: "Faculty Coordinator",
        message: "The Technical Society's philosophy is to foster the all-round development of students. We aim to build an environment of collaborative growth that uplifts the whole community. Each club under the Society hosts events and activities year-round to uncover and nurture the hidden potential of every student. The objective of the students club is to sensitize the technological updating, by enabling the students to participate in various activities like, code-a-thon, hackathons, peer-to-peer learning, entrepreneurial activities, programming challenges, app development, certifications, industrial challenges and many other activities. The students club strengthens the presentation, verbal and communication skills, leadership qualities, confidence and utmost the technical skills among the students.",
        quote: "Nurturing Technical & Interpersonal Skills",
        imagePath: "/assets/leadership/coordinator.png"
    }
]


const TEAM_METADATA: Record<string, any> = {
    "Shivangi Joshi": {
        bio: "Leading the vision and strategy of Technova.",
        color: "text-[var(--sig-amber)]",
        bg: "bg-[var(--sig-amber)]/10",
        icon: Award,
        imagePath: null
    },
    "Saquib Shamshi": {
        bio: "Driving operational excellence and team coordination.",
        color: "text-[var(--sig-indigo)]",
        bg: "bg-[var(--sig-indigo)]/10",
        icon: TrendingUp,
        imagePath: null
    },
    "Lavanya Bharadwaj": {
        bio: "Managing administrative efficiency and documentation.",
        color: "text-[var(--sig-green)]",
        bg: "bg-[var(--sig-green)]/10",
        icon: Target,
        imagePath: null
    },
    "Salwa Rashid": {
        bio: "Assisting in administration and team coordination.",
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        icon: Users,
        imagePath: null
    },
    "Aishwarya Srivastava": {
        bio: "Managing external communications and brand image.",
        color: "text-pink-500",
        bg: "bg-pink-500/10",
        icon: Users,
        imagePath: null
    },
    "Tanvi Puri": {
        bio: "Assisting in outreach and media relations.",
        color: "text-pink-500",
        bg: "bg-pink-500/10",
        icon: Users,
        imagePath: null
    },
    "Sanzit Kumar Shil": {
        bio: "Curating creative content and managing editorial strategy.",
        color: "text-[var(--sig-amber)]",
        bg: "bg-[var(--sig-amber)]/10",
        icon: BookOpen,
        imagePath: null
    },
    "Dushyant Prajapati": {
        bio: "Leading technical developments and innovation.",
        color: "text-[var(--sig-indigo)]",
        bg: "bg-[var(--sig-indigo)]/10",
        icon: Sparkles,
        imagePath: "/assets/team/technova_main/dushyant_prajapati.jpg"
    }
}

// Cards pinned to a fixed slot (1-based) on this page, regardless of role sorting
const PINNED_POSITIONS: Record<string, number> = {}

// Cards placed right after someone with a given role (e.g. after the Joint Secretary)
const PLACE_AFTER_ROLE: Record<string, string> = {
    "Dushyant Prajapati": "joint secretary",
}

function applyPinnedPositions<T extends { name: string }>(members: T[]): T[] {
    const afterRole = members.filter(m => m.name in PLACE_AFTER_ROLE)
    members = members.filter(m => !(m.name in PLACE_AFTER_ROLE))
    for (const m of afterRole) {
        const role = PLACE_AFTER_ROLE[m.name]
        const anchor = members.findIndex(x => String((x as any).role ?? "").toLowerCase() === role)
        members.splice(anchor === -1 ? members.length : anchor + 1, 0, m)
    }
    const result = members.filter(m => !(m.name in PINNED_POSITIONS))
    members
        .filter(m => m.name in PINNED_POSITIONS)
        .sort((a, b) => PINNED_POSITIONS[a.name] - PINNED_POSITIONS[b.name])
        .forEach(m => result.splice(Math.min(PINNED_POSITIONS[m.name] - 1, result.length), 0, m))
    return result
}

const ensureAbsoluteUrl = (url: string) => {
    if (!url) return "#"
    if (url.startsWith("http://") || url.startsWith("https://")) return url
    return `https://${url}`
}

export function LeadershipClient({ members }: { members: any[] }) {
    const [activeIndex, setActiveIndex] = useState(0)

    const teamMembers = useMemo(() => applyPinnedPositions(members.map((m: any) => {
        const meta = TEAM_METADATA[m.name] || {
            bio: "Core Team Member",
            color: "text-[var(--sig-amber)]",
            bg: "bg-[var(--sig-amber)]/10",
            icon: Users,
            imagePath: null
        }
        return {
            ...m,
            ...meta,
            imagePath: meta.imagePath || getMemberPhotoPath(m.name)
        }
    })), [members])

    useEffect(() => {
        // Mentors Carousel Timer
        const timer = setInterval(() => {
            setActiveIndex((current) => (current + 1) % MENTORS.length)
        }, 5000)
        return () => clearInterval(timer)
    }, [])

    return (
        <div className="min-h-screen bg-[var(--sig-bg)] text-[var(--sig-text)] selection:bg-[var(--sig-amber)] selection:text-black">
            <AnimatedBackground />

            {/* HERO */}
            <section className="relative pt-32 pb-20 overflow-hidden">
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
                        <span className="text-[var(--sig-amber)] font-medium">Leadership</span>
                    </motion.nav>

                    <div className="text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div className="inline-block mb-6 px-5 py-2 rounded-full border border-[var(--sig-amber)]/30 bg-[var(--sig-amber)]/10 backdrop-blur-xl shadow-[0_0_30px_var(--sig-amber-dim)]">
                                <span className="text-[var(--sig-amber)] font-medium text-sm tracking-wider uppercase font-mono">The Council & Mentors</span>
                            </div>

                            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                                Our Leadership
                            </h1>

                            <p className="text-xl text-[var(--sig-text-secondary)] max-w-2xl mx-auto leading-relaxed">
                                Guided by experience, driven by innovation.
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* MENTORS CAROUSEL */}
            <section className="py-14 md:py-24 bg-[var(--sig-surface)]/50 border-y border-[var(--sig-border)] relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
                <div className="container mx-auto px-4 relative z-10">
                    <h2 className="text-4xl md:text-5xl font-bold mb-10 md:mb-20 text-center flex items-center justify-center gap-4">
                        <BookOpen className="w-12 h-12 text-[var(--sig-amber)]" />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-amber-100 to-white">
                            From The Administration
                        </span>
                    </h2>

                    <div className="max-w-7xl mx-auto">
                        {/* Slides share one grid cell, so the height follows the tallest bio at any width (a fixed 1350px left big gaps on wider phones). */}
                        <div className="relative grid md:min-h-[750px]">
                            {MENTORS.map((mentor, index) => (
                                <div
                                    key={mentor.name}
                                    className={`[grid-area:1/1] transition-all duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] transform ${index === activeIndex
                                        ? "opacity-100 translate-x-0 scale-100 blur-0 z-20"
                                        : "opacity-0 translate-x-24 scale-90 blur-xl z-10 pointer-events-none"
                                        }`}
                                >
                                    <div className="h-full bg-[var(--sig-surface)]/60 backdrop-blur-3xl p-6 md:p-16 rounded-[3rem] border border-[var(--sig-border)] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                                        {/* Background Effects */}
                                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--sig-amber)]/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
                                        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[var(--sig-indigo)]/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2" />

                                        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-20 relative z-10 h-full">
                                            {/* Image Section */}
                                            <div className="relative shrink-0 group-hover:scale-[1.02] transition-transform duration-700 ease-[var(--ease-out)]">
                                                <div className="absolute inset-0 bg-gradient-to-br from-[var(--sig-amber)] to-[var(--sig-indigo)] blur-2xl opacity-30 rounded-[2.5rem]" />
                                                <div className="w-64 h-64 md:w-80 md:h-80 bg-[var(--sig-surface)] rounded-[2.5rem] overflow-hidden border border-[var(--sig-border-hover)] shadow-2xl relative z-10">
                                                    <TeamPhoto src={mentor.imagePath} name={mentor.name} sizes="(min-width: 768px) 320px, 256px" className="object-cover object-top" priority={index === 0} />
                                                </div>

                                                {/* Decorative */}
                                                <div className="absolute -bottom-6 -right-6 bg-[var(--sig-surface)]/90 backdrop-blur-md border border-[var(--sig-border)] p-4 rounded-2xl shadow-xl hidden md:block">
                                                    <Sparkles className="w-8 h-8 text-[var(--sig-amber)]" />
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="text-center md:text-left flex-1 flex flex-col justify-center">
                                                <div className="mb-8">
                                                    <h3 className="text-3xl md:text-5xl font-bold mb-4 text-white tracking-tight leading-tight">
                                                        {mentor.name}
                                                    </h3>
                                                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-[var(--sig-amber)]/10 border border-[var(--sig-amber)]/20 text-[var(--sig-amber)] font-bold text-sm md:text-base uppercase tracking-widest font-mono">
                                                        <Award className="w-4 h-4" />
                                                        {mentor.role}
                                                    </div>
                                                </div>

                                                <div className="relative group/quote">
                                                    <span className="hidden md:block absolute -top-10 -left-6 text-8xl text-white/5 font-serif group-hover/quote:text-[var(--sig-amber)]/10 transition-colors">&ldquo;</span>
                                                    <div className="text-gray-200 relative z-10">
                                                        <p className="text-base md:text-xl leading-relaxed font-light mb-6">
                                                            {mentor.message}
                                                        </p>

                                                        {/* @ts-ignore */}
                                                        {mentor.quote && (
                                                            <div className="border-l-4 border-[var(--sig-amber)] pl-4 py-1 mt-6">
                                                                <p className="text-xl md:text-2xl font-bold text-amber-100 italic leading-relaxed">
                                                                    {/* @ts-ignore */}
                                                                    &ldquo;{mentor.quote}&rdquo;
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="hidden md:block absolute -bottom-16 -right-6 text-8xl text-white/5 font-serif rotate-180 group-hover/quote:text-[var(--sig-amber)]/10 transition-colors">&ldquo;</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Navigation Dots — amber active */}
                        <div className="flex justify-center gap-4 mt-8 md:mt-16 relative z-20">
                            {MENTORS.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveIndex(idx)}
                                    className={`h-1.5 rounded-full transition-all duration-500 ${idx === activeIndex
                                        ? "bg-gradient-to-r from-[var(--sig-amber)] to-amber-400 w-16 opacity-100 shadow-[0_0_15px_var(--sig-amber-dim)]"
                                        : "bg-white/20 w-3 hover:bg-white/40"
                                        }`}
                                    aria-label={`Go to slide ${idx + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* TEAM GRID */}
            <section className="py-12 pb-24 relative z-10">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl font-bold mb-12 text-center flex items-center justify-center gap-3">
                        <Star className="w-8 h-8 text-[var(--sig-amber)]" />
                        Executive Council
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {teamMembers.map((member) => (
                            <div key={member.name} className="group sig-card rounded-3xl p-8 overflow-hidden relative shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_40px_var(--sig-amber-dim)]">
                                <div className="flex justify-between items-start mb-6 relative z-10">
                                    <div className={`w-32 h-32 ${member.bg} ${member.color} backdrop-blur-xl rounded-2xl flex items-center justify-center text-current group-hover:scale-110 transition-transform duration-500 overflow-hidden relative border border-[var(--sig-border)]`}>
                                        {/* @ts-ignore */}
                                        {member.imagePath ? (
                                            <TeamPhoto src={member.imagePath} name={member.name} sizes="128px" />
                                        ) : (
                                            <member.icon className="w-12 h-12" />
                                        )}
                                    </div>
                                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        {/* @ts-ignore */}
                                        {member.linkedin_id && (
                                            <a
                                                href={ensureAbsoluteUrl(member.linkedin_id)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="spring-btn p-2.5 bg-[var(--sig-surface)] rounded-xl hover:bg-[var(--sig-amber)]/20 hover:text-[var(--sig-amber)] transition-all duration-200 border border-[var(--sig-border)]"
                                                title="LinkedIn"
                                            >
                                                <Linkedin className="w-5 h-5" />
                                            </a>
                                        )}
                                        <a
                                            // @ts-ignore
                                            href={`mailto:${member.email}`}
                                            className="spring-btn p-2.5 bg-[var(--sig-surface)] rounded-xl hover:bg-red-500/20 hover:text-red-400 transition-all duration-200 border border-[var(--sig-border)]"
                                            title="Email"
                                        >
                                            <Mail className="w-5 h-5" />
                                        </a>
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold mb-1 relative z-10">{member.name}</h3>
                                <p className={`text-sm font-bold uppercase tracking-wider mb-4 ${member.color} relative z-10 font-mono`}>
                                    {member.role}
                                </p>

                                <p className="text-[var(--sig-text-secondary)] text-sm leading-relaxed relative z-10">
                                    {member.bio}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}
