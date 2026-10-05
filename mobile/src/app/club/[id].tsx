import { useState } from 'react'
import { Linking, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { optimized } from '@/lib/image'
import { useClub } from '@/lib/queries'
import { EventCarousel, EventRow } from '@/components/event-row'
import { PersonRow } from '@/components/person'
import { Button, Empty, ErrorState, Group, Loading, Screen, Section, Segmented, T } from '@/components/ui'

export default function ClubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const club = useClub(id)
  const [tab, setTab] = useState<'events' | 'team'>('events')
  if (club.isLoading) return <Screen><Loading rows={4} /></Screen>
  if (club.error || !club.data) return <Screen><ErrorState error={club.error} onRetry={() => void club.refetch()} /></Screen>
  const c = club.data
  const links = [
    c.links.instagram && { ios: 'camera', android: 'photo_camera', label: 'Instagram', url: c.links.instagram },
    c.links.linkedin && { ios: 'link', android: 'link', label: 'LinkedIn', url: c.links.linkedin },
    c.links.email && { ios: 'envelope', android: 'mail', label: 'Email', url: `mailto:${c.links.email}` },
  ].filter(Boolean) as { ios: string; android: string; label: string; url: string }[]
  return (
    <Screen refreshing={club.isRefetching} onRefresh={() => void club.refetch()}>
      <Stack.Screen options={{ title: c.name }} />
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {c.logo && <Image alt={`${c.name} logo`} source={{ uri: optimized(c.logo, 128)! }} cachePolicy="memory-disk" style={{ width: 48, height: 48 }} contentFit="contain" />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="h2">{c.name}</T>
          <T v="small">{c.upcoming.length} upcoming · {c.past.length} past · {c.members.length} in team</T>
        </View>
      </View>
      {!!c.description && <T v="dim">{c.description}</T>}
      {links.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {links.map(l => <Button key={l.label} title={l.label} size="sm" icon={{ ios: l.ios, android: l.android }} onPress={() => void Linking.openURL(l.url)} />)}
        </View>
      )}
      <Segmented value={tab} onChange={setTab} options={[{ value: 'events', label: `Events (${c.upcoming.length + c.past.length})` }, { value: 'team', label: `Team (${c.members.length})` }]} />
      {tab === 'events' ? (
        c.upcoming.length + c.past.length === 0 ? <Group><Empty title="No events yet" /></Group> : (
          <>
            {c.upcoming.length > 0 && <Section title="Upcoming"><EventCarousel events={c.upcoming} /></Section>}
            {c.past.length > 0 && <Section title="Past"><Group>{c.past.map(e => <EventRow key={e.id} e={e} />)}</Group></Section>}
          </>
        )
      ) : c.members.length === 0 ? <Group><Empty title="No team listed yet" /></Group> : <Group>{c.members.map(p => <PersonRow key={p.id} p={p} />)}</Group>}
    </Screen>
  )
}
