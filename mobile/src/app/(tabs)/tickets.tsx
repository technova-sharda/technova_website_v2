import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import * as WebBrowser from 'expo-web-browser'
import { C, F, R } from '@/constants/theme'
import { fmtWhen, relative } from '@/lib/format'
import { optimized } from '@/lib/image'
import { useTickets } from '@/lib/queries'
import type { Ticket } from '@/lib/types'
import { TabTitle } from '@/components/event-row'
import { Badge, Button, Empty, ErrorState, Group, Icon, Loading, PressScale, Screen, Section, T } from '@/components/ui'

/** A ticket stub: event on top, a perforated tear line, and the entry action below. */
function TicketStub({ t }: { t: Ticket }) {
  const live = t.event.phase === 'live'
  return (
    <PressScale scaleTo={0.98} onPress={() => router.push({ pathname: '/event/[id]', params: { id: t.event.id } })} style={styles.stub}>
      <View style={{ flexDirection: 'row', gap: 12, padding: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 14, overflow: 'hidden', backgroundColor: C.surface2 }}>
          {t.event.banner ? <Image alt="" source={{ uri: optimized(t.event.banner, 128)! }} cachePolicy="memory-disk" transition={200} style={{ width: 64, height: 64 }} contentFit="cover" /> : null}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <T v="small" style={{ color: C.accent, fontFamily: F.semibold, flex: 1 }} numberOfLines={1}>{t.event.club?.name ?? 'Technova'}</T>
            {t.attended ? <Badge text="Checked in" tone="green" /> : t.paymentPending ? <Badge text="Payment pending" tone="amber" /> : live ? <Badge text="Live" tone="red" /> : <Badge text={relative(t.event.start)} />}
          </View>
          <T v="h3" numberOfLines={2}>{t.event.title}</T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={[styles.notch, { marginLeft: -9 }]} />
        <View style={{ flex: 1, height: 1, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: C.borderStrong, marginHorizontal: 4 }} />
        <View style={[styles.notch, { marginRight: -9 }]} />
      </View>
      <View style={{ padding: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <View style={{ gap: 2, flex: 1 }}>
            <T v="label">When</T>
            <T v="small" style={{ color: C.text }} numberOfLines={1}>{fmtWhen(t.event.start, t.event.end)}</T>
          </View>
          <View style={{ gap: 2, flex: 1 }}>
            <T v="label">Where</T>
            <T v="small" style={{ color: C.text }} numberOfLines={1}>{t.event.isVirtual ? 'Online' : t.event.venue || 'On campus'}</T>
          </View>
        </View>
        {t.qr
          ? <Button title="Show entry QR" variant="primary" icon={{ ios: 'qrcode', android: 'qr_code_2' }} onPress={() => router.push({ pathname: '/pass/[id]', params: { id: t.event.id } })} />
          : t.meetingLink ? <Button title="Join online" icon={{ ios: 'video.fill', android: 'videocam' }} onPress={() => void WebBrowser.openBrowserAsync(t.meetingLink!)} />
          : t.paymentPending ? <T v="small">Complete the payment on the website to get your QR.</T> : null}
      </View>
    </PressScale>
  )
}

export default function TicketsScreen() {
  const tickets = useTickets()
  const list = tickets.data ?? []
  return (
    <Screen edges={['top']} refreshing={tickets.isRefetching} onRefresh={() => void tickets.refetch()}>
      <TabTitle title="Tickets" kicker={list.length ? `${list.length} upcoming` : undefined} />
      {tickets.isLoading ? <Loading /> : tickets.error ? <ErrorState error={tickets.error} onRetry={() => void tickets.refetch()} /> :
        list.length === 0 ? (
          <Group><Empty icon={{ ios: 'ticket', android: 'confirmation_number' }} title="No tickets yet" hint="Register for an event and your ticket lands here. In-person events get a QR code for the entrance."
            action={<Button title="Browse events" variant="primary" size="sm" onPress={() => router.navigate('/events')} />} /></Group>
        ) : (
          <Section hint="Show the QR at the entrance. Your screen brightens automatically.">
            <View style={{ gap: 14 }}>{list.map(t => <TicketStub key={t.event.id} t={t} />)}</View>
          </Section>
        )}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
        <Icon ios="lock.shield" android="verified_user" size={13} color={C.textMuted} />
        <T v="small">Each QR is unique to you. Don&apos;t share screenshots of it.</T>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  stub: { backgroundColor: C.surface, borderRadius: R.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderStrong, overflow: 'hidden' },
  notch: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.bg },
})
