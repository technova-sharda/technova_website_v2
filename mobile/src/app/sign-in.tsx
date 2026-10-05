import { useState } from 'react'
import { Alert, View } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { C } from '@/constants/theme'
import { useSession } from '@/lib/session'
import { Button, Icon, T } from '@/components/ui'

const FEATURES = [
  { ios: 'ticket.fill', android: 'confirmation_number', text: 'Your event tickets, ready at the door' },
  { ios: 'calendar', android: 'event', text: 'Every Technova event, one tap to register' },
  { ios: 'trophy.fill', android: 'emoji_events', text: 'XP, rank and certificates in your pocket' },
]

export default function SignIn() {
  const { signIn } = useSession()
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try { await signIn() } catch (e) { Alert.alert('Sign-in failed', e instanceof Error ? e.message : 'Try again') } finally { setBusy(false) }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center', marginTop: 48, gap: 16 }}>
        <Image alt="Technova" source={require('@/assets/images/technova-white.png')} style={{ width: 120, height: 120 }} contentFit="contain" />
        <T v="title" style={{ textAlign: 'center' }}>Technova</T>
        <T v="dim" style={{ textAlign: 'center' }}>SSCSE Technical Society · Sharda University</T>
      </View>
      <View style={{ gap: 18 }}>
        {FEATURES.map(f => (
          <View key={f.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.amberSoft, alignItems: 'center', justifyContent: 'center' }}><Icon ios={f.ios} android={f.android} color={C.amber} /></View>
            <T style={{ flex: 1 }}>{f.text}</T>
          </View>
        ))}
      </View>
      <View style={{ gap: 12 }}>
        <Button title="Continue with Google" onPress={go} loading={busy} />
        <T v="small" style={{ textAlign: 'center' }}>Use your Sharda email. Signing in opens a secure browser page.</T>
      </View>
    </SafeAreaView>
  )
}
