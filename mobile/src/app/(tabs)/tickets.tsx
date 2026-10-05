import { View } from 'react-native'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import QRCode from 'react-native-qrcode-svg'
import { C } from '@/constants/theme'
import { fmtWhen, relative } from '@/lib/format'
import { useTickets } from '@/lib/queries'
import { Button, Card, Empty, ErrorBox, Loading, Pill, Screen, T } from '@/components/ui'

export default function TicketsScreen() {
  const tickets = useTickets()
  return (
    <Screen refreshing={tickets.isRefetching} onRefresh={() => void tickets.refetch()}>
      <T v="title">Tickets</T>
      {tickets.isLoading ? <Loading /> : tickets.error ? <ErrorBox error={tickets.error} onRetry={() => void tickets.refetch()} /> :
        tickets.data!.length === 0 ? (
          <Empty icon={{ ios: 'ticket', android: 'confirmation_number' }} title="No tickets yet" hint="Register for an event and its ticket appears here, ready to show at the door." />
        ) : tickets.data!.map(t => (
          <Card key={t.event.id} onPress={() => (t.qr ? router.push({ pathname: '/pass/[id]', params: { id: t.event.id } }) : router.push({ pathname: '/event/[id]', params: { id: t.event.id } }))}
            style={{ padding: 0, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, padding: 16, gap: 6 }}>
                <Pill text={t.event.phase === 'live' ? 'Live now' : relative(t.event.start)} color={t.event.phase === 'live' ? C.green : C.amber} bg={t.event.phase === 'live' ? C.greenSoft : C.amberSoft} />
                <T v="h3" numberOfLines={2}>{t.event.title}</T>
                <T v="small">{fmtWhen(t.event.start, t.event.end)}</T>
                <T v="small">{t.event.isVirtual ? 'Online event' : t.event.venue || 'On campus'}</T>
                {t.paymentPending && <T v="small" style={{ color: C.amber }}>Payment pending</T>}
                {t.attended && <T v="small" style={{ color: C.green }}>Checked in</T>}
              </View>
              {/* perforation */}
              <View style={{ width: 1, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: C.borderStrong, marginVertical: 12 }} />
              <View style={{ width: 112, alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                {t.qr ? (
                  <View style={{ backgroundColor: '#fff', padding: 6, borderRadius: 8 }}><QRCode value={t.qr} size={76} /></View>
                ) : <T v="small" style={{ textAlign: 'center' }}>{t.event.isVirtual ? 'Join online' : 'No QR'}</T>}
              </View>
            </View>
            {t.meetingLink && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                <Button title="Join online" icon={{ ios: 'video.fill', android: 'videocam' }} onPress={() => WebBrowser.openBrowserAsync(t.meetingLink!)} />
              </View>
            )}
          </Card>
        ))}
    </Screen>
  )
}
