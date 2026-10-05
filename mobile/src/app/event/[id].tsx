import { Alert, ScrollView, Share, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import * as WebBrowser from 'expo-web-browser'
import * as Haptics from 'expo-haptics'
import { C } from '@/constants/theme'
import { ApiError } from '@/lib/api'
import { fmtWhen } from '@/lib/format'
import { useEvent, useRegister } from '@/lib/queries'
import { statusPill } from '@/components/event-card'
import { Button, Card, ErrorBox, Icon, Loading, Pill, T } from '@/components/ui'

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const q = useEvent(id)
  const register = useRegister(id)
  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: C.bg }}><Loading /></View>
  if (q.error || !q.data) return <View style={{ flex: 1, backgroundColor: C.bg, padding: 16, paddingTop: 100 }}><ErrorBox error={q.error} onRetry={() => void q.refetch()} /></View>
  const e = q.data
  const registered = e.my.status === 'registered'
  const full = !!e.capacity && e.registered >= e.capacity
  const open = (e.phase === 'upcoming' || e.phase === 'live') && !e.registrationsClosed && !full

  const doRegister = () => {
    if (!e.canRegisterInApp) return void WebBrowser.openBrowserAsync(e.webUrl)
    register.mutate(undefined, {
      onSuccess: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); Alert.alert("You're in!", e.isVirtual ? 'The joining link is on your ticket.' : 'Your ticket QR is in the Tickets tab.') },
      onError: err => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        const web = err instanceof ApiError ? (err.data.webUrl as string | undefined) : undefined
        if (web) Alert.alert('Finish on the website', err.message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Open', onPress: () => void WebBrowser.openBrowserAsync(web) }])
        else Alert.alert("Couldn't register", err instanceof Error ? err.message : 'Try again')
      },
    })
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 140 }}>
      <View style={{ aspectRatio: 16 / 9, backgroundColor: C.surface2 }}>
        {e.banner && <Image alt="" source={{ uri: e.banner }} style={{ flex: 1 }} contentFit="cover" transition={200} />}
      </View>
      <View style={{ padding: 16, gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Pill {...statusPill(e)} />
          <T v="title" style={{ fontSize: 26 }}>{e.title}</T>
          {e.club && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {e.club.logo && <Image alt={`${e.club.name} logo`} source={{ uri: e.club.logo }} style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: '#fff' }} contentFit="contain" />}
              <T v="dim">{e.club.name} · Technova</T>
            </View>
          )}
        </View>

        <Card style={{ gap: 14 }}>
          <Row ios="calendar" android="calendar_today" title={fmtWhen(e.start, e.end)} sub={e.isMultiDay ? 'Multi-day event' : undefined} />
          <Row ios={e.isVirtual ? 'video.fill' : 'mappin.and.ellipse'} android={e.isVirtual ? 'videocam' : 'location_on'} title={e.isVirtual ? 'Online' : e.venue || 'On campus'} />
          <Row ios="person.2.fill" android="group" title={`${e.registered}${e.capacity ? ` / ${e.capacity}` : ''} registered`} sub={e.price > 0 ? `Fee ₹${e.price}` : 'Free'} />
          {e.poc && <Row ios="person.crop.circle" android="person" title={`Contact: ${e.poc}`} />}
        </Card>

        {registered && !e.isVirtual && e.ticket && (
          <Button title="Show my ticket" icon={{ ios: 'qrcode', android: 'qr_code_2' }} onPress={() => router.push({ pathname: '/pass/[id]', params: { id: e.id } })} />
        )}
        {registered && e.meetingLink && <Button title="Join online" icon={{ ios: 'video.fill', android: 'videocam' }} onPress={() => WebBrowser.openBrowserAsync(e.meetingLink!)} />}
        {e.certificateId && (
          <Button title="View my certificate" variant="secondary" icon={{ ios: 'rosette', android: 'workspace_premium' }} onPress={() => WebBrowser.openBrowserAsync(`${e.webUrl.split('/events/')[0]}/verify/${e.certificateId}`)} />
        )}

        {e.description ? (
          <View style={{ gap: 8 }}>
            <T v="h3">About</T>
            <T v="dim" style={{ lineHeight: 22 }}>{e.description}</T>
          </View>
        ) : null}

        <Button title="Share event" variant="ghost" icon={{ ios: 'square.and.arrow.up', android: 'share' }} onPress={() => Share.share({ message: `${e.title}\n${e.webUrl}` })} />
      </View>

      {!registered && open && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 34, backgroundColor: 'rgba(9,9,11,0.96)', borderTopWidth: 1, borderColor: C.border }}>
          <Button title={e.canRegisterInApp ? 'Register' : e.price > 0 ? `Register · ₹${e.price} (website)` : 'Register on website'} loading={register.isPending} onPress={doRegister} />
        </View>
      )}
    </ScrollView>
  )
}

function Row({ ios, android, title, sub }: { ios: string; android: string; title: string; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon ios={ios} android={android} size={18} color={C.amber} /></View>
      <View style={{ flex: 1 }}>
        <T>{title}</T>
        {sub && <T v="small">{sub}</T>}
      </View>
    </View>
  )
}
