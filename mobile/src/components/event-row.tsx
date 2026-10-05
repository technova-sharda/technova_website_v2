import { useEffect, type ReactNode } from 'react'
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { C, F, R } from '@/constants/theme'
import { fmtTime, fmtWhen } from '@/lib/format'
import { optimized } from '@/lib/image'
import type { AppEvent } from '@/lib/types'
import { Badge, Icon, PressScale, Rise, T, Thumb } from './ui'

/** The one status that matters for a student, or none. */
export function eventStatus(e: AppEvent): { text: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'neutral' } | null {
  if (e.my.status === 'registered') return { text: e.my.attended ? 'Attended' : 'Registered', tone: 'green' }
  if (e.my.status === 'payment_pending') return { text: 'Payment pending', tone: 'amber' }
  if (e.phase === 'live') return { text: 'Live', tone: 'red' }
  if (e.phase === 'ended') return null
  if (e.registrationsClosed || (e.capacity && e.registered >= e.capacity)) return { text: 'Full', tone: 'red' }
  return null
}
const open = (e: AppEvent) => router.push({ pathname: '/event/[id]', params: { id: e.id } })

/** Day and month in a small calendar tile. */
export function DateChip({ iso }: { iso: string }) {
  const d = new Date(iso)
  const day = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric' })
  const mon = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short' }).toUpperCase()
  return (
    <View style={{ width: 46, borderRadius: 12, backgroundColor: 'rgba(10,10,11,0.78)', borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderStrong, alignItems: 'center', paddingVertical: 5 }}>
      <T style={{ fontFamily: F.semibold, fontSize: 10, color: C.accent, letterSpacing: 0.8 }}>{mon}</T>
      <T style={{ fontFamily: F.display, fontSize: 19, lineHeight: 22, color: C.text }}>{day}</T>
    </View>
  )
}

/** How full the event is; fills in when it appears. Red when almost full. */
export function SeatsBar({ registered, capacity }: { registered: number; capacity: number | null }) {
  const pct = capacity ? Math.min(1, registered / capacity) : 0
  const w = useSharedValue(0)
  useEffect(() => { w.set(withDelay(250, withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) }))) }, [w, pct])
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }))
  if (!capacity) return null
  const left = Math.max(0, capacity - registered)
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T v="small">{registered} registered</T>
        <T v="small" style={{ color: left === 0 ? C.red : left <= capacity * 0.15 ? C.amber : C.textMuted }}>{left === 0 ? 'Full' : `${left} seats left`}</T>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: C.surface2, overflow: 'hidden' }}>
        <Animated.View style={[{ height: 4, borderRadius: 2, backgroundColor: pct > 0.85 ? C.red : C.accent }, fill]} />
      </View>
    </View>
  )
}

/** Big event card: banner with a scrim, date tile, status, title, place and seats. */
export function EventCard({ e, width, compact }: { e: AppEvent; width?: number; compact?: boolean }) {
  const status = eventStatus(e)
  return (
    <PressScale onPress={() => open(e)} scaleTo={0.975} style={[styles.card, width ? { width } : null]} accessibilityLabel={e.title}>
      <View style={{ aspectRatio: compact ? 1.9 : 1.75, backgroundColor: C.surface2 }}>
        {e.banner
          ? <Image alt="" source={{ uri: optimized(e.banner, 750)! }} cachePolicy="memory-disk" transition={250} style={StyleSheet.absoluteFill} contentFit="cover" />
          : <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><Icon ios="sparkles" android="auto_awesome" size={28} color={C.textMuted} /></View>}
        <LinearGradient colors={['rgba(10,10,11,0)', 'rgba(10,10,11,0.15)', 'rgba(10,10,11,0.92)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <DateChip iso={e.start} />
          {status && <Badge text={status.text} tone={status.tone} />}
        </View>
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 12, gap: 4 }}>
          {e.club && <T v="small" style={{ color: C.accent, fontFamily: F.semibold }} numberOfLines={1}>{e.club.name}</T>}
          <T v="h2" numberOfLines={2} style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 }}>{e.title}</T>
        </View>
      </View>
      <View style={{ padding: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Meta icon={{ ios: 'clock', android: 'schedule' }} text={fmtTime(e.start)} />
          <Meta icon={e.isVirtual ? { ios: 'video', android: 'videocam' } : { ios: 'mappin.and.ellipse', android: 'location_on' }} text={e.isVirtual ? 'Online' : e.venue || 'On campus'} flex />
          <Meta icon={{ ios: 'indianrupeesign', android: 'currency_rupee' }} text={e.price > 0 ? `${e.price}` : 'Free'} />
        </View>
        {e.phase !== 'ended' && !e.my.status && <SeatsBar registered={e.registered} capacity={e.capacity} />}
      </View>
    </PressScale>
  )
}
function Meta({ icon, text, flex }: { icon: { ios: string; android: string }; text: string; flex?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: flex ? 1 : 0, flex: flex ? 1 : undefined }}>
      <Icon {...icon} size={13} color={C.textMuted} />
      <T v="small" style={{ color: C.textDim }} numberOfLines={1}>{text}</T>
    </View>
  )
}

/** Swipeable row of cards (live and featured events). */
export function EventCarousel({ events }: { events: AppEvent[] }) {
  const { width } = useWindowDimensions()
  const cardW = Math.min(360, width * 0.8)
  return (
    <FlatList horizontal data={events} keyExtractor={e => e.id} showsHorizontalScrollIndicator={false}
      snapToInterval={cardW + 12} decelerationRate="fast" contentContainerStyle={{ gap: 12, paddingRight: 16 }} style={{ marginRight: -16, overflow: 'visible' }}
      renderItem={({ item, index }) => <Rise index={index}><EventCard e={item} width={cardW} compact /></Rise>} />
  )
}

/** Compact row for long lists (past events, admin). */
export function EventRow({ e }: { e: AppEvent }) {
  const status = eventStatus(e)
  return (
    <PressScale onPress={() => open(e)} scaleTo={0.985}>
      {pressed => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: pressed ? C.hover : 'transparent' }}>
          <Thumb uri={e.banner} size={58} />
          <View style={{ flex: 1, gap: 3 }}>
            <T v="h3" numberOfLines={2}>{e.title}</T>
            <T v="small" numberOfLines={1}>{fmtWhen(e.start, e.end)}</T>
            <T v="small" numberOfLines={1}>{[e.club?.name, e.isVirtual ? 'Online' : e.venue || 'On campus'].filter(Boolean).join(' · ')}</T>
          </View>
          {status ? <Badge text={status.text} tone={status.tone} /> : <Icon ios="chevron.right" android="chevron_right" size={13} color={C.textMuted} />}
        </View>
      )}
    </PressScale>
  )
}

/** Page title for tab screens (tabs have no native header). */
export function TabTitle({ title, kicker, right }: { title: string; kicker?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 40, paddingTop: 4 }}>
      <View style={{ gap: 2, flex: 1 }}>
        {kicker && <T v="small" style={{ color: C.accent, fontFamily: F.semibold }}>{kicker}</T>}
        <T v="display">{title}</T>
      </View>
      {right}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: R.xl, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderStrong },
})
export const SEP = C.border
