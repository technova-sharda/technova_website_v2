import { useEffect } from 'react'
import { Platform, Pressable, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Brightness from 'expo-brightness'
import QRCode from 'react-native-qrcode-svg'
import { fmtWhen } from '@/lib/format'
import { useEvent, useTickets } from '@/lib/queries'
import { useSession } from '@/lib/session'
import Animated, { Easing, ZoomIn } from 'react-native-reanimated'
import { F } from '@/constants/theme'
import { Icon, Loading, T } from '@/components/ui'

/** Full-screen ticket for the door: white background, big QR, screen brightness up while open. */
export default function PassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useSession()
  const tickets = useTickets()
  const fromList = tickets.data?.find(t => t.event.id === id)
  const detail = useEvent(id)
  const qr = fromList?.qr ?? detail.data?.ticket ?? null
  const event = fromList?.event ?? detail.data

  useEffect(() => {
    let previous: number | null = null
    void (async () => {
      try { previous = await Brightness.getBrightnessAsync(); await Brightness.setBrightnessAsync(1) } catch { /* optional */ }
    })()
    return () => {
      void (async () => {
        try {
          if (Platform.OS === 'android') await Brightness.restoreSystemBrightnessAsync()
          else if (previous !== null) await Brightness.setBrightnessAsync(previous)
        } catch { /* optional */ }
      })()
    }
  }, [])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F4F5', padding: 20 }}>
      <Pressable onPress={() => router.back()} hitSlop={16} style={{ alignSelf: 'flex-end', padding: 6 }}>
        <Icon ios="xmark.circle.fill" android="close" size={30} color="#9ca3af" />
      </Pressable>
      {!event ? <Loading /> : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View entering={ZoomIn.duration(450).easing(Easing.out(Easing.back(1.4)))} style={{ width: '100%', maxWidth: 380, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 }}>
            <View style={{ backgroundColor: '#0A0A0B', paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T style={{ fontFamily: F.display, fontSize: 16, color: '#fff' }}>Technova</T>
              <T v="label" style={{ color: '#F5A623' }}>Entry ticket</T>
            </View>
            <View style={{ alignItems: 'center', padding: 22, gap: 14 }}>
              <T v="h2" style={{ color: '#111', textAlign: 'center' }}>{event.title}</T>
              <T v="dim" style={{ color: '#4b5563', textAlign: 'center', marginTop: -6 }}>{fmtWhen(event.start, event.end)}</T>
              {qr ? <View style={{ padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb' }}><QRCode value={qr} size={250} ecl="M" /></View>
                : <T v="dim" style={{ color: '#4b5563' }}>This event has no QR ticket.</T>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#F4F4F5', marginLeft: -10, borderWidth: 1, borderColor: '#ececec' }} />
              <View style={{ flex: 1, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: '#d4d4d8', marginHorizontal: 4 }} />
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#F4F4F5', marginRight: -10, borderWidth: 1, borderColor: '#ececec' }} />
            </View>
            <View style={{ padding: 18, alignItems: 'center', gap: 2 }}>
              <T v="h3" style={{ color: '#111' }}>{user?.name}</T>
              <T v="small" style={{ color: '#6b7280' }}>{user?.email}</T>
            </View>
          </Animated.View>
          <T v="small" style={{ color: '#6b7280', marginTop: 18 }}>Show this at the entrance · brightness is turned up</T>
        </View>
      )}
    </SafeAreaView>
  )
}
