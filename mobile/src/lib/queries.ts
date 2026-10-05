import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { Certificate, EventDetail, Home, LeaderRow, Me, AppEvent, Ticket } from './types'

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/api/mobile/v1/me') })
export const useHome = () => useQuery({ queryKey: ['home'], queryFn: () => api<Home>('/api/mobile/v1/home') })
export const useEvents = (scope: 'upcoming' | 'past', q: string) =>
  useQuery({ queryKey: ['events', scope, q], queryFn: () => api<{ events: AppEvent[] }>(`/api/mobile/v1/events?scope=${scope}&q=${encodeURIComponent(q)}`).then(r => r.events) })
export const useEvent = (id: string) => useQuery({ queryKey: ['event', id], queryFn: () => api<{ event: EventDetail }>(`/api/mobile/v1/events/${encodeURIComponent(id)}`).then(r => r.event) })
export const useTickets = () => useQuery({ queryKey: ['tickets'], queryFn: () => api<{ tickets: Ticket[] }>('/api/mobile/v1/tickets').then(r => r.tickets) })
export const useCertificates = () => useQuery({ queryKey: ['certificates'], queryFn: () => api<{ certificates: Certificate[] }>('/api/mobile/v1/certificates').then(r => r.certificates) })
export const useLeaderboard = (period: 'all-time' | 'monthly' | 'weekly') =>
  useQuery({ queryKey: ['leaderboard', period], queryFn: () => api<{ users: LeaderRow[]; me: { rank: number; xp: number; totalUsers: number } | null }>(`/api/mobile/v1/leaderboard?period=${period}`) })

export function useRegister(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<{ event: EventDetail }>(`/api/mobile/v1/events/${id}/register`, { method: 'POST' }).then(r => r.event),
    onSuccess: event => {
      qc.setQueryData(['event', id], event)
      void qc.invalidateQueries({ queryKey: ['tickets'] })
      void qc.invalidateQueries({ queryKey: ['home'] })
      void qc.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

// ── staff: scanner (existing website endpoints) ──
export type LiveEvent = { id: string; title: string; start_time: string; end_time?: string }
export type Attendee = { id: string; userId?: string; name: string; email: string; attended: boolean; checkinDates?: string[]; daysCheckedIn?: number }
export const useLiveEvents = (enabled: boolean) => useQuery({ queryKey: ['live-events'], enabled, queryFn: () => api<{ events: LiveEvent[] }>('/api/events/live').then(r => r.events ?? []) })
export const useAttendees = (eventId: string | null) => useQuery({
  queryKey: ['attendees', eventId], enabled: !!eventId, refetchInterval: 45_000,
  queryFn: () => api<{ attendees: Attendee[]; eventDaysList: string[]; isMultiDay: boolean }>(`/api/events/${eventId}/attendees`),
})
