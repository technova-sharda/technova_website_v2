'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Code2, Zap, Rocket, Terminal } from 'lucide-react'
import { useState, useEffect } from 'react'

// Particle Background Animation
function randomParticles(count: number, minDuration: number) {
    return Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        duration: Math.random() * minDuration + minDuration,
        delay: Math.random() * 5,
    }))
}

function ParticleBackground() {
    const [mounted, setMounted] = useState(false)
    // Picked once; computing these during render moved every particle on each re-render.
    const [blue] = useState(() => randomParticles(20, 5))
    const [purple] = useState(() => randomParticles(15, 6))

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {blue.map((p, i) => (
                <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-blue-500 rounded-full blur-[2px]"
                    style={{
                        left: `${p.left}%`,
                        top: `${p.top}%`,
                    }}
                    animate={{
                        y: [0, -100, 0],
                        opacity: [0, 1, 0],
                        scale: [0, 1.5, 0],
                    }}
                    transition={{
                        duration: p.duration,
                        repeat: Infinity,
                        ease: "linear",
                        delay: p.delay,
                    }}
                />
            ))}
            {purple.map((p, i) => (
                <motion.div
                    key={`purple-${i}`}
                    className="absolute w-3 h-3 bg-purple-500 rounded-full blur-[3px]"
                    style={{
                        left: `${p.left}%`,
                        top: `${p.top}%`,
                    }}
                    animate={{
                        x: [0, 100, 0],
                        opacity: [0, 0.8, 0],
                        scale: [0, 1.2, 0],
                    }}
                    transition={{
                        duration: p.duration,
                        repeat: Infinity,
                        ease: "linear",
                        delay: p.delay,
                    }}
                />
            ))}
        </div>
    )
}

export function HackathonTeaser() {
    return (
        <section className="relative py-16 md:py-32 overflow-hidden bg-black border-y border-white/5">
            {/* Background elements */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15)_0,transparent_50%)]" />
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-purple-900/20 to-transparent blur-[100px]" />
            <div className="absolute bottom-0 left-0 w-1/2 h-full bg-gradient-to-r from-blue-900/20 to-transparent blur-[100px]" />

            <ParticleBackground />

            <div className="container mx-auto px-4 relative z-10">
                <div className="max-w-5xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">

                        {/* Text Content */}
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                        >
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/30 bg-blue-500/10 mb-6 backdrop-blur-md">
                                <Zap className="w-5 h-5 text-blue-400" />
                                <span className="text-blue-400 font-bold uppercase tracking-widest text-sm">Upcoming Event</span>
                            </div>

                            <h2 className="text-5xl md:text-7xl font-black tracking-tight mb-6 mt-6">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-white to-green-500">
                                    INNOVATE BHARAT
                                </span>
                                <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500">
                                    24 Hrs HACKATHON
                                </span>
                            </h2>

                            <p className="text-xl text-gray-400 mb-8 leading-relaxed">
                                Innovating Today for a Sustainable Tomorrow. Join the ultimate 24-hour test of endurance, creativity, and coding skills at Sharda University.
                            </p>

                            <div className="flex flex-wrap gap-4">
                                <Link href="/hackathon">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="group relative px-8 py-4 bg-white text-black rounded-xl font-bold text-lg overflow-hidden transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] flex items-center gap-2"
                                    >
                                        <span className="relative z-10">Register Now</span>
                                        <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                                        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </motion.button>
                                </Link>
                                <Link href="/hackathon">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="px-8 py-4 bg-white/5 border border-white/10 rounded-xl font-bold text-lg text-white hover:bg-white/10 transition-colors backdrop-blur-md"
                                    >
                                        Learn More
                                    </motion.button>
                                </Link>
                            </div>
                        </motion.div>

                        {/* Floating Cards Graphic */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                            className="relative hidden lg:block h-[500px]"
                        >
                            {/* Central glowing orb */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/30 rounded-full blur-[80px] animate-pulse" />

                            {/* Floating Card 1 */}
                            <motion.div
                                animate={{ y: [-15, 15, -15], rotate: [-2, 2, -2] }}
                                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute top-[10%] left-[10%] p-6 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl w-64"
                            >
                                <Code2 className="w-10 h-10 text-blue-400 mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">Build Fast</h3>
                                <p className="text-sm text-gray-400">Turn your crazy ideas into working prototypes in just 24 hours.</p>
                            </motion.div>

                            {/* Floating Card 2 */}
                            <motion.div
                                animate={{ y: [15, -15, 15], rotate: [2, -2, 2] }}
                                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                className="absolute bottom-[10%] right-[5%] p-6 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl w-64 z-20"
                            >
                                <Rocket className="w-10 h-10 text-purple-400 mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">Win Prizes</h3>
                                <p className="text-sm text-gray-400">Compete for amazing prizes, swags, and bragging rights.</p>
                            </motion.div>

                            {/* Center Decorative Element */}
                            <motion.div
                                animate={{ scale: [0.95, 1.05, 0.95] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-blue-500/20 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
                            >
                                <div className="w-full h-full rounded-full border border-purple-500/30 flex items-center justify-center bg-gradient-to-br from-blue-600/20 to-purple-600/20">
                                    <Terminal className="w-16 h-16 text-white" />
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    )
}
