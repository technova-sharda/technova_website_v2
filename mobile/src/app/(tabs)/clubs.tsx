import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { C, F, R } from '@/constants/theme'
import { optimized } from '@/lib/image'
import { useClubs } from '@/lib/queries'
import type { Club } from '@/lib/types'
import { TabTitle } from '@/components/event-row'
import { ErrorState, Group, Icon, Loading, PressScale, Rise, Row, Screen, Section, T } from '@/components/ui'

function ClubTile({ c }: { c: Club }) {
  return (
    <PressScale haptic scaleTo={0.96} onPress={() => router.push({ pathname: '/club/[id]', params: { id: c.id } })} accessibilityLabel={c.name}
      style={{ backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderStrong, padding: 14, gap: 12, height: 168 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {c.logo ? <Image alt={`${c.name} logo`} source={{ uri: optimized(c.logo, 128)! }} cachePolicy="memory-disk" transition={200} style={{ width: 40, height: 40 }} contentFit="contain" /> : <Icon ios="person.3.fill" android="groups" color="#555" />}
        </View>
        {c.upcoming > 0 && (
          <View style={{ backgroundColor: C.accentSoft, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
            <T style={{ color: C.accent, fontFamily: F.semibold, fontSize: 11 }}>{c.upcoming} upcoming</T>
          </View>
        )}
      </View>
      <View style={{ flex: 1, justifyContent: 'flex-end', gap: 3 }}>
        <T v="h3" numberOfLines={2}>{c.name}</T>
        <T v="small" numberOfLines={1}>{c.totalEvents} events · {c.members} in team</T>
      </View>
    </PressScale>
  )
}

export default function ClubsScreen() {
  const clubs = useClubs()
  const list = clubs.data ?? []
  return (
    <Screen edges={['top']} refreshing={clubs.isRefetching} onRefresh={() => void clubs.refetch()}>
      <TabTitle title="Clubs" kicker={list.length ? `${list.length} clubs under Technova` : undefined} />
      <Group>
        <Row title="Team Technova" subtitle="Faculty mentors, the student team, and how to reach us"
          left={<View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon ios="person.3.fill" android="groups" color={C.accent} /></View>}
          chevron onPress={() => router.push('/team')} />
      </Group>
      <Section title="All clubs">
        {clubs.isLoading ? <Loading rows={6} /> : clubs.error ? <ErrorState error={clubs.error} onRetry={() => void clubs.refetch()} /> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {list.map((c, i) => (
              <Rise key={c.id} index={i} style={{ width: '48.2%' }}><ClubTile c={c} /></Rise>
            ))}
          </View>
        )}
      </Section>
    </Screen>
  )
}
