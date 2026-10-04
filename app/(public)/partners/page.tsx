'use client'

import { SponsorShowcase } from "@/components/partners/SponsorShowcase";
import { PartnershipForm } from "@/components/partners/PartnershipForm";
import { EcosystemHighlight } from "@/components/partners/EcosystemHighlight";
import { motion } from "framer-motion";
import { Home, ChevronRight, Handshake, Target, Users, Lightbulb, Mic, Quote } from "lucide-react";
import Link from "next/link";
import { AnimatedBackground } from "@/components/ui/animated-background";

export default function PartnersPage() {
    return (
        <div className="min-h-screen bg-[var(--sig-bg)] text-[var(--sig-text)] overflow-hidden">
            <AnimatedBackground />

            {/* Hero Section */}
            <section className="relative py-16 md:py-32 lg:py-40 overflow-hidden">
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

                <div className="container mx-auto px-4 relative z-10">
                    {/* Breadcrumb */}
                    <motion.nav
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 text-sm mb-8"
                    >
                        <Link href="/" className="text-[var(--sig-text-secondary)] hover:text-white transition-colors flex items-center gap-1">
                            <Home className="w-4 h-4" /> Home
                        </Link>
                        <ChevronRight className="w-4 h-4 text-[var(--sig-border-hover)]" />
                        <span className="text-[var(--sig-amber)]">Partners</span>
                    </motion.nav>

                    <div className="text-center max-w-4xl mx-auto">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-[var(--sig-amber)]/30 bg-[var(--sig-amber)]/10 backdrop-blur-xl mb-8 shadow-[0_0_30px_var(--sig-amber-dim)]"
                        >
                            <Handshake className="w-4 h-4 text-[var(--sig-amber)]" />
                            <span className="text-[var(--sig-amber)] font-medium text-sm tracking-wider uppercase font-mono">Partnership Opportunities</span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50"
                        >
                            Partner with{" "}
                            <span className="text-[var(--sig-amber)]">Technova</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-xl text-[var(--sig-text-secondary)] max-w-2xl mx-auto leading-relaxed"
                        >
                            Join us in building the future of technology by supporting the most vibrant student technical community at Sharda University.
                        </motion.p>
                    </div>
                </div>
            </section>

            {/* Ecosystem Stats */}
            <section className="py-16 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-[var(--sig-surface)] to-[var(--sig-bg)]" />
                <div className="container mx-auto px-4 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-12"
                    >
                        <h2 className="text-sm font-bold text-[var(--sig-amber)] uppercase tracking-widest mb-3 font-mono">Our Reach</h2>
                        <h3 className="text-3xl md:text-4xl font-bold">A Thriving Tech Ecosystem</h3>
                    </motion.div>
                    <EcosystemHighlight />
                </div>
            </section>

            {/* Value Proposition */}
            <section className="py-14 md:py-24 relative overflow-hidden">
                <div className="container mx-auto px-4 relative z-10">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                        >
                            <h2 className="text-sm font-bold text-[var(--sig-amber)] uppercase tracking-widest mb-3 font-mono">Benefits</h2>
                            <h3 className="text-4xl font-bold mb-8">Why Partner With Us?</h3>
                            <div className="space-y-6">
                                {[
                                    { icon: Users, text: "Access to top engineering talent for internships and full-time roles." },
                                    { icon: Target, text: "Brand visibility across our events, hackathons, and workshops." },
                                    { icon: Lightbulb, text: "Direct engagement with student projects and research." },
                                    { icon: Mic, text: "Opportunities to host tech talks and mentorship sessions." }
                                ].map((item, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: i * 0.1, ease: [0.23, 1, 0.32, 1] }}
                                        className="flex items-start gap-4 p-4 rounded-xl sig-card"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-[var(--sig-amber)]/20 flex items-center justify-center text-[var(--sig-amber)] shrink-0">
                                            <item.icon className="w-5 h-5" />
                                        </div>
                                        <span className="text-gray-300 leading-relaxed">{item.text}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="p-8 rounded-3xl sig-card shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:border-[var(--sig-amber)]/30 transition-all duration-500"
                        >
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--sig-amber)] to-amber-500 flex items-center justify-center">
                                    <Quote className="w-6 h-6 text-black" />
                                </div>
                                <h3 className="text-2xl font-bold">What Partners Say</h3>
                            </div>
                            <p className="text-[var(--sig-text-secondary)] italic text-lg leading-relaxed mb-6">
                                &ldquo;Technova has been instrumental in bridging the gap between academia and industry. The students here are ready to tackle real-world challenges from day one.&rdquo;
                            </p>
                            <div className="flex items-center gap-4 pt-4 border-t border-[var(--sig-border)]">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--sig-amber)] to-amber-400 flex items-center justify-center text-black font-bold">
                                    P
                                </div>
                                <div>
                                    <div className="font-semibold text-white">Partner Company</div>
                                    <div className="text-sm text-[var(--sig-text-secondary)]">Industry Partner</div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Sponsor Showcase */}
            <section className="py-16 bg-[var(--sig-surface)]/50 border-y border-[var(--sig-border)]">
                <div className="container mx-auto px-4">
                    <SponsorShowcase />
                </div>
            </section>

            {/* Partnership Inquiry Form */}
            <section className="py-14 md:py-24 relative overflow-hidden">
                <div className="container mx-auto px-4 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-12"
                    >
                        <h2 className="text-sm font-bold text-[var(--sig-amber)] uppercase tracking-widest mb-3 font-mono">Get In Touch</h2>
                        <h3 className="text-4xl font-bold mb-4">Let&apos;s Build Together</h3>
                        <p className="text-[var(--sig-text-secondary)] max-w-xl mx-auto">
                            Ready to make an impact? Send us an inquiry and our team will get back to you.
                        </p>
                    </motion.div>
                    <PartnershipForm />
                </div>
            </section>
        </div>
    );
}
