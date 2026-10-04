'use client'

import Link from "next/link"
import { motion, useScroll, useTransform, useSpring, useMotionValue, useMotionTemplate, AnimatePresence } from "framer-motion"
import { ArrowRight, Terminal, Globe, Users, Target, Zap, ChevronRight, Mail, MapPin, Instagram, Linkedin, Code2, Database, Cpu, Rocket, Trophy, BookOpen, ExternalLink } from "lucide-react"
import { useRef, useState, useEffect, useCallback } from "react"
import { ClubsCarousel } from "@/components/ui/clubs-carousel"
import { AnimatedBackground } from "@/components/ui/animated-background"
import { Footer } from "@/components/layout/footer"

// ========================================================
// PARTICLE CONSTELLATION — Interactive Canvas Background
// ========================================================
function ParticleConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const particlesRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number;
    baseX: number; baseY: number; size: number; alpha: number;
  }>>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Initialize particles
    const PARTICLE_COUNT = 80
    const particles: typeof particlesRef.current = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = Math.random() * canvas.width
      const y = Math.random() * canvas.height
      particles.push({
        x, y, baseX: x, baseY: y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
      })
    }
    particlesRef.current = particles

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', handleMouseMove)

    const CONNECTION_DISTANCE = 150
    const MOUSE_RADIUS = 200

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particles) {
        // Drift gently
        p.x += p.vx
        p.y += p.vy

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        // Mouse attraction
        const dx = mouseRef.current.x - p.x
        const dy = mouseRef.current.y - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < MOUSE_RADIUS) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS
          p.vx += dx * force * 0.0008
          p.vy += dy * force * 0.0008
        }

        // Damping
        p.vx *= 0.99
        p.vy *= 0.99

        // Draw particle
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(245, 166, 35, ${p.alpha})`
        ctx.fill()
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.15
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(245, 166, 35, ${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      // Mouse glow
      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      if (mx > 0 && my > 0) {
        const gradient = ctx.createRadialGradient(mx, my, 0, mx, my, 180)
        gradient.addColorStop(0, 'rgba(245, 166, 35, 0.06)')
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none"
      style={{ opacity: 0.7 }}
    />
  )
}

// ========================================================
// TEXT ROTATE — Cycles through descriptors
// ========================================================
function TextCycle({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % words.length)
    }, 2800)
    return () => clearInterval(interval)
  }, [words.length])

  return (
    <span className="inline-block relative overflow-hidden h-[1.2em] align-bottom" style={{ minWidth: '200px' }}>
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ y: '100%', opacity: 0, filter: 'blur(4px)' }}
          animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-100%', opacity: 0, filter: 'blur(4px)' }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="absolute left-0 whitespace-nowrap text-[var(--sig-amber)]"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

// ========================================================
// ANIMATED COUNTER — Counts up on scroll
// ========================================================
function AnimatedStat({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)
          let start = 0
          const step = value / 40
          const timer = setInterval(() => {
            start += step
            if (start >= value) {
              setCount(value)
              clearInterval(timer)
            } else {
              setCount(Math.floor(start))
            }
          }, 30)
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, hasAnimated])

  return (
    <div ref={ref} className="flex flex-col">
      <span className="text-4xl md:text-5xl font-heading font-black text-[var(--sig-amber)] tabular-nums">
        {count}{suffix}
      </span>
      <span className="text-xs font-semibold text-[var(--sig-text-secondary)] uppercase tracking-[0.2em] mt-2">
        {label}
      </span>
    </div>
  )
}

// ========================================================
// BENTO CARD — with mouse-tracking gradient
// ========================================================
function BentoCard({
  icon: Icon,
  title,
  description,
  tags,
  className = '',
  href,
}: {
  icon: React.ElementType
  title: string
  description: string
  tags?: string[]
  className?: string
  href?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    mouseX.set(e.clientX - rect.left)
    mouseY.set(e.clientY - rect.top)
  }, [mouseX, mouseY])

  const background = useMotionTemplate`radial-gradient(
    300px circle at ${mouseX}px ${mouseY}px,
    rgba(245, 166, 35, 0.06),
    transparent 80%
  )`

  const inner = (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`sig-card rounded-lg p-8 flex flex-col justify-between min-h-[240px] relative overflow-hidden group ${className}`}
      style={{ background }}
      whileHover={{ borderColor: 'var(--sig-border-hover)' }}
    >
      {/* Static background as fallback */}
      <div className="absolute inset-0 bg-[var(--sig-surface)] -z-10" />

      <div>
        <Icon className="w-8 h-8 mb-5 text-[var(--sig-amber)] group-hover:scale-110 transition-transform duration-200" style={{ transitionTimingFunction: 'var(--ease-out)' }} />
        <h4 className="text-xl font-heading font-bold text-[var(--sig-text)] mb-3">{title}</h4>
        <p className="text-sm text-[var(--sig-text-secondary)] leading-relaxed font-medium">{description}</p>
      </div>
      {tags && (
        <div className="flex gap-2 mt-6 flex-wrap">
          {tags.map(tag => (
            <span key={tag} className="px-2.5 py-1 bg-white/5 border border-[var(--sig-border)] text-[10px] font-bold uppercase tracking-wider text-[var(--sig-text-secondary)] rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )

  if (href) {
    return <Link href={href} className="block">{inner}</Link>
  }
  return inner
}


// ========================================================
// MAIN PAGE
// ========================================================
export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] })
  const smoothY = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 })

  // Subtle easings for custom curves
  const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen bg-[var(--sig-bg)] text-[var(--sig-text)] selection:bg-[var(--sig-amber)] selection:text-black overflow-hidden font-sans relative">

      {/* Global animated background */}
      <AnimatedBackground />

      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        {/* Particle constellation */}
        <ParticleConstellation />

        {/* Grain overlay */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none opacity-[0.03] animate-grain"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '128px 128px',
          }}
        />

        {/* Gradient veil */}
        <div className="absolute bottom-0 left-0 right-0 h-[40vh] bg-gradient-to-t from-[var(--sig-bg)] to-transparent z-[2] pointer-events-none" />

        <div className="container mx-auto px-6 lg:px-16 relative z-10 flex flex-col justify-center h-full mt-12">
          <div className="max-w-5xl">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            >
              <div className="inline-flex items-center gap-2.5 border border-[var(--sig-border)] bg-[var(--sig-surface)] px-4 py-2 rounded-full mb-10">
                <div className="w-2 h-2 rounded-full bg-[var(--sig-green)] animate-live-pulse" />
                <span className="text-[var(--sig-text-secondary)] text-xs font-semibold tracking-[0.15em] uppercase">
                  Student-Led Technical Society • Sharda University
                </span>
              </div>
            </motion.div>

            {/* Main Heading — TECHNOVA single line with character stagger */}
            <motion.h1
              className="text-[clamp(3.5rem,14vw,10rem)] font-heading font-extrabold tracking-[-0.05em] leading-[0.85] uppercase mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.1, delay: 0.1 }}
            >
              {'TECHNOVA'.split('').map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 60, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1], delay: 0.15 + i * 0.04 }}
                  className={`inline-block ${i === 7 ? 'text-[var(--sig-amber)]' : 'text-[var(--sig-text)]'}`}
                  style={{
                    textShadow: i === 7 ? '0 0 40px rgba(245, 166, 35, 0.3)' : 'none',
                  }}
                >
                  {char}
                </motion.span>
              ))}
              <motion.span
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.55 }}
                className="text-[var(--sig-amber)] inline-block"
              >.</motion.span>
            </motion.h1>

            {/* Rotating subtitle */}
            <motion.p
              className="text-xl md:text-2xl font-medium text-[var(--sig-text-secondary)] mb-12 max-w-xl leading-relaxed"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.5 }}
            >
              We build{' '}
              <TextCycle words={['Engineers', 'Innovators', 'Problem Solvers', 'Designers', 'Leaders']} />
              <br />
              for the future of technology.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-wrap gap-4 mb-20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.65 }}
            >
              <Link
                href="/events"
                className="group relative bg-[var(--sig-amber)] text-black font-heading font-bold px-8 py-4 rounded-lg uppercase tracking-wider text-sm spring-btn overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Explore Events <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" style={{ transitionTimingFunction: 'var(--ease-out)' }} />
                </span>
              </Link>
              <Link
                href="/clubs"
                className="group border border-[var(--sig-border)] bg-transparent text-[var(--sig-text)] font-heading font-bold px-8 py-4 rounded-lg uppercase tracking-wider text-sm spring-btn hover:bg-[var(--sig-surface)] hover:border-[var(--sig-border-hover)] transition-colors duration-200"
              >
                View Clubs
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-[var(--sig-border)] pt-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.8 }}
            >
              <AnimatedStat value={8} suffix="+" label="Specialized Clubs" />
              <AnimatedStat value={50} suffix="+" label="Events Yearly" />
              <AnimatedStat value={2500} suffix="+" label="Active Members" />
              <AnimatedStat value={24} suffix="/7" label="Innovation" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Spacer between hero and banner */}
      <div className="h-16 lg:h-24" />

      {/* ============================================
          ABOUT / VISION & MISSION
          ============================================ */}
      <section className="py-14 md:py-28 lg:py-36 relative">
        <div className="container mx-auto px-6 lg:px-16">
          {/* Section header */}
          <motion.div
            className="mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
          >
            <span className="text-xs font-bold text-[var(--sig-amber)] uppercase tracking-[0.2em] mb-4 block">Who We Are</span>
            <h2 className="text-4xl md:text-6xl font-heading font-black tracking-tight">
              Vision & Mission
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-16 lg:gap-24 relative">
            {/* Vertical divider */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[var(--sig-border)] hidden md:block -translate-x-1/2" />

            {/* Vision */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: EASE_OUT }}
              className="relative group"
            >
              <div className="text-[7rem] font-heading font-black text-white/[0.03] absolute -top-12 -left-6 pointer-events-none select-none z-0 transition-colors duration-500 group-hover:text-[var(--sig-amber-dim)]">
                01
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-lg bg-[var(--sig-amber)]/10 border border-[var(--sig-amber)]/20 flex items-center justify-center mb-8 group-hover:bg-[var(--sig-amber)]/20 transition-colors duration-300">
                  <Target className="w-5 h-5 text-[var(--sig-amber)]" />
                </div>
                <h4 className="text-2xl font-heading font-bold mb-5 text-[var(--sig-text)]">Our Vision</h4>
                <p className="text-[var(--sig-text-secondary)] text-base leading-relaxed font-medium">
                  To become a front-runner in preparing graduates to be efficient problem solvers, researchers, innovators and entrepreneurs — making them competent professionals ready to take on any challenge in the IT industry.
                </p>
              </div>
            </motion.div>

            {/* Mission */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.15 }}
              className="relative group md:pt-24"
            >
              <div className="text-[7rem] font-heading font-black text-white/[0.03] absolute md:top-12 -top-12 -left-6 pointer-events-none select-none z-0 transition-colors duration-500 group-hover:text-[var(--sig-indigo)]/20">
                02
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-lg bg-[var(--sig-indigo)]/10 border border-[var(--sig-indigo)]/20 flex items-center justify-center mb-8 group-hover:bg-[var(--sig-indigo)]/20 transition-colors duration-300">
                  <Zap className="w-5 h-5 text-[var(--sig-indigo)]" />
                </div>
                <h4 className="text-2xl font-heading font-bold mb-5 text-[var(--sig-text)]">Our Mission</h4>
                <p className="text-[var(--sig-text-secondary)] text-base leading-relaxed font-medium">
                  Elevating technical skillsets to match industry standards through intensive sessions, raw interactions, and propelling students to pursue their passion with uncompromising support from our alumni network.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============================================
          OFFERINGS — Bento Grid
          ============================================ */}
      <section className="py-14 md:py-28 lg:py-36 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--sig-amber)]/[0.03] rounded-full blur-[200px] pointer-events-none" />

        <div className="container mx-auto px-6 lg:px-16 relative z-10">
          <motion.div
            className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
          >
            <div>
              <span className="text-xs font-bold text-[var(--sig-indigo)] uppercase tracking-[0.2em] mb-4 block">What We Offer</span>
              <h2 className="text-4xl md:text-6xl font-heading font-black tracking-tight">
                Why Join Us
              </h2>
            </div>
            <p className="max-w-md text-[var(--sig-text-secondary)] font-medium text-base">
              We provide the framework. You provide the execution. Open doors to personal growth, leadership, and real engineering.
            </p>
          </motion.div>

          {/* Bento Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.06 }}
            >
              <BentoCard
                icon={BookOpen}
                title="Workshops & Bootcamps"
                description="Intensive, hands-on sessions covering cloud architecture, machine learning, cybersecurity, and full-stack development."
                tags={['AWS', 'AI/ML', 'DevOps']}
                href="/events"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.12 }}
            >
              <BentoCard
                icon={Users}
                title="The Network"
                description="Connect with like-minded students, high-achieving alumni, and top-tier industry professionals through exclusive meetups."
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.18 }}
              className="lg:col-span-2"
            >
              <BentoCard
                icon={Code2}
                title="Open Source & DevSpace"
                description="Contribute to real projects, find hackathon teammates, showcase your work, and access curated resources. Our DevSpace is the engineering commons for every Technova member."
                tags={['Community', 'Buddy Finder', 'Showcase', 'Resources']}
                href="/community"
                className="min-h-[280px]"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-[var(--sig-border)] to-transparent" />

      {/* ============================================
          CLUBS CAROUSEL
          ============================================ */}
      <section className="py-14 md:py-28 lg:py-36">
        <div className="container mx-auto px-6 lg:px-16">
          <motion.div
            className="flex flex-col md:flex-row items-start md:items-end justify-between mb-16 gap-6"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
          >
            <div>
              <span className="text-xs font-bold text-[var(--sig-amber)] uppercase tracking-[0.2em] mb-4 block">Divisions</span>
              <h2 className="text-4xl md:text-6xl font-heading font-black tracking-tight">
                Our Clubs
              </h2>
            </div>
            <Link
              href="/clubs"
              className="inline-flex items-center gap-2 text-[var(--sig-text-secondary)] font-semibold text-sm uppercase tracking-wider hover:text-[var(--sig-amber)] transition-colors duration-200 pb-1 border-b border-transparent hover:border-[var(--sig-amber)]"
            >
              View All Clubs <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>
          <ClubsCarousel />
        </div>
      </section>

      {/* ============================================
          DEVSPACE + CALENDAR
          ============================================ */}
      <section className="py-14 md:py-28 lg:py-36 border-t border-[var(--sig-border)]">
        <div className="container mx-auto px-6 lg:px-16">

          {/* DevSpace Grid */}
          <motion.div
            className="mb-12 md:mb-24"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
          >
            <h2 className="text-4xl md:text-5xl font-heading font-black tracking-tight mb-10">
              DevSpace <span className="text-[var(--sig-indigo)]">Hub</span>
            </h2>

            <div className="grid md:grid-cols-4 border border-[var(--sig-border)] rounded-lg overflow-hidden">
              {[
                { title: "Community", desc: "Discuss ideas, ask questions, share knowledge.", icon: Users, href: "/community" },
                { title: "Buddy Finder", desc: "Find teammates for hackathons and projects.", icon: Rocket, href: "/buddy-finder" },
                { title: "Showcase", desc: "Show off your projects and get feedback.", icon: Code2, href: "/showcase" },
                { title: "Resources", desc: "Access high-value academic resources.", icon: Database, href: "/resources" },
              ].map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  className="group block border-r border-b md:border-b-0 border-[var(--sig-border)] last:border-r-0 hover:bg-[var(--sig-surface)] transition-colors duration-200 p-8 relative overflow-hidden min-h-[200px] flex flex-col justify-between"
                  style={{ transitionTimingFunction: 'var(--ease-out)' }}
                >
                  <div className="absolute inset-0 bg-[var(--sig-amber)] scale-y-0 origin-bottom group-hover:scale-y-100 transition-transform duration-300 z-0" style={{ transitionTimingFunction: 'var(--ease-out)' }} />

                  <div className="relative z-10">
                    <item.icon className="w-6 h-6 text-[var(--sig-text-secondary)] group-hover:text-black transition-colors duration-200 mb-5" />
                    <h4 className="text-lg font-heading font-bold group-hover:text-black transition-colors duration-200 mb-2">{item.title}</h4>
                  </div>
                  <p className="text-sm text-[var(--sig-text-secondary)] group-hover:text-black/70 relative z-10 font-medium transition-colors duration-200">{item.desc}</p>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Calendar */}
          <motion.div
            className="border border-[var(--sig-border)] rounded-lg overflow-hidden"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
          >
            <div className="bg-[var(--sig-surface)] p-8 md:p-12 relative overflow-hidden group">
              <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">
                <div className="md:w-1/3">
                  <h3 className="text-3xl lg:text-4xl font-heading font-black tracking-tight mb-4">
                    Schedule<br /><span className="text-[var(--sig-amber)]">Sync</span>
                  </h3>
                  <p className="text-[var(--sig-text-secondary)] font-medium mb-8 text-sm leading-relaxed">
                    Never miss an event. Subscribe to the official Technova calendar and stay in sync.
                  </p>
                  <Link
                    href="https://calendar.google.com/calendar/u/0?cid=dGVjaG5vdmFAc2hhcmRhLmFjLmlu"
                    target="_blank"
                    className="inline-flex items-center gap-2 text-black bg-[var(--sig-amber)] px-6 py-3 font-heading font-bold uppercase tracking-wider text-sm rounded-lg spring-btn hover:brightness-110"
                  >
                    Add to Calendar <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="md:w-2/3 w-full bg-black border border-[var(--sig-border)] rounded-lg p-2 md:p-4 opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                  <iframe
                    src="https://calendar.google.com/calendar/embed?src=technova%40sharda.ac.in&ctz=Asia%2FKolkata&bgcolor=%23000000&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&showTz=1"
                    style={{ border: 0, filter: 'invert(0.9) hue-rotate(180deg) grayscale(1) contrast(1.2)' }}
                    width="100%"
                    height="380"
                    frameBorder="0"
                    scrolling="no"
                    className="w-full mix-blend-screen rounded"
                  ></iframe>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============================================
          FOOTER
          ============================================ */}
      <Footer />
    </div>
  )
}
