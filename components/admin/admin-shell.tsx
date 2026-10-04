'use client'

import { useEffect, useState } from "react"
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react"
import { SidebarNav } from "./sidebar-nav"

/**
 * Admin layout.
 * - Desktop (md+): fixed sidebar that can be collapsed.
 * - Phone: top bar with a menu button; the sidebar is a slide-in drawer that
 *   closes when a page is chosen.
 */
export function AdminShell({ children, userName, userRole, userImage, canViewLogs = false }: {
    children: React.ReactNode,
    userName?: string | null,
    userRole?: string | null,
    userImage?: string | null,
    canViewLogs?: boolean,
}) {
    const [collapsed, setCollapsed] = useState(false)   // desktop
    const [drawerOpen, setDrawerOpen] = useState(false) // phone

    // No background scrolling behind the open drawer
    useEffect(() => {
        document.body.style.overflow = drawerOpen ? "hidden" : ""
        return () => { document.body.style.overflow = "" }
    }, [drawerOpen])

    const avatar = userImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={userImage} alt={userName || ""} className="w-9 h-9 rounded-full border border-white/20" referrerPolicy="no-referrer" />
    ) : (
        <div className="w-9 h-9 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-400 font-bold">
            {userName?.charAt(0).toUpperCase()}
        </div>
    )

    return (
        <div className="min-h-screen bg-black">
            {/* Phone top bar */}
            <header className="md:hidden sticky top-0 z-30 h-14 flex items-center justify-between gap-3 px-3 bg-zinc-950/95 backdrop-blur border-b border-white/10">
                <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="h-10 w-10 flex items-center justify-center rounded-lg text-gray-300 hover:bg-white/10"
                    aria-label="Open menu"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <span className="font-bold text-white">Technova Admin</span>
                {avatar}
            </header>

            {/* Phone drawer backdrop */}
            {drawerOpen && <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setDrawerOpen(false)} aria-hidden />}

            {/* Sidebar: drawer on phones, fixed column on desktop */}
            <aside
                className={`fixed top-0 left-0 z-50 h-[100dvh] w-[min(18rem,85vw)] md:w-64 bg-zinc-900 border-r border-white/10 flex flex-col transition-transform duration-300 ease-out
                    ${drawerOpen ? "translate-x-0" : "-translate-x-full"}
                    ${collapsed ? "md:-translate-x-full" : "md:translate-x-0"}`}
            >
                <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between shrink-0">
                    <h2 className="font-bold text-xl text-white">Technova Admin</h2>
                    <button
                        type="button"
                        onClick={() => setDrawerOpen(false)}
                        className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setCollapsed(true)}
                        className="hidden md:block p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Collapse sidebar"
                    >
                        <PanelLeftClose className="w-5 h-5 pointer-events-none" />
                    </button>
                </div>
                {/* Tapping any link closes the phone drawer */}
                <div className="flex-1 overflow-y-auto overscroll-contain" onClick={e => { if ((e.target as HTMLElement).closest("a")) setDrawerOpen(false) }}>
                    <SidebarNav canViewLogs={canViewLogs} />
                </div>
                <div className="p-4 border-t border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                        {avatar}
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{userName}</p>
                            <p className="text-xs text-gray-500 capitalize">{userRole?.replace("_", " ")}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className={`min-h-screen transition-[margin] duration-300 ${collapsed ? "" : "md:ml-64"}`}>
                {collapsed && (
                    <button
                        type="button"
                        onClick={() => setCollapsed(false)}
                        className="hidden md:block fixed top-4 left-4 z-40 p-2.5 rounded-xl bg-zinc-800 border border-white/10 text-gray-400 hover:text-white hover:bg-zinc-700 transition-colors shadow-lg"
                        aria-label="Open sidebar"
                    >
                        <PanelLeftOpen className="w-5 h-5 pointer-events-none" />
                    </button>
                )}
                <div className={`p-3 sm:p-5 md:p-8 max-w-[1400px] mx-auto min-w-0 ${collapsed ? "md:pl-20" : ""}`}>
                    {children}
                </div>
            </main>
        </div>
    )
}
