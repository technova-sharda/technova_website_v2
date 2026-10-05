import { useDeferredValue, useMemo, useState } from 'react'
import { View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { adminApi, useAdminMutation, useFormResponses, useForms, type FormField, type FormResponse } from '@/lib/admin'
import { downloadAndOpen } from '@/lib/download'
import { useToast } from '@/components/toast'
import { Box, Button, Empty, ErrorState, Group, Loading, Pagination, Row, Screen, SearchBar, Section, Sheet, StatStrip, SwitchRow, T } from '@/components/ui'

const PAGE = 20
const answerText = (r: FormResponse, f: FormField) => {
  const a = r.answers.find(x => x.field_id === f.id)
  if (!a) return ''
  if (a.answer_text) return a.answer_text
  if (Array.isArray(a.answer_json)) return a.answer_json.join(', ')
  return a.answer_json == null ? '' : typeof a.answer_json === 'object' ? JSON.stringify(a.answer_json) : String(a.answer_json)
}

export default function FormDetail() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>()
  const toast = useToast()
  const data = useFormResponses(id)
  const forms = useForms()
  const form = forms.data?.find(f => f.id === id)
  const [q, setQ] = useState('')
  const query = useDeferredValue(q.trim().toLowerCase())
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<FormResponse | null>(null)
  const [exporting, setExporting] = useState(false)
  const settings = useAdminMutation((v: { is_active?: boolean; is_published?: boolean }) => adminApi(`/forms/${id}/settings`, { method: 'POST', body: v }), [['admin', 'forms']])

  const fields = useMemo(() => [...(data.data?.fields ?? [])].sort((a, b) => a.order_index - b.order_index), [data.data])
  const filtered = useMemo(() => (data.data?.responses ?? []).filter(r => !query
    || [r.user.name, r.user.email, r.user.system_id].some(v => (v ?? '').toLowerCase().includes(query))
    || r.answers.some(a => (a.answer_text ?? '').toLowerCase().includes(query))), [data.data, query])
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE)))
  const rows = filtered.slice((current - 1) * PAGE, current * PAGE)
  const preview = fields[0]

  const exportCsv = async () => {
    setExporting(true)
    try { await downloadAndOpen(`/api/mobile/v1/admin/forms/${id}/csv`, { mimeType: 'text/csv', title: `${form?.title ?? title ?? 'Form'} responses` }) }
    catch (e) { toast.error("Couldn't export", e instanceof Error ? e.message : 'Try again') }
    finally { setExporting(false) }
  }

  return (
    <Screen refreshing={data.isRefetching} onRefresh={() => { void data.refetch(); void forms.refetch() }}>
      <Stack.Screen options={{ title: form?.title ?? title ?? 'Form' }} />
      {form && (
        <Group>
          <SwitchRow title="Accepting responses" subtitle={form.is_active ? 'Students can submit' : 'Closed to new responses'} value={form.is_active} disabled={settings.isPending}
            onChange={v => settings.mutate({ is_active: v }, { onSuccess: () => toast.success(v ? 'Form reopened' : 'Form closed'), onError: e => toast.error("Couldn't update", e.message) })} />
          <SwitchRow title="Published" subtitle="Listed on the website's forms page" value={form.is_published} disabled={settings.isPending}
            onChange={v => settings.mutate({ is_published: v }, { onSuccess: () => toast.success(v ? 'Published' : 'Unpublished'), onError: e => toast.error("Couldn't update", e.message) })} />
        </Group>
      )}
      {data.isLoading ? <Loading rows={5} /> : data.error ? <ErrorState error={data.error} onRetry={() => void data.refetch()} /> : (
        <>
          <StatStrip items={[
            { label: 'Responses', value: String(data.data!.responses.length) },
            { label: 'Questions', value: String(fields.length) },
            { label: 'Latest', value: data.data!.responses[0] ? new Date(data.data!.responses[0].created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }) : '–' },
          ]} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><SearchBar value={q} onChange={v => { setQ(v); setPage(1) }} placeholder="Search names or answers" /></View>
            <Button icon={{ ios: 'square.and.arrow.down', android: 'download' }} accessibilityLabel="Export CSV" loading={exporting} disabled={!data.data!.responses.length} onPress={() => void exportCsv()} />
          </View>
          <Section title={query ? `${filtered.length} match` : 'Responses'}>
            <Group>
              {rows.length === 0 ? <Empty title={query ? 'No responses match' : 'No responses yet'} /> : rows.map(r => (
                <Row key={r.id} title={r.user.name || r.user.email || 'Anonymous'} chevron onPress={() => setOpen(r)}
                  subtitle={`${new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}${preview ? ` · ${answerText(r, preview).slice(0, 60)}` : ''}`} />
              ))}
            </Group>
            <Pagination page={current} pageSize={PAGE} total={filtered.length} onChange={setPage} />
          </Section>
        </>
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.user.name || 'Response'}>
        {open && (
          <>
            <T v="small">{[open.user.email, open.user.system_id].filter(Boolean).join(' · ')} · {new Date(open.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</T>
            <Box>
              {fields.map(f => (
                <View key={f.id} style={{ gap: 2 }}>
                  <T v="small">{f.label}</T>
                  <T selectable>{answerText(open, f) || '—'}</T>
                </View>
              ))}
            </Box>
          </>
        )}
      </Sheet>
    </Screen>
  )
}
