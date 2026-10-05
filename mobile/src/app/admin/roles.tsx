import { useDeferredValue, useState } from 'react'
import { View } from 'react-native'
import { adminApi, useAdminMutation, useRoleSearch, useRoles, type RoleUser } from '@/lib/admin'
import { useSession } from '@/lib/session'
import { roleLabel } from '@/components/admin/phase'
import { useToast } from '@/components/toast'
import { Avatar, Badge, Button, Empty, ErrorState, Group, Loading, Row, Screen, SearchBar, Section, Sheet, T } from '@/components/ui'

type Role = 'student' | 'admin' | 'super_admin'
const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: 'super_admin', label: 'Super admin', hint: 'Full admin panel: events, people, roles, certificates, emails.' },
  { value: 'admin', label: 'Scanner admin', hint: 'Can scan tickets and check students in. Nothing else.' },
  { value: 'student', label: 'Student', hint: 'No admin access.' },
]
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default function Roles() {
  const toast = useToast()
  const { user: me } = useSession()
  const roles = useRoles()
  const [q, setQ] = useState('')
  const query = useDeferredValue(q.trim())
  const search = useRoleSearch(query)
  const [target, setTarget] = useState<RoleUser | null>(null)
  const [next, setNext] = useState<Role | null>(null)
  const change = useAdminMutation((v: { userId: string; role: Role }) => adminApi('/roles', { method: 'POST', body: v }), [['admin', 'roles'], ['admin', 'role-search']])
  const close = () => { setTarget(null); setNext(null) }

  const holders = roles.data?.holders ?? []
  const supers = holders.filter(h => h.role === 'super_admin')
  const scanners = holders.filter(h => h.role === 'admin')
  const userRow = (u: RoleUser) => (
    <Row key={u.id} left={<Avatar uri={u.image} name={u.name} size={32} />} title={u.name ?? u.email ?? 'No name'} subtitle={u.email ?? undefined}
      right={roleLabel(u.role) ? <Badge text={roleLabel(u.role)!} tone={u.role === 'super_admin' ? 'violet' : 'blue'} /> : null}
      chevron={u.id !== me?.id} disabled={u.id === me?.id} onPress={u.id === me?.id ? undefined : () => { setTarget(u); setNext(null) }} />
  )

  return (
    <Screen refreshing={roles.isRefetching} onRefresh={() => void roles.refetch()}>
      <Section title="Give someone access">
        <SearchBar value={q} onChange={setQ} placeholder="Search students by name or email" loading={search.isFetching} />
        {query.length >= 2 && (
          <Group>{(search.data ?? []).length === 0 ? <Empty title={search.isLoading ? 'Searching…' : 'Nobody matches'} /> : (search.data ?? []).slice(0, 10).map(userRow)}</Group>
        )}
      </Section>

      {roles.isLoading ? <Loading rows={4} /> : roles.error ? <ErrorState error={roles.error} onRetry={() => void roles.refetch()} /> : (
        <>
          <Section title={`Super admins · ${supers.length}`}><Group>{supers.length ? supers.map(userRow) : <Empty title="None" />}</Group></Section>
          <Section title={`Scanner admins · ${scanners.length}`}><Group>{scanners.length ? scanners.map(userRow) : <Empty title="None" hint="Scanner admins can check students in at the door." />}</Group></Section>
          <Section title="Recent changes">
            <Group>
              {(roles.data?.changes ?? []).length === 0 ? <Empty title="No changes yet" /> : roles.data!.changes.slice(0, 15).map(c => (
                <Row key={c.id} title={c.user_name ?? c.user_email ?? 'Someone'}
                  subtitle={`${roleLabel(c.old_role) ?? 'Student'} → ${roleLabel(c.new_role) ?? 'Student'} · by ${c.changed_by_email ?? 'unknown'} · ${when(c.changed_at)}`} />
              ))}
            </Group>
          </Section>
        </>
      )}

      <Sheet open={!!target} onClose={close} title={next ? 'Confirm change' : 'Change access'}>
        {target && !next && (
          <>
            <T v="dim">{target.name ?? target.email} is currently {roleLabel(target.role)?.toLowerCase() ?? 'a student'}.</T>
            <Group>
              {ROLES.map(r => (
                <Row key={r.value} title={r.label} subtitle={r.hint} selected={(target.role ?? 'student') === r.value}
                  disabled={(target.role ?? 'student') === r.value} onPress={() => setNext(r.value)} chevron />
              ))}
            </Group>
          </>
        )}
        {target && next && (
          <>
            <T>Make {target.name ?? target.email} {ROLES.find(r => r.value === next)!.label.toLowerCase()}?</T>
            <T v="dim">{ROLES.find(r => r.value === next)!.hint} Takes effect the next time they open the app or website.</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Back" style={{ flex: 1 }} onPress={() => setNext(null)} />
              <Button title="Confirm" variant={next === 'student' ? 'danger' : 'primary'} style={{ flex: 1 }} loading={change.isPending}
                onPress={() => change.mutate({ userId: target.id, role: next }, { onSuccess: () => { toast.success('Access updated'); close() }, onError: e => toast.error("Couldn't change role", e.message) })} />
            </View>
          </>
        )}
      </Sheet>
    </Screen>
  )
}
