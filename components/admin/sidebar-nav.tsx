'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, BarChart, Settings, Home, BookOpen, Rocket, FileText, ShieldCheck, UserRound } from "lucide-react"

export function SidebarNav() {
    const pathname = usePathname()

    const isActive = (path: string) => {
        if (!pathname) return false
        return pathname === path || pathname.startsWith(`${path}/`)
    }

    return (
        <nav className="flex-1 p-4 space-y-2">
            <Link href="/" className="flex items-center gap-3 p-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                <Home className="w-5 h-5" /> Back to App
            </Link>

            <div className="pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Manage</div>

            <Link
                href="/admin/dashboard"
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive('/admin/dashboard')
                    ? 'bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                <BarChart className="w-5 h-5" /> Overview
            </Link>

            <Link
                href="/admin/events"
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive('/admin/events')
                    ? 'bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                <Calendar className="w-5 h-5" /> Events
            </Link>

            <Link
                href="/admin/forms"
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive('/admin/forms')
                    ? 'bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                <FileText className="w-5 h-5" /> Forms
            </Link>

            <Link
                href="/admin/resources"
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive('/admin/resources')
                    ? 'bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                <BookOpen className="w-5 h-5" /> Resources
            </Link>

            <Link
                href="/admin/people"
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive('/admin/people')
                    ? 'bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                <UserRound className="w-5 h-5" /> People
            </Link>

            <Link
                href="/hackathon-portal"
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive('/hackathon-portal')
                    ? 'bg-emerald-600/20 text-emerald-400 font-medium border border-emerald-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                <Rocket className="w-5 h-5 text-emerald-500" /> Hackathon Portal
            </Link>

            <div className="pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">System</div>

            {/* The whole admin panel is super-admin only, so everyone who sees this link may use it. */}
            <Link
                href="/admin/roles"
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive('/admin/roles')
                    ? 'bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                <ShieldCheck className="w-5 h-5" /> Admin Roles
            </Link>

            <Link
                href="/admin/settings"
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive('/admin/settings')
                    ? 'bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                <Settings className="w-5 h-5" /> Settings
            </Link>
        </nav>
    )
}
