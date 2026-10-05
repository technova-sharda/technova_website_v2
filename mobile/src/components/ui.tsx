import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { SymbolView, type SymbolViewProps } from 'expo-symbols'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { C, R, S } from '@/constants/theme'

type SymbolName = SymbolViewProps['name']
/** One icon, native on each platform: SF Symbols on iOS, Material Symbols on Android. */
export function Icon({ ios, android, size = 20, color = C.text }: { ios: string; android: string; size?: number; color?: string }) {
  return <SymbolView name={{ ios, android } as unknown as SymbolName} size={size} tintColor={color} />
}

export function Screen({ children, refreshing, onRefresh, edges = ['top'], scroll = true, style }: {
  children: React.ReactNode; refreshing?: boolean; onRefresh?: () => void; edges?: Edge[]; scroll?: boolean; style?: StyleProp<ViewStyle>
}) {
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: C.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={[{ padding: S.lg, paddingBottom: 120, gap: S.lg }, style]}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.amber} colors={[C.amber]} /> : undefined}>
          {children}
        </ScrollView>
      ) : <View style={[{ flex: 1 }, style]}>{children}</View>}
    </SafeAreaView>
  )
}

type Variant = 'title' | 'h2' | 'h3' | 'body' | 'dim' | 'small' | 'label'
const tv: Record<Variant, TextStyle> = {
  title: { fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700', color: C.text },
  h3: { fontSize: 16, fontWeight: '600', color: C.text },
  body: { fontSize: 15, color: C.text, lineHeight: 21 },
  dim: { fontSize: 14, color: C.textDim, lineHeight: 20 },
  small: { fontSize: 12, color: C.textMuted },
  label: { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
}
export function T({ v = 'body', style, children, numberOfLines }: { v?: Variant; style?: StyleProp<TextStyle>; children: React.ReactNode; numberOfLines?: number }) {
  return <Text style={[tv[v], style]} numberOfLines={numberOfLines}>{children}</Text>
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const body = [styles.card, style]
  return onPress
    ? <Pressable onPress={onPress} style={({ pressed }) => [...body, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>{children}</Pressable>
    : <View style={body}>{children}</View>
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style }: {
  title: string; onPress: PressableProps['onPress']; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean; disabled?: boolean
  icon?: { ios: string; android: string }; style?: StyleProp<ViewStyle>
}) {
  const bg = variant === 'primary' ? C.amber : variant === 'danger' ? C.red : variant === 'secondary' ? C.surface2 : 'transparent'
  const fg = variant === 'primary' ? '#111' : C.text
  return (
    <Pressable disabled={disabled || loading}
      onPress={e => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(e) }}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, borderColor: variant === 'secondary' ? C.border : 'transparent', opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Icon {...icon} size={18} color={fg} />}
          <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{title}</Text>
        </>
      )}
    </Pressable>
  )
}

export function Pill({ text, color = C.textDim, bg = C.surface2 }: { text: string; color?: string; bg?: string }) {
  return <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}><Text style={{ color, fontSize: 12, fontWeight: '700' }}>{text}</Text></View>
}

export function Avatar({ uri, name, size = 44 }: { uri?: string | null; name?: string | null; size?: number }) {
  const initials = (name ?? '?').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return uri
    ? <Image alt={name ?? ''} source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.surface2 }} contentFit="cover" />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.amberSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.amber, fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text></View>
}

export function Empty({ title, hint, icon }: { title: string; hint?: string; icon?: { ios: string; android: string } }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
      {icon && <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}><Icon {...icon} size={26} color={C.textMuted} /></View>}
      <T v="h3">{title}</T>
      {hint && <T v="dim" style={{ textAlign: 'center', maxWidth: 280 }}>{hint}</T>}
    </View>
  )
}

export function Loading() {
  return <View style={{ paddingVertical: 60, alignItems: 'center' }}><ActivityIndicator color={C.amber} /></View>
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Card style={{ borderColor: 'rgba(244,63,94,0.35)', gap: 10 }}>
      <T v="h3">Couldn&apos;t load</T>
      <T v="dim">{error instanceof Error ? error.message : 'Check your connection and try again.'}</T>
      {onRetry && <Button title="Try again" variant="secondary" onPress={onRetry} />}
    </Card>
  )
}

export function Segmented<V extends string>({ value, options, onChange }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.md, padding: 4, borderWidth: 1, borderColor: C.border }}>
      {options.map(o => (
        <Pressable key={o.value} onPress={() => { void Haptics.selectionAsync(); onChange(o.value) }}
          style={{ flex: 1, paddingVertical: 9, borderRadius: R.sm, backgroundColor: value === o.value ? C.surface2 : 'transparent', alignItems: 'center' }}>
          <Text style={{ color: value === o.value ? C.text : C.textMuted, fontWeight: '700', fontSize: 14 }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: S.lg },
  button: { minHeight: 52, borderRadius: R.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: S.lg },
})
