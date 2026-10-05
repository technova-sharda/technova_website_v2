import { useState } from 'react'
import { Platform, Pressable, View } from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { C, R } from '@/constants/theme'
import { Button, Icon, Sheet, T } from '@/components/ui'

/** Values are IST wall-clock strings, the same as the website's inputs: "2026-10-05T14:30", "2026-10-05" or "14:30". */
type Mode = 'datetime' | 'date' | 'time'
const IST = 5.5 * 3600_000
const TZ = 'Asia/Kolkata'

export function toIstInput(iso: string | null | undefined) {
  return iso ? new Date(new Date(iso).getTime() + IST).toISOString().slice(0, 16) : ''
}
function toDate(value: string, mode: Mode) {
  if (!value) return new Date()
  const s = mode === 'time' ? `2000-01-01T${value}` : mode === 'date' ? `${value}T10:00` : value
  return new Date(`${s}:00+05:30`)
}
function fromDate(d: Date, mode: Mode) {
  const s = new Date(d.getTime() + IST).toISOString()
  return mode === 'date' ? s.slice(0, 10) : mode === 'time' ? s.slice(11, 16) : s.slice(0, 16)
}
function show(value: string, mode: Mode) {
  if (!value) return null
  const d = toDate(value, mode)
  const o: Intl.DateTimeFormatOptions = mode === 'time' ? { hour: 'numeric', minute: '2-digit' }
    : mode === 'date' ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
    : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
  return d.toLocaleString('en-IN', { ...o, timeZone: TZ })
}

export function DateTimeField({ label, value, onChange, mode = 'datetime', required, error, helper }: {
  label: string; value: string; onChange: (v: string) => void; mode?: Mode; required?: boolean; error?: string | null; helper?: string
}) {
  const [iosOpen, setIosOpen] = useState(false)
  const [draft, setDraft] = useState<Date>(new Date())
  const open = () => {
    const current = toDate(value, mode)
    if (Platform.OS === 'android') {
      const pickTime = (base: Date) => DateTimePickerAndroid.open({ value: base, mode: 'time', is24Hour: false, timeZoneName: TZ, onChange: (ev, t) => { if (ev.type === 'set' && t) onChange(fromDate(t, mode)) } })
      if (mode === 'time') return pickTime(current)
      DateTimePickerAndroid.open({ value: current, mode: 'date', timeZoneName: TZ, onChange: (ev, d) => {
        if (ev.type !== 'set' || !d) return
        if (mode === 'date') onChange(fromDate(d, 'date'))
        else { const day = fromDate(d, 'date'); const time = value ? value.slice(11, 16) : '10:00'; pickTime(new Date(`${day}T${time}:00+05:30`)) }
      } })
    } else { setDraft(current); setIosOpen(true) }
  }
  const text = show(value, mode)
  return (
    <View style={{ gap: 6 }}>
      <T v="small" style={{ color: C.textDim, fontWeight: '500' }}>{label}{required ? ' *' : ''}</T>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${label}: ${text ?? 'not set'}`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: R.sm, borderWidth: 1, borderColor: error ? C.red : pressed ? C.borderStrong : C.border, paddingHorizontal: 12, minHeight: 42 })}>
        <Icon ios={mode === 'time' ? 'clock' : 'calendar'} android={mode === 'time' ? 'schedule' : 'calendar_today'} size={15} color={C.textMuted} />
        <T style={{ color: text ? C.text : C.textMuted, flex: 1 }}>{text ?? 'Choose'}</T>
      </Pressable>
      {error ? <T v="small" style={{ color: C.red }}>{error}</T> : helper ? <T v="small">{helper}</T> : null}
      {Platform.OS === 'ios' && (
        <Sheet open={iosOpen} onClose={() => setIosOpen(false)} title={label}>
          <DateTimePicker value={draft} mode={mode} display="spinner" themeVariant="dark" timeZoneName={TZ} onChange={(_, d) => d && setDraft(d)} />
          <Button variant="primary" title="Done" onPress={() => { onChange(fromDate(draft, mode)); setIosOpen(false) }} />
        </Sheet>
      )}
    </View>
  )
}

/** Two options side by side for a yes/no setting that needs a label above it. */
export function Toggle({ label, value, onChange, options }: { label: string; value: boolean; onChange: (v: boolean) => void; options: [string, string] }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="small" style={{ color: C.textDim, fontWeight: '500' }}>{label}</T>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[false, true].map(v => (
          <Pressable key={String(v)} onPress={() => onChange(v)} accessibilityRole="radio" accessibilityState={{ selected: value === v }}
            style={{ flex: 1, minHeight: 40, borderRadius: R.sm, borderWidth: 1, borderColor: value === v ? C.accent : C.border, backgroundColor: value === v ? C.accentSoft : C.bg, alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ color: value === v ? C.text : C.textDim, fontWeight: '600', fontSize: 13 }}>{options[v ? 1 : 0]}</T>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
