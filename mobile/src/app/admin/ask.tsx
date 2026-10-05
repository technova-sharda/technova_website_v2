import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { C, R } from '@/constants/theme'
import { api } from '@/lib/api'
import { Box, Button, T } from '@/components/ui'

type Rows = Record<string, string | number | boolean | null>[]
type Answer = { summary: string; chart: { type: string; title: string; x: string; y: string[]; data: Rows } | null; followUps: string[]; steps: { tool: string }[]; model: string }
type Turn = { q: string; a?: Answer; error?: string }
const STARTERS = ['Which events had the best turnout this semester?', 'How many students registered in the last 30 days?', 'Which club ran the most events this year?', 'Which events still need attendance marked?']
const cell = (v: unknown) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : v == null ? '–' : String(v))

/** The answer's numbers as a compact table; a bar per row when there is one numeric column. */
function DataTable({ chart }: { chart: NonNullable<Answer['chart']> }) {
  const rows = chart.data.slice(0, 25)
  const y = chart.y[0]
  const max = Math.max(1, ...rows.map(r => (typeof r[y] === 'number' ? (r[y] as number) : 0)))
  const bars = chart.type !== 'table' && chart.y.length === 1
  return (
    <View style={{ gap: 6 }}>
      <T v="label">{chart.title}</T>
      <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: R.sm, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', backgroundColor: C.surface2, paddingHorizontal: 8, paddingVertical: 6 }}>
          <T v="small" style={{ flex: 2 }}>{chart.x}</T>
          {chart.y.map(k => <T key={k} v="small" style={{ flex: 1, textAlign: 'right' }}>{k}</T>)}
        </View>
        {rows.map((r, i) => (
          <View key={i} style={{ paddingHorizontal: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border, gap: 4 }}>
            <View style={{ flexDirection: 'row' }}>
              <T style={{ flex: 2, fontSize: 13 }} numberOfLines={2}>{cell(r[chart.x])}</T>
              {chart.y.map(k => <T key={k} v="mono" style={{ flex: 1, textAlign: 'right' }}>{cell(r[k])}</T>)}
            </View>
            {bars && typeof r[y] === 'number' && <View style={{ height: 3, width: `${Math.max(2, ((r[y] as number) / max) * 100)}%`, backgroundColor: C.accent, borderRadius: 2 }} />}
          </View>
        ))}
      </View>
      {chart.data.length > rows.length && <T v="small">Showing 25 of {chart.data.length} rows.</T>}
    </View>
  )
}

export default function Ask() {
  const insets = useSafeAreaInsets()
  const scroll = useRef<ScrollView>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const ask = async (question: string) => {
    const q = question.trim()
    if (q.length < 3 || busy) return
    setText(''); setBusy(true)
    const history = turns.filter(t => t.a).slice(-3).map(t => ({ q: t.q, a: t.a!.summary }))
    setTurns(t => [...t, { q }])
    try {
      const a = await api<Answer>('/api/admin/insights', { method: 'POST', body: { question: q, history } })
      setTurns(t => t.map((x, i) => (i === t.length - 1 ? { ...x, a } : x)))
    } catch (e) {
      setTurns(t => t.map((x, i) => (i === t.length - 1 ? { ...x, error: e instanceof Error ? e.message : 'Something went wrong' } : x)))
    } finally {
      setBusy(false)
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
        {turns.length === 0 && (
          <View style={{ gap: 8 }}>
            <T v="dim">Ask about events, registrations, attendance, ratings or clubs. Answers come from the live database; numbers are shown as a table you can check.</T>
            <T v="label" style={{ marginTop: 8 }}>Try</T>
            {STARTERS.map(s => <Button key={s} title={s} style={{ justifyContent: 'flex-start' }} onPress={() => void ask(s)} />)}
          </View>
        )}
        {turns.map((t, i) => (
          <View key={i} style={{ gap: 8 }}>
            <View style={{ alignSelf: 'flex-end', maxWidth: '88%', backgroundColor: C.surface2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 8 }}><T>{t.q}</T></View>
            {t.a ? (
              <Box>
                <T selectable>{t.a.summary}</T>
                {t.a.chart && t.a.chart.data.length > 0 && <DataTable chart={t.a.chart} />}
                {t.a.steps.length > 0 && <T v="small">Checked: {[...new Set(t.a.steps.map(s => s.tool.replace(/_/g, ' ')))].join(', ')}</T>}
                {i === turns.length - 1 && t.a.followUps.length > 0 && (
                  <View style={{ gap: 6 }}>
                    {t.a.followUps.slice(0, 3).map(f => <Button key={f} size="sm" variant="ghost" title={f} icon={{ ios: 'arrow.turn.down.right', android: 'subdirectory_arrow_right' }} style={{ justifyContent: 'flex-start' }} onPress={() => void ask(f)} />)}
                  </View>
                )}
              </Box>
            ) : t.error ? (
              <Box style={{ borderColor: 'rgba(240,82,79,0.35)' }}><T style={{ color: C.red }}>{t.error}</T></Box>
            ) : <T v="small">Looking through the data…</T>}
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 12 + insets.bottom, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface }}>
        <TextInput value={text} onChangeText={setText} placeholder="Ask a question" placeholderTextColor={C.textMuted} multiline maxLength={500}
          style={{ flex: 1, color: C.text, fontSize: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 10, maxHeight: 120 }} />
        <Button variant="primary" icon={{ ios: 'arrow.up', android: 'arrow_upward' }} accessibilityLabel="Ask" loading={busy} disabled={text.trim().length < 3} onPress={() => void ask(text)} />
      </View>
    </KeyboardAvoidingView>
  )
}
