import { useState } from 'react'
import { Linking, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { C } from '@/constants/theme'
import { usePerson } from '@/lib/admin'
import { downloadAndOpen } from '@/lib/download'
import { useToast } from '@/components/toast'
import { Avatar, Badge, Button, Empty, ErrorState, Group, Icon, Loading, Row, Screen, Section, StatStrip, T } from '@/components/ui'

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const toast = useToast()
  const person = usePerson(id)
  const [dl, setDl] = useState<string | null>(null)
  if (person.isLoading) return <Screen><Loading rows={4} /></Screen>
  if (person.error || !person.data) return <Screen><ErrorState error={person.error ?? new Error('Not found')} onRetry={() => void person.refetch()} /></Screen>
  const p = person.data
  const xp = p.xpAwards.reduce((s, a) => s + (a.xp_amount ?? 0), 0)
  const attended = p.registrations.filter(r => r.attended).length
  const titleById = new Map(p.registrations.map(r => [r.event.id, r.event.title]))
  const download = async (certId: string) => {
    setDl(certId)
    try { await downloadAndOpen(`/api/certificate?id=${certId}`, { mimeType: 'application/pdf', title: 'Certificate' }) }
    catch (e) { toast.error("Couldn't download", e instanceof Error ? e.message : 'Try again') }
    finally { setDl(null) }
  }

  return (
    <Screen refreshing={person.isRefetching} onRefresh={() => void person.refetch()}>
      <Stack.Screen options={{ title: p.name ?? 'Student' }} />
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Avatar uri={p.image} name={p.name} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="h2" numberOfLines={1}>{p.name ?? 'No name'}</T>
          <T v="small" selectable numberOfLines={1}>{p.email}</T>
          <T v="small" numberOfLines={1}>{[p.system_id, p.course, p.year && `Year ${p.year}`, p.section].filter(Boolean).join(' · ') || 'Profile not completed'}</T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {p.email && <Button size="sm" icon={{ ios: 'envelope', android: 'mail' }} title="Email" onPress={() => void Linking.openURL(`mailto:${p.email}`)} />}
        {p.mobile && <Button size="sm" icon={{ ios: 'phone', android: 'call' }} title="Call" onPress={() => void Linking.openURL(`tel:${p.mobile}`)} />}
      </View>
      <StatStrip items={[{ label: 'Registered', value: String(p.registrations.length) }, { label: 'Attended', value: String(attended) }, { label: 'XP', value: String(xp) }]} />

      <Section title="Events">
        <Group>
          {p.registrations.length === 0 ? <Empty title="No registrations" /> : p.registrations.map(r => (
            <Row key={r.id} title={r.event.title} subtitle={day(r.event.start_time)} chevron
              right={r.payment_status === 'pending' ? <Badge text="Unpaid" tone="amber" /> : r.attended ? <Badge text="Attended" tone="green" /> : <Badge text="Absent" />}
              onPress={() => router.push({ pathname: '/admin/event/[id]', params: { id: r.event.id } })} />
          ))}
        </Group>
      </Section>

      <Section title="Certificates">
        <Group>
          {p.certificates.length === 0 ? <Empty title="No certificates" /> : p.certificates.map(c => (
            <Row key={c.certificate_id} title={titleById.get(c.event_id) ?? c.role_title ?? 'Certificate'}
              subtitle={<T v="mono">{c.certificate_id} · {day(c.issued_at)}{c.status !== 'issued' ? ` · ${c.status}` : ''}</T>}
              right={<Button size="sm" icon={{ ios: 'arrow.down.doc', android: 'download' }} accessibilityLabel="Download certificate" loading={dl === c.certificate_id} onPress={() => void download(c.certificate_id)} />} />
          ))}
        </Group>
      </Section>

      {p.role && p.role !== 'student' && (
        <Group><Row left={<Icon ios="person.badge.key" android="admin_panel_settings" color={C.violet} />} title={p.role === 'super_admin' ? 'Super admin' : 'Scanner admin'} subtitle="Change in Admin roles" chevron onPress={() => router.push('/admin/roles')} /></Group>
      )}
    </Screen>
  )
}
