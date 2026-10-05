/** Admin data for the app: thin hooks over /api/mobile/v1/admin/* (same server functions as the website). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { AdminEventRow, AdminOverview } from './types'

const A = '/api/mobile/v1/admin'
export const adminApi = <T,>(path: string, init?: { method?: string; body?: unknown }) => api<T>(`${A}${path}`, init)

export type RosterEntry = { registrationId: string; userId: string; name: string | null; email: string | null; systemId: string | null; attended: boolean; paymentPending: boolean; checkedInDays: string[] }
export type Roster = { event: { id: string; title: string; start_time: string; end_time: string; isMultiDay: boolean }; days: { key: string; label: string }[]; roster: RosterEntry[] }
export type FeedbackForm = { id: string; title: string; day_number: number | null; release_mode: 'automatic' | 'manual'; is_released: boolean; released_at: string | null; closes_at: string | null; response_count: number; questions: unknown[] }
export type FeedbackInfo = { forms: FeedbackForm[]; analytics: { averageRating: number | null; responseRate: number; totalResponses: number; totalRegistrations: number } | null }
export type FeedbackThemes = { overall: string; praise: string[]; complaints: string[]; suggestions: string[]; commentsRead: number }
export type PersonSummary = { id: string; name: string | null; email: string | null; image: string | null; system_id?: string | null; year: number | null; course: string | null; section: string | null; role: string | null }
export type PersonDetail = PersonSummary & {
  mobile: string | null
  registrations: { id: string; created_at: string; attended: boolean; payment_status: string | null; event: { id: string; slug: string | null; title: string; start_time: string } }[]
  certificates: { certificate_id: string; event_id: string; status: string; issued_at: string; role_title: string | null }[]
  xpAwards: { event_id: string; xp_amount: number; awarded_at: string }[]
}
export type RoleUser = { id: string; name: string | null; email: string | null; image: string | null; role: string | null }
export type RoleChange = { id: string; user_name: string | null; user_email: string | null; old_role: string | null; new_role: string; changed_by_email: string | null; changed_at: string }
export type CertificateHit = { certificate_id: string; status: string; issued_at: string; emailed: boolean; downloads: number; type: string | null; role_title: string | null; event: { id: string; title: string } | null; student: { name: string | null; email: string | null } | null }
export type FormRow = { id: string; title: string; description: string | null; is_active: boolean; is_published: boolean; deadline: string | null; response_count: number; created_at: string }
export type FormField = { id: string; label: string; type: string; order_index: number }
export type FormResponse = { id: string; created_at: string; user: { name: string; email: string; system_id: string }; answers: { field_id: string; answer_text: string | null; answer_json: unknown }[] }
export type EventSummary = { id: string; title: string; club: string | null; date: string; registrations: number; attended: number; turnoutPct: number; fillPct: number | null; avgRating: number | null; ratings: number; feedbackResponses: number; certificates: number; attendanceRecorded: boolean }
export type LogRow = { id: number; created_at: string; actor_name: string | null; actor_email: string | null; action: string; entity: string; summary: string; page: string | null }
export type ManagedClub = { id: string; name: string; logo_url: string | null; memberCount: number }
export type ManagedMember = { id: string; name: string; role: string | null; email: string | null; phone: string | null; linkedin_id: string | null; photo_url: string | null; fallback_photo: string | null; isLead: boolean }
export type ClubForManagement = { club: { id: string; name: string; description: string | null; logo_url: string | null; linkedin_url: string | null; instagram_url: string | null; contact_email: string | null }; members: ManagedMember[]; canEditLeads: boolean }

export const useOverview = () => useQuery({ queryKey: ['admin', 'overview'], queryFn: () => adminApi<AdminOverview>('/overview') })
export const useAdminEventList = () => useQuery({ queryKey: ['admin', 'events'], queryFn: () => adminApi<{ events: AdminEventRow[] }>('/events').then(r => r.events) })
export const useAdminEvent = (id?: string) => useQuery({ queryKey: ['admin', 'event', id], enabled: !!id, queryFn: () => adminApi<{ event: Record<string, any>; clubs: { id: string; name: string }[] }>(`/events/${id}`) })
export const useClubOptions = () => useQuery({ queryKey: ['admin', 'club-options'], staleTime: 10 * 60_000, queryFn: () => adminApi<{ clubs: { id: string; name: string }[] }>('/club-options').then(r => r.clubs) })
export const useRoster = (id: string) => useQuery({ queryKey: ['admin', 'roster', id], queryFn: () => adminApi<Roster>(`/events/${id}/roster`) })
export const useFeedbackInfo = (id: string, enabled: boolean) => useQuery({ queryKey: ['admin', 'feedback', id], enabled, queryFn: () => adminApi<FeedbackInfo>(`/events/${id}/feedback`) })
export const useBlasts = (id: string, enabled: boolean) => useQuery({ queryKey: ['admin', 'blasts', id], enabled, queryFn: () => adminApi<{ blasts: { id: string; subject?: string; sent_at: string; recipients_count?: number }[] }>(`/events/${id}/blasts`).then(r => r.blasts) })
export const usePeople = (q: string) => useQuery({ queryKey: ['admin', 'people', q], enabled: q.trim().length >= 2, placeholderData: keepPreviousData, queryFn: () => adminApi<{ people: PersonSummary[] }>(`/people?q=${encodeURIComponent(q)}`).then(r => r.people) })
export const usePerson = (id: string) => useQuery({ queryKey: ['admin', 'person', id], queryFn: () => adminApi<{ person: PersonDetail }>(`/people/${id}`).then(r => r.person) })
export const useRoles = () => useQuery({ queryKey: ['admin', 'roles'], queryFn: () => adminApi<{ holders: RoleUser[]; changes: RoleChange[] }>('/roles') })
export const useRoleSearch = (q: string) => useQuery({ queryKey: ['admin', 'role-search', q], enabled: q.trim().length >= 2, placeholderData: keepPreviousData, queryFn: () => adminApi<{ users: RoleUser[] }>(`/roles/search?q=${encodeURIComponent(q)}`).then(r => r.users) })
export const useCertSearch = (q: string) => useQuery({ queryKey: ['admin', 'certs', q], enabled: q.trim().length >= 2, placeholderData: keepPreviousData, queryFn: () => adminApi<{ certificates: CertificateHit[] }>(`/certificates?q=${encodeURIComponent(q)}`).then(r => r.certificates) })
export const useForms = () => useQuery({ queryKey: ['admin', 'forms'], queryFn: () => adminApi<{ forms: FormRow[] }>('/forms').then(r => r.forms) })
export const useFormResponses = (id: string) => useQuery({ queryKey: ['admin', 'form', id], queryFn: () => adminApi<{ fields: FormField[]; responses: FormResponse[] }>(`/forms/${id}/responses`) })
export const useAnalytics = () => useQuery({ queryKey: ['admin', 'analytics'], queryFn: () => adminApi<{ generatedAt: string; events: EventSummary[] }>('/analytics') })
export const useLogs = (page: number, q: string) => useQuery({ queryKey: ['admin', 'logs', page, q], placeholderData: keepPreviousData, retry: false, queryFn: () => adminApi<{ logs: LogRow[]; total: number; page: number }>(`/logs?page=${page}&q=${encodeURIComponent(q)}`) })
export const useManageableClubs = () => useQuery({ queryKey: ['manage', 'clubs'], queryFn: () => adminApi<{ clubs: ManagedClub[] }>('/clubs').then(r => r.clubs) })
export const useClubForManagement = (id: string) => useQuery({ queryKey: ['manage', 'club', id], queryFn: () => adminApi<ClubForManagement>(`/clubs/${id}`) })

/** Mutation helper that refreshes the given query keys afterwards. */
export function useAdminMutation<V, R = unknown>(fn: (v: V) => Promise<R>, invalidate: unknown[][]) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => { for (const key of invalidate) void qc.invalidateQueries({ queryKey: key }) } })
}
