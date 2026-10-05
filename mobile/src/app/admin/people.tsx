import { useDeferredValue, useState } from 'react'
import { router } from 'expo-router'
import { usePeople } from '@/lib/admin'
import { roleLabel } from '@/components/admin/phase'
import { Avatar, Empty, ErrorState, Group, Loading, Row, Screen, SearchBar, Section } from '@/components/ui'

export default function People() {
  const [q, setQ] = useState('')
  const query = useDeferredValue(q.trim())
  const people = usePeople(query)
  return (
    <Screen>
      <SearchBar value={q} onChange={setQ} placeholder="Name, email or system ID" loading={people.isFetching} />
      {query.length < 2 ? <Group><Empty icon={{ ios: 'magnifyingglass', android: 'search' }} title="Find a student" hint="Type at least 2 characters. You'll see their registrations, attendance, certificates and XP." /></Group>
        : people.isLoading ? <Loading rows={5} />
        : people.error ? <ErrorState error={people.error} onRetry={() => void people.refetch()} />
        : (
          <Section title={`${people.data?.length ?? 0} found`}>
            <Group>
              {(people.data ?? []).length === 0 ? <Empty title="Nobody matches" hint="Try their email or system ID." /> : (people.data ?? []).map(p => (
                <Row key={p.id} left={<Avatar uri={p.image} name={p.name} />} title={p.name ?? p.email ?? 'No name'} chevron
                  subtitle={[p.system_id, p.course && `${p.course}${p.year ? ` · Year ${p.year}` : ''}${p.section ? ` · ${p.section}` : ''}`, roleLabel(p.role)].filter(Boolean).join(' · ') || p.email || undefined}
                  onPress={() => router.push({ pathname: '/admin/person/[id]', params: { id: p.id } })} />
              ))}
            </Group>
          </Section>
        )}
    </Screen>
  )
}
