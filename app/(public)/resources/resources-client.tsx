'use client'

import { ResourceList } from "@/components/resources/ResourceList";
import { UploadResource } from "@/components/resources/UploadResource";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Home, ChevronRight, BookOpen, FileText, GraduationCap, Filter } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AnimatedBackground } from "@/components/ui/animated-background";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function ResourcesClient({ resources, semesterParam, subject }: {
    resources: any[];
    semesterParam: string;
    subject: string;
}) {

    return (
        <div className="min-h-screen bg-[var(--sig-bg)] text-[var(--sig-text)]">
            <AnimatedBackground />

            {/* Hero Section */}
            <section className="relative py-12 md:py-20 overflow-hidden">
                {/* Grid Overlay */}
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
                        <span className="text-[var(--sig-amber)]">Resources</span>
                    </motion.nav>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="max-w-2xl"
                        >
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--sig-amber)]/30 bg-[var(--sig-amber)]/10 backdrop-blur-xl mb-6">
                                <BookOpen className="w-4 h-4 text-[var(--sig-amber)]" />
                                <span className="text-[var(--sig-amber)] font-medium text-sm tracking-wider uppercase font-mono">DevSpace Resources</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                                Academic Resources
                            </h1>
                            <p className="text-[var(--sig-text-secondary)] text-lg">
                                Access PYQs, notes, and study materials shared by seniors and peers.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <UploadResource />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Search & Resources */}
            <section className="py-12 relative z-10">
                <div className="container mx-auto px-4 max-w-5xl">
                    {/* Filter Box */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="sig-card rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] mb-10"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Filter className="w-5 h-5 text-[var(--sig-amber)]" />
                            <h3 className="font-semibold">Filter Resources</h3>
                        </div>
                        <form className="flex flex-col md:flex-row gap-4">
                            <div className="w-full md:w-48">
                                <Select name="semester" defaultValue={semesterParam}>
                                    <SelectTrigger className="bg-[var(--sig-surface)] border-[var(--sig-border)] focus:border-[var(--sig-amber)]/50 h-12">
                                        <SelectValue placeholder="Semester" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[var(--sig-surface)] border-[var(--sig-border)]">
                                        <SelectItem value="all">All Semesters</SelectItem>
                                        <SelectItem value="Sem 1">Sem 1</SelectItem>
                                        <SelectItem value="Sem 2">Sem 2</SelectItem>
                                        <SelectItem value="Sem 3">Sem 3</SelectItem>
                                        <SelectItem value="Sem 4">Sem 4</SelectItem>
                                        <SelectItem value="Sem 5">Sem 5</SelectItem>
                                        <SelectItem value="Sem 6">Sem 6</SelectItem>
                                        <SelectItem value="Sem 7">Sem 7</SelectItem>
                                        <SelectItem value="Sem 8">Sem 8</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--sig-text-secondary)]" />
                                <Input
                                    name="subject"
                                    placeholder="Search for subjects..."
                                    className="pl-12 bg-[var(--sig-surface)] border-[var(--sig-border)] focus:border-[var(--sig-amber)]/50 h-12 placeholder:text-[var(--sig-text-secondary)]"
                                    defaultValue={subject}
                                />
                            </div>
                            <Button type="submit" className="spring-btn h-12 px-8 bg-gradient-to-r from-[var(--sig-amber)] to-amber-500 hover:opacity-90 text-black font-bold">
                                <Search className="w-4 h-4 mr-2" />
                                Filter
                            </Button>
                        </form>
                    </motion.div>

                    {/* Resources */}
                    {resources.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-20 sig-card rounded-2xl"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-[var(--sig-amber)]/20 flex items-center justify-center text-[var(--sig-amber)] mx-auto mb-6">
                                <FileText className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-bold mb-2">No Resources Found</h3>
                            <p className="text-[var(--sig-text-secondary)] max-w-md mx-auto mb-6">
                                No resources match your filter criteria. Try adjusting your search or be the first to upload!
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="sig-card rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                        >
                            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[var(--sig-border)]">
                                <GraduationCap className="w-5 h-5 text-[var(--sig-amber)]" />
                                <span className="font-semibold">{resources.length} Resources Found</span>
                            </div>
                            <ResourceList resources={resources} />
                        </motion.div>
                    )}
                </div>
            </section>
        </div>
    );
}
