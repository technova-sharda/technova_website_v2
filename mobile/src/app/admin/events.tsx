import { useDeferredValue, useMemo, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { C } from '@/constants/theme'
import { useAdminEventList } from '@/lib/admin'
import type { AdminEventRow } from '@/lib/types'
import { PHASE_BADGE } from '@/components/admin/phase'
import { Badge, Button, Empty, ErrorState, Loading, Row, SearchBar, Segmented, Select, T, Thumb } from '@/components/ui'

type Filter = 'active' | 'ended' | 'drafts' | 'all'
type Sort = 'date-desc' | 'date-asc' | 'registrations'
const MATCH: Record<Filter, (e: AdminEventRow) => boolean> = {
  active: e => e.phase === 'live' || e.phase === 'upcoming',
  ended: e => e.phase === 'ended',
  drafts: e => e.phase === 'draft' || e.phase === 'cancelled',
  all: () => true,
}

export default function AdminEvents() {
  const events = useAdminEventList()
  const [filter, setFilter] = useState<Filter>('active')
  const [sort, setSort] = useState<Sort>('date-desc')
  const [q, setQ] = useState('')
  const query = useDeferredValue(q)
  const all = useMemo(() => events.data ?? [], [events.data])
  const counts = useMemo(() => Object.fromEntries((Object.keys(MATCH) as Filter[]).map(f => [f, all.filter(MATCH[f]).length])) as Record<Filter, number>, [all])
  const rows = useMemo(() => {
    const s = query.trim().toLowerCase()
    const list = all.filter(e => MATCH[filter](e) && (!s || e.title.toLowerCase().includes(s) || (e.club ?? '').toLowerCase().includes(s)))
    return [...list].sort((a, b) => sort === 'registrations' ? b.registrations - a.registrations : sort === 'date-asc' ? a.startTime.localeCompare(b.startTime) : b.startTime.localeCompare(a.startTime))
  }, [all, filter, sort, query])

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerRight: () => <Button size="sm" variant="primary" title="New" icon={{ ios: 'plus', android: 'add' }} onPress={() => router.push('/admin/event-form')} /> }} />
      <View style={{ padding: 16, paddingBottom: 8, gap: 10 }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search by event or club" />
        <Segmented value={filter} onChange={setFilter} options={[
          { value: 'active', label: `Active ${counts.active ?? 0}` }, { value: 'ended', label: `Ended ${counts.ended ?? 0}` },
          { value: 'drafts', label: `Drafts ${counts.drafts ?? 0}` }, { value: 'all', label: `All ${counts.all ?? 0}` },
        ]} />
        <Select label="Sort" value={sort} onChange={setSort} options={[{ value: 'date-desc', label: 'Date, newest first' }, { value: 'date-asc', label: 'Date, oldest first' }, { value: 'registrations', label: 'Most registrations' }]} />
      </View>
      {events.isLoading ? <View style={{ paddingHorizontal: 16 }}><Loading rows={6} /></View>
        : events.error ? <View style={{ paddingHorizontal: 16 }}><ErrorState error={events.error} onRetry={() => void events.refetch()} /></View> : (
          <FlatList
            data={rows}
            keyExtractor={e => e.id}
            style={{ marginHorizontal: 16, marginBottom: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderStrong, backgroundColor: C.surface, flexGrow: 0 }}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.border }} />}
            refreshing={events.isRefetching}
            onRefresh={() => void events.refetch()}
            ListEmptyComponent={<Empty title={q ? 'No events match' : 'No events here'} />}
            renderItem={({ item: e }) => {
              const ended = e.phase === 'ended'
              return (
                <Row left={<Thumb uri={e.banner} size={44} />} title={e.title} numberOfLines={2} chevron
                  onPress={() => router.push({ pathname: '/admin/event/[id]', params: { id: e.id } })}
                  subtitle={<View style={{ gap: 2 }}>
                    <T v="small" numberOfLines={1}>{e.when}{e.club ? ` · ${e.club}` : ''}</T>
                    <T v="mono">{e.registrations}{e.capacity ? `/${e.capacity}` : ''} reg{ended ? (e.attended ? ` · ${e.attended} in (${e.registrations ? Math.round((e.attended / e.registrations) * 100) : 0}%)` : ' · attendance missing') : ''}{e.registrationsClosed && !ended ? ' · closed' : ''}</T>
                  </View>}
                  right={<Badge {...PHASE_BADGE[e.phase]} />} />
              )
            }}
          />
        )}
    </View>
  )
}
