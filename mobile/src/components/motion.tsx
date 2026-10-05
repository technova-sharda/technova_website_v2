/**
 * Motion for the whole app: spring press feedback, staggered entrances,
 * count-up numbers, a pulsing live dot and shimmering placeholders. All run on
 * the UI thread (Reanimated) so they stay smooth while data loads.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

const SPRING = { damping: 18, stiffness: 320, mass: 0.6 }

/** Pressable that springs down a little while held. */
export function PressScale({ children, onPress, onLongPress, disabled, style, scaleTo = 0.97, haptic = false, accessibilityLabel, accessibilityRole = 'button', hitSlop }: {
  children: ReactNode | ((pressed: boolean) => ReactNode); onPress?: () => void; onLongPress?: () => void; disabled?: boolean
  style?: StyleProp<ViewStyle>; scaleTo?: number; haptic?: boolean; accessibilityLabel?: string; accessibilityRole?: 'button' | 'tab' | 'link' | 'radio' | 'checkbox'; hitSlop?: number
}) {
  const scale = useSharedValue(1)
  const [pressed, setPressed] = useState(false)
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <Pressable disabled={disabled} hitSlop={hitSlop} accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }}
      onPressIn={() => { scale.set(withSpring(scaleTo, SPRING)); setPressed(true) }}
      onPressOut={() => { scale.set(withSpring(1, SPRING)); setPressed(false) }}
      onPress={onPress ? () => { if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress() } : undefined}
      onLongPress={onLongPress}>
      <Animated.View style={[style, anim]}>{typeof children === 'function' ? children(pressed) : children}</Animated.View>
    </Pressable>
  )
}

/**
 * Rises and fades in when it first mounts; `index` staggers siblings.
 * Driven by a shared value rather than a layout `entering` animation: those can fail to
 * start when a screen mounts during a navigation switch (e.g. right after sign-in) and
 * leave the content at opacity 0. A timing animation always ends visible.
 */
export function Rise({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const p = useSharedValue(0)
  useEffect(() => { p.set(withDelay(Math.min(index, 10) * 55, withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }))) }, [p, index])
  const anim = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 18 }] }))
  return <Animated.View style={[style, anim]}>{children}</Animated.View>
}

/** "1,240", "#12", "86%", "4.5/5": the number counts up, the rest stays. */
export function CountUp({ value, style, duration = 750 }: { value: string; style?: StyleProp<TextStyle>; duration?: number }) {
  const m = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(value)
  const target = m ? Number(m[2].replace(/,/g, '')) : NaN
  const decimals = m?.[2].includes('.') ? m[2].split('.')[1].length : 0
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!Number.isFinite(target)) return
    let raf = 0
    const start = Date.now()
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration)
      setShown(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  if (!m || !Number.isFinite(target)) return <Text style={style}>{value}</Text>
  const n = decimals ? shown.toFixed(decimals) : Math.round(shown).toLocaleString('en-IN')
  return <Text style={style}>{m[1]}{n}{m[3]}</Text>
}

/** Small breathing dot for things that are live right now. */
export function PulseDot({ color, size = 7 }: { color: string; size?: number }) {
  const o = useSharedValue(1)
  useEffect(() => { o.set(withRepeat(withSequence(withTiming(0.25, { duration: 700 }), withTiming(1, { duration: 700 })), -1)) }, [o])
  const anim = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: 0.8 + o.value * 0.2 }] }))
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, anim]} />
}

/** Placeholder block that gently shimmers while content loads. */
export function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.45)
  useEffect(() => { o.set(withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }), -1, true)) }, [o])
  const anim = useAnimatedStyle(() => ({ opacity: o.value }))
  return <Animated.View style={[{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8 }, style, anim]} />
}

export { Animated, SPRING }
