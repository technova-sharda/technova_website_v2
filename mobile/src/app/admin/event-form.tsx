import { useState } from 'react'
import { KeyboardAvoidingView, Platform, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { C, R } from '@/constants/theme'
import { adminApi, useAdminEvent, useClubOptions } from '@/lib/admin'
import { useToast } from '@/components/toast'
import { DateTimeField, Toggle, toIstInput } from '@/components/admin/inputs'
import { Box, Button, ErrorState, Field, Loading, Screen, Section, Select, T } from '@/components/ui'

type Ev = Record<string, any>
const TYPES = [{ value: 'talk_seminar', label: 'Talk / Seminar (50 XP)' }, { value: 'workshop', label: 'Workshop (80 XP)' }, { value: 'competition', label: 'Competition (100 XP)' }, { value: 'hackathon', label: 'Hackathon (150 XP)' }]
const LEVELS = [{ value: 'easy', label: 'Easy (×1.0), no prerequisite' }, { value: 'moderate', label: 'Moderate (×1.3), basic prerequisite' }, { value: 'hard', label: 'Hard (×1.6), strong prerequisite' }, { value: 'elite', label: 'Elite (×2.0), advanced' }]

function initial(e?: Ev) {
  const start = toIstInput(e?.start_time), end = toIstInput(e?.end_time)
  return {
    title: e?.title ?? '', description: e?.description ?? '', club_id: e?.club_id ?? '', co_host_club_id: e?.co_host_club_id ?? 'none', poc_name: e?.poc_name ?? '',
    is_virtual: !!e?.is_virtual, meeting_link: e?.meeting_link ?? '', venue: e?.venue ?? '',
    is_multi_day: !!e?.is_multi_day, start_time: start, end_time: end, start_date: start.slice(0, 10), end_date: end.slice(0, 10),
    daily_start_time: (e?.daily_start_time ?? '').slice(0, 5), daily_end_time: (e?.daily_end_time ?? '').slice(0, 5),
    capacity: e?.capacity != null ? String(e.capacity) : '', price: String(e?.price ?? 0),
    status: e?.status ?? 'draft', event_type: e?.event_type ?? 'workshop', difficulty_level: e?.difficulty_level ?? 'easy',
  }
}
type Form = ReturnType<typeof initial>

function validate(f: Form) {
  const err: Partial<Record<keyof Form, string>> = {}
  if (!f.title.trim()) err.title = 'Add a title'
  if (!f.description.trim()) err.description = 'Add a description'
  if (!f.club_id) err.club_id = 'Choose the organising club'
  if (!f.is_virtual && !f.venue.trim()) err.venue = 'Add a venue, or switch to online'
  if (f.is_virtual && f.meeting_link && !/^https?:\/\//.test(f.meeting_link.trim())) err.meeting_link = 'Paste the full link, starting with https://'
  if (f.is_multi_day) {
    if (!f.start_date) err.start_date = 'Choose the first day'
    if (!f.end_date) err.end_date = 'Choose the last day'
    else if (f.start_date && f.end_date < f.start_date) err.end_date = 'Last day is before the first day'
    if (!f.daily_start_time) err.daily_start_time = 'Choose a start time'
    if (!f.daily_end_time) err.daily_end_time = 'Choose an end time'
  } else {
    if (!f.start_time) err.start_time = 'Choose when it starts'
    if (!f.end_time) err.end_time = 'Choose when it ends'
    else if (f.start_time && f.end_time <= f.start_time) err.end_time = 'Ends before it starts'
  }
  if (!/^\d+$/.test(f.capacity) || Number(f.capacity) < 1) err.capacity = 'Whole number, at least 1'
  if (!/^\d+(\.\d{1,2})?$/.test(f.price)) err.price = 'Enter 0 for free events'
  return err
}

export default function EventFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const existing = useAdminEvent(id)
  if (id && existing.isLoading) return <Screen><Loading rows={5} /></Screen>
  if (id && (existing.error || !existing.data)) return <Screen><ErrorState error={existing.error ?? new Error('Event not found')} onRetry={() => void existing.refetch()} /></Screen>
  return <EventForm event={existing.data?.event} key={id ?? 'new'} />
}

function EventForm({ event }: { event?: Ev }) {
  const toast = useToast()
  const qc = useQueryClient()
  const clubs = useClubOptions()
  const [f, setF] = useState(() => initial(event))
  const [banner, setBanner] = useState<{ uri: string; name: string; type: string } | null>(null)
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setF(s => ({ ...s, [k]: v }))
  const errors = validate(f)
  const err = (k: keyof Form) => (tried ? errors[k] ?? null : null)
  const clubOptions = (clubs.data ?? []).map(c => ({ value: c.id, label: c.name }))
  const questions = (() => { try { const r = event?.registration_fields; const a = typeof r === 'string' ? JSON.parse(r) : r; return Array.isArray(a) ? a : [] } catch { return [] } })()
  const statusOptions = [{ value: 'draft', label: 'Draft (hidden from students)' }, { value: 'live', label: 'Live (public)' }]
  if (event?.status && !statusOptions.some(o => o.value === event.status)) statusOptions.push({ value: event.status, label: event.status })

  const pickBanner = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [16, 9] })
    if (r.canceled || !r.assets[0]) return
    const a = r.assets[0]
    setBanner({ uri: a.uri, name: a.fileName ?? `banner-${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg' })
  }

  const save = async () => {
    setTried(true)
    if (Object.keys(errors).length) { toast.error('Check the highlighted fields'); return }
    const fd = new FormData()
    const put = (k: string, v: string) => fd.append(k, v)
    put('title', f.title.trim()); put('description', f.description.trim()); put('club_id', f.club_id); put('co_host_club_id', f.co_host_club_id || 'none')
    put('poc_name', f.poc_name.trim()); put('venue', f.venue.trim()); put('capacity', f.capacity); put('price', f.price)
    put('status', f.status); put('event_type', f.event_type); put('difficulty_level', f.difficulty_level)
    if (f.is_virtual) { put('is_virtual', 'true'); put('meeting_link', f.meeting_link.trim()) }
    if (f.is_multi_day) {
      put('is_multi_day', 'true'); put('start_date', f.start_date); put('end_date', f.end_date)
      put('daily_start_time', f.daily_start_time); put('daily_end_time', f.daily_end_time)
      put('excluded_dates', JSON.stringify(event?.excluded_dates ?? []))
    } else { put('start_time', f.start_time); put('end_time', f.end_time) }
    put('registration_fields', JSON.stringify(questions))
    put('banner_position', event?.banner_position || 'center')
    if (event?.banner) put('banner', event.banner)
    if (banner) fd.append('banner_file', banner as unknown as Blob)
    setSaving(true)
    try {
      const r = await adminApi<{ eventId?: string; message?: string }>(event ? `/events/${event.id}` : '/events', { method: event ? 'PUT' : 'POST', body: fd })
      void qc.invalidateQueries({ queryKey: ['admin'] })
      void qc.invalidateQueries({ queryKey: ['events'] })
      void qc.invalidateQueries({ queryKey: ['home'] })
      toast.success(event ? 'Event saved' : 'Event created', f.status === 'draft' ? 'Still a draft: students can\'t see it yet.' : undefined)
      if (!event && r.eventId) router.replace({ pathname: '/admin/event/[id]', params: { id: r.eventId } })
      else router.back()
    } catch (e) {
      toast.error("Couldn't save", e instanceof Error ? e.message : 'Try again')
    } finally { setSaving(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: event ? 'Edit event' : 'New event' }} />
      <Screen>
        <Section title="Basics">
          <Box>
            <Field label="Title" required value={f.title} onChangeText={set('title')} error={err('title')} placeholder="e.g. Intro to Git and GitHub" maxLength={140} />
            <Field label="Description" required value={f.description} onChangeText={set('description')} error={err('description')} multiline placeholder="What students will do and learn, and what to bring" />
            {clubs.isLoading ? <T v="small">Loading clubs…</T> : (
              <>
                <Select label="Organising club *" value={f.club_id || null} onChange={set('club_id')} options={clubOptions} helper={err('club_id') ?? undefined} />
                <Select label="Co-host" value={f.co_host_club_id} onChange={set('co_host_club_id')} options={[{ value: 'none', label: 'No co-host' }, ...clubOptions.filter(c => c.value !== f.club_id)]} />
              </>
            )}
            <Field label="Point of contact" value={f.poc_name} onChangeText={set('poc_name')} placeholder="Name of the coordinator" helper="Shown in the ECR." />
          </Box>
        </Section>

        <Section title="Banner">
          <Box>
            {(banner?.uri || event?.banner) ? (
              <Image source={{ uri: banner?.uri ?? event?.banner }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: R.sm, backgroundColor: C.surface2 }} contentFit="cover" alt="Event banner" />
            ) : <T v="small">No banner yet. A 16:9 image works best.</T>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title={banner || event?.banner ? 'Replace image' : 'Choose image'} icon={{ ios: 'photo', android: 'image' }} onPress={() => void pickBanner()} />
              {banner && <Button variant="ghost" title="Undo" onPress={() => setBanner(null)} />}
            </View>
          </Box>
        </Section>

        <Section title="When and where">
          <Box>
            <Toggle label="Format" value={f.is_virtual} onChange={set('is_virtual')} options={['In person', 'Online']} />
            {f.is_virtual
              ? <Field label="Meeting link" value={f.meeting_link} onChangeText={set('meeting_link')} error={err('meeting_link')} placeholder="https://meet.google.com/…" autoCapitalize="none" keyboardType="url" helper="Registered students see it in their tickets." />
              : null}
            <Field label={f.is_virtual ? 'Venue (optional)' : 'Venue'} required={!f.is_virtual} value={f.venue} onChangeText={set('venue')} error={err('venue')} placeholder="e.g. Block 10, Room 204" />
            <Toggle label="Schedule" value={f.is_multi_day} onChange={set('is_multi_day')} options={['Single session', 'Several days']} />
            {f.is_multi_day ? (
              <>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><DateTimeField mode="date" label="First day" required value={f.start_date} onChange={set('start_date')} error={err('start_date')} /></View>
                  <View style={{ flex: 1 }}><DateTimeField mode="date" label="Last day" required value={f.end_date} onChange={set('end_date')} error={err('end_date')} /></View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><DateTimeField mode="time" label="Daily start" required value={f.daily_start_time} onChange={set('daily_start_time')} error={err('daily_start_time')} /></View>
                  <View style={{ flex: 1 }}><DateTimeField mode="time" label="Daily end" required value={f.daily_end_time} onChange={set('daily_end_time')} error={err('daily_end_time')} /></View>
                </View>
                {(event?.excluded_dates?.length ?? 0) > 0 && <T v="small">{event!.excluded_dates.length} skipped days are kept. Change them on the website.</T>}
              </>
            ) : (
              <>
                <DateTimeField label="Starts" required value={f.start_time} onChange={set('start_time')} error={err('start_time')} />
                <DateTimeField label="Ends" required value={f.end_time} onChange={set('end_time')} error={err('end_time')} />
              </>
            )}
            <T v="small">Times are India time (IST).</T>
          </Box>
        </Section>

        <Section title="Registration">
          <Box>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Seats" required value={f.capacity} onChangeText={set('capacity')} error={err('capacity')} keyboardType="number-pad" placeholder="100" /></View>
              <View style={{ flex: 1 }}><Field label="Price (₹)" required value={f.price} onChangeText={set('price')} error={err('price')} keyboardType="decimal-pad" helper="0 = free" /></View>
            </View>
            <T v="small">{questions.length ? `${questions.length} custom registration questions are kept. Edit them on the website.` : 'Custom registration questions can be added on the website.'}</T>
          </Box>
        </Section>

        <Section title="XP and visibility">
          <Box>
            <Select label="Event type" value={f.event_type} onChange={set('event_type')} options={TYPES} />
            <Select label="Difficulty" value={f.difficulty_level} onChange={set('difficulty_level')} options={LEVELS} helper="XP = type × difficulty, awarded when attendance is marked." />
            <Select label="Status" value={f.status} onChange={set('status')} options={statusOptions} />
          </Box>
        </Section>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Cancel" style={{ flex: 1 }} onPress={() => router.back()} disabled={saving} />
          <Button title={event ? 'Save changes' : 'Create event'} variant="primary" style={{ flex: 2 }} loading={saving} onPress={() => void save()} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  )
}
