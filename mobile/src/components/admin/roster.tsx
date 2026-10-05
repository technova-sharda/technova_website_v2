import { useDeferredValue, useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { C } from '@/constants/theme'
import { adminApi, useAdminMutation, useRoster, type RosterEntry } from '@/lib/admin'
import { useToast } from '@/components/toast'
import { Badge, Button, Empty, ErrorState, Group, Icon, Loading, Pagination, Row, SearchBar, Section, Segmented, Select, Sheet, T } from '@/components/ui'

const PAGE = 25
type Show = 'all' | 'absent' | 'present'

function Check({ on, onPress, disabled }: { on: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled }}
      style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: on ? C.accent : C.borderStrong, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
      {on && <Icon ios="checkmark" android="check" size={14} color={C.accentText} />}
    </Pressable>
  )
}

/** Registrations with search, present/absent filter, paging, and bulk "mark present" for a chosen day. */
export function RosterPanel({ eventId }: { eventId: string }) {
  const toast = useToast()
  const roster = useRoster(eventId)
  const [q, setQ] = useState('')
  const query = useDeferredValue(q)
  const [show, setShow] = useState<Show>('all')
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState(false)
  const days = roster.data?.days ?? []
  const [dayChoice, setDayChoice] = useState<string | null>(null)
  const [today] = useState(() => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10))
  const day = dayChoice ?? days.find(d => d.key === today)?.key ?? days[0]?.key ?? ''
  const multi = !!roster.data?.event.isMultiDay && days.length > 1
  const present = (r: RosterEntry) => (multi ? r.checkedInDays.includes(day) : r.attended)

  const all = roster.data?.roster ?? []
  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase()
    return all.filter(r => (show === 'all' || (show === 'present') === present(r))
      && (!s || [r.name, r.email, r.systemId].some(v => (v ?? '').toLowerCase().includes(s))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, query, show, day, multi])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const current = Math.min(page, pages)
  const rows = filtered.slice((current - 1) * PAGE, current * PAGE)
  const presentCount = all.filter(present).length
  const selectable = (r: RosterEntry) => !present(r) && !r.paymentPending
  const pageSelectable = rows.filter(selectable)
  const allPagePicked = pageSelectable.length > 0 && pageSelectable.every(r => picked.has(r.registrationId))

  const toggle = (id: string) => setPicked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const togglePage = () => setPicked(s => {
    const n = new Set(s)
    for (const r of pageSelectable) { if (allPagePicked) n.delete(r.registrationId); else n.add(r.registrationId) }
    return n
  })

  const mark = useAdminMutation(
    (ids: string[]) => adminApi<{ marked: number; alreadyDone: number; skipped: number; failed: { reason: string }[] }>(`/events/${eventId}/attendance`, { method: 'POST', body: { registrationIds: ids, day } }),
    [['admin', 'roster', eventId], ['admin', 'events'], ['admin', 'overview']],
  )
  const submit = () => mark.mutate([...picked], {
    onSuccess: r => {
      setConfirm(false); setPicked(new Set())
      const extra = [r.alreadyDone && `${r.alreadyDone} already in`, r.failed.length && `${r.failed.length} failed (${r.failed[0]?.reason})`].filter(Boolean).join(' · ')
      if (r.failed.length) toast.error(`Marked ${r.marked} present`, extra)
      else toast.success(`Marked ${r.marked} present`, extra || 'XP awarded')
    },
    onError: e => toast.error("Couldn't mark attendance", e.message),
  })

  if (roster.isLoading) return <Loading rows={6} />
  if (roster.error) return <ErrorState error={roster.error} onRetry={() => void roster.refetch()} />

  return (
    <View style={{ gap: 12 }}>
      <SearchBar value={q} onChange={v => { setQ(v); setPage(1) }} placeholder="Name, email or system ID" />
      {multi && <Select label="Day" value={day} onChange={v => { setDayChoice(v); setPicked(new Set()) }} options={days.map(d => ({ value: d.key, label: d.label }))} />}
      <Segmented value={show} onChange={v => { setShow(v); setPage(1) }} options={[
        { value: 'all', label: `All ${all.length}` }, { value: 'absent', label: `Absent ${all.length - presentCount}` }, { value: 'present', label: `Present ${presentCount}` },
      ]} />

      <Section title={picked.size ? `${picked.size} selected` : multi ? `Attendance · ${days.find(d => d.key === day)?.label ?? ''}` : 'Attendance'}
        action={pageSelectable.length ? <Button size="sm" variant="ghost" title={allPagePicked ? 'Clear page' : 'Select page'} onPress={togglePage} /> : undefined}>
        {rows.length === 0 ? <Group><Empty title={q ? 'Nobody matches' : all.length ? 'Nobody in this filter' : 'No registrations yet'} /></Group> : (
          <Group>
            {rows.map(r => {
              const p = present(r)
              return (
                <Row key={r.registrationId} selected={picked.has(r.registrationId)}
                  onPress={selectable(r) ? () => toggle(r.registrationId) : undefined}
                  left={<Check on={p || picked.has(r.registrationId)} disabled={!selectable(r)} onPress={() => toggle(r.registrationId)} />}
                  title={r.name ?? 'No name'}
                  subtitle={[r.systemId, r.email].filter(Boolean).join(' · ')}
                  right={r.paymentPending ? <Badge text="Unpaid" tone="amber" /> : p ? <Badge text="Present" tone="green" /> : null} />
              )
            })}
          </Group>
        )}
        <Pagination page={current} pageSize={PAGE} total={filtered.length} onChange={setPage} />
      </Section>

      {picked.size > 0 && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Clear" onPress={() => setPicked(new Set())} />
          <Button style={{ flex: 1 }} variant="primary" icon={{ ios: 'checkmark.circle', android: 'check_circle' }} title={`Mark ${picked.size} present`} onPress={() => setConfirm(true)} />
        </View>
      )}

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Mark present">
        <T>Mark {picked.size} {picked.size === 1 ? 'student' : 'students'} present{multi ? ` for ${days.find(d => d.key === day)?.label}` : ''}?</T>
        <T v="dim">They get XP for this event, and it counts toward their certificates. This is the same as scanning their tickets.</T>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <Button title="Cancel" style={{ flex: 1 }} onPress={() => setConfirm(false)} />
          <Button title="Mark present" variant="primary" style={{ flex: 1 }} loading={mark.isPending} onPress={submit} />
        </View>
      </Sheet>
    </View>
  )
}
