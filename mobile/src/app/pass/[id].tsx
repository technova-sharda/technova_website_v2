import { useEffect } from 'react'
import { Platform, Pressable, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Brightness from 'expo-brightness'
import QRCode from 'react-native-qrcode-svg'
import { fmtWhen } from '@/lib/format'
import { useEvent, useTickets } from '@/lib/queries'
import { useSession } from '@/lib/session'
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff', padding: 24 }}>
      <Pressable onPress={() => router.back()} hitSlop={16} style={{ alignSelf: 'flex-end', padding: 6 }}>
        <Icon ios="xmark.circle.fill" android="close" size={30} color="#9ca3af" />
      </Pressable>
      {!event ? <Loading /> : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          <T v="label" style={{ color: '#6b7280' }}>Show this at the entrance</T>
          <T v="h2" style={{ color: '#111', textAlign: 'center' }}>{event.title}</T>
          <T v="dim" style={{ color: '#4b5563', textAlign: 'center' }}>{fmtWhen(event.start, event.end)}</T>
          {qr ? (
            <View style={{ padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#e5e7eb' }}><QRCode value={qr} size={270} ecl="M" /></View>
          ) : <T v="dim" style={{ color: '#4b5563' }}>This event has no QR ticket.</T>}
          <T v="h3" style={{ color: '#111' }}>{user?.name}</T>
          <T v="small" style={{ color: '#6b7280' }}>{user?.email}</T>
        </View>
      )}
    </SafeAreaView>
  )
}
