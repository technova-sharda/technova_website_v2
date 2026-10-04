'use client'

import { searchBuddies } from "@/lib/actions/profile";
import { BuddyCard } from "@/components/buddy/BuddyCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Home, ChevronRight, Users, UserPlus, Sparkles, UsersRound, Filter, X, Rocket, Eye, Handshake, Trophy, ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Profile completion popup component
function ProfilePopup({ onClose }: { onClose: () => void }) {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-lg mx-auto rounded-3xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Gradient border effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-blue-500 to-emerald-500 opacity-50" />
                    <div className="relative m-[1px] bg-zinc-950 rounded-3xl p-8">
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Icon + Header */}
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center"><Rocket className="w-8 h-8 text-purple-300" /></div>
                            <h2 className="text-2xl font-black text-white mb-2">
                                Complete Your Profile!
                            </h2>
                            <p className="text-gray-400 text-sm">
                                Stand out and find the perfect hackathon team
                            </p>
                        </div>

                        {/* Advantages */}
                        <div className="space-y-3 mb-8">
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                <Eye className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-white text-sm font-semibold">Get Discovered</p>
                                    <p className="text-gray-400 text-xs">Your profile appears in search results — others can find you by skills, name, or interests</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <Handshake className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-white text-sm font-semibold">Find Hackathon Teammates</p>
                                    <p className="text-gray-400 text-xs">Add &quot;Looking for Team&quot; to your skills and connect with students who need team members</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <Trophy className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-white text-sm font-semibold">Build Your Network</p>
                                    <p className="text-gray-400 text-xs">Connect with peers who share your tech stack for projects, study groups, and future collaborations</p>
                                </div>
                            </div>
                        </div>

                        {/* CTA Buttons */}
                        <div className="space-y-3">
                            <Link href="/profile/edit" className="block">
                                <Button className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-base shadow-[0_0_30px_rgba(147,51,234,0.3)] hover:shadow-[0_0_40px_rgba(147,51,234,0.5)] transition-all">
                                    <Rocket className="w-5 h-5 mr-2" />
                                    Complete My Profile
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                            <button
                                onClick={onClose}
                                className="w-full text-center text-sm text-gray-500 hover:text-gray-300 transition-colors py-2"
                            >
                                I&apos;ll do it later
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

function BuddyFinderContent() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q') || '';
    const skill = searchParams.get('skill') || '';

    const [buddies, setBuddies] = useState<any[]>([]);
    const [needsSignIn, setNeedsSignIn] = useState(false);
    const [loading, setLoading] = useState(true);
    const [lookingForTeam, setLookingForTeam] = useState(false);
    const [showPopup, setShowPopup] = useState(false);

    // Pagination and Filtering states
    const [currentPage, setCurrentPage] = useState(1);
    const [isFiltering, setIsFiltering] = useState(false);
    const ITEMS_PER_PAGE = 15;

    useEffect(() => {
        // Show popup once per session
        const dismissed = sessionStorage.getItem('buddy-popup-dismissed');
        if (!dismissed) {
            // Small delay so page loads first
            const timer = setTimeout(() => setShowPopup(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleClosePopup = () => {
        setShowPopup(false);
        sessionStorage.setItem('buddy-popup-dismissed', 'true');
    };

    useEffect(() => {
        async function fetchBuddies() {
            setLoading(true);
            const results = await searchBuddies(query, skill);
            // null = not signed in (results include contact emails, so sign-in is required)
            setNeedsSignIn(results === null);
            setBuddies(results ?? []);
            setCurrentPage(1);
            setLoading(false);
        }
        fetchBuddies();
    }, [query, skill]);

    const handleToggleLookingForTeam = () => {
        setIsFiltering(true);
        setTimeout(() => {
            setLookingForTeam(prev => !prev);
            setCurrentPage(1);
            setIsFiltering(false);
        }, 500);
    };

    // Filter results client-side for "Looking for Team"
    const filteredBuddies = lookingForTeam
        ? buddies.filter(b => b.skills?.includes("Looking for Team"))
        : buddies;

    const lookingForTeamCount = buddies.filter(b => b.skills?.includes("Looking for Team")).length;

    const totalPages = Math.ceil(filteredBuddies.length / ITEMS_PER_PAGE);
    const paginatedBuddies = filteredBuddies.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Profile Completion Popup */}
            {showPopup && <ProfilePopup onClose={handleClosePopup} />}
            {/* Hero Section */}
            <section className="relative py-12 md:py-20 overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black" />
                <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/3 left-1/4 w-[300px] h-[300px] bg-blue-600/15 rounded-full blur-[100px]" />

                <div className="container mx-auto px-4 relative z-10">
                    {/* Breadcrumb */}
                    <motion.nav
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 text-sm mb-6"
                    >
                        <Link href="/" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                            <Home className="w-4 h-4" /> Home
                        </Link>
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                        <span className="text-purple-400">Buddy Finder</span>
                    </motion.nav>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="max-w-2xl"
                        >
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-xl mb-6">
                                <Users className="w-4 h-4 text-purple-400" />
                                <span className="text-purple-400 font-medium text-sm">DevSpace Buddy Finder</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                                Find Your Perfect Buddy
                            </h1>
                            <p className="text-gray-400 text-lg">
                                Connect with peers for hackathons, projects, and study groups.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <Link href="/profile/edit">
                                <Button className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)]">
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Edit My Profile
                                </Button>
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Search & Results */}
            <section className="py-12">
                <div className="container mx-auto px-4 max-w-6xl">

                    {/* Hackathon Team-Finding Banner */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-emerald-900/30 via-emerald-800/20 to-teal-900/30 border border-emerald-500/20 backdrop-blur-xl"
                    >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                                    <UsersRound className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">Looking for a Hackathon Team?</h3>
                                    <p className="text-emerald-400/80 text-xs mt-0.5">
                                        {lookingForTeamCount > 0
                                            ? `${lookingForTeamCount} student${lookingForTeamCount !== 1 ? 's' : ''} currently looking for teammates!`
                                            : "Add 'Looking for Team' to your skills in your profile to appear here!"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                                <button
                                    onClick={handleToggleLookingForTeam}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 whitespace-nowrap ${lookingForTeam
                                            ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:bg-emerald-400'
                                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                        }`}
                                >
                                    <UsersRound className="w-4 h-4" />
                                    {lookingForTeam ? 'Showing Teammates' : 'Find Teammates'}
                                    {lookingForTeamCount > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${lookingForTeam ? 'bg-white/20' : 'bg-emerald-500/30'
                                            }`}>
                                            {lookingForTeamCount}
                                        </span>
                                    )}
                                </button>
                                {!lookingForTeam && (
                                    <Link href="/profile/edit" className="sm:hidden">
                                        <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs">
                                            Mark Yourself
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </motion.div>

                    {/* Search Box */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="p-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] mb-10"
                    >
                        <form className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                                <Input
                                    name="q"
                                    placeholder="Search by name or skill (e.g. John, React, Python)..."
                                    className="pl-12 bg-white/5 border-white/10 focus:border-purple-500/50 h-12 text-white placeholder:text-gray-500"
                                    defaultValue={query || skill}
                                />
                            </div>
                            <Button type="submit" className="h-12 px-8 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500">
                                <Search className="w-4 h-4 mr-2" />
                                Search
                            </Button>
                        </form>
                    </motion.div>

                    {/* Active Filter Pill */}
                    {lookingForTeam && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mb-6 flex items-center gap-2"
                        >
                            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Active Filter:</span>
                            <button
                                onClick={() => {
                                    setIsFiltering(true);
                                    setTimeout(() => {
                                        setLookingForTeam(false);
                                        setCurrentPage(1);
                                        setIsFiltering(false);
                                    }, 500);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
                            >
                                <Handshake className="w-4 h-4" /> Looking for Team
                                <X className="ml-1 w-3.5 h-3.5 text-emerald-300 hover:text-white" />
                            </button>
                        </motion.div>
                    )}

                    {/* Results */}
                    {loading || isFiltering ? (
                        <div className="text-center py-20">
                            <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-gray-400">{isFiltering ? "Updating..." : "Finding buddies..."}</p>
                        </div>
                    ) : filteredBuddies.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-20 rounded-2xl bg-white/[0.02] border border-white/10"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400 mx-auto mb-6">
                                <Users className="w-8 h-8" />
                            </div>
                            {needsSignIn ? (
                                <>
                                    <h3 className="text-2xl font-bold mb-2">Sign In to Find Buddies</h3>
                                    <p className="text-gray-400 max-w-md mx-auto mb-6">
                                        Buddy Finder shows students&apos; contact details, so it&apos;s available to signed-in Sharda students only.
                                    </p>
                                    <Link href="/login?callbackUrl=/buddy-finder">
                                        <Button className="bg-purple-600 hover:bg-purple-500">
                                            <ArrowRight className="w-4 h-4 mr-2" />
                                            Sign In
                                        </Button>
                                    </Link>
                                </>
                            ) : lookingForTeam ? (
                                <>
                                    <h3 className="text-2xl font-bold mb-2">No One Looking for a Team Yet</h3>
                                    <p className="text-gray-400 max-w-md mx-auto mb-6">
                                        Be the first! Go to your profile and add &quot;Looking for Team&quot; to your skills so others can find you.
                                    </p>
                                    <Link href="/profile/edit">
                                        <Button className="bg-emerald-600 hover:bg-emerald-500">
                                            <UserPlus className="w-4 h-4 mr-2" />
                                            Update My Profile
                                        </Button>
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <h3 className="text-2xl font-bold mb-2">No Buddies Found</h3>
                                    <p className="text-gray-400 max-w-md mx-auto mb-6">
                                        No active buddies found matching your criteria. Try adjusting your search or be the first to update your profile!
                                    </p>
                                    <Link href="/profile/edit">
                                        <Button className="bg-purple-600 hover:bg-purple-500">
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Create Your Profile
                                        </Button>
                                    </Link>
                                </>
                            )}
                        </motion.div>
                    ) : (
                        <>
                            {/* Results count */}
                            <div className="mb-4 text-sm text-gray-500">
                                Showing {filteredBuddies.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredBuddies.length)} of {filteredBuddies.length} {filteredBuddies.length === 1 ? 'buddy' : 'buddies'}
                                {lookingForTeam && ' looking for a team'}
                            </div>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                            >
                                {paginatedBuddies.map((buddy: any, idx: number) => (
                                    <motion.div
                                        key={buddy.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                    >
                                        <BuddyCard buddy={buddy} />
                                    </motion.div>
                                ))}
                            </motion.div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="mt-12 flex items-center justify-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === 1}
                                        onClick={() => {
                                            setIsFiltering(true);
                                            setTimeout(() => {
                                                setCurrentPage(prev => Math.max(1, prev - 1));
                                                setIsFiltering(false);
                                                window.scrollTo({ top: 400, behavior: 'smooth' });
                                            }, 400);
                                        }}
                                        className="border-white/10 text-gray-300 hover:text-white bg-white/5"
                                    >
                                        Previous
                                    </Button>
                                    
                                    <div className="flex items-center gap-1 mx-2 hidden sm:flex">
                                        {Array.from({ length: totalPages }).map((_, i) => {
                                            if (totalPages > 7) {
                                                if (i !== 0 && i !== totalPages - 1 && Math.abs(i + 1 - currentPage) > 1) {
                                                    if (i === 1 && currentPage > 3) return <span key={`ellipsis-start-${i}`} className="text-gray-500 mx-1">...</span>;
                                                    if (i === totalPages - 2 && currentPage < totalPages - 2) return <span key={`ellipsis-end-${i}`} className="text-gray-500 mx-1">...</span>;
                                                    return null;
                                                }
                                            }
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => {
                                                        if (currentPage === i + 1) return;
                                                        setIsFiltering(true);
                                                        setTimeout(() => {
                                                            setCurrentPage(i + 1);
                                                            setIsFiltering(false);
                                                            window.scrollTo({ top: 400, behavior: 'smooth' });
                                                        }, 400);
                                                    }}
                                                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                                                        currentPage === i + 1 
                                                        ? 'bg-purple-600 text-white' 
                                                        : 'text-gray-400 hover:bg-white/10 hover:text-white'
                                                    }`}
                                                >
                                                    {i + 1}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="sm:hidden text-gray-400 text-sm mx-4">
                                        Page {currentPage} of {totalPages}
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === totalPages}
                                        onClick={() => {
                                            setIsFiltering(true);
                                            setTimeout(() => {
                                                setCurrentPage(prev => Math.min(totalPages, prev + 1));
                                                setIsFiltering(false);
                                                window.scrollTo({ top: 400, behavior: 'smooth' });
                                            }, 400);
                                        }}
                                        className="border-white/10 text-gray-300 hover:text-white bg-white/5"
                                    >
                                        Next
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>
        </div>
    );
}

// Loading component for Suspense fallback
function BuddyFinderLoading() {
    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <div className="text-center">
                <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Loading Buddy Finder...</p>
            </div>
        </div>
    );
}

// Default export with Suspense wrapper to prevent hydration mismatch
export default function BuddyFinderPage() {
    return (
        <Suspense fallback={<BuddyFinderLoading />}>
            <BuddyFinderContent />
        </Suspense>
    );
}
