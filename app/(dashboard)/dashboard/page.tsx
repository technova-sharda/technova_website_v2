import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Award, Calendar, CalendarPlus, CheckCircle2, MapPin, Ticket, Trophy, Users, Video, Zap } from "lucide-react"
import { getMyEvents, splitMyEvents, type MyEvent } from "@/lib/data/student-dashboard"
import { getUserRank } from "@/lib/actions/leaderboard"
import { getCachedPublicEvents } from "@/lib/data/public-cache"
import { googleCalendarUrl, toCalendarEntry } from "@/lib/calendar/event-calendar"
import { formatDateShort, formatTime } from "@/lib/utils"
import { BannerImage } from "@/components/ui/banner-image"
import { getClubAccess } from "@/lib/clubs/permissions"

export const metadata = { title: "Dashboard" }

function when(e: MyEvent["event"]) {
    return e.is_multi_day && e.daily_start_time
        ? `${formatDateShort(e.start_time)} – ${formatDateShort(e.end_time)} · ${e.daily_start_time.slice(0, 5)} daily`
        : `${formatDateShort(e.start_time)} · ${formatTime(e.start_time)}`
}

function StatCard({ icon: Icon, label, value, hint, accent }: { icon: any; label: string; value: string | number; hint: string; accent: string }) {
    return (
        <div className="p-5 md:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm text-gray-400">{label}</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{hint}</p>
        </div>
    )
}

export default async function DashboardPage() {
    const session = await auth()
    // Layout and page render in parallel, so the page needs its own guard (the layout's redirect isn't enough)
    if (!session?.user?.id) redirect("/login")
    const userId = session.user.id

    const [myEvents, rank, publicEvents, clubAccess] = await Promise.all([
        getMyEvents(userId),
        getUserRank(userId).catch(() => null),
        getCachedPublicEvents(),
        getClubAccess(session.user.email).catch(() => ({ global: false, clubIds: [] as string[] })),
    ])
    const managesClubs = clubAccess.global || clubAccess.clubIds.length > 0

    const { upcoming, past, suggestions } = splitMyEvents(myEvents, publicEvents)
    const attendedCount = rank?.eventsAttended ?? past.filter(m => m.attended).length
    const certificateCount = myEvents.filter(m => m.certificateId).length

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white">
                        Welcome back{session?.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}!
                    </h1>
                    <p className="text-gray-400 mt-1">Your events, tickets and certificates in one place.</p>
                </div>
                <Link href="/events" className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors">
                    Explore Events <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Club leads, co-leads and Technova's President / VP / Tech Lead */}
            {managesClubs && (
                <Link href="/club-management" className="flex items-center justify-between gap-4 p-4 md:p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 transition-colors">
                    <span className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0"><Users className="w-5 h-5" /></span>
                        <span>
                            <span className="block font-semibold text-white">Club Management</span>
                            <span className="block text-sm text-amber-100/70">{clubAccess.global ? "Manage every club's logo, coordinators and photos" : "Manage your club's logo, coordinators and photos"}</span>
                        </span>
                    </span>
                    <ArrowRight className="w-5 h-5 text-amber-300 shrink-0" />
                </Link>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <StatCard icon={Trophy} label="My XP" value={rank?.xp_points ?? session?.user.xp_points ?? 0} hint="Earn more by attending events" accent="bg-blue-600/30 text-blue-400" />
                <StatCard icon={Zap} label="Rank" value={rank ? `#${rank.rank}` : "–"} hint={rank ? `of ${rank.totalUsers} students` : "Attend an event to get ranked"} accent="bg-orange-600/20 text-orange-400" />
                <StatCard icon={CheckCircle2} label="Events Attended" value={attendedCount} hint={`${myEvents.length} registered in total`} accent="bg-green-600/20 text-green-400" />
                <StatCard icon={Award} label="Certificates" value={certificateCount} hint="Download from My Certificates" accent="bg-violet-600/20 text-violet-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* My upcoming events */}
                <section className="p-5 md:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-xl font-bold text-white">My Upcoming Events</h2>
                        <span className="text-sm text-gray-500">{upcoming.length}</span>
                    </div>
                    {upcoming.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>You haven&apos;t registered for anything coming up.</p>
                            <Link href="/events" className="inline-block mt-3 text-sm text-blue-400 hover:text-blue-300">Browse events →</Link>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {upcoming.map(m => (
                                <li key={m.registrationId} className="p-4 rounded-xl bg-black/40 border border-white/5">
                                    <Link href={`/events/${m.event.slug || m.event.id}`} className="font-semibold text-white hover:text-blue-300">{m.event.title}</Link>
                                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                                        <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{when(m.event)}</span>
                                        <span className="flex items-center gap-1.5">
                                            {m.event.is_virtual ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                            {m.event.is_virtual ? "Online" : (m.event.venue || "TBA")}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <Link href={`/events/${m.event.slug || m.event.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                                            {m.event.is_virtual ? <Video className="w-4 h-4" /> : <Ticket className="w-4 h-4" />}
                                            {m.event.is_virtual ? "Join link" : "My ticket"}
                                        </Link>
                                        <a href={googleCalendarUrl(toCalendarEntry(m.event))} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-gray-300 text-sm">
                                            <CalendarPlus className="w-4 h-4" /> Calendar
                                        </a>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {/* Suggestions */}
                <section className="p-5 md:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-xl font-bold text-white">Open for Registration</h2>
                        <Link href="/events" className="text-sm text-blue-400 hover:text-blue-300">View all →</Link>
                    </div>
                    {suggestions.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No new events right now. Check back soon!</p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {suggestions.map((e: any) => (
                                <li key={e.id}>
                                    <Link href={`/events/${e.slug || e.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-black/40 border border-white/5 hover:border-blue-500/30 transition-colors">
                                        {e.banner ? (
                                            <span className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0">
                                                <BannerImage src={e.banner} alt="" sizes="64px" className="object-cover" />
                                            </span>
                                        ) : (
                                            <div className="w-16 h-16 rounded-lg bg-white/5 shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                            <p className="font-medium text-white truncate">{e.title}</p>
                                            <p className="text-sm text-gray-400">{formatDateShort(e.start_time)} · {e.is_virtual ? "Online" : (e.venue || "On campus")}</p>
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            {/* Past events */}
            {past.length > 0 && (
                <section className="p-5 md:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-xl font-bold text-white">My Past Events</h2>
                        <Link href="/dashboard/certificates" className="text-sm text-blue-400 hover:text-blue-300">My certificates →</Link>
                    </div>
                    <ul className="divide-y divide-white/5">
                        {past.slice(0, 10).map(m => (
                            <li key={m.registrationId} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                                <div className="min-w-0">
                                    <Link href={`/events/${m.event.slug || m.event.id}`} className="font-medium text-white hover:text-blue-300">{m.event.title}</Link>
                                    <p className="text-sm text-gray-500">{formatDateShort(m.event.start_time)} · {m.attended ? "Attended" : "Registered"}</p>
                                </div>
                                {m.certificateId ? (
                                    <a href={`/api/certificate?id=${m.certificateId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium self-start sm:self-auto">
                                        <Award className="w-4 h-4" /> Certificate
                                    </a>
                                ) : (
                                    <Link href={`/events/${m.event.slug || m.event.id}`} className="text-sm text-gray-400 hover:text-white self-start sm:self-auto">Feedback & details →</Link>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    )
}
