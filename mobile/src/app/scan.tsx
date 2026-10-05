/**
 * Door scanner for volunteers and admins (native camera, much faster than the
 * website scanner). Uses the website's existing check-in endpoints, so the
 * same rules apply: one check-in per day, XP awarded once, paid tickets only.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { C, R } from '@/constants/theme'
import { api, ApiError } from '@/lib/api'
import { useAttendees, useLiveEvents, type Attendee } from '@/lib/queries'
import { useSession } from '@/lib/session'
import { Button, Empty, Icon, Loading, Segmented, T } from '@/components/ui'
import { fmtWhen } from '@/lib/format'

type Result = { kind: 'success' | 'already' | 'error'; name: string; message: string }
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export default function ScanScreen() {
  const { user } = useSession()
  const staff = user?.role === 'admin' || user?.role === 'super_admin'
  const [permission, requestPermission] = useCameraPermissions()
  const live = useLiveEvents(staff)
  const [eventId, setEventId] = useState<string | null>(null)
  const current = eventId ?? live.data?.[0]?.id ?? null
  const currentEvent = live.data?.find(e => e.id === current)
  const [picking, setPicking] = useState(false)
  const attendees = useAttendees(current)
  const qc = useQueryClient()
  const [mode, setMode] = useState<'camera' | 'list'>('camera')
  const [focused, setFocused] = useState(true)
  const [result, setResult] = useState<Result | null>(null)
  const [recent, setRecent] = useState<(Result & { at: number })[]>([])
  const [search, setSearch] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const lock = useRef(false)
  const last = useRef({ data: '', at: 0 })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false) }, []))

  const list = useMemo(() => attendees.data?.attendees ?? [], [attendees.data])
  const multi = !!attendees.data?.isMultiDay
  const isIn = useCallback((a: Attendee) => (multi ? !!a.checkinDates?.includes(today()) : a.attended), [multi])
  const checked = list.filter(isIn).length

  const markLocal = (match: (a: Attendee) => boolean) => qc.setQueryData(['attendees', current], (old: typeof attendees.data) => old && ({
    ...old, attendees: old.attendees.map(a => match(a) ? { ...a, attended: true, checkinDates: [...new Set([...(a.checkinDates ?? []), today()])] } : a),
  }))

  const show = (r: Result) => {
    setResult(r)
    setRecent(x => [{ ...r, at: Date.now() }, ...x].slice(0, 8))
    void Haptics.notificationAsync(r.kind === 'success' ? Haptics.NotificationFeedbackType.Success : r.kind === 'already' ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Error)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setResult(null), r.kind === 'success' ? 1300 : 2500)
  }

  const onScan = async ({ data }: { data: string }) => {
    const now = Date.now()
    if (lock.current || (data === last.current.data && now - last.current.at < 4000)) return
    lock.current = true
    last.current = { data, at: now }
    try {
      let qr: Record<string, string>
      try { qr = JSON.parse(data) } catch { return show({ kind: 'error', name: '', message: 'Not a Technova ticket' }) }
      const userId = qr.userId || qr.u, ev = qr.eventId || qr.e
      if (!(qr.token || qr.t) || !userId || !ev) return show({ kind: 'error', name: '', message: 'Invalid ticket QR' })
      if (current && ev !== current) {
        const other = live.data?.find(e => e.id === ev)
        return show({ kind: 'error', name: '', message: other ? `Ticket is for “${other.title}”` : 'Ticket is for another event' })
      }
      const res = await api<{ userName?: string; isMultiDay?: boolean; daysCheckedIn?: number }>('/api/scan', { method: 'POST', body: qr })
      markLocal(a => a.userId === userId)
      show({ kind: 'success', name: res.userName ?? 'Attendee', message: res.isMultiDay ? `Day ${res.daysCheckedIn} checked in` : 'Checked in' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Check-in failed'
      const name = e instanceof ApiError ? String(e.data.userName ?? '') : ''
      show({ kind: /already checked in/i.test(msg) ? 'already' : 'error', name, message: e instanceof ApiError || e instanceof Error ? msg : 'No connection' })
    } finally {
      setTimeout(() => { lock.current = false }, 300)
    }
  }

  const manual = async (a: Attendee) => {
    setActing(a.id)
    try {
      await api(`/api/events/${current}/checkin`, { method: 'POST', body: { registrationId: a.id } })
      markLocal(x => x.id === a.id)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (e) {
      if (e instanceof Error && /already/i.test(e.message)) markLocal(x => x.id === a.id)
      else show({ kind: 'error', name: a.name, message: e instanceof Error ? e.message : 'Check-in failed' })
    } finally { setActing(null) }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (q ? list.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)) : list)
      .slice().sort((a, b) => Number(isIn(a)) - Number(isIn(b)) || a.name.localeCompare(b.name))
  }, [list, search, isIn])

  if (!staff) return <SafeAreaView style={styles.page}><Empty title="Scanner is for event staff" /></SafeAreaView>

  return (
    <SafeAreaView edges={[]} style={styles.page}>
      <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 12, paddingTop: 8 }}>
        {live.isLoading ? <Loading /> : !live.data?.length ? (
          <Empty icon={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner' }} title="No live event" hint="Events appear here from when they're published until they end." />
        ) : (
          <>
            {/* Which event is being checked in: always visible */}
            <View style={styles.eventCard}>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="label">Scanning for</T>
                <T v="h3" numberOfLines={2}>{currentEvent?.title ?? 'Pick an event'}</T>
                {currentEvent && <T v="small">{fmtWhen(currentEvent.start_time, currentEvent.end_time ?? null)}</T>}
              </View>
              {live.data.length > 1 && (
                <Pressable onPress={() => setPicking(v => !v)} style={styles.change}>
                  <T v="small" style={{ color: C.text, fontWeight: '700' }}>{picking ? 'Done' : 'Change'}</T>
                </Pressable>
              )}
            </View>
            {picking && (
              <View style={{ gap: 8 }}>
                {live.data.map(e => (
                  <Pressable key={e.id} onPress={() => { setEventId(e.id); setPicking(false); setRecent([]) }}
                    style={[styles.option, current === e.id && { borderColor: C.amber, backgroundColor: C.amberSoft }]}>
                    <T style={{ fontWeight: '600', color: current === e.id ? C.amber : C.text }} numberOfLines={1}>{e.title}</T>
                    <T v="small">{fmtWhen(e.start_time, e.end_time ?? null)}</T>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <T><T v="h3" style={{ color: C.green }}>{checked}</T><T v="dim"> / {list.length} checked in{multi ? ' today' : ''}</T></T>
                <T v="small">{list.length - checked} to go</T>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: C.surface2, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${list.length ? (checked / list.length) * 100 : 0}%`, backgroundColor: C.green }} />
              </View>
            </View>
            <Segmented value={mode} onChange={setMode} options={[{ value: 'camera', label: 'Scan' }, { value: 'list', label: 'Find a person' }]} />
          </>
        )}
      </View>

      {!!live.data?.length && mode === 'camera' && (
        <View style={{ flex: 1, paddingHorizontal: 16, gap: 12 }}>
          {!permission ? <Loading /> : !permission.granted ? (
            <View style={{ gap: 12, paddingTop: 24 }}>
              <T v="dim" style={{ textAlign: 'center' }}>Allow the camera to scan tickets.</T>
              <Button title="Allow camera" variant="primary" onPress={requestPermission} />
            </View>
          ) : (
            <View style={styles.camera}>
              {focused && <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={result ? undefined : onScan} />}
              <View pointerEvents="none" style={styles.frame} />
              {result && (
                <Pressable onPress={() => setResult(null)} style={[styles.result, { backgroundColor: result.kind === 'success' ? C.green : result.kind === 'already' ? C.amber : C.red }]}>
                  <Icon ios={result.kind === 'success' ? 'checkmark.circle.fill' : result.kind === 'already' ? 'person.crop.circle.badge.checkmark' : 'xmark.octagon.fill'} android={result.kind === 'success' ? 'check_circle' : result.kind === 'already' ? 'how_to_reg' : 'error'} size={34} color={result.kind === 'already' ? '#111' : '#fff'} />
                  <View style={{ flex: 1 }}>
                    {!!result.name && <T v="h3" style={{ color: result.kind === 'already' ? '#111' : '#fff' }} numberOfLines={1}>{result.name}</T>}
                    <T style={{ color: result.kind === 'already' ? '#111' : '#fff' }}>{result.message}</T>
                  </View>
                </Pressable>
              )}
            </View>
          )}
          {recent.length > 0 && (
            <View style={{ gap: 6 }}>
              {recent.slice(0, 3).map(r => (
                <View key={r.at} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.kind === 'success' ? C.green : r.kind === 'already' ? C.amber : C.red }} />
                  <T v="small" style={{ flex: 1, color: C.textDim }} numberOfLines={1}>{r.name || r.message}</T>
                  <T v="small">{new Date(r.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</T>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {!!live.data?.length && mode === 'list' && (
        <View style={{ flex: 1, paddingHorizontal: 16, gap: 10 }}>
          <View style={styles.search}>
            <Icon ios="magnifyingglass" android="search" size={18} color={C.textMuted} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Name or email" placeholderTextColor={C.textMuted} style={{ flex: 1, color: C.text, fontSize: 16, paddingVertical: 12 }} />
          </View>
          {attendees.isLoading ? <Loading /> : (
            <FlatList data={filtered} keyExtractor={a => a.id} contentContainerStyle={{ gap: 8, paddingBottom: 140 }} keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Empty title={search ? 'Nobody matches' : 'No registrations'} />}
              renderItem={({ item: a }) => {
                const inNow = isIn(a)
                return (
                  <View style={[styles.row, inNow && { borderColor: 'rgba(34,197,94,0.35)', backgroundColor: 'rgba(34,197,94,0.06)' }]}>
                    <View style={{ flex: 1 }}>
                      <T style={{ fontWeight: '600' }} numberOfLines={1}>{a.name}</T>
                      <T v="small" numberOfLines={1}>{a.email}</T>
                    </View>
                    {inNow ? <Icon ios="checkmark.circle.fill" android="check_circle" size={26} color={C.green} /> : (
                      <Button title="Check in" size="sm" variant="primary" onPress={() => void manual(a)} loading={acting === a.id} />
                    )}
                  </View>
                )
              }} />
          )}
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderLeftWidth: 3, borderLeftColor: C.accent, borderRadius: R.md, padding: 12 },
  change: { borderWidth: 1, borderColor: C.borderStrong, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 7 },
  option: { borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 12, gap: 2, backgroundColor: C.surface },
  camera: { width: '100%', aspectRatio: 1, borderRadius: R.md, overflow: 'hidden', backgroundColor: '#000' },
  frame: { position: 'absolute', top: '14%', left: '14%', right: '14%', bottom: '14%', borderWidth: 2, borderColor: 'rgba(245,166,35,0.9)', borderRadius: 24 },
  result: { position: 'absolute', left: 10, right: 10, bottom: 10, borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.md, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
})
