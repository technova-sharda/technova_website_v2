import { useDeferredValue, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { C, R } from '@/constants/theme'
import { useEvents } from '@/lib/queries'
import { EventCard, EventRow, TabTitle } from '@/components/event-row'
import { Empty, ErrorState, Loading, Rise, SearchBar, Segmented } from '@/components/ui'

export default function EventsScreen() {
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming')
  const [q, setQ] = useState('')
  const query = useDeferredValue(q)
  const events = useEvents(scope, query)
  const past = scope === 'past'
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, gap: 12 }}>
        <TabTitle title="Events" kicker={events.data ? `${events.data.length} ${scope}` : undefined} />
        <Segmented value={scope} onChange={setScope} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} />
        <SearchBar value={q} onChange={setQ} placeholder="Search events or clubs" loading={events.isFetching && !!q} />
      </View>
      {events.isLoading ? <View style={{ paddingHorizontal: 16 }}><Loading rows={5} /></View>
        : events.error ? <View style={{ paddingHorizontal: 16 }}><ErrorState error={events.error} onRetry={() => void events.refetch()} /></View> : (
          <FlatList
            key={scope}
            data={events.data}
            keyExtractor={e => e.id}
            renderItem={({ item, index }) => past
              ? <Rise index={index}><View style={[styles.pastItem, index === 0 && styles.first, index === (events.data?.length ?? 0) - 1 && styles.last, index > 0 && styles.divider]}><EventRow e={item} /></View></Rise>
              : <Rise index={index}><EventCard e={item} /></Rise>}
            ItemSeparatorComponent={past ? undefined : () => <View style={{ height: 14 }} />}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 }}
            refreshing={events.isRefetching}
            onRefresh={() => void events.refetch()}
            ListEmptyComponent={<Empty icon={{ ios: 'calendar', android: 'event' }} title={q ? 'No events match' : past ? 'No past events' : 'No upcoming events'} hint={q ? 'Try a club name or a shorter word.' : 'New events show up here as soon as they are published.'} />}
            initialNumToRender={6}
            windowSize={7}
          />
        )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  pastItem: { backgroundColor: C.surface, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: C.borderStrong, overflow: 'hidden' },
  first: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg },
  last: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: R.lg, borderBottomRightRadius: R.lg },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
})
