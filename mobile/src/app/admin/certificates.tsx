import { useDeferredValue, useState } from 'react'
import { useCertSearch } from '@/lib/admin'
import { downloadAndOpen } from '@/lib/download'
import { useToast } from '@/components/toast'
import { Badge, Button, Empty, ErrorState, Group, Loading, Row, Screen, SearchBar, Section, T } from '@/components/ui'

export default function AdminCertificates() {
  const toast = useToast()
  const [q, setQ] = useState('')
  const query = useDeferredValue(q.trim())
  const certs = useCertSearch(query)
  const [dl, setDl] = useState<string | null>(null)
  const download = async (id: string) => {
    setDl(id)
    try { await downloadAndOpen(`/api/certificate?id=${id}`, { mimeType: 'application/pdf', title: `Certificate ${id}` }) }
    catch (e) { toast.error("Couldn't download", e instanceof Error ? e.message : 'Try again') }
    finally { setDl(null) }
  }
  return (
    <Screen>
      <SearchBar value={q} onChange={setQ} placeholder="Certificate ID, student or event" loading={certs.isFetching} />
      {query.length < 2 ? <Group><Empty icon={{ ios: 'rosette', android: 'workspace_premium' }} title="Look up a certificate" hint="Search by the 8-character ID printed on it, the student's name or email, or the event." /></Group>
        : certs.isLoading ? <Loading rows={4} />
        : certs.error ? <ErrorState error={certs.error} onRetry={() => void certs.refetch()} />
        : (
          <Section title={`${certs.data?.length ?? 0} found`}>
            <Group>
              {(certs.data ?? []).length === 0 ? <Empty title="No certificates match" /> : certs.data!.map(c => (
                <Row key={c.certificate_id} numberOfLines={2} title={c.student?.name ?? c.student?.email ?? 'Unknown student'}
                  subtitle={<>
                    <T v="small" numberOfLines={1}>{c.event?.title ?? 'Event removed'}{c.role_title ? ` · ${c.role_title}` : ''}</T>
                    <T v="mono">{c.certificate_id} · {new Date(c.issued_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })} · {c.emailed ? 'emailed' : 'not emailed'} · {c.downloads} downloads</T>
                  </>}
                  right={c.status !== 'issued' ? <Badge text={c.status} tone="red" /> : <Button size="sm" icon={{ ios: 'arrow.down.doc', android: 'download' }} accessibilityLabel="Download PDF" loading={dl === c.certificate_id} onPress={() => void download(c.certificate_id)} />} />
              ))}
            </Group>
          </Section>
        )}
    </Screen>
  )
}
