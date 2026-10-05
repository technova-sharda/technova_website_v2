import { useState } from 'react'
import { View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { fmtDay } from '@/lib/format'
import { downloadAndOpen } from '@/lib/download'
import { useCertificates } from '@/lib/queries'
import { useToast } from '@/components/toast'
import { Button, Empty, ErrorState, Group, Loading, Row, Screen, Section, T } from '@/components/ui'

export default function CertificatesScreen() {
  const certs = useCertificates()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const download = async (id: string, path: string) => {
    setBusy(id)
    try { await downloadAndOpen(path, { mimeType: 'application/pdf', title: `Certificate ${id}` }) }
    catch (e) { toast.error('Download failed', e instanceof Error ? e.message : undefined) }
    finally { setBusy(null) }
  }
  return (
    <Screen refreshing={certs.isRefetching} onRefresh={() => void certs.refetch()}>
      {certs.isLoading ? <Loading /> : certs.error ? <ErrorState error={certs.error} onRetry={() => void certs.refetch()} /> :
        certs.data!.length === 0 ? <Group><Empty icon={{ ios: 'rosette', android: 'workspace_premium' }} title="No certificates yet" hint="Certificates appear here once an event's organisers issue them." /></Group> : (
          <Section title={`${certs.data!.length} certificate${certs.data!.length > 1 ? 's' : ''}`} hint="Download saves a PDF you can open, keep in Files or share.">
            <Group>
              {certs.data!.map(c => (
                <Row key={c.id} title={c.event.title} numberOfLines={2}
                  subtitle={<View style={{ gap: 2 }}>
                    <T v="small">{c.type === 'participation' ? 'Participation' : c.type} · {fmtDay(c.issuedAt)}{c.event.club ? ` · ${c.event.club}` : ''}</T>
                    <T v="mono">ID {c.id}</T>
                  </View>}
                  right={<View style={{ flexDirection: 'row', gap: 6 }}>
                    <Button size="sm" icon={{ ios: 'checkmark.seal', android: 'verified' }} accessibilityLabel="Verification page" onPress={() => void WebBrowser.openBrowserAsync(c.verifyUrl)} />
                    <Button size="sm" variant="primary" title="PDF" icon={{ ios: 'arrow.down', android: 'download' }} loading={busy === c.id} onPress={() => void download(c.id, c.downloadPath)} />
                  </View>} />
              ))}
            </Group>
          </Section>
        )}
    </Screen>
  )
}
