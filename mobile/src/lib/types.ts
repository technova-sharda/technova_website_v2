/** Shapes returned by the website's /api/mobile/v1 endpoints. */
export type Phase = 'draft' | 'cancelled' | 'live' | 'upcoming' | 'ended'
export type AppEvent = {
  id: string; slug: string | null; title: string; banner: string | null
  club: { name: string; logo: string | null } | null
  start: string; end: string | null; venue: string | null; isVirtual: boolean
  phase: Phase; capacity: number | null; registered: number; price: number
  registrationsClosed: boolean; webUrl: string
  my: { status: 'registered' | 'payment_pending' | null; attended: boolean }
}
export type EventDetail = AppEvent & {
  description: string; poc: string | null; isMultiDay: boolean; canRegisterInApp: boolean
  meetingLink: string | null; ticket: string | null; certificateId: string | null
}
export type Ticket = { event: AppEvent; paymentPending: boolean; attended: boolean; qr: string | null; meetingLink: string | null }
export type Me = {
  id: string; name: string | null; email: string | null; image: string | null; role: string
  systemId: string | null; course: string | null; year: number | null; section: string | null
  xp: number; rank: number | null; totalUsers: number | null; eventsAttended: number; needsOnboarding: boolean; isStaff: boolean
}
export type Certificate = { id: string; type: string; issuedAt: string; event: { id: string; title: string; date: string; club: string | null }; verifyUrl: string; downloadPath: string }
export type LeaderRow = { id: string; name: string; image: string | null; xp: number; rank: number; isMe: boolean }
export type Home = { nextTicket: Ticket | null; live: AppEvent[]; upcoming: AppEvent[] }

export type Club = { id: string; name: string; description: string; logo: string | null; members: number; upcoming: number; totalEvents: number }
export type Person = { id: string; name: string; role: string | null; photo: string | null; email: string | null; phone: string | null; linkedin: string | null }
export type ClubDetail = {
  id: string; name: string; description: string; logo: string | null
  links: { linkedin: string | null; instagram: string | null; email: string | null; web: string }
  members: Person[]; upcoming: AppEvent[]; past: AppEvent[]
}
export type Team = { mentors: { name: string; role: string; quote: string | null; photo: string | null }[]; executives: Person[]; contact: { email?: string; reportUrl: string; website: string } }
export type AdminBrief = { id: string; title: string; start: string; phase: Phase; capacity: number | null; registered: number; attended: number; attendanceRecorded: boolean; turnoutPct: number; rating: number | null }
export type AdminOverview = {
  kpis: { liveAndUpcoming: number; live: number; regs30: number; change: number | null; avgTurnout: number | null; avgRating: string | null; ratingCount: number; ratingScope: string }
  totals: { students: number; events: number; registrations: number }
  perDay: { day: string; count: number }[]
  todos: { kind: string; eventId: string; title: string; detail: string }[]
  nextUp: AdminBrief[]; recent: AdminBrief[]
}
export type AdminEventRow = {
  id: string; title: string; slug: string | null; banner: string | null; club: string | null; phase: Phase; startTime: string; when: string; where: string
  capacity: number | null; registrations: number; attended: number; registrationsClosed: boolean
}
