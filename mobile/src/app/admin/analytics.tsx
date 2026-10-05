import { useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { C } from '@/constants/theme'
import { useAnalytics, type EventSummary } from '@/lib/admin'
import { ErrorState, Icon, Loading, Screen, SearchBar, StatStrip, T } from '@/components/ui'

type Key = 'date' | 'registrations' | 'attended' | 'turnoutPct' | 'avgRating' | 'feedbackResponses' | 'certificates'
const COLS: { key: Key; label: string; width: number; render: (e: EventSummary) => string }[] = [
  { key: 'date', label: 'Date', width: 74, render: e => new Date(e.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: '2-digit' }) },
  { key: 'registrations', label: 'Reg', width: 52, render: e => String(e.registrations) },
  { key: 'attended', label: 'In', width: 48, render: e => (e.attendanceRecorded ? String(e.attended) : '–') },
  { key: 'turnoutPct', label: 'Turnout', width: 64, render: e => (e.attendanceRecorded ? `${Math.round(e.turnoutPct)}%` : '–') },
  { key: 'avgRating', label: 'Rating', width: 56, render: e => (e.avgRating == null ? '–' : Number(e.avgRating).toFixed(1)) },
  { key: 'feedbackResponses', label: 'Feedback', width: 70, render: e => String(e.feedbackResponses) },
  { key: 'certificates', label: 'Certs', width: 52, render: e => String(e.certificates) },
]
const NAME_W = 170

/** Every published event's numbers in one sortable table; tap a row to open the event. */
export default function Analytics() {
  const a = useAnalytics()
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'date', dir: -1 })
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = (a.data?.events ?? []).filter(e => !s || e.title.toLowerCase().includes(s) || (e.club ?? '').toLowerCase().includes(s))
    const v = (e: EventSummary) => (sort.key === 'date' ? new Date(e.date).getTime() : (e[sort.key] as number | null) ?? -1)
    return [...list].sort((x, y) => (v(x) - v(y)) * sort.dir)
  }, [a.data, sort, q])
  const recorded = rows.filter(e => e.attendanceRecorded)
  const regs = rows.reduce((s, e) => s + e.registrations, 0)
  const turnout = recorded.length ? Math.round(recorded.reduce((s, e) => s + e.turnoutPct, 0) / recorded.length) : null
  const rated = rows.filter(e => e.avgRating != null)
  const avgRating = rated.length ? (rated.reduce((s, e) => s + Number(e.avgRating), 0) / rated.length).toFixed(1) : '–'

  const head = (label: string, key: Key | null, width: number) => (
    <Pressable key={label} disabled={!key} onPress={() => key && setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}
      style={{ width, paddingVertical: 8, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 2 }} accessibilityRole="button" accessibilityLabel={`Sort by ${label}`}>
      <T v="label" style={{ color: sort.key === key ? C.text : C.textMuted }}>{label}</T>
      {sort.key === key && <Icon ios={sort.dir === 1 ? 'chevron.up' : 'chevron.down'} android={sort.dir === 1 ? 'expand_less' : 'expand_more'} size={10} color={C.text} />}
    </Pressable>
  )

  return (
    <Screen refreshing={a.isRefetching} onRefresh={() => void a.refetch()}>
      {a.isLoading ? <Loading rows={6} /> : a.error ? <ErrorState error={a.error} onRetry={() => void a.refetch()} /> : (
        <>
          <StatStrip items={[{ label: 'Events', value: String(rows.length) }, { label: 'Registrations', value: String(regs) }, { label: 'Avg turnout', value: turnout == null ? '–' : `${turnout}%` }, { label: 'Avg rating', value: avgRating }]} />
          <SearchBar value={q} onChange={setQ} placeholder="Filter by event or club" />
          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 18, backgroundColor: C.surface, overflow: 'hidden' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface2 }}>
                  {head('Event', null, NAME_W)}
                  {COLS.map(c => head(c.label, c.key, c.width))}
                </View>
                {rows.map((e, i) => (
                  <Pressable key={e.id} onPress={() => router.push({ pathname: '/admin/event/[id]', params: { id: e.id } })}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', borderTopWidth: i ? 1 : 0, borderTopColor: C.border, backgroundColor: pressed ? C.hover : 'transparent' })}>
                    <View style={{ width: NAME_W, paddingVertical: 8, paddingHorizontal: 6 }}>
                      <T numberOfLines={1} style={{ fontSize: 13, fontWeight: '500' }}>{e.title}</T>
                      <T v="small" numberOfLines={1}>{e.club ?? ''}</T>
                    </View>
                    {COLS.map(c => (
                      <View key={c.key} style={{ width: c.width, paddingHorizontal: 6 }}>
                        <T v="mono" style={c.key === 'turnoutPct' && e.attendanceRecorded && e.turnoutPct < 40 ? { color: C.red } : undefined}>{c.render(e)}</T>
                      </View>
                    ))}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
          <T v="small">Tap a column to sort. “–” means attendance wasn&apos;t recorded. Updated {a.data ? new Date(a.data.generatedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }) : ''}.</T>
        </>
      )}
    </Screen>
  )
}
