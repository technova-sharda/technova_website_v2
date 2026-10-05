/**
 * Building blocks for every screen, in the Technova style: soft rounded
 * surfaces, Sora headings, amber for the main action, and motion on every
 * touch (spring press, staggered entrances, sliding selections). Each control
 * has pressed, disabled, loading, empty and error states.
 */
import { Children, createContext, isValidElement, use, useEffect, useState, type ReactNode } from 'react'
import {
  ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { Stack } from 'expo-router'
import { SymbolView, type SymbolViewProps } from 'expo-symbols'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { C, F, R, S } from '@/constants/theme'
import { optimized } from '@/lib/image'
import { CountUp, PressScale, PulseDot, Rise, SPRING, Shimmer } from './motion'

export type IconName = { ios: string; android: string }
type SymbolName = SymbolViewProps['name']

/** Native icon: SF Symbols on iOS, Material Symbols on Android. */
export function Icon({ ios, android, size = 18, color = C.textDim }: IconName & { size?: number; color?: string }) {
  return <SymbolView name={{ ios, android } as unknown as SymbolName} size={size} tintColor={color} />
}

// ── text ──
type Variant = 'display' | 'title' | 'h2' | 'h3' | 'body' | 'dim' | 'small' | 'label' | 'mono'
const tv: Record<Variant, TextStyle> = {
  display: { fontFamily: F.displayHeavy, fontSize: 30, color: C.text, letterSpacing: -0.8, lineHeight: 36 },
  title: { fontFamily: F.display, fontSize: 24, color: C.text, letterSpacing: -0.5, lineHeight: 30 },
  h2: { fontFamily: F.displaySemi, fontSize: 18, color: C.text, letterSpacing: -0.2, lineHeight: 24 },
  h3: { fontFamily: F.semibold, fontSize: 15.5, color: C.text, lineHeight: 21 },
  body: { fontFamily: F.regular, fontSize: 15, color: C.text, lineHeight: 21 },
  dim: { fontFamily: F.regular, fontSize: 14, color: C.textDim, lineHeight: 20 },
  small: { fontFamily: F.regular, fontSize: 12.5, color: C.textMuted, lineHeight: 17 },
  label: { fontFamily: F.semibold, fontSize: 11, color: C.textMuted, letterSpacing: 1.1, textTransform: 'uppercase' },
  mono: { fontFamily: F.medium, fontSize: 13, color: C.textDim, fontVariant: ['tabular-nums'] },
}
const WEIGHT_FAMILY: Record<string, string> = { '400': F.regular, normal: F.regular, '500': F.medium, '600': F.semibold, '700': F.bold, bold: F.bold, '800': F.bold, '900': F.bold }
/** Custom fonts carry their weight in the family name; translate fontWeight so screens can keep using it. */
function fontFix(style: StyleProp<TextStyle>): TextStyle | undefined {
  const flat = StyleSheet.flatten(style)
  if (!flat?.fontWeight) return flat
  const { fontWeight, ...rest } = flat
  return { ...rest, fontFamily: rest.fontFamily ?? WEIGHT_FAMILY[String(fontWeight)] ?? F.medium }
}
export function T({ v = 'body', style, children, numberOfLines, selectable }: { v?: Variant; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number; selectable?: boolean }) {
  return <Text style={[tv[v], fontFix(style)]} numberOfLines={numberOfLines} selectable={selectable}>{children}</Text>
}

// ── layout ──
/** Children that render nothing on the page (header options, closed sheets): never wrapped, so they add no gap. */
const INVISIBLE = new Set<unknown>([Stack.Screen, Sheet])

/** Scrollable page; its direct children rise in one after another. */
export function Screen({ children, refreshing, onRefresh, edges = [], scroll = true, padded = true, animate = true }: {
  children: ReactNode; refreshing?: boolean; onRefresh?: () => void; edges?: Edge[]; scroll?: boolean; padded?: boolean; animate?: boolean
}) {
  const items = Children.toArray(children)
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: C.bg }}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: padded ? S.lg : 0, paddingBottom: 56, gap: S.xl }}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.surface} /> : undefined}>
          {animate ? items.map((child, i) => (isValidElement(child) && INVISIBLE.has(child.type)) ? child
            : <Rise key={isValidElement(child) && child.key != null ? child.key : i} index={i}>{child}</Rise>) : children}
        </ScrollView>
      ) : <View style={{ flex: 1 }}>{children}</View>}
    </SafeAreaView>
  )
}

/** A titled block of the page. */
export function Section({ title, action, children, hint }: { title?: string; action?: ReactNode; children: ReactNode; hint?: string }) {
  return (
    <View style={{ gap: 10 }}>
      {(title || action) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 22, paddingHorizontal: 2 }}>
          {title ? <T v="label">{title}</T> : <View />}
          {action}
        </View>
      )}
      {children}
      {hint && <T v="small" style={{ paddingHorizontal: 2 }}>{hint}</T>}
    </View>
  )
}

/** Rounded list surface; rows inside get inset hairline dividers. */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = Children.toArray(children)
  return (
    <View style={[styles.group, style]}>
      {items.map((child, i) => (
        <View key={isValidElement(child) && child.key != null ? child.key : i}>
          {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.borderStrong, marginLeft: 16, opacity: 0.6 }} />}
          {child}
        </View>
      ))}
    </View>
  )
}

/** Rounded surface for free-form content (text, forms). */
export function Box({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.group, { padding: S.lg, gap: S.md }, style]}>{children}</View>
}

export function Row({ title, subtitle, left, right, onPress, chevron, destructive, disabled, selected, numberOfLines = 1 }: {
  title: ReactNode; subtitle?: ReactNode; left?: ReactNode; right?: ReactNode; onPress?: () => void; chevron?: boolean
  destructive?: boolean; disabled?: boolean; selected?: boolean; numberOfLines?: number
}) {
  const body = (pressed: boolean) => (
    <View style={[styles.row, pressed && { backgroundColor: C.hover }, selected && { backgroundColor: C.accentSoft }, disabled && { opacity: 0.45 }]}>
      {left}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        {typeof title === 'string' ? <T v="h3" style={[{ fontFamily: F.medium }, destructive && { color: C.red }]} numberOfLines={numberOfLines}>{title}</T> : title}
        {subtitle ? (typeof subtitle === 'string' ? <T v="small" numberOfLines={2}>{subtitle}</T> : subtitle) : null}
      </View>
      {right}
      {chevron && <Icon ios="chevron.right" android="chevron_right" size={13} color={C.textMuted} />}
    </View>
  )
  return onPress ? <PressScale scaleTo={0.985} disabled={disabled} onPress={onPress}>{body}</PressScale> : body(false)
}

/** Key numbers side by side; they count up when they appear. */
export function StatStrip({ items }: { items: { label: string; value: string; hint?: string; tone?: string }[] }) {
  return (
    <View style={[styles.group, { flexDirection: 'row' }]}>
      {items.map((it, i) => (
        <View key={it.label} style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 14, gap: 3, borderLeftWidth: i ? StyleSheet.hairlineWidth : 0, borderLeftColor: C.borderStrong }}>
          <T v="small" numberOfLines={1}>{it.label}</T>
          <CountUp value={it.value} style={{ fontFamily: F.display, fontSize: 22, letterSpacing: -0.4, color: it.tone ?? C.text, fontVariant: ['tabular-nums'] }} />
          {it.hint && <T v="small" numberOfLines={1}>{it.hint}</T>}
        </View>
      ))}
    </View>
  )
}

// ── controls ──
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export function Button({ title, onPress, variant = 'secondary', size = 'md', loading, disabled, icon, style, accessibilityLabel }: {
  title?: string; onPress?: () => void; variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean; disabled?: boolean
  icon?: IconName; style?: StyleProp<ViewStyle>; accessibilityLabel?: string
}) {
  const bg = { primary: C.accent, secondary: C.surface2, ghost: 'transparent', danger: C.redSoft }[variant]
  const fg = { primary: C.accentText, secondary: C.text, ghost: C.accent, danger: C.red }[variant]
  const h = size === 'sm' ? 36 : 48
  return (
    <PressScale haptic scaleTo={0.96} disabled={disabled || loading} onPress={onPress} accessibilityLabel={accessibilityLabel ?? title}
      style={[styles.button, { height: h, borderRadius: size === 'sm' ? 11 : R.md, paddingHorizontal: title ? (size === 'sm' ? 12 : 18) : 0, width: title ? undefined : h, backgroundColor: bg, borderColor: variant === 'secondary' ? C.border : 'transparent', opacity: disabled ? 0.4 : 1 }, style]}>
      {loading ? <ActivityIndicator size="small" color={fg} /> : (
        <>
          {icon && <Icon {...icon} size={size === 'sm' ? 15 : 18} color={fg} />}
          {title ? <Text style={{ color: fg, fontSize: size === 'sm' ? 13.5 : 15, fontFamily: F.bold }} numberOfLines={1}>{title}</Text> : null}
        </>
      )}
    </PressScale>
  )
}

/** Status pill (registered, live, closed…). "Live" breathes. */
export function Badge({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'violet' }) {
  const map = { neutral: [C.textDim, C.surface2], green: [C.green, C.greenSoft], amber: [C.amber, C.amberSoft], red: [C.red, C.redSoft], blue: [C.blue, C.blueSoft], violet: [C.violet, C.violetSoft] } as const
  const [fg, bg] = map[tone]
  const live = /^live$/i.test(text)
  return (
    <View style={{ backgroundColor: bg, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 3.5, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {live && <PulseDot color={fg} size={6} />}
      <Text style={{ color: fg, fontSize: 11.5, fontFamily: F.semibold }}>{text}</Text>
    </View>
  )
}

export function Field({ label, helper, error, required, style, ...props }: TextInputProps & { label: string; helper?: string; error?: string | null; required?: boolean }) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={{ gap: 7 }}>
      <T v="small" style={{ color: focused ? C.accent : C.textDim, fontFamily: F.medium }}>{label}{required ? ' *' : ''}</T>
      <TextInput placeholderTextColor={C.textMuted} selectionColor={C.accent} {...props}
        onFocus={e => { setFocused(true); props.onFocus?.(e) }} onBlur={e => { setFocused(false); props.onBlur?.(e) }}
        style={[styles.input, props.multiline && { minHeight: 104, textAlignVertical: 'top', paddingTop: 12 }, focused && { borderColor: C.accent, backgroundColor: C.surface2 }, !!error && { borderColor: C.red }, props.editable === false && { opacity: 0.5 }, style]} />
      {error ? <T v="small" style={{ color: C.red }}>{error}</T> : helper ? <T v="small">{helper}</T> : null}
    </View>
  )
}

export function SearchBar({ value, onChange, placeholder = 'Search', loading }: { value: string; onChange: (v: string) => void; placeholder?: string; loading?: boolean }) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 0, borderRadius: R.md, backgroundColor: C.surface }, focused && { borderColor: C.accent }]}>
      <Icon ios="magnifyingglass" android="search" size={17} color={focused ? C.accent : C.textMuted} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.textMuted} returnKeyType="search" autoCorrect={false} autoCapitalize="none" selectionColor={C.accent}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ flex: 1, color: C.text, fontSize: 15, fontFamily: F.regular, paddingVertical: 12 }} />
      {loading ? <ActivityIndicator size="small" color={C.textMuted} /> : value ? (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityLabel="Clear search"><Icon ios="xmark.circle.fill" android="cancel" size={17} color={C.textMuted} /></Pressable>
      ) : null}
    </View>
  )
}

/** Tabs with a thumb that slides to the selected option. */
export function Segmented<V extends string>({ value, options, onChange }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  const [w, setW] = useState(0)
  const index = Math.max(0, options.findIndex(o => o.value === value))
  const seg = w ? (w - 8) / options.length : 0
  const x = useSharedValue(0)
  useEffect(() => { if (seg) x.set(withSpring(index * seg, SPRING)) }, [x, seg, index])
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.md, padding: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderStrong }}>
      {seg > 0 && <Animated.View style={[{ position: 'absolute', top: 4, bottom: 4, left: 4, width: seg, borderRadius: 10, backgroundColor: C.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderStrong }, thumb]} />}
      {options.map(o => {
        const on = value === o.value
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { if (!on) { void Haptics.selectionAsync(); onChange(o.value) } }}
            style={{ flex: 1, paddingVertical: 8, alignItems: 'center' }}>
            <Text style={{ color: on ? C.text : C.textMuted, fontFamily: on ? F.bold : F.medium, fontSize: 13 }} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function SwitchRow({ title, subtitle, value, onChange, disabled }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <Row title={title} subtitle={subtitle} disabled={disabled} right={<Switch value={value} disabled={disabled} onValueChange={v => { void Haptics.selectionAsync(); onChange(v) }} trackColor={{ true: C.accent, false: C.surface2 }} thumbColor="#fafaf9" />} />
}

/** "1–25 of 175" with previous / next. */
export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
      <T v="small">{(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total}</T>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button size="sm" icon={{ ios: 'chevron.left', android: 'chevron_left' }} accessibilityLabel="Previous page" disabled={page <= 1} onPress={() => onChange(page - 1)} />
        <Button size="sm" icon={{ ios: 'chevron.right', android: 'chevron_right' }} accessibilityLabel="Next page" disabled={page >= pages} onPress={() => onChange(page + 1)} />
      </View>
    </View>
  )
}

export function Avatar({ uri, name, size = 38 }: { uri?: string | null; name?: string | null; size?: number }) {
  const initials = (name ?? '?').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return uri
    ? <Image alt={name ?? ''} source={{ uri: optimized(uri, size > 64 ? 256 : 128)! }} cachePolicy="memory-disk" transition={180} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.surface2 }} contentFit="cover" />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.accent, fontFamily: F.bold, fontSize: size * 0.36 }}>{initials}</Text></View>
}

export function Thumb({ uri, size = 56 }: { uri: string | null; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: C.surface2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {uri ? <Image alt="" source={{ uri: optimized(uri, 128)! }} cachePolicy="memory-disk" transition={180} style={{ width: size, height: size }} contentFit="cover" /> : <Icon ios="calendar" android="event" size={20} color={C.textMuted} />}
    </View>
  )
}

// ── states ──
export function Empty({ title, hint, icon, action }: { title: string; hint?: string; icon?: IconName; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 34, paddingHorizontal: 20, gap: 8 }}>
      {icon && <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}><Icon {...icon} size={22} color={C.accent} /></View>}
      <T v="h3" style={{ textAlign: 'center' }}>{title}</T>
      {hint && <T v="dim" style={{ textAlign: 'center', maxWidth: 300 }}>{hint}</T>}
      {action && <View style={{ marginTop: 8 }}>{action}</View>}
    </View>
  )
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.group}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.row, i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border } : null]}>
          <Shimmer style={{ width: 44, height: 44, borderRadius: 12 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <Shimmer style={{ height: 11, width: `${70 - (i % 3) * 12}%` }} />
            <Shimmer style={{ height: 9, width: '38%' }} />
          </View>
        </View>
      ))}
    </View>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={[styles.group, { padding: S.lg, gap: 10, borderColor: 'rgba(244,63,94,0.35)' }]}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Icon ios="wifi.exclamationmark" android="cloud_off" size={17} color={C.red} />
        <T v="h3">Couldn&apos;t load this</T>
      </View>
      <T v="dim">{error instanceof Error ? error.message : 'Check your connection and try again.'}</T>
      {onRetry && <Button title="Try again" size="sm" icon={{ ios: 'arrow.clockwise', android: 'refresh' }} onPress={onRetry} style={{ alignSelf: 'flex-start' }} />}
    </View>
  )
}

// ── focused tasks: bottom sheet ──
const SheetCtx = createContext<() => void>(() => {})
export const useSheetClose = () => use(SheetCtx)
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderStrong, paddingBottom: insets.bottom + 12, maxHeight: '88%' }}>
        <View style={{ alignItems: 'center', paddingTop: 8 }}><View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: C.borderStrong }} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.lg, paddingTop: 10, paddingBottom: 6 }}>
          <T v="h2">{title}</T>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Icon ios="xmark" android="close" size={14} color={C.textDim} />
          </Pressable>
        </View>
        <SheetCtx value={onClose}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.md }}>{children}</ScrollView>
        </SheetCtx>
      </View>
    </Modal>
  )
}

/** A select field that opens a sheet with the options. */
export function Select<V extends string>({ label, value, options, onChange, placeholder = 'Choose…', helper }: {
  label: string; value: V | null; options: { value: V; label: string }[]; onChange: (v: V) => void; placeholder?: string; helper?: string
}) {
  const [open, setOpen] = useState(false)
  const current = options.find(o => o.value === value)
  return (
    <View style={{ gap: 7 }}>
      <T v="small" style={{ color: C.textDim, fontFamily: F.medium }}>{label}</T>
      <PressScale scaleTo={0.985} onPress={() => setOpen(true)} accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
        style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <T style={{ color: current ? C.text : C.textMuted, flex: 1 }} numberOfLines={1}>{current?.label ?? placeholder}</T>
        <Icon ios="chevron.up.chevron.down" android="unfold_more" size={14} color={C.textMuted} />
      </PressScale>
      {helper && <T v="small">{helper}</T>}
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <Group>
          {options.map(o => (
            <Row key={o.value} title={o.label} selected={o.value === value}
              right={o.value === value ? <Icon ios="checkmark" android="check" size={16} color={C.accent} /> : null}
              onPress={() => { void Haptics.selectionAsync(); onChange(o.value); setOpen(false) }} />
          ))}
        </Group>
      </Sheet>
    </View>
  )
}

export { PressScale, Rise, CountUp, PulseDot, Shimmer }

const styles = StyleSheet.create({
  group: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderStrong, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 54 },
  button: { borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  input: { backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 15, fontFamily: F.regular, paddingHorizontal: 14, paddingVertical: 11, minHeight: 46 },
})
