import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { istDateKey, spansMultipleIstDays } from '@/lib/dates/ist'
import { auth } from '@/lib/auth'
import { fetchAllRows, fetchInChunks } from '@/lib/supabase/fetch-all'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const session = await auth()

        if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { eventId } = await params
        const { searchParams } = new URL(req.url)
        const dayFilter = searchParams.get('day') // Format: YYYY-MM-DD

        // Event, registrations and check-ins in parallel; paged so big events aren't cut at 1,000 rows
        const [{ data: event }, regsRes, checkinsRes] = await Promise.all([
            supabase.from('events').select('start_time, end_time, is_multi_day, excluded_dates').eq('id', eventId).single(),
            fetchAllRows<{ id: string; user_id: string; attended: boolean; created_at: string }>((f, t) =>
                supabase.from('registrations').select('id, user_id, attended, created_at').eq('event_id', eventId).order('created_at', { ascending: false }).order('id').range(f, t)),
            fetchAllRows<{ user_id: string; checkin_date: string; xp_awarded: number }>((f, t) =>
                supabase.from('daily_checkins').select('id, user_id, checkin_date, xp_awarded').eq('event_id', eventId).order('id').range(f, t)),
        ])

        // Calculate event days
        let eventDays = 1
        let eventDaysList: string[] = []
        const excludedDates: string[] = (event?.excluded_dates || []) as string[]

        if (event) {
            const start = new Date(event.start_time)
            const end = event.end_time ? new Date(event.end_time) : start
            // IST calendar days, matching how daily check-ins are keyed (the server runs in UTC)
            const isMultiDay = event.is_multi_day || spansMultipleIstDays(start, end)

            if (isMultiDay) {
                // Every IST date from the start day to the end day, excluding holidays.
                // (The old loop stepped from the start *time*, so a last day whose end
                // time was earlier in the day than the start time was dropped.)
                const DAY_MS = 24 * 60 * 60 * 1000
                const lastDay = Date.parse(`${istDateKey(end)}T00:00:00Z`)
                for (let day = Date.parse(`${istDateKey(start)}T00:00:00Z`); day <= lastDay; day += DAY_MS) {
                    const dateStr = new Date(day).toISOString().slice(0, 10)
                    if (!excludedDates.includes(dateStr)) {
                        eventDaysList.push(dateStr)
                    }
                }
                eventDays = eventDaysList.length
            } else {
                eventDaysList = [istDateKey(start)]
            }
        }

        const registrations = regsRes.data
        if (regsRes.error) {
            console.error('Error fetching registrations:', regsRes.error)
            return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 })
        }

        if (!registrations || registrations.length === 0) {
            return NextResponse.json({
                attendees: [],
                eventDays,
                eventDaysList,
                isMultiDay: eventDays > 1
            })
        }

        // Get user details from next_auth schema
        const userIds = registrations.map(r => r.user_id)

        const { data: users, error: userError } = await fetchInChunks<{ id: string; name: string | null; email: string | null; image: string | null }>(userIds, chunk =>
            supabase.schema('next_auth' as unknown as 'public').from('users').select('id, name, email, image').in('id', chunk))
        if (userError) console.error('Error fetching users:', userError)
        const dailyCheckins = checkinsRes.data

        // Create check-in map: userId -> { date -> xp }
        const checkinMap = new Map<string, Map<string, number>>()

        // Get event start date string for remapping early check-ins
        let eventStartDateStr = ''
        if (event) {
            eventStartDateStr = istDateKey(event.start_time)
        }

        dailyCheckins?.forEach(c => {
            if (!checkinMap.has(c.user_id)) {
                checkinMap.set(c.user_id, new Map())
            }

            // Fix: If check-in is before event start (early check-in), map it to Day 1
            let dateKey = c.checkin_date
            if (eventStartDateStr && c.checkin_date < eventStartDateStr) {
                dateKey = eventStartDateStr
            }

            checkinMap.get(c.user_id)!.set(dateKey, c.xp_awarded)
        })

        // Map users to registrations
        const userMap = new Map(users?.map(u => [u.id, u]) || [])
        const today = istDateKey(new Date())

        const attendees = registrations.map(reg => {
            const user = userMap.get(reg.user_id)
            const userCheckins = checkinMap.get(reg.user_id)
            const daysCheckedIn = userCheckins?.size || 0
            const checkedInToday = userCheckins?.has(today) || false
            const checkedInOnDay = dayFilter ? (userCheckins?.has(dayFilter) || false) : null

            return {
                id: reg.id,
                userId: reg.user_id,
                name: user?.name || 'Unknown',
                email: user?.email || '',
                image: user?.image,
                attended: reg.attended || false,
                registered_at: reg.created_at,
                // Daily check-in info
                daysCheckedIn,
                checkedInToday,
                checkedInOnDay,
                checkinDates: userCheckins ? Array.from(userCheckins.keys()) : []
            }
        })

        // Don't filter here - send all attendees, let UI handle filtering
        // Each attendee has checkedInOnDay field for day-specific filtering

        return NextResponse.json({
            attendees,
            eventDays,
            eventDaysList,
            isMultiDay: eventDays > 1,
            selectedDay: dayFilter
        })
    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
