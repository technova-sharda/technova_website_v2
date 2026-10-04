"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Suspense, useEffect, useState } from "react"

function ErrorContent() {
    const searchParams = useSearchParams()
    const error = searchParams?.get("error")
    const [mounted, setMounted] = useState(false)
    // Random positions are picked once; computing them during render made the
    // particles jump to new places on every re-render.
    const [particles] = useState(() => Array.from({ length: 20 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 2 + Math.random() * 4,
    })))

    useEffect(() => {
        setMounted(true)
    }, [])

    const isAccessDenied = error === "AccessDenied"

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-[#050507]">
            {/* Background elements */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
                    style={{
                        background: isAccessDenied
                            ? 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)'
                    }} />
                {/* Floating particles */}
                {mounted && particles.map((p, i) => (
                    <div key={i}
                        className="absolute w-1 h-1 rounded-full animate-pulse"
                        style={{
                            backgroundColor: isAccessDenied ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)',
                            left: `${p.left}%`,
                            top: `${p.top}%`,
                            animationDelay: `${p.delay}s`,
                            animationDuration: `${p.duration}s`,
                        }} />
                ))}
                {/* Grid pattern */}
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                        backgroundSize: '60px 60px'
                    }} />
            </div>

            <div className={`relative w-full max-w-lg transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                {/* Card */}
                <div className="relative bg-[#0a0a0c]/80 backdrop-blur-2xl border border-white/[0.06] rounded-3xl p-8 sm:p-12 shadow-2xl shadow-black/50">
                    {/* Top accent bar */}
                    <div className="absolute top-0 left-8 right-8 h-px"
                        style={{
                            background: isAccessDenied
                                ? 'linear-gradient(90deg, transparent, rgba(239,68,68,0.5), transparent)'
                                : 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)'
                        }} />

                    {/* Icon */}
                    <div className={`mx-auto mb-8 w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500 ${mounted ? 'scale-100' : 'scale-50'}`}
                        style={{
                            background: isAccessDenied
                                ? 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))'
                                : 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))',
                            border: isAccessDenied
                                ? '1px solid rgba(239,68,68,0.15)'
                                : '1px solid rgba(99,102,241,0.15)'
                        }}>
                        {isAccessDenied ? (
                            <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                        ) : (
                            <svg className="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                        )}
                    </div>

                    {/* Title */}
                    <h1 className={`text-center text-2xl sm:text-3xl font-bold tracking-tight mb-3 ${isAccessDenied ? 'text-white' : 'text-white'}`}>
                        {isAccessDenied ? 'Access Denied' : 'Authentication Error'}
                    </h1>

                    {/* Message */}
                    {isAccessDenied ? (
                        <div className="text-center space-y-4 mb-10">
                            <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">
                                This platform is restricted to <span className="text-white font-medium">Sharda University</span> members.
                            </p>
                            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
                                <p className="text-sm text-zinc-500 mb-2">Accepted email domains:</p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {['@ug.sharda.ac.in', '@pg.sharda.ac.in', '@sharda.ac.in'].map(domain => (
                                        <span key={domain} className="px-3 py-1.5 rounded-lg bg-zinc-800/80 text-zinc-300 text-xs font-mono border border-zinc-700/50">
                                            {domain}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <p className="text-zinc-500 text-sm">
                                Please sign in with your college email to continue.
                            </p>
                        </div>
                    ) : (
                        <div className="text-center mb-10">
                            <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">
                                {error === "Configuration"
                                    ? "There is a problem with the server configuration."
                                    : error
                                        ? `An error occurred: ${error}`
                                        : "An unknown authentication error occurred."
                                }
                            </p>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="space-y-3">
                        {isAccessDenied && (
                            <Link href="/login"
                                className="group relative flex justify-center items-center gap-3 w-full py-4 px-6 rounded-2xl font-semibold text-base transition-all duration-300 bg-white text-black hover:bg-zinc-200 active:scale-[0.98]">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                                </svg>
                                Login with College Email
                            </Link>
                        )}
                        <Link href="/"
                            className={`group relative flex justify-center items-center gap-3 w-full py-4 px-6 rounded-2xl font-semibold text-base transition-all duration-300 active:scale-[0.98] ${
                                isAccessDenied
                                    ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700'
                                    : 'bg-white text-black hover:bg-zinc-200'
                            }`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                            </svg>
                            Go to Home
                        </Link>
                        {!isAccessDenied && (
                            <Link href="/login"
                                className="group relative flex justify-center items-center gap-3 w-full py-4 px-6 rounded-2xl font-semibold text-base transition-all duration-300 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 active:scale-[0.98]">
                                Try Again
                            </Link>
                        )}
                    </div>

                    {/* Bottom accent */}
                    <div className="absolute bottom-0 left-8 right-8 h-px"
                        style={{
                            background: isAccessDenied
                                ? 'linear-gradient(90deg, transparent, rgba(239,68,68,0.2), transparent)'
                                : 'linear-gradient(90deg, transparent, rgba(99,102,241,0.2), transparent)'
                        }} />
                </div>

                {/* Status code */}
                <p className="text-center mt-6 text-zinc-700 text-xs font-mono tracking-widest">
                    {isAccessDenied ? 'ERROR 403 · ACCESS DENIED' : `ERROR · ${error?.toUpperCase() || 'UNKNOWN'}`}
                </p>
            </div>
        </div>
    )
}

export default function ErrorPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#050507]">
                <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
        }>
            <ErrorContent />
        </Suspense>
    )
}
