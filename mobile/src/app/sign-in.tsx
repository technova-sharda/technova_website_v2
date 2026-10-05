import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { Easing, FadeInDown, ZoomIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { C, F } from '@/constants/theme'
import { useSession } from '@/lib/session'
import { useToast } from '@/components/toast'
import { Button, Icon, T } from '@/components/ui'

const FEATURES = [
  { ios: 'calendar.badge.plus', android: 'event_available', text: 'Register for events in one tap' },
  { ios: 'qrcode', android: 'qr_code_2', text: 'Your entry ticket, always with you' },
  { ios: 'rosette', android: 'workspace_premium', text: 'Certificates, XP and the leaderboard' },
]
const rise = (i: number) => FadeInDown.delay(250 + i * 90).duration(520).easing(Easing.out(Easing.cubic))

export default function SignIn() {
  const { signIn } = useSession()
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const go = async () => {
    setBusy(true)
    try { await signIn() } catch (e) { toast.error('Sign-in failed', e instanceof Error ? e.message : 'Try again') } finally { setBusy(false) }
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={['rgba(245,166,35,0.16)', 'rgba(99,102,241,0.05)', 'rgba(10,10,11,0)']} locations={[0, 0.4, 0.75]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 22 }}>
          <Animated.View entering={ZoomIn.duration(600).easing(Easing.out(Easing.back(1.6)))}>
            <Image alt="Technova" source={require('@/assets/images/technova-white.png')} style={{ width: 76, height: 76 }} contentFit="contain" />
          </Animated.View>
          <Animated.View entering={rise(0)} style={{ gap: 6 }}>
            <T style={{ fontFamily: F.displayHeavy, fontSize: 40, lineHeight: 46, letterSpacing: -1.2 }}>Technova</T>
            <T v="dim">SSCSE Technical Society · Sharda University</T>
          </Animated.View>
          <View style={{ gap: 12 }}>
            {FEATURES.map((f, i) => (
              <Animated.View key={f.text} entering={rise(i + 1)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon ios={f.ios} android={f.android} size={17} color={C.accent} /></View>
                <T>{f.text}</T>
              </Animated.View>
            ))}
          </View>
        </View>
        <Animated.View entering={rise(5)} style={{ gap: 12 }}>
          <Button title="Continue with Google" variant="primary" icon={{ ios: 'person.crop.circle.fill', android: 'account_circle' }} onPress={go} loading={busy} />
          <T v="small" style={{ textAlign: 'center' }}>Use your Sharda email. A secure sign-in page opens in Chrome or Safari.</T>
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}
