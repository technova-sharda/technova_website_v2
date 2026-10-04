'use client'

import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Home, ChevronRight, Code, Rocket, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { useRouter } from "next/navigation";

export function ShowcaseClient({ projects, currentUserId }: { projects: any[]; currentUserId?: string }) {
    const router = useRouter();
    const fetchProjects = () => router.refresh();

    return (
        <div className="min-h-screen bg-[var(--sig-bg)] text-[var(--sig-text)]">
            <AnimatedBackground />

            {/* Hero Section */}
            <section className="relative py-12 md:py-20 overflow-hidden">
                {/* Grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

                <div className="container mx-auto px-4 relative z-10">
                    {/* Breadcrumb */}
                    <motion.nav
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 text-sm mb-6"
                    >
                        <Link href="/" className="text-[var(--sig-text-secondary)] hover:text-white transition-colors flex items-center gap-1">
                            <Home className="w-4 h-4" /> Home
                        </Link>
                        <ChevronRight className="w-4 h-4 text-[var(--sig-border-hover)]" />
                        <span className="text-[var(--sig-amber)]">Showcase</span>
                    </motion.nav>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="max-w-2xl"
                        >
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--sig-green)]/30 bg-[var(--sig-green)]/10 backdrop-blur-xl mb-6">
                                <Code className="w-4 h-4 text-[var(--sig-green)]" />
                                <span className="text-[var(--sig-green)] font-medium text-sm tracking-wider uppercase font-mono">DevSpace Showcase</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                                Student Project Showcase
                            </h1>
                            <p className="text-[var(--sig-text-secondary)] text-lg">
                                Explore amazing projects built by the Technova community. Get inspired and share your work.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <Link href="/showcase/new">
                                <Button size="lg" className="spring-btn bg-gradient-to-r from-[var(--sig-green)] to-emerald-500 hover:opacity-90 shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] font-bold text-black">
                                    <Plus className="w-5 h-5 mr-2" />
                                    Submit Project
                                </Button>
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Projects Grid */}
            <section className="py-12 relative z-10">
                <div className="container mx-auto px-4 max-w-7xl">
                    {projects.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-24 rounded-3xl sig-card border-dashed"
                        >
                            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[var(--sig-green)]/20 to-[var(--sig-amber)]/20 flex items-center justify-center mx-auto mb-6">
                                <Rocket className="w-10 h-10 text-[var(--sig-green)]" />
                            </div>
                            <h3 className="text-3xl font-bold mb-3">No Projects Yet</h3>
                            <p className="text-[var(--sig-text-secondary)] max-w-md mx-auto mb-8">
                                Be the first to showcase your work to the world! Share your projects and inspire others.
                            </p>
                            <Link href="/showcase/new">
                                <Button size="lg" className="spring-btn bg-gradient-to-r from-[var(--sig-green)] to-emerald-500 hover:opacity-90 shadow-[0_0_30px_rgba(34,197,94,0.3)] text-black font-bold">
                                    <Sparkles className="w-5 h-5 mr-2" />
                                    Submit Your First Project
                                </Button>
                            </Link>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                        >
                            {projects.map((project: any, idx: number) => (
                                <motion.div
                                    key={project.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05, ease: [0.23, 1, 0.32, 1] }}
                                >
                                    <ProjectCard
                                        project={project}
                                        currentUserId={currentUserId}
                                        onDelete={fetchProjects}
                                    />
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </div>
            </section>
        </div>
    );
}
