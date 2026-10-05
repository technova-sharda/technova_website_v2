import { useState } from 'react'
import { DarkTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { C } from '@/constants/theme'
import { SessionProvider, useSession } from '@/lib/session'

SplashScreen.preventAutoHideAsync()

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, primary: C.amber, text: C.text, border: C.border } }

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }))
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <SplashController />
          <RootNavigator />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}

function SplashController() {
  const { isLoading } = useSession()
  if (!isLoading) SplashScreen.hide()
  return null
}

function RootNavigator() {
  const { token } = useSession()
  const header = { headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text, headerShadowVisible: false, contentStyle: { backgroundColor: C.bg } }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="event/[id]" options={{ ...header, headerShown: true, title: '', headerTransparent: true, headerBackButtonDisplayMode: 'minimal' }} />
        <Stack.Screen name="pass/[id]" options={{ presentation: 'modal', contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="certificates" options={{ ...header, headerShown: true, title: 'Certificates', headerBackButtonDisplayMode: 'minimal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!token}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  )
}
