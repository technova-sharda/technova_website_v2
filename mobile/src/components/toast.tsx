/**
 * In-app toasts: a card slides down from the top with an icon, then slides away.
 * Usage: const toast = useToast(); toast.success('Registered')
 */
import { createContext, use, useCallback, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { Animated, Easing, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { C, F } from '@/constants/theme'
import { Icon } from './ui'

type Kind = 'success' | 'error' | 'info'
type Toast = { id: number; kind: Kind; title: string; message?: string }
type Api = { show: (kind: Kind, title: string, message?: string) => void; success: (t: string, m?: string) => void; error: (t: string, m?: string) => void; info: (t: string, m?: string) => void }

const ToastContext = createContext<Api | null>(null)
export function useToast() {
  const v = use(ToastContext)
  if (!v) throw new Error('useToast must be inside <ToastProvider>')
  return v
}

const STYLE: Record<Kind, { color: string; soft: string; ios: string; android: string }> = {
  success: { color: C.green, soft: C.greenSoft, ios: 'checkmark.circle.fill', android: 'check_circle' },
  error: { color: C.red, soft: C.redSoft, ios: 'exclamationmark.circle.fill', android: 'error' },
  info: { color: C.accent, soft: C.accentSoft, ios: 'info.circle.fill', android: 'info' },
}

export function ToastProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets()
  const [toast, setToast] = useState<Toast | null>(null)
  const [anim] = useState(() => new Animated.Value(0))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setToast(null))
  }, [anim])

  const show = useCallback((kind: Kind, title: string, message?: string) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ id: Date.now(), kind, title, message })
    anim.setValue(0)
    Animated.spring(anim, { toValue: 1, damping: 16, stiffness: 220, mass: 0.7, useNativeDriver: true }).start()
    void Haptics.notificationAsync(kind === 'error' ? Haptics.NotificationFeedbackType.Error : kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning)
    timer.current = setTimeout(hide, kind === 'error' ? 3800 : 2600)
  }, [anim, hide])

  const api = useMemo<Api>(() => ({
    show, success: (t, m) => show('success', t, m), error: (t, m) => show('error', t, m), info: (t, m) => show('info', t, m),
  }), [show])

  const s = toast ? STYLE[toast.kind] : null
  return (
    <ToastContext value={api}>
      {children}
      {toast && s && (
        <Animated.View pointerEvents="box-none" style={{
          position: 'absolute', left: 12, right: 12, top: insets.top + 8, zIndex: 1000,
          opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-70, 0] }) }, { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
        }}>
          <Pressable onPress={hide} accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1E1E22', borderRadius: 20, borderWidth: 1, borderColor: C.borderStrong, paddingVertical: 12, paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: s.soft, alignItems: 'center', justifyContent: 'center' }}><Icon ios={s.ios} android={s.android} size={18} color={s.color} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontFamily: F.semibold, fontSize: 14.5 }}>{toast.title}</Text>
              {!!toast.message && <Text style={{ color: C.textDim, fontFamily: F.regular, fontSize: 13, marginTop: 2 }}>{toast.message}</Text>}
            </View>
          </Pressable>
        </Animated.View>
      )}
    </ToastContext>
  )
}
