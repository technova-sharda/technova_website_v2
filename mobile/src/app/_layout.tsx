import { useState } from 'react'
import { DarkTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import { Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora'
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans'
import { C, F } from '@/constants/theme'
import { SessionProvider, useSession } from '@/lib/session'
import { ToastProvider } from '@/components/toast'

SplashScreen.preventAutoHideAsync()

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, primary: C.accent, text: C.text, border: C.border } }

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold })
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }))
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={theme}>
          <ToastProvider>
            <StatusBar style="light" />
            <SplashController ready={fontsLoaded || !!fontError} />
            {(fontsLoaded || fontError) && <RootNavigator />}
          </ToastProvider>
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}

function SplashController({ ready }: { ready: boolean }) {
  const { isLoading } = useSession()
  if (!isLoading && ready) SplashScreen.hide()
  return null
}

function RootNavigator() {
  const { token } = useSession()
  const header = { headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text, headerTitleStyle: { fontFamily: F.displaySemi, fontSize: 17 }, headerShadowVisible: false, contentStyle: { backgroundColor: C.bg } }
  const page = { ...header, headerShown: true, headerBackButtonDisplayMode: 'minimal' as const }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'ios_from_right' }}>
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="event/[id]" options={{ ...header, headerShown: true, title: '', headerTransparent: true, headerBackButtonDisplayMode: 'minimal' }} />
        <Stack.Screen name="pass/[id]" options={{ presentation: 'modal', contentStyle: { backgroundColor: '#F4F4F5' } }} />
        <Stack.Screen name="certificates" options={{ ...page, title: 'Certificates' }} />
        <Stack.Screen name="leaderboard" options={{ ...page, title: 'Leaderboard' }} />
        <Stack.Screen name="team" options={{ ...page, title: 'Team Technova' }} />
        <Stack.Screen name="club/[id]" options={{ ...page, title: 'Club' }} />
        <Stack.Screen name="scan" options={{ ...page, title: 'Check-in' }} />
        <Stack.Screen name="admin/index" options={{ ...page, title: 'Admin' }} />
        <Stack.Screen name="admin/events" options={{ ...page, title: 'Events' }} />
        <Stack.Screen name="admin/event/[id]" options={{ ...page, title: 'Event' }} />
        <Stack.Screen name="admin/event-form" options={{ ...page, title: 'Event' }} />
        <Stack.Screen name="admin/people" options={{ ...page, title: 'People' }} />
        <Stack.Screen name="admin/person/[id]" options={{ ...page, title: 'Student' }} />
        <Stack.Screen name="admin/roles" options={{ ...page, title: 'Admin roles' }} />
        <Stack.Screen name="admin/certificates" options={{ ...page, title: 'Certificates' }} />
        <Stack.Screen name="admin/forms" options={{ ...page, title: 'Forms' }} />
        <Stack.Screen name="admin/form/[id]" options={{ ...page, title: 'Form' }} />
        <Stack.Screen name="admin/analytics" options={{ ...page, title: 'Analytics' }} />
        <Stack.Screen name="admin/ask" options={{ ...page, title: 'Ask Technova' }} />
        <Stack.Screen name="admin/logs" options={{ ...page, title: 'Activity log' }} />
        <Stack.Screen name="manage/index" options={{ ...page, title: 'Club management' }} />
        <Stack.Screen name="manage/[id]" options={{ ...page, title: 'Club' }} />
      </Stack.Protected>
      <Stack.Protected guard={!token}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  )
}
