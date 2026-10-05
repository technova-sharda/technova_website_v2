import { useDeferredValue, useState } from 'react'
import { useLogs } from '@/lib/admin'
import { Badge, Empty, ErrorState, Group, Loading, Pagination, Row, Screen, SearchBar, Section, T } from '@/components/ui'

const TONE: Record<string, 'green' | 'blue' | 'red' | 'amber' | 'neutral'> = { create: 'green', insert: 'green', update: 'blue', delete: 'red', email: 'amber', upsert: 'blue' }

export default function Logs() {
  const [q, setQ] = useState('')
  const query = useDeferredValue(q.trim())
  const [page, setPage] = useState(1)
  const logs = useLogs(page, query)
  return (
    <Screen refreshing={logs.isRefetching} onRefresh={() => void logs.refetch()}>
      <SearchBar value={q} onChange={v => { setQ(v); setPage(1) }} placeholder="Search by person or change" loading={logs.isFetching} />
      {logs.isLoading ? <Loading rows={8} /> : logs.error ? <ErrorState error={logs.error} onRetry={() => void logs.refetch()} /> : (
        <Section title={`${logs.data!.total} changes`}>
          <Group>
            {logs.data!.logs.length === 0 ? <Empty title="Nothing logged" /> : logs.data!.logs.map(l => (
              <Row key={l.id} numberOfLines={3} title={l.summary}
                subtitle={<T v="small" numberOfLines={1}>{l.actor_name ?? l.actor_email ?? 'Unknown'} · {new Date(l.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{l.page ? ` · ${l.page}` : ''}</T>}
                right={<Badge text={l.action} tone={TONE[l.action] ?? 'neutral'} />} />
            ))}
          </Group>
          <Pagination page={page} pageSize={50} total={logs.data!.total} onChange={setPage} />
        </Section>
      )}
    </Screen>
  )
}
