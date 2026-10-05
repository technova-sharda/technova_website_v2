import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { C } from '@/constants/theme'
import { useSession } from '@/lib/session'
import { Button, T } from '@/components/ui'

/**
 * Android also delivers the sign-in return link (technova://auth?code=…) to the router,
 * usually before the session provider has finished exchanging the code for a session.
 * Redirecting straight to Home then hits the signed-in guard and leaves this (empty)
 * screen showing, which looked like a black screen. So wait here until the session
 * exists, and offer a way back if it never arrives.
 */
export default function AuthReturn() {
  const { token } = useSession()
  const [slow, setSlow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setSlow(true), 15_000); return () => clearTimeout(t) }, [])
  if (token) return <Redirect href="/" />
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
      {!slow && <ActivityIndicator color={C.accent} size="large" />}
      <T v="h3">{slow ? 'Sign-in is taking longer than usual' : 'Signing you in…'}</T>
      {slow && <T v="dim" style={{ textAlign: 'center' }}>Check your internet connection and try again.</T>}
      {slow && <Button title="Back to sign in" variant="primary" onPress={() => router.replace('/sign-in')} />}
    </View>
  )
}
