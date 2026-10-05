import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import * as WebBrowser from 'expo-web-browser'
import { C, F, R } from '@/constants/theme'
import { API_URL } from '@/lib/config'
import { firstName, fmtWhen } from '@/lib/format'
import { optimized } from '@/lib/image'
import { useHome, useMe } from '@/lib/queries'
import { useSession } from '@/lib/session'
import type { Ticket } from '@/lib/types'
import { Countdown } from '@/components/countdown'
import { EventCard, EventCarousel, TabTitle } from '@/components/event-row'
import { Avatar, Badge, Button, Empty, ErrorState, Group, Icon, Loading, PressScale, Row, Screen, Section, StatStrip, T } from '@/components/ui'

function greeting() {
  const h = Number(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** The student's next registered event, with a live countdown and the ticket one tap away. */
function NextUp({ t }: { t: Ticket }) {
  const live = t.event.phase === 'live'
  return (
    <PressScale scaleTo={0.98} onPress={() => router.push({ pathname: '/event/[id]', params: { id: t.event.id } })} style={{ borderRadius: R.xl, overflow: 'hidden', backgroundColor: C.surface, borderWidth: 1, borderColor: 'rgba(245,166,35,0.35)' }}>
      {t.event.banner && <Image alt="" source={{ uri: optimized(t.event.banner, 750)! }} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={2} />}
      <LinearGradient colors={['rgba(10,10,11,0.55)', 'rgba(10,10,11,0.88)', '#141416']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ padding: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon ios="ticket.fill" android="confirmation_number" size={14} color={C.accent} />
            <T v="label" style={{ color: C.accent }}>Your next event</T>
          </View>
          {live ? <Badge text="Live" tone="red" /> : t.attended ? <Badge text="Checked in" tone="green" /> : null}
        </View>
        <View style={{ gap: 4 }}>
          <T v="title" numberOfLines={2}>{t.event.title}</T>
          <T v="dim" numberOfLines={1}>{fmtWhen(t.event.start, t.event.end)} · {t.event.isVirtual ? 'Online' : t.event.venue || 'On campus'}</T>
        </View>
        {!live && <Countdown iso={t.event.start} />}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {t.qr
            ? <Button title="Show ticket" variant="primary" icon={{ ios: 'qrcode', android: 'qr_code_2' }} style={{ flex: 1 }} onPress={() => router.push({ pathname: '/pass/[id]', params: { id: t.event.id } })} />
            : t.meetingLink ? <Button title="Join online" variant="primary" icon={{ ios: 'video.fill', android: 'videocam' }} style={{ flex: 1 }} onPress={() => void WebBrowser.openBrowserAsync(t.meetingLink!)} /> : null}
          <Button title="Details" style={{ flex: t.qr || t.meetingLink ? 0 : 1 }} onPress={() => router.push({ pathname: '/event/[id]', params: { id: t.event.id } })} />
        </View>
      </View>
    </PressScale>
  )
}

function Tile({ title, hint, icon, onPress }: { title: string; hint: string; icon: { ios: string; android: string }; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} haptic style={{ flex: 1, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderStrong, padding: 14, gap: 10 }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon {...icon} size={19} color={C.accent} /></View>
      <View style={{ gap: 2 }}>
        <T v="h3">{title}</T>
        <T v="small" numberOfLines={2}>{hint}</T>
      </View>
    </PressScale>
  )
}

export default function HomeScreen() {
  const { user } = useSession()
  const me = useMe()
  const home = useHome()
  const refresh = () => { void home.refetch(); void me.refetch() }
  const t = home.data?.nextTicket
  const isSuper = user?.role === 'super_admin'
  const isStaff = isSuper || user?.role === 'admin'
  const upcoming = home.data?.upcoming ?? []

  return (
    <Screen edges={['top']} refreshing={home.isRefetching || me.isRefetching} onRefresh={refresh}>
      <TabTitle kicker={greeting()} title={firstName(me.data?.name ?? user?.name)}
        right={<PressScale onPress={() => router.navigate('/profile')} accessibilityLabel="Your profile"><Avatar uri={me.data?.image ?? user?.image} name={me.data?.name ?? user?.name} size={42} /></PressScale>} />

      {(me.data?.needsOnboarding ?? user?.needsOnboarding) && (
        <Group style={{ borderColor: 'rgba(251,191,36,0.4)' }}>
          <Row title="Finish your profile" subtitle="Add your system ID, course and year to register for events and get certificates."
            left={<Icon ios="exclamationmark.circle.fill" android="error" color={C.amber} />}
            right={<Button title="Complete" size="sm" variant="primary" onPress={() => void WebBrowser.openBrowserAsync(`${API_URL}/onboarding`)} />} />
        </Group>
      )}

      {t && <NextUp t={t} />}

      {me.data && (
        <Section title="Your standing" action={<Button title="Leaderboard" size="sm" variant="ghost" onPress={() => router.push('/leaderboard')} />}>
          <StatStrip items={[
            { label: 'XP', value: String(me.data.xp), tone: C.accent },
            { label: 'Rank', value: me.data.rank ? `#${me.data.rank}` : '–', hint: me.data.totalUsers ? `of ${me.data.totalUsers.toLocaleString('en-IN')}` : undefined },
            { label: 'Attended', value: String(me.data.eventsAttended), hint: 'events' },
          ]} />
        </Section>
      )}

      {isStaff && (
        <Section title="Staff">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Tile title="Scan tickets" hint="Check people in at the door" icon={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner' }} onPress={() => router.push('/scan')} />
            {isSuper && <Tile title="Admin" hint="Events, people, forms, analytics" icon={{ ios: 'rectangle.stack.badge.person.crop', android: 'admin_panel_settings' }} onPress={() => router.push('/admin')} />}
          </View>
        </Section>
      )}

      {home.isLoading ? <Loading rows={3} /> : home.error ? <ErrorState error={home.error} onRetry={refresh} /> : (
        <View style={{ gap: 22 }}>
          {home.data!.live.length > 0 && (
            <Section title="Happening now">
              <EventCarousel events={home.data!.live} />
            </Section>
          )}
          <Section title="Upcoming" action={<Button title="All events" size="sm" variant="ghost" onPress={() => router.navigate('/events')} />}>
            {upcoming.length === 0
              ? <Group><Empty icon={{ ios: 'calendar', android: 'event' }} title="No upcoming events" hint="New events appear here as soon as they're published." /></Group>
              : <View style={{ gap: 14 }}>{upcoming.slice(0, 6).map(e => <EventCard key={e.id} e={e} />)}</View>}
          </Section>
        </View>
      )}
      <T v="small" style={{ textAlign: 'center', fontFamily: F.medium }}>Technova · SSCSE Technical Society</T>
    </Screen>
  )
}
