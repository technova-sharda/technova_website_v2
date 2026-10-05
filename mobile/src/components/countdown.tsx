import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { C, F } from '@/constants/theme'
import { T } from './ui'

/** Days / hours / minutes / seconds until `iso`, ticking every second. */
export function Countdown({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const ms = Math.max(0, new Date(iso).getTime() - now)
  if (ms === 0) return null
  const parts = [[Math.floor(ms / 86_400_000), 'd'], [Math.floor(ms / 3_600_000) % 24, 'h'], [Math.floor(ms / 60_000) % 60, 'm'], [Math.floor(ms / 1000) % 60, 's']] as const
  const shown = parts[0][0] > 0 ? parts.slice(0, 3) : parts.slice(1)
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {shown.map(([n, u]) => (
        <View key={u} style={{ minWidth: 46, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, backgroundColor: 'rgba(10,10,11,0.6)', borderWidth: 1, borderColor: C.border, alignItems: 'center' }}>
          <T style={{ fontFamily: F.display, fontSize: 18, lineHeight: 21, fontVariant: ['tabular-nums'] }}>{String(n).padStart(2, '0')}</T>
          <T v="small" style={{ fontSize: 10, lineHeight: 12 }}>{u === 'd' ? 'days' : u === 'h' ? 'hrs' : u === 'm' ? 'min' : 'sec'}</T>
        </View>
      ))}
    </View>
  )
}
