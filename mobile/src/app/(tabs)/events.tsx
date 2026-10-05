import { useDeferredValue, useState } from 'react'
import { TextInput, View } from 'react-native'
import { C, R } from '@/constants/theme'
import { useEvents } from '@/lib/queries'
import { EventCard } from '@/components/event-card'
import { Empty, ErrorBox, Icon, Loading, Screen, Segmented, T } from '@/components/ui'

export default function EventsScreen() {
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming')
  const [q, setQ] = useState('')
  const query = useDeferredValue(q)
  const events = useEvents(scope, query)
  return (
    <Screen refreshing={events.isRefetching} onRefresh={() => void events.refetch()}>
      <T v="title">Events</T>
      <Segmented value={scope} onChange={setScope} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12 }}>
        <Icon ios="magnifyingglass" android="search" size={18} color={C.textMuted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search events" placeholderTextColor={C.textMuted} returnKeyType="search"
          style={{ flex: 1, color: C.text, fontSize: 16, paddingVertical: 12 }} />
      </View>
      {events.isLoading ? <Loading /> : events.error ? <ErrorBox error={events.error} onRetry={() => void events.refetch()} /> :
        events.data!.length === 0
          ? <Empty icon={{ ios: 'calendar', android: 'event' }} title={q ? 'No events match' : scope === 'upcoming' ? 'No upcoming events' : 'No past events'} />
          : events.data!.map(e => <EventCard key={e.id} e={e} />)}
    </Screen>
  )
}
