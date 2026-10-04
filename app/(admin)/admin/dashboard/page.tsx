import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { createClient as createServerClient } from "@supabase/supabase-js"
import { Calendar, Users, IndianRupee, Shield, TrendingUp, Activity, Crown, Star, Sparkles } from "lucide-react"
import { formatDate } from "@/lib/utils"
import Link from "next/link"

async function getAdminStats() {
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { count: eventsCount, error: dbError } = await supabase.from('events').select('*', { count: 'exact', head: true })
    const { count: registrationsCount } = await supabase.from('registrations').select('*', { count: 'exact', head: true })
    const { count: clubsCount } = await supabase.from('clubs').select('*', { count: 'exact', head: true })

    // Calculate Revenue from Sponsorships
    let totalRevenue = 0
    const { data: sponsorships } = await supabase.from('sponsorships').select('amount')
    if (sponsorships) {
        totalRevenue += sponsorships.reduce((sum, s) => sum + s.amount, 0)
    }

    // Real count of admins and super admins (managed on the Roles page)
    const { count: adminsCount } = await supabase
        .schema('next_auth')
        .from('users')
        .select('id', { count: 'exact', head: true })
        .in('role', ['admin', 'super_admin'])

    // Get recent events
    const { data: recentEvents } = await supabase
        .from('events')
        .select('id, title, start_time, status')
        .order('created_at', { ascending: false })
        .limit(5)

    // Real health checks (this panel used to be hard-coded "All Systems Operational")
    const { data: lastReminder } = await supabase
        .from('events')
        .select('reminder_sent_at')
        .not('reminder_sent_at', 'is', null)
        .order('reminder_sent_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    const health = {
        databaseOk: !dbError,
        emailConfigured: !!process.env.RESEND_API_KEY,
        remindersConfigured: !!process.env.CRON_SECRET,
        lastReminderAt: (lastReminder?.reminder_sent_at as string | null) || null,
    }

    return {
        health,
        events: eventsCount || 0,
        registrations: registrationsCount || 0,
        revenue: totalRevenue,
        scanners: adminsCount || 0,
        clubs: clubsCount || 0,
        recentEvents: recentEvents || []
    }
}

export default async function AdminDashboardPage() {
    // Own guard: the admin layout's check runs in parallel with this page, not before it
    const session = await auth()
    if (!session) redirect('/login')
    if (session.user.role !== 'super_admin') return null // the layout shows its "Access restricted" message
    const stats = await getAdminStats()

    const statCards = [
        { label: "Total Events", value: stats.events, icon: Calendar, color: "blue", gradient: "from-blue-600/20 to-blue-500/10", borderColor: "border-blue-500/30" },
        { label: "Registrations", value: stats.registrations, icon: Users, color: "green", gradient: "from-green-600/20 to-green-500/10", borderColor: "border-green-500/30" },
        { label: "Revenue", value: `₹${stats.revenue.toLocaleString()}`, icon: IndianRupee, color: "amber", gradient: "from-amber-600/20 to-amber-500/10", borderColor: "border-amber-500/30" },
        { label: "Team / Admins", value: stats.scanners, icon: Shield, color: "purple", gradient: "from-purple-600/20 to-purple-500/10", borderColor: "border-purple-500/30" },
    ]

    return (
        <div className="min-h-screen bg-black p-6 md:p-8">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[150px]" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative space-y-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Crown className="w-8 h-8 text-amber-400" />
                            Admin Dashboard
                        </h1>
                        <p className="text-gray-400 mt-1">Monitor your Technova platform at a glance</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-sm text-amber-300 font-medium">
                            <Sparkles className="w-4 h-4 inline-block mr-2" />
                            Season 2025-2026
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {statCards.map((stat, i) => (
                        <div
                            key={i}
                            className={`p-6 rounded-2xl bg-gradient-to-br ${stat.gradient} border ${stat.borderColor} backdrop-blur-xl hover:scale-[1.02] transition-transform duration-300`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-2xl bg-${stat.color}-600/30 flex items-center justify-center shadow-lg`}>
                                    <stat.icon className={`w-7 h-7 text-${stat.color}-400`} />
                                </div>
                                <div>
                                    <p className="text-gray-400 text-sm font-medium">{stat.label}</p>
                                    <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Link
                        href="/admin/events/new"
                        className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40 transition-all text-center group"
                    >
                        <Calendar className="w-6 h-6 text-blue-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-sm text-white font-medium">New Event</span>
                    </Link>
                    <Link
                        href="/admin/events"
                        className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 hover:border-green-500/40 transition-all text-center group"
                    >
                        <Users className="w-6 h-6 text-green-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-sm text-white font-medium">Manage Events</span>
                    </Link>
                    <Link
                        href="/admin/registrations"
                        className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/40 transition-all text-center group"
                    >
                        <Star className="w-6 h-6 text-purple-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-sm text-white font-medium">Registrations</span>
                    </Link>
                    <Link
                        href="/admin/settings"
                        className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all text-center group"
                    >
                        <IndianRupee className="w-6 h-6 text-amber-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-sm text-white font-medium">Finances</span>
                    </Link>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Events */}
                    <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-blue-400" />
                                Recent Events
                            </h2>
                            <Link href="/admin/events" className="text-sm text-blue-400 hover:text-blue-300">
                                View All →
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {stats.recentEvents.length === 0 ? (
                                <div className="text-center py-12">
                                    <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-500">No events yet</p>
                                    <Link href="/admin/events/new" className="text-sm text-blue-400 hover:text-blue-300 mt-2 inline-block">
                                        Create your first event →
                                    </Link>
                                </div>
                            ) : (
                                stats.recentEvents.map((event: any) => (
                                    <Link
                                        key={event.id}
                                        href={`/admin/events/${event.id}`}
                                        className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group"
                                    >
                                        <div>
                                            <p className="font-medium text-white group-hover:text-blue-400 transition-colors">{event.title}</p>
                                            <p className="text-sm text-gray-500">{formatDate(event.start_time)}</p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${event.status === 'live'
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            : event.status === 'draft'
                                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                            }`}>
                                            {event.status}
                                        </span>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>

                    {/* System Status */}
                    <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Activity className="w-5 h-5 text-green-400" />
                                System Status
                            </h2>
                        </div>
                        <div className="space-y-4">
                            {(() => {
                                const issues = [
                                    !stats.health.databaseOk && 'Database is not reachable',
                                    !stats.health.emailConfigured && 'Email sending is not configured (RESEND_API_KEY)',
                                    !stats.health.remindersConfigured && 'Event reminders are not scheduled (CRON_SECRET missing)',
                                    stats.health.remindersConfigured && !stats.health.lastReminderAt && 'Event reminders have never been sent',
                                ].filter(Boolean) as string[]
                                return issues.length === 0 ? (
                                    <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                        <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                        <span className="text-green-400 font-medium">All checks passing</span>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                        <p className="text-amber-400 font-medium mb-1">{issues.length} {issues.length === 1 ? 'issue needs' : 'issues need'} attention</p>
                                        <ul className="text-sm text-amber-200/80 list-disc pl-5 space-y-0.5">
                                            {issues.map(issue => <li key={issue}>{issue}</li>)}
                                        </ul>
                                    </div>
                                )
                            })()}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                    <p className="text-gray-500 text-xs uppercase tracking-wide">Database</p>
                                    <p className="text-white font-medium mt-1 flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${stats.health.databaseOk ? 'bg-green-500' : 'bg-red-500'}`} />
                                        {stats.health.databaseOk ? 'Connected' : 'Error'}
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                    <p className="text-gray-500 text-xs uppercase tracking-wide">Email</p>
                                    <p className="text-white font-medium mt-1 flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${stats.health.emailConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
                                        {stats.health.emailConfigured ? 'Configured' : 'Key missing'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                                <TrendingUp className="w-5 h-5 text-blue-400" />
                                <div>
                                    <p className="text-white font-medium">Event Reminders</p>
                                    <p className="text-gray-500 text-sm">
                                        {!stats.health.remindersConfigured
                                            ? 'Not scheduled — set CRON_SECRET and a cron job'
                                            : stats.health.lastReminderAt
                                                ? `Last sent ${formatDate(stats.health.lastReminderAt)}`
                                                : 'Scheduled, none sent yet'}
                                    </p>
                                </div>
                            </div>

                            {/* Club Stats */}
                            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Crown className="w-5 h-5 text-purple-400" />
                                        <div>
                                            <p className="text-white font-medium">Active Clubs</p>
                                            <p className="text-gray-500 text-sm">{stats.clubs} clubs registered</p>
                                        </div>
                                    </div>
                                    <Link href="/leadership" className="text-sm text-purple-400 hover:text-purple-300">
                                        View Team →
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
