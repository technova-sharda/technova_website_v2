import { Pressable, View } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { C, R } from '@/constants/theme'
import { fmtWhen, relative } from '@/lib/format'
import type { AppEvent } from '@/lib/types'
import { Icon, Pill, T } from './ui'

export function statusPill(e: AppEvent) {
  if (e.my.status === 'registered') return { text: e.my.attended ? 'Attended' : 'Registered', color: C.green, bg: C.greenSoft }
  if (e.my.status === 'payment_pending') return { text: 'Payment pending', color: C.amber, bg: C.amberSoft }
  if (e.phase === 'live') return { text: 'Live now', color: C.green, bg: C.greenSoft }
  if (e.phase === 'ended') return { text: 'Ended', color: C.textMuted, bg: C.surface2 }
  if (e.registrationsClosed || (e.capacity && e.registered >= e.capacity)) return { text: 'Full', color: C.red, bg: C.redSoft }
  if (e.capacity) return { text: `${Math.max(0, e.capacity - e.registered)} seats left`, color: C.amber, bg: C.amberSoft }
  return { text: relative(e.start), color: C.textDim, bg: C.surface2 }
}

/** Big banner card for lists. */
export function EventCard({ e, compact }: { e: AppEvent; compact?: boolean }) {
  const pill = statusPill(e)
  return (
    <Pressable onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })}
      style={({ pressed }) => ({ backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden', width: compact ? 280 : undefined, opacity: pressed ? 0.88 : 1 })}>
      <View style={{ aspectRatio: 16 / 8, backgroundColor: C.surface2 }}>
        {e.banner ? <Image alt="" source={{ uri: e.banner }} style={{ flex: 1 }} contentFit="cover" transition={200} /> : null}
        <View style={{ position: 'absolute', left: 12, top: 12 }}><Pill {...pill} /></View>
      </View>
      <View style={{ padding: 14, gap: 6 }}>
        {e.club && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {e.club.logo && <Image alt={`${e.club.name} logo`} source={{ uri: e.club.logo }} style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: '#fff' }} contentFit="contain" />}
            <T v="small" style={{ color: C.textDim }}>{e.club.name}</T>
          </View>
        )}
        <T v="h3" numberOfLines={2}>{e.title}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon ios="calendar" android="calendar_today" size={14} color={C.textMuted} />
          <T v="small" numberOfLines={1}>{fmtWhen(e.start, e.end)}</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon ios={e.isVirtual ? 'video' : 'mappin.and.ellipse'} android={e.isVirtual ? 'videocam' : 'location_on'} size={14} color={C.textMuted} />
          <T v="small" numberOfLines={1}>{e.isVirtual ? 'Online' : e.venue || 'On campus'}</T>
        </View>
      </View>
    </Pressable>
  )
}
