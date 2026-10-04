"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Activity, Terminal, ChevronRight, Home, Target, ArrowRight, Clock, CheckCircle } from "lucide-react";
import { format, differenceInSeconds } from "date-fns";
import { motion, AnimatePresence, useMotionValue, useSpring, useMotionTemplate } from "framer-motion";
import Link from "next/link";
import { LiveHackbot } from "@/components/hackathon/live-hackbot";

/* ========================================================
   VERTICAL TIMELINE COMPONENT
   ======================================================== */
function VerticalTimelineItem({ ev, now, isLast }: { ev: any, now: Date, isLast: boolean }) {
    const start = new Date(ev.start_time);
    const end = ev.end_time ? new Date(ev.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
    const isPast = now > end;
    const isCurrent = now >= start && now <= end;
    const isFuture = now < start;

    const [timeLeftStr, setTimeLeftStr] = useState("");

    useEffect(() => {
        const calculate = () => {
            const currentTime = new Date();
            if (currentTime < start) {
                const diff = differenceInSeconds(start, currentTime);
                const hrs = Math.floor(diff / 3600);
                const mins = Math.floor((diff % 3600) / 60);
                setTimeLeftStr(`IN ${hrs > 0 ? hrs + 'h ' : ''}${mins}m`);
            } else if (currentTime >= start && currentTime <= end) {
                const diff = differenceInSeconds(end, currentTime);
                const hrs = Math.floor(diff / 3600);
                const mins = Math.floor((diff % 3600) / 60);
                setTimeLeftStr(`ENDS IN ${hrs > 0 ? hrs + 'h ' : ''}${mins}m`);
            } else {
                setTimeLeftStr(`DONE`);
            }
        };
        calculate();
        const t = setInterval(calculate, 1000);
        return () => clearInterval(t);
    }, [start, end]);

    return (
        <div className="relative flex gap-4 pr-2">
            {/* Timeline Line */}
            {!isLast && (
                <div className={`absolute left-4 top-10 bottom-[-20px] w-0.5 ${isPast ? 'bg-[#00FF41]/20' : 'bg-white/5'}`} />
            )}
            
            {/* Timeline Node */}
            <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 
                ${isCurrent ? 'bg-[#00FF41]/20 border-[#00FF41] shadow-[0_0_15px_rgba(0,255,65,0.3)]' : 
                  isPast ? 'bg-[#00FF41]/10 border-[#00FF41]/40' : 
                  'bg-[#03030F] border-white/10'}`
            }>
                {isCurrent ? <Activity className="w-3.5 h-3.5 text-[#00FF41] animate-pulse" /> : 
                 isPast ? <CheckCircle className="w-3.5 h-3.5 text-[#00FF41]/60" /> : 
                 <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
            </div>

            {/* Content */}
            <div className={`flex flex-col pb-8 ${isPast ? 'opacity-50' : isFuture ? 'opacity-80' : 'opacity-100'} transition-opacity hover:opacity-100`}>
                <div className="flex items-baseline justify-between gap-4 mb-1">
                    <h4 className={`text-base font-bold font-sans uppercase leading-tight ${isCurrent ? 'text-white' : 'text-white/80'}`}>{ev.title}</h4>
                    <span className={`text-[10px] whitespace-nowrap font-mono font-bold tracking-widest ${isCurrent ? 'text-[#00FF41]' : isFuture ? 'text-[#FF6B00]' : 'text-white/30'}`}>
                        {timeLeftStr}
                    </span>
                </div>
                <div className="text-xs font-mono text-white/40 tracking-widest mb-1.5">
                    {format(start, "HH:mm")}
                </div>
                {ev.description && <p className="text-xs text-white/50 font-sans line-clamp-2 leading-relaxed">{ev.description}</p>}
            </div>
        </div>
    );
}

export default function LiveDashboardClient({
    initialSettings,
    initialSchedule,
    initialShortlisted
}: {
    initialSettings: any;
    initialSchedule: any[];
    initialShortlisted: any[];
}) {
    const router = useRouter();
    const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
    const [isFinished, setIsFinished] = useState(false);
    const [totalSeconds, setTotalSeconds] = useState(0);
    const [totalDurationSeconds, setTotalDurationSeconds] = useState(0);

    // GLITCH ENGINE STATE
    const [glitchActive, setGlitchActive] = useState(false);
    const [glitchText, setGlitchText] = useState({ hours: "00", minutes: "00", seconds: "00" });
    const containerRef = useRef<HTMLDivElement>(null);

    // INTERACTIVE FLASHLIGHT PHYSICS
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mouseX.set(e.clientX - rect.left);
        mouseY.set(e.clientY - rect.top);
    };
    const springX = useSpring(mouseX, { stiffness: 100, damping: 15 });
    const springY = useSpring(mouseY, { stiffness: 100, damping: 15 });
    const bgGradient = useMotionTemplate`radial-gradient(circle 500px at ${springX}px ${springY}px, rgba(0, 255, 65, 0.08), transparent 70%)`;

    // Auto refresh data every 15 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            router.refresh();
        }, 15000);
        return () => clearInterval(interval);
    }, [router]);

    // Timer Logic
    useEffect(() => {
        if (!initialSettings?.timer_start || !initialSettings?.is_running) return;

        const startTime = new Date(initialSettings.timer_start);
        const durationMs = initialSettings.duration_hours * 60 * 60 * 1000;
        const endTime = new Date(startTime.getTime() + durationMs);
        setTotalDurationSeconds(Math.floor(durationMs / 1000));

        const calculateTimeLeft = () => {
            const now = new Date();
            const diffSeconds = differenceInSeconds(endTime, now);

            if (diffSeconds <= 0) {
                setIsFinished(true);
                setTotalSeconds(0);
                setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
            } else {
                setIsFinished(false);
                setTotalSeconds(diffSeconds);
                setTimeLeft({
                    hours: Math.floor(diffSeconds / 3600),
                    minutes: Math.floor((diffSeconds % 3600) / 60),
                    seconds: diffSeconds % 60
                });
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(timer);
    }, [initialSettings]);

    // Glitch Effect Loop
    useEffect(() => {
        if (!glitchActive) return;
        const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*";
        const glitchInterval = setInterval(() => {
            setGlitchText({
                hours: chars[Math.floor(Math.random() * chars.length)] + chars[Math.floor(Math.random() * chars.length)],
                minutes: chars[Math.floor(Math.random() * chars.length)] + chars[Math.floor(Math.random() * chars.length)],
                seconds: chars[Math.floor(Math.random() * chars.length)] + chars[Math.floor(Math.random() * chars.length)],
            });
        }, 50);
        return () => clearInterval(glitchInterval);
    }, [glitchActive]);

    const progressPercent = totalDurationSeconds > 0 ? Math.max(0, Math.min(100, ((totalDurationSeconds - totalSeconds) / totalDurationSeconds) * 100)) : 0;
    const totalHoursLeft = totalSeconds / 3600;

    // Urgency levels
    const urgency = useMemo(() => {
        if (isFinished) return 'finished';
        if (totalHoursLeft <= 0.083) return 'final'; 
        if (totalHoursLeft <= 0.5) return 'critical'; 
        if (totalHoursLeft <= 2) return 'urgent';     
        if (totalHoursLeft <= 6) return 'warning';     
        return 'normal';
    }, [totalHoursLeft, isFinished]);

    // Phase detection
    const phase = useMemo(() => {
        if (isFinished) return { label: 'EVENT CONCLUDED', color: '#FF4136', icon: <CheckCircle className="w-8 h-8" />, desc: 'The hackathon has ended. Results inbound.' };
        if (totalHoursLeft <= 1) return { label: 'SUBMISSION WINDOW', color: '#FFD700', icon: <Target className="w-8 h-8"/>, desc: 'Final hour! Code freeze imminent, prepare submissions.' };
        if (totalHoursLeft <= 3) return { label: 'CRUNCH TIME', color: '#FF6B00', icon: <Activity className="w-8 h-8"/>, desc: 'Last stretch. Focus purely on MVP completion and demos.' };
        if (totalHoursLeft <= 12) return { label: 'DEEP WORK', color: '#6366F1', icon: <Terminal className="w-8 h-8"/>, desc: 'Core development phase. Avoid distractions, build logic.' };
        return { label: 'HACKING LIVE', color: '#00FF41', icon: <Activity className="w-8 h-8"/>, desc: 'The clock has started. Brainstorm, map, and architect.' };
    }, [totalHoursLeft, isFinished]);



    // Radial progress ring
    const ringRadius = 100;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset = ringCircumference - (progressPercent / 100) * ringCircumference;
    const ringColor = urgency === 'critical' || urgency === 'final' ? '#FF4136' : urgency === 'urgent' ? '#FF6B00' : urgency === 'warning' ? '#FFD700' : '#00FF41';

    const handleGlitchStart = () => setGlitchActive(true);
    const handleGlitchEnd = () => setGlitchActive(false);

    const now = new Date();
    const sortedSchedule = [...initialSchedule].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    return (
        <div ref={containerRef} className="container mx-auto max-w-[1500px] px-4 md:px-6 pb-24 animate-in fade-in duration-1000 relative">
            
            {/* NAVIGATION HEADER */}
            <div className="flex items-center justify-between mb-6 bg-white/[0.02] border border-white/10 rounded-2xl px-6 py-4 backdrop-blur-md">
                <Link href="/" className="inline-flex items-center gap-2.5 text-white/60 hover:text-white transition-colors uppercase tracking-widest text-xs font-bold font-mono group">
                    <Home className="w-4 h-4 transition-transform group-hover:scale-110" /> Home Base
                </Link>
                <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-white/30 uppercase tracking-widest font-bold">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#00FF41] animate-pulse"/> LIVE SYSTEM SYNCED</span>
                </div>
                <Link href="/hackathon" className="inline-flex items-center gap-2.5 text-[#FF6B00] hover:text-[#FFa000] transition-colors uppercase tracking-widest text-xs font-bold font-mono group">
                    Main Portal <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
            </div>

            {/* EVENT TITLE */}
            <div className="flex justify-center mb-10 mt-2 w-full text-center">
                <h1 className="text-[clamp(1.5rem,4vw,3.5rem)] font-heading font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#FF9933] via-white to-[#138808] drop-shadow-2xl">
                    Innovate Bharat Hackathon 2026
                </h1>
            </div>

            {/* MARQUEE ANNOUNCEMENT */}
            {initialSettings?.active_announcement && (
                <div className="w-[100vw] relative left-1/2 -translate-x-1/2 mb-10 bg-gradient-to-r from-[#FF6B00] via-[#FFa000] to-[#FF6B00] border-y border-white/20 text-black overflow-hidden flex whitespace-nowrap py-3 font-heading font-black text-2xl uppercase tracking-widest shadow-[0_0_30px_rgba(255,107,0,0.3)]">
                   <motion.div 
                        initial={{ x: "0%" }}
                        animate={{ x: "-50%" }}
                        transition={{ ease: "linear", duration: 25, repeat: Infinity }}
                        className="flex items-center"
                   >
                        {[...Array(6)].map((_, i) => (
                            <span key={i} className="flex items-center">
                                <span className="px-8 text-black flex items-center"><Megaphone className="inline-block w-6 h-6 mr-3" /> {initialSettings.active_announcement}</span>
                                <span className="px-8 text-black/50">{'///'}</span>
                            </span>
                        ))}
                   </motion.div>
                </div>
            )}

            <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 font-mono mb-16">
                
                {/* ========================================================
                    LEFT COL: MASSIVE GLASSSMORPHIC TIMER 
                    ======================================================== */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <motion.div 
                        onMouseMove={handleMouseMove}
                        whileHover={{ scale: 1.01 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="bg-[#03030F]/60 backdrop-blur-2xl p-8 md:p-14 rounded-[32px] border border-white/10 relative overflow-hidden group min-h-[450px] flex flex-col shadow-2xl"
                    >
                        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-multiply pointer-events-none z-0" />
                        
                        {/* INTERACTIVE MOUSE TRACKER */}
                        <motion.div
                            className="absolute inset-0 pointer-events-none z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-screen"
                            style={{ background: bgGradient }}
                        />

                        {/* BACKGROUND GRID */}
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,#000_70%,transparent_100%)] pointer-events-none z-0" />
                        
                        {/* Pulsing state visualizer */}
                        {(urgency === 'critical' || urgency === 'final') && <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse pointer-events-none z-0 shadow-[0_0_20px_red]" />}
                        {urgency === 'urgent' && <div className="absolute top-0 left-0 w-full h-1 bg-[#FF6B00] animate-pulse pointer-events-none z-0 shadow-[0_0_20px_#FF6B00]" />}

                        <div className="flex justify-between items-start mb-8 relative z-10 w-full">
                            <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl border font-bold uppercase tracking-widest shadow-lg bg-[#03030F]" style={{ borderColor: `${phase.color}40`, color: phase.color }}>
                                <div className="animate-pulse">{phase.icon}</div>
                                <span className="text-sm">{initialSettings?.is_running ? "SYSTEM ACTIVE" : 'SYSTEM PAUSED'}</span>
                            </div>

                            {/* GLITCH TRIGGER */}
                            <motion.button 
                                whileTap={{ scale: 0.9 }}
                                onMouseDown={handleGlitchStart}
                                onMouseUp={handleGlitchEnd}
                                onMouseLeave={handleGlitchEnd}
                                className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-white/30 text-white/50 hover:text-white rounded-xl px-4 py-2 font-black uppercase tracking-widest transition-all select-none z-10"
                            >
                                <Terminal className="w-5 h-5" />
                            </motion.button>
                        </div>

                        {/* GIANT COUNTDOWN */}
                        <div className="flex items-center gap-3 md:gap-8 justify-center relative z-10 mt-auto mb-auto w-full max-w-full drop-shadow-2xl">
                            <div className="flex flex-col items-center min-w-0">
                                <span className={`text-[clamp(4.5rem,12vw,14rem)] font-black leading-none tracking-tighter ${urgency==='critical'?'text-red-500':'text-white'} ${glitchActive ? 'text-[#00FF41]' : ''}`}>
                                    {glitchActive ? glitchText.hours : String(timeLeft.hours).padStart(2, '0')}
                                </span>
                                <span className={`text-white/30 tracking-[0.2em] md:tracking-[0.5em] text-[10px] md:text-xs font-bold uppercase mt-2 ${glitchActive ? 'text-[#00FF41]' : ''}`}>Hours</span>
                            </div>
                            <span className={`text-[clamp(3.5rem,9vw,9rem)] leading-none mb-4 md:mb-8 font-light ${urgency==='critical'?'text-red-500/50 animate-pulse':'text-white/20'}`}>:</span>
                            <div className="flex flex-col items-center min-w-0">
                                <span className={`text-[clamp(4.5rem,12vw,14rem)] font-black leading-none tracking-tighter ${urgency==='critical'?'text-red-500':'text-white'} ${glitchActive ? 'text-[#00FF41]' : ''}`}>
                                    {glitchActive ? glitchText.minutes : String(timeLeft.minutes).padStart(2, '0')}
                                </span>
                                <span className={`text-white/30 tracking-[0.2em] md:tracking-[0.5em] text-[10px] md:text-xs font-bold uppercase mt-2 ${glitchActive ? 'text-[#00FF41]' : ''}`}>Minutes</span>
                            </div>
                            <span className={`text-[clamp(3.5rem,9vw,9rem)] leading-none mb-4 md:mb-8 font-light ${urgency==='critical'?'text-red-500/50 animate-pulse':'text-white/20'}`}>:</span>
                            <div className="flex flex-col items-center min-w-0">
                                <span className={`text-[clamp(4.5rem,12vw,14rem)] font-black leading-none tracking-tighter text-[#00FF41]`}>
                                    {glitchActive ? glitchText.seconds : String(timeLeft.seconds).padStart(2, '0')}
                                </span>
                                <span className={`text-[#00FF41]/40 tracking-[0.2em] md:tracking-[0.5em] text-[10px] md:text-xs font-bold uppercase mt-2`}>Seconds</span>
                            </div>
                        </div>

                        {/* HACKBOT COMPANION & OVERALL PROGRESS */}
                        <div className="relative z-10 mt-auto flex items-end justify-between border-t border-[#00FF41]/10 pt-6 hidden sm:flex">
                            {/* Left Side: Hackbot */}
                            <div className="flex items-center gap-6">
                                <div className="scale-75 origin-bottom-left flex-shrink-0">
                                    <LiveHackbot urgency={urgency as any} />
                                </div>
                                <div className="text-[10px] uppercase tracking-widest font-mono font-bold text-white/30 border-l border-white/10 pl-6 h-full flex flex-col justify-center">
                                    <span className="block text-white/50 mb-1.5 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse"/>
                                        Companion DB-01
                                    </span>
                                    {urgency === 'critical' || urgency === 'final' ? 
                                        <span className="text-[#FF4136]">PANIC PROTOCOL ENGAGED</span> : 
                                    urgency === 'urgent' || urgency === 'warning' ?
                                        <span className="text-[#FF6B00]">FOCUS MODE ACTIVE</span> :
                                        <span className="text-[#00FF41]">SYSTEMS PURRING</span>
                                    }
                                </div>
                            </div>

                            {/* Right Side: Overall Progress */}
                            {initialSettings?.is_running && (
                                <div className="flex items-center gap-4 text-right select-none">
                                    <div className="flex flex-col items-end pt-2">
                                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Overall Progress</h3>
                                        <div className="text-2xl font-black tabular-nums tracking-tighter leading-none" style={{ color: ringColor }}>
                                            {progressPercent.toFixed(1)}<span className="text-base ml-1 opacity-60">%</span>
                                        </div>
                                    </div>
                                    <div className="relative w-[50px] h-[50px] flex items-center justify-center shrink-0">
                                        <svg width="50" height="50" className="-rotate-90">
                                            <circle cx="25" cy="25" r={22} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                                            <circle
                                                cx="25" cy="25" r={22}
                                                fill="none"
                                                stroke={ringColor}
                                                strokeWidth="4"
                                                strokeLinecap="round"
                                                strokeDasharray={2 * Math.PI * 22}
                                                strokeDashoffset={(2 * Math.PI * 22) - (progressPercent / 100) * (2 * Math.PI * 22)}
                                                className="transition-all duration-1000 ease-linear"
                                                style={{ filter: `drop-shadow(0 0 6px ${ringColor}40)` }}
                                            />
                                        </svg>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Time Is Up Screen Overlay */}
                        {isFinished && (
                            <div className="absolute inset-0 bg-[#03030F]/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-8 border-4 border-red-500 rounded-[32px]">
                                <div className="animate-pulse bg-red-500 text-black px-6 py-2 rounded-lg font-black uppercase tracking-[0.5em] mb-8">
                                    MISSION CONCLUDED
                                </div>
                                <h1 className="text-[80px] md:text-[130px] font-black leading-none text-red-500 tracking-tighter text-center uppercase">
                                    TIME IS UP
                                </h1>
                                <p className="text-xl mt-6 text-white uppercase tracking-widest font-bold">Code Freeze Activated. Prepare for Demo.</p>
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* ========================================================
                    RIGHT COL: CONTEXT MODULAR CARDS 
                    ======================================================== */}
                <div className="lg:col-span-4 flex flex-col gap-6 h-full">
                    
                    {/* CURRENT PHASE CARD */}
                    {initialSettings?.is_running && (
                        <motion.div 
                            whileHover={{ scale: 1.02 }}
                            className="bg-[#03030F]/60 backdrop-blur-xl border border-white/10 p-8 rounded-3xl flex-1 flex flex-col justify-center relative overflow-hidden group shadow-xl"
                        >
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                <div style={{ color: phase.color }}>{phase.icon}</div>
                            </div>
                            <div className="flex items-center gap-3 mb-4">
                                <Target className="w-5 h-5 flex-shrink-0" style={{ color: phase.color }} />
                                <h3 className="text-xs font-bold uppercase tracking-widest text-white/50">Current Phase</h3>
                            </div>
                            <div className="text-3xl md:text-4xl font-heading font-black uppercase mb-3 leading-none drop-shadow-md" style={{ color: phase.color }}>{phase.label}</div>
                            <p className="text-sm text-white/40 font-sans leading-relaxed">{phase.desc}</p>
                        </motion.div>
                    )}

                    {/* EVENT FLOW TRACKER (VERTICAL) */}
                    {sortedSchedule.length > 0 && (
                        <div className="bg-[#03030F]/60 backdrop-blur-xl border border-white/10 p-8 rounded-3xl flex-1 flex flex-col relative shadow-xl">
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10 z-10 relative mt-2">
                                <div className="flex items-center gap-3">
                                    <Clock className="w-5 h-5 text-[#00FF41]" />
                                    <h3 className="text-xl font-heading font-black uppercase tracking-widest text-white">Event Flow</h3>
                                </div>
                                <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-white/40">Schedule</span>
                            </div>
                            
                            <div className="relative flex-1 z-10 w-full pb-4">
                                <div className="pt-2">
                                    {sortedSchedule.map((ev, i) => (
                                        <VerticalTimelineItem key={ev.id} ev={ev} now={now} isLast={i === sortedSchedule.length - 1} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
