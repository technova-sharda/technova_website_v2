import { ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { C } from '@/constants/theme'
import { API_URL } from '@/lib/config'
import { firstName, fmtWhen, relative } from '@/lib/format'
import { useHome, useMe } from '@/lib/queries'
import { useSession } from '@/lib/session'
import { EventCard } from '@/components/event-card'
import { Avatar, Button, Card, Empty, ErrorBox, Icon, Loading, Pill, Screen, T } from '@/components/ui'

export default function HomeScreen() {
  const { user } = useSession()
  const me = useMe()
  const home = useHome()
  const refreshing = home.isRefetching || me.isRefetching
  const refresh = () => { void home.refetch(); void me.refetch() }
  const t = home.data?.nextTicket

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T v="dim">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</T>
          <T v="title">Hi, {firstName(me.data?.name ?? user?.name)}</T>
        </View>
        <Avatar uri={me.data?.image ?? user?.image} name={me.data?.name ?? user?.name} />
      </View>

      {(me.data?.needsOnboarding ?? user?.needsOnboarding) && (
        <Card style={{ borderColor: 'rgba(245,158,11,0.4)', gap: 10 }}>
          <T v="h3">Finish your profile</T>
          <T v="dim">Add your system ID, course and year once, so you can register for events and get certificates.</T>
          <Button title="Complete profile" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/onboarding`)} />
        </Card>
      )}

      {/* XP */}
      <Card onPress={() => router.navigate('/leaderboard')} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: C.amberSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon ios="bolt.fill" android="bolt" size={26} color={C.amber} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="label">Your XP</T>
          <T v="h2">{me.data?.xp ?? '–'} XP</T>
          <T v="small">{me.data?.rank ? `Rank #${me.data.rank} of ${me.data.totalUsers} · ${me.data.eventsAttended} events attended` : 'Attend events to climb the leaderboard'}</T>
        </View>
        <Icon ios="chevron.right" android="chevron_right" color={C.textMuted} />
      </Card>

      {/* Next ticket */}
      {t && (
        <Card onPress={() => router.push({ pathname: '/pass/[id]', params: { id: t.event.id } })} style={{ backgroundColor: '#1a1408', borderColor: 'rgba(245,158,11,0.35)', gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T v="label" style={{ color: C.amber }}>Your next event</T>
            <Pill text={t.event.phase === 'live' ? 'Live now' : relative(t.event.start)} color={C.amber} bg={C.amberSoft} />
          </View>
          <T v="h2" numberOfLines={2}>{t.event.title}</T>
          <T v="dim">{fmtWhen(t.event.start, t.event.end)} · {t.event.isVirtual ? 'Online' : t.event.venue || 'On campus'}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Icon ios={t.qr ? 'qrcode' : 'video.fill'} android={t.qr ? 'qr_code_2' : 'videocam'} color={C.amber} />
            <T style={{ color: C.amber, fontWeight: '700' }}>{t.qr ? 'Show ticket QR' : t.paymentPending ? 'Payment pending' : 'Open event'}</T>
          </View>
        </Card>
      )}

      {home.isLoading ? <Loading /> : home.error ? <ErrorBox error={home.error} onRetry={refresh} /> : (
        <>
          {home.data!.live.length > 0 && (
            <View style={{ gap: 12 }}>
              <T v="h2">Happening now</T>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {home.data!.live.map(e => <EventCard key={e.id} e={e} compact />)}
              </ScrollView>
            </View>
          )}
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <T v="h2">Coming up</T>
              <T v="small" style={{ color: C.amber }} >{home.data!.upcoming.length ? 'See all in Events' : ''}</T>
            </View>
            {home.data!.upcoming.length === 0
              ? <Empty icon={{ ios: 'calendar', android: 'event' }} title="Nothing scheduled yet" hint="New events show up here the moment they're published." />
              : home.data!.upcoming.map(e => <EventCard key={e.id} e={e} />)}
          </View>
        </>
      )}
    </Screen>
  )
}
