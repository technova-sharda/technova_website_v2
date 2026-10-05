/**
 * Sign-in for the app. The website does the Google login in the phone's
 * browser and hands back a short code that only this app can redeem
 * (PKCE-style: the code is bound to a secret that never leaves the phone).
 * The resulting session token lives in the device keychain / keystore.
 */
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'
import * as Crypto from 'expo-crypto'
import * as Linking from 'expo-linking'
import { useQueryClient } from '@tanstack/react-query'
import { api, setApiToken, setOnUnauthorized } from './api'
import { API_URL } from './config'

export type SessionUser = { id: string; name: string | null; email: string | null; image: string | null; role: string; system_id: string | null; needsOnboarding: boolean }
type Ctx = {
  isLoading: boolean
  token: string | null
  user: SessionUser | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  setUser: (u: SessionUser) => void
}

const TOKEN_KEY = 'technova.session'
const USER_KEY = 'technova.user'
const SessionContext = createContext<Ctx | null>(null)

export function useSession() {
  const v = use(SessionContext)
  if (!v) throw new Error('useSession must be inside <SessionProvider>')
  return v
}

/**
 * Android: sign in through Chrome when it's installed. Some phones (HONOR, Xiaomi…)
 * otherwise pick their own browser, which can route pages through its servers.
 */
async function androidBrowser(): Promise<WebBrowser.AuthSessionOpenOptions> {
  if (Platform.OS !== 'android') return {}
  try {
    const { browserPackages } = await WebBrowser.getCustomTabsSupportingBrowsersAsync()
    return browserPackages.includes('com.android.chrome') ? { browserPackage: 'com.android.chrome' } : {}
  } catch { return {} }
}

const toB64Url = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')

export function SessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const [isLoading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUserState] = useState<SessionUser | null>(null)

  const clear = useCallback(async () => {
    setApiToken(null)
    setToken(null)
    setUserState(null)
    queryClient.clear()
    await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USER_KEY)]).catch(() => {})
  }, [queryClient])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [t, u] = await Promise.all([SecureStore.getItemAsync(TOKEN_KEY), SecureStore.getItemAsync(USER_KEY)])
        if (!alive) return
        if (t) { setApiToken(t); setToken(t); if (u) setUserState(JSON.parse(u)) }
      } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => { setOnUnauthorized(() => { void clear() }); return () => setOnUnauthorized(null) }, [clear])

  const signIn = useCallback(async () => {
    const verifier = hex(await Crypto.getRandomBytesAsync(32))
    const challenge = toB64Url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }))
    const redirect = Linking.createURL('auth')
    const start = `${API_URL}/api/mobile/auth/start?challenge=${challenge}&redirect=${encodeURIComponent(redirect)}`
    const result = await WebBrowser.openAuthSessionAsync(start, redirect, await androidBrowser())
    if (result.type !== 'success') return
    const code = Linking.parse(result.url).queryParams?.code
    if (typeof code !== 'string') throw new Error('Sign-in was not completed')
    const res = await fetch(`${API_URL}/api/mobile/auth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, verifier }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.token) throw new Error(data.error || 'Sign-in failed')
    await Promise.all([SecureStore.setItemAsync(TOKEN_KEY, data.token), SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user))])
    setApiToken(data.token)
    setUserState(data.user)
    setToken(data.token)
  }, [])

  const signOut = useCallback(async () => {
    try { await api('/api/mobile/auth/logout', { method: 'POST' }) } catch { /* signing out locally anyway */ }
    await clear()
  }, [clear])

  const setUser = useCallback((u: SessionUser) => { setUserState(u); void SecureStore.setItemAsync(USER_KEY, JSON.stringify(u)) }, [])

  const value = useMemo(() => ({ isLoading, token, user, signIn, signOut, setUser }), [isLoading, token, user, signIn, signOut, setUser])
  return <SessionContext value={value}>{children}</SessionContext>
}
