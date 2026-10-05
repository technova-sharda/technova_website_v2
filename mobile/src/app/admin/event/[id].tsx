import { useState } from 'react'
import { View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useAdminEvent, useAdminEventList } from '@/lib/admin'
import { PHASE_BADGE } from '@/components/admin/phase'
import { RosterPanel } from '@/components/admin/roster'
import { FeedbackPanel } from '@/components/admin/feedback-panel'
import { ActionsPanel } from '@/components/admin/actions-panel'
import { Badge, ErrorState, Loading, Screen, Segmented, StatStrip, T, Thumb } from '@/components/ui'

type Tab = 'registrations' | 'feedback' | 'actions'

export default function AdminEvent() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const ev = useAdminEvent(id)
  const list = useAdminEventList()
  const [tab, setTab] = useState<Tab>('registrations')
  const row = list.data?.find(e => e.id === id)
  const e = ev.data?.event

  if (ev.isLoading) return <Screen><Loading rows={4} /></Screen>
  if (ev.error || !e) return <Screen><ErrorState error={ev.error ?? new Error('Event not found')} onRetry={() => void ev.refetch()} /></Screen>
  const regs = row?.registrations ?? 0
  const att = row?.attended ?? 0

  return (
    <Screen refreshing={ev.isRefetching} onRefresh={() => { void ev.refetch(); void list.refetch() }}>
      <Stack.Screen options={{ title: e.title }} />
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Thumb uri={e.banner ?? null} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <T v="h2" numberOfLines={2}>{e.title}</T>
          <T v="small" numberOfLines={1}>{row?.when ?? new Date(e.start_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}{row?.club ? ` · ${row.club}` : ''}</T>
          {row && <Badge {...PHASE_BADGE[row.phase]} />}
        </View>
      </View>
      <StatStrip items={[
        { label: 'Registered', value: `${regs}${e.capacity ? `/${e.capacity}` : ''}` },
        { label: 'Attended', value: String(att) },
        { label: 'Turnout', value: regs ? `${Math.round((att / regs) * 100)}%` : '–' },
      ]} />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'registrations', label: 'Registrations' }, { value: 'feedback', label: 'Feedback' }, { value: 'actions', label: 'Actions' }]} />
      {tab === 'registrations' && <RosterPanel eventId={id} />}
      {tab === 'feedback' && <FeedbackPanel eventId={id} />}
      {tab === 'actions' && <ActionsPanel event={e as never} registered={regs} />}
    </Screen>
  )
}
