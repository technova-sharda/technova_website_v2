'use client'

import { UserNav } from "../auth/user-nav"

import Link from "next/link"
import { useState } from "react"
import { Menu, X, LayoutDashboard, Rocket, User, Settings, LogOut } from "lucide-react"

interface NavbarProps {
    user?: {
        name?: string | null
        email?: string | null
        image?: string | null
        role?: 'student' | 'admin' | 'super_admin' | 'evaluator' | 'student_lead'
    }
}

import { ChevronDown } from "lucide-react"
export function Navbar({ user }: NavbarProps) {
    const [isOpen, setIsOpen] = useState(false)

    const publicLinks = [
        { href: "/", label: "Home" },
        { href: "/events", label: "Events" },
        { href: "/clubs", label: "Clubs" },
        { href: "/leadership", label: "Leadership" },
        { href: "/partners", label: "Partners" },
    ]

    const authLinks = [
        { href: "/leaderboard", label: "Leaderboard" },
        { href: "/dashboard/certificates", label: "My Certificates" },
    ]

    const adminLinks = [
        { href: "/admin/dashboard", label: "Admin" },
        { href: "/scan", label: "Scanner" },
    ]

    const hackathonLink = { href: "/hackathon-portal", label: "Hackathon Portal" }

    const isPrivileged = user?.role === 'admin' || user?.role === 'super_admin'

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-2xl border-b border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.3)]">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    <Link href="/" className="text-xl font-bold text-white flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/assets/logo/technova-new.png" alt="Technova" className="h-10 w-auto" />
                    </Link>

                    {/* Desktop Links */}
                    <div className="hidden md:flex items-center gap-1">
                        {publicLinks.map(link => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="text-gray-300 hover:text-white hover:bg-white/10 px-4 py-2 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]"
                            >
                                {link.label}
                            </Link>
                        ))}

                        <div className="relative group">
                            <Link
                                href="/community"
                                className="flex items-center gap-1 text-gray-300 hover:text-white hover:bg-white/10 px-4 py-2 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] outline-none"
                            >
                                DevSpace <ChevronDown className="h-4 w-4" />
                            </Link>

                            {/* Hover Menu */}
                            <div className="absolute right-0 top-full pt-2 hidden group-hover:block w-48 z-50">
                                <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-xl py-2 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                                    <Link href="/community" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10">Community Hub</Link>
                                    <Link href="/buddy-finder" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10">Buddy Finder</Link>
                                </div>
                            </div>
                        </div>

                        <div className="w-px h-6 bg-gray-700 mx-2" />

                        {/* Authenticated User Links */}
                        {user && (
                            <>
                                {authLinks.map(link => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className="text-gray-400 hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg transition-all text-sm"
                                    >
                                        {link.label}
                                    </Link>
                                ))}

                                {isPrivileged && adminLinks.map(link => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className="text-amber-400 hover:text-amber-200 hover:bg-white/10 px-3 py-2 rounded-lg transition-all text-sm font-medium"
                                    >
                                        {link.label}
                                    </Link>
                                ))}

                                {user && (
                                    <Link
                                        href={hackathonLink.href}
                                        className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-3 py-2 rounded-lg transition-all text-sm font-medium"
                                    >
                                        <Rocket className="w-3.5 h-3.5" /> {hackathonLink.label}
                                    </Link>
                                )}
                            </>
                        )}

                        {user ? (
                            <div className="ml-2">
                                <UserNav user={user} />
                            </div>
                        ) : (
                            <Link
                                href="/login"
                                className="ml-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-5 py-2 rounded-xl font-medium transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]"
                            >
                                Login
                            </Link>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="md:hidden text-white p-2 hover:bg-white/10 rounded-lg"
                    >
                        {isOpen ? <X /> : <Menu />}
                    </button>
                </div>

                {/* Mobile Links */}
                {isOpen && (
                    <div className="md:hidden py-4 space-y-1 border-t border-white/10 max-h-[calc(100vh-80px)] overflow-y-auto pb-8">
                        {publicLinks.map(link => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="block text-gray-300 hover:text-white hover:bg-white/10 py-3 px-4 rounded-lg"
                                onClick={() => setIsOpen(false)}
                            >
                                {link.label}
                            </Link>
                        ))}



                        <div className="border-t border-white/10 my-2 pt-2">
                            <p className="text-xs text-gray-500 px-4 mb-2">DevSpace</p>
                            <Link href="/community" className="block text-gray-300 hover:text-white hover:bg-white/10 py-3 px-4 rounded-lg" onClick={() => setIsOpen(false)}>Community Hub</Link>
                            <Link href="/buddy-finder" className="block text-gray-300 hover:text-white hover:bg-white/10 py-3 px-4 rounded-lg" onClick={() => setIsOpen(false)}>Buddy Finder</Link>
                        </div>

                        <div className="border-t border-white/10 my-2 pt-2">
                            <p className="text-xs text-gray-500 px-4 mb-2">Member Area</p>
                            {user && authLinks.map(link => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="block text-gray-400 hover:text-white hover:bg-white/10 py-3 px-4 rounded-lg"
                                    onClick={() => setIsOpen(false)}
                                >
                                    {link.label}
                                </Link>
                            ))}

                            {user && isPrivileged && adminLinks.map(link => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="block text-amber-400 hover:text-amber-200 hover:bg-white/10 py-3 px-4 rounded-lg"
                                    onClick={() => setIsOpen(false)}
                                >
                                    {link.label}
                                </Link>
                            ))}

                            {user && (
                                <Link
                                    href={hackathonLink.href}
                                    className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 py-3 px-4 rounded-lg font-medium"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <Rocket className="w-4 h-4" /> {hackathonLink.label}
                                </Link>
                            )}
                        </div>

                        {user ? (
                            <div className="border-t border-white/10 mt-4 pt-4 space-y-1">
                                <p className="text-xs text-gray-500 px-4 mb-2">Account</p>

                                {/* User Info */}
                                <div className="px-4 py-2 flex items-center gap-3">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=3b82f6&color=fff`}
                                        alt={user.name || ''}
                                        className="w-10 h-10 rounded-full"
                                    />
                                    <div>
                                        <p className="text-white font-medium">{user.name}</p>
                                        <p className="text-gray-400 text-xs truncate max-w-[200px]">{user.email}</p>
                                    </div>
                                </div>

                                {/* Profile Links */}
                                <Link
                                    href="/profile"
                                    className="flex items-center gap-3 text-gray-300 hover:text-white hover:bg-white/10 py-3 px-4 rounded-lg"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <User className="w-4 h-4" /> My Profile
                                </Link>
                                <Link
                                    href="/profile/edit"
                                    className="flex items-center gap-3 text-gray-300 hover:text-white hover:bg-white/10 py-3 px-4 rounded-lg"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <Settings className="w-4 h-4" /> Edit Profile
                                </Link>

                                {/* Logout Button */}
                                <button
                                    onClick={() => {
                                        setIsOpen(false)
                                        import('next-auth/react').then(({ signOut }) => signOut({ callbackUrl: '/' }))
                                    }}
                                    className="flex items-center gap-3 w-full text-left text-red-400 hover:text-red-300 hover:bg-red-500/10 py-3 px-4 rounded-lg"
                                >
                                    <LogOut className="w-4 h-4" /> Logout
                                </button>
                            </div>
                        ) : (
                            <Link
                                href="/login"
                                className="block bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg text-center font-medium mx-4 mt-4"
                                onClick={() => setIsOpen(false)}
                            >
                                Login
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </nav >
    )
}
