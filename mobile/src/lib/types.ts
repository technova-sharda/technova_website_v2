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
