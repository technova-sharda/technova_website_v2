import { useState } from 'react'
import { Share, StyleSheet, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import * as WebBrowser from 'expo-web-browser'
import Animated, { Extrapolation, interpolate, SlideInDown, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { C, F, R } from '@/constants/theme'
import { ApiError } from '@/lib/api'
import { fmtWhen } from '@/lib/format'
import { optimized } from '@/lib/image'
import { downloadAndOpen } from '@/lib/download'
import { useEvent, useRegister } from '@/lib/queries'
import { eventStatus, SeatsBar } from '@/components/event-row'
import { useToast } from '@/components/toast'
import { Badge, Button, ErrorState, Group, Icon, Loading, Rise, Row, Section, T } from '@/components/ui'

const BANNER = 300

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const q = useEvent(id)
  const register = useRegister(id)
  const toast = useToast()
  const [downloading, setDownloading] = useState(false)
  const y = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler(ev => { y.value = ev.contentOffset.y })
  const bannerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value < 0 ? y.value / 2 : y.value * 0.45 },
      { scale: y.value < 0 ? 1 + -y.value / BANNER : 1 },
    ],
  }))
  const headerStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [BANNER - 140, BANNER - 70], [0, 1], Extrapolation.CLAMP) }))

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: C.bg, padding: 16, paddingTop: insets.top + 60 }}><Loading rows={4} /></View>
  if (q.error || !q.data) return <View style={{ flex: 1, backgroundColor: C.bg, padding: 16, paddingTop: insets.top + 60 }}><ErrorState error={q.error} onRetry={() => void q.refetch()} /></View>
  const e = q.data
  const registered = e.my.status === 'registered'
  const full = !!e.capacity && e.registered >= e.capacity
  const open = (e.phase === 'upcoming' || e.phase === 'live') && !e.registrationsClosed && !full
  const status = eventStatus(e)

  const doRegister = () => {
    if (!e.canRegisterInApp) return void WebBrowser.openBrowserAsync(e.webUrl)
    register.mutate(undefined, {
      onSuccess: () => toast.success("You're in!", e.isVirtual ? 'The joining link is in Tickets.' : 'Your QR ticket is in Tickets.'),
      onError: err => {
        const web = err instanceof ApiError ? (err.data.webUrl as string | undefined) : undefined
        if (web) { toast.info('Finish on the website', err.message); void WebBrowser.openBrowserAsync(web) }
        else toast.error("Couldn't register", err instanceof Error ? err.message : 'Try again')
      },
    })
  }
  const downloadCert = async () => {
    setDownloading(true)
    try { await downloadAndOpen(`/api/certificate?id=${e.certificateId}`, { mimeType: 'application/pdf', title: 'Certificate' }) }
    catch (err) { toast.error('Download failed', err instanceof Error ? err.message : undefined) }
    finally { setDownloading(false) }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ title: '' }} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 130 }}>
        <Animated.View style={[{ height: BANNER, backgroundColor: C.surface2 }, bannerStyle]}>
          {e.banner && <Image alt="" source={{ uri: optimized(e.banner, 1080)! }} cachePolicy="memory-disk" transition={250} style={StyleSheet.absoluteFill} contentFit="cover" />}
          <LinearGradient colors={['rgba(10,10,11,0.55)', 'rgba(10,10,11,0)', 'rgba(10,10,11,0.35)', C.bg]} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />
        </Animated.View>

        <View style={{ padding: 16, gap: 20, marginTop: -56, backgroundColor: 'transparent' }}>
          <Rise index={0} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {status && <Badge text={status.text} tone={status.tone} />}
              {e.phase === 'ended' && <Badge text="Ended" />}
              {e.price === 0 && e.phase !== 'ended' && <Badge text="Free" tone="green" />}
            </View>
            <T v="display">{e.title}</T>
            <T style={{ color: C.accent, fontFamily: F.semibold }}>{e.club?.name ?? 'Technova'}</T>
          </Rise>

          <Rise index={1}>
            <Group>
              <Row title={fmtWhen(e.start, e.end)} subtitle={e.isMultiDay ? 'Multi-day event · attendance is per day' : undefined} left={<IconDot ios="calendar" android="calendar_today" />} />
              <Row title={e.isVirtual ? 'Online' : e.venue || 'On campus'} subtitle={e.isVirtual ? 'Link appears in Tickets after you register' : undefined} left={<IconDot ios={e.isVirtual ? 'video' : 'mappin.and.ellipse'} android={e.isVirtual ? 'videocam' : 'location_on'} />} />
              {e.poc ? <Row title={e.poc} subtitle="Point of contact" left={<IconDot ios="person.crop.circle" android="person" />} /> : null}
              {e.capacity && e.phase !== 'ended' ? <View style={{ padding: 14 }}><SeatsBar registered={e.registered} capacity={e.capacity} /></View> : null}
            </Group>
          </Rise>

          {(registered || e.certificateId) && (
            <Rise index={2}>
              <Section title="Yours">
                <Group style={{ borderColor: 'rgba(245,166,35,0.35)' }}>
                  {registered && !e.isVirtual && e.ticket ? <Row title="Show ticket QR" subtitle="For the entrance" left={<IconDot ios="qrcode" android="qr_code_2" accent />} chevron onPress={() => router.push({ pathname: '/pass/[id]', params: { id: e.id } })} /> : null}
                  {registered && e.meetingLink ? <Row title="Join online" subtitle={e.meetingLink} left={<IconDot ios="video.fill" android="videocam" accent />} chevron onPress={() => void WebBrowser.openBrowserAsync(e.meetingLink!)} /> : null}
                  {e.certificateId ? <Row title="Download certificate" subtitle={`PDF · ID ${e.certificateId}`} left={<IconDot ios="rosette" android="workspace_premium" accent />}
                    right={downloading ? <T v="small">Preparing…</T> : <Icon ios="arrow.down.circle.fill" android="download" color={C.accent} />} onPress={downloading ? undefined : () => void downloadCert()} /> : null}
                </Group>
              </Section>
            </Rise>
          )}

          {e.description ? (
            <Rise index={3}>
              <Section title="About">
                <T v="dim" selectable style={{ fontSize: 15, lineHeight: 23 }}>{e.description}</T>
              </Section>
            </Rise>
          ) : null}

          <Rise index={4}>
            <Button title="Share with friends" icon={{ ios: 'square.and.arrow.up', android: 'share' }} onPress={() => void Share.share({ message: `${e.title}\n${e.webUrl}` })} />
          </Rise>
        </View>
      </Animated.ScrollView>

      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 56, backgroundColor: 'rgba(10,10,11,0.94)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, justifyContent: 'flex-end', paddingBottom: 16, paddingHorizontal: 64 }, headerStyle]}>
        <T v="h3" numberOfLines={1} style={{ textAlign: 'center' }}>{e.title}</T>
      </Animated.View>

      {!registered && open && (
        <Animated.View entering={SlideInDown.delay(250).springify().damping(18)} style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 10, padding: 12, borderRadius: R.xl, backgroundColor: '#1A1A1D', borderWidth: 1, borderColor: C.borderStrong, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 }}>
          <View style={{ flex: 1, paddingLeft: 4 }}>
            <T style={{ fontFamily: F.display, fontSize: 18 }}>{e.price > 0 ? `₹${e.price}` : 'Free'}</T>
            <T v="small">{e.capacity ? `${Math.max(0, e.capacity - e.registered)} seats left` : 'Open registration'}</T>
          </View>
          <Button title={e.canRegisterInApp ? 'Register' : 'Register on website'} variant="primary" icon={e.canRegisterInApp ? { ios: 'checkmark.circle.fill', android: 'check_circle' } : { ios: 'safari', android: 'open_in_new' }} loading={register.isPending} onPress={doRegister} style={{ minWidth: 150 }} />
        </Animated.View>
      )}
    </View>
  )
}

function IconDot({ ios, android, accent }: { ios: string; android: string; accent?: boolean }) {
  return (
    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: accent ? C.accentSoft : C.surface2, alignItems: 'center', justifyContent: 'center' }}>
      <Icon ios={ios} android={android} size={16} color={accent ? C.accent : C.textDim} />
    </View>
  )
}
