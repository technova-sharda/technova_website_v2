import { useDeferredValue, useMemo, useState } from 'react'
import { router } from 'expo-router'
import { useForms } from '@/lib/admin'
import { Badge, Empty, ErrorState, Group, Loading, Row, Screen, SearchBar, Section } from '@/components/ui'

export default function Forms() {
  const forms = useForms()
  const [q, setQ] = useState('')
  const [now] = useState(() => Date.now())
  const query = useDeferredValue(q.trim().toLowerCase())
  const rows = useMemo(() => (forms.data ?? []).filter(f => !query || f.title.toLowerCase().includes(query)), [forms.data, query])
  return (
    <Screen refreshing={forms.isRefetching} onRefresh={() => void forms.refetch()}>
      <SearchBar value={q} onChange={setQ} placeholder="Search forms" />
      {forms.isLoading ? <Loading rows={5} /> : forms.error ? <ErrorState error={forms.error} onRetry={() => void forms.refetch()} /> : (
        <Section title={`${rows.length} forms`} hint="Build and edit forms on the website; the flow builder needs a big screen.">
          <Group>
            {rows.length === 0 ? <Empty title={q ? 'No forms match' : 'No forms yet'} /> : rows.map(f => {
              const closed = !f.is_active || (f.deadline && new Date(f.deadline).getTime() < now)
              return (
                <Row key={f.id} title={f.title} chevron
                  subtitle={`${f.response_count} responses${f.deadline ? ` · closes ${new Date(f.deadline).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })}` : ''}`}
                  right={!f.is_published ? <Badge text="Unpublished" tone="amber" /> : closed ? <Badge text="Closed" /> : <Badge text="Accepting" tone="green" />}
                  onPress={() => router.push({ pathname: '/admin/form/[id]', params: { id: f.id, title: f.title } })} />
              )
            })}
          </Group>
        </Section>
      )}
    </Screen>
  )
}
