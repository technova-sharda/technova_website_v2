'use client'

import { CreatePost } from "@/components/community/CreatePost";
import { PostList } from "@/components/community/PostList";
import { CommunityShowcase } from "@/components/community/CommunityShowcase";
import { CommunityResources } from "@/components/community/CommunityResources";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, ChevronRight, Users, Rocket, HelpCircle, Lightbulb, MessageSquare, PenSquare, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { useSearchParams } from "next/navigation";

// Posts and the session come from the server render, so a new post shows up as
// soon as its action revalidates /community (the old client fetch never re-ran).
export function CommunityClient({ posts, session }: { posts: any[]; session: { user: { id: string } } | null }) {
    const searchParams = useSearchParams();
    const defaultTab = searchParams.get('tab') || 'discussions';

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
                        <span className="text-[var(--sig-amber)]">Community</span>
                    </motion.nav>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-2xl"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--sig-indigo)]/30 bg-[var(--sig-indigo)]/10 backdrop-blur-xl mb-6">
                            <Users className="w-4 h-4 text-[var(--sig-indigo)]" />
                            <span className="text-[var(--sig-indigo)] font-medium text-sm tracking-wider uppercase font-mono">DevSpace Community</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                            Community & Collaboration
                        </h1>
                        <p className="text-[var(--sig-text-secondary)] text-lg">
                            Discuss ideas, find teammates, and share knowledge with the community.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Main Content */}
            <section className="py-12 relative z-10">
                <div className="container mx-auto px-4 max-w-7xl">
                    <Tabs defaultValue={defaultTab} className="w-full">
                        <div className="flex justify-center mb-12">
                            <TabsList className="bg-[var(--sig-surface)] border border-[var(--sig-border)] p-1.5 rounded-2xl max-w-full overflow-x-auto no-scrollbar justify-start">
                                <TabsTrigger value="discussions" className="data-[state=active]:bg-[var(--sig-indigo)]/20 data-[state=active]:text-[var(--sig-indigo)] rounded-xl px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base flex gap-2 flex-shrink-0">
                                    <MessageSquare className="w-5 h-5" /> Discussions
                                </TabsTrigger>
                                <TabsTrigger value="showcase" className="data-[state=active]:bg-[var(--sig-green)]/20 data-[state=active]:text-[var(--sig-green)] rounded-xl px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base flex gap-2 flex-shrink-0">
                                    <Rocket className="w-5 h-5" /> Project Showcase
                                </TabsTrigger>
                                <TabsTrigger value="resources" className="data-[state=active]:bg-[var(--sig-amber)]/20 data-[state=active]:text-[var(--sig-amber)] rounded-xl px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base flex gap-2 flex-shrink-0">
                                    <BookOpen className="w-5 h-5" /> Academic Resources
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* Discussions Tab */}
                        <TabsContent value="discussions" className="mt-0">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Posts */}
                                <motion.div
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="lg:col-span-2"
                                >
                                    <Tabs defaultValue="all" className="w-full">
                                        <TabsList className="mb-6 bg-[var(--sig-surface)] border border-[var(--sig-border)] p-1 rounded-xl w-full flex overflow-x-auto no-scrollbar justify-start sm:justify-center">
                                            <TabsTrigger value="all" className="data-[state=active]:bg-[var(--sig-indigo)]/20 data-[state=active]:text-[var(--sig-indigo)] rounded-lg gap-2 flex-shrink-0">
                                                <MessageSquare className="w-4 h-4" /> All
                                            </TabsTrigger>
                                            <TabsTrigger value="projects" className="data-[state=active]:bg-[var(--sig-indigo)]/20 data-[state=active]:text-[var(--sig-indigo)] rounded-lg gap-2 flex-shrink-0">
                                                <Rocket className="w-4 h-4" /> Projects
                                            </TabsTrigger>
                                            <TabsTrigger value="hackathons" className="data-[state=active]:bg-[var(--sig-green)]/20 data-[state=active]:text-[var(--sig-green)] rounded-lg gap-2 flex-shrink-0">
                                                <Lightbulb className="w-4 h-4" /> Hackathons
                                            </TabsTrigger>
                                            <TabsTrigger value="questions" className="data-[state=active]:bg-[var(--sig-amber)]/20 data-[state=active]:text-[var(--sig-amber)] rounded-lg gap-2 flex-shrink-0">
                                                <HelpCircle className="w-4 h-4" /> Questions
                                            </TabsTrigger>
                                        </TabsList>

                                        <div className="sig-card rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                                            {(
                                                <>
                                                    <TabsContent value="all" className="mt-0">
                                                        <PostList posts={posts} userId={session?.user?.id} />
                                                    </TabsContent>
                                                    <TabsContent value="projects" className="mt-0">
                                                        <PostList posts={posts.filter(p => p.category === 'Project')} userId={session?.user?.id} />
                                                    </TabsContent>
                                                    <TabsContent value="hackathons" className="mt-0">
                                                        <PostList posts={posts.filter(p => p.category === 'Hackathon')} userId={session?.user?.id} />
                                                    </TabsContent>
                                                    <TabsContent value="questions" className="mt-0">
                                                        <PostList posts={posts.filter(p => p.category === 'Question')} userId={session?.user?.id} />
                                                    </TabsContent>
                                                </>
                                            )}
                                        </div>
                                    </Tabs>
                                </motion.div>

                                {/* Sidebar */}
                                <motion.div
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="lg:col-span-1"
                                >
                                    <div className="sticky top-32">
                                        {session?.user ? (
                                            <div className="sig-card rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                                                <div className="w-12 h-12 rounded-xl bg-[var(--sig-green)]/20 flex items-center justify-center text-[var(--sig-green)] mb-4">
                                                    <PenSquare className="w-6 h-6" />
                                                </div>
                                                <h3 className="font-bold text-xl mb-4">Start a Discussion</h3>
                                                <CreatePost />
                                            </div>
                                        ) : (
                                            <div className="sig-card rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                                                <div className="w-12 h-12 rounded-xl bg-[var(--sig-indigo)]/20 flex items-center justify-center text-[var(--sig-indigo)] mb-4">
                                                    <MessageSquare className="w-6 h-6" />
                                                </div>
                                                <h3 className="font-bold text-xl mb-2">Join the Conversation</h3>
                                                <p className="text-sm text-[var(--sig-text-secondary)] mb-6">
                                                    Log in to post questions, share projects, and connect with peers.
                                                </p>
                                                <Link href="/login">
                                                    <Button className="spring-btn w-full bg-gradient-to-r from-[var(--sig-amber)] to-amber-500 hover:opacity-90 shadow-[0_0_20px_var(--sig-amber-dim)] text-black font-bold">
                                                        Login to Post
                                                    </Button>
                                                </Link>
                                            </div>
                                        )}

                                        {/* Quick Stats */}
                                        <div className="mt-6 sig-card rounded-2xl p-6">
                                            <h4 className="font-semibold text-sm text-[var(--sig-text-secondary)] uppercase tracking-wider mb-4 font-mono">Community Stats</h4>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[var(--sig-text-secondary)]">Total Posts</span>
                                                    <span className="font-bold text-white">{posts.length}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[var(--sig-text-secondary)]">Projects</span>
                                                    <span className="font-bold text-[var(--sig-indigo)]">{posts.filter(p => p.category === 'Project').length}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[var(--sig-text-secondary)]">Questions</span>
                                                    <span className="font-bold text-[var(--sig-amber)]">{posts.filter(p => p.category === 'Question').length}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </TabsContent>

                        <TabsContent value="showcase" className="mt-0">
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                            >
                                <CommunityShowcase />
                            </motion.div>
                        </TabsContent>

                        <TabsContent value="resources" className="mt-0">
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                            >
                                <CommunityResources />
                            </motion.div>
                        </TabsContent>
                    </Tabs>
                </div>
            </section>
        </div>
    );
}
