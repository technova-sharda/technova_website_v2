import { useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { API_URL } from '@/lib/config'
import { useMe } from '@/lib/queries'
import { useSession } from '@/lib/session'
import { C } from '@/constants/theme'
import { Avatar, Badge, Button, Group, Icon, Row, Screen, Section, Sheet, StatStrip, T } from '@/components/ui'

export default function ProfileScreen() {
  const { user, signOut } = useSession()
  const me = useMe()
  const m = me.data
  const [confirmOut, setConfirmOut] = useState(false)
  const role = user?.role
  return (
    <Screen edges={['top']} refreshing={me.isRefetching} onRefresh={() => void me.refetch()}>
      <View style={{ alignItems: 'center', gap: 10, paddingTop: 8 }}>
        <View style={{ padding: 3, borderRadius: 50, borderWidth: 2, borderColor: C.accent }}>
          <Avatar uri={m?.image ?? user?.image} name={m?.name ?? user?.name} size={84} />
        </View>
        <View style={{ alignItems: 'center', gap: 3 }}>
          <T v="title" style={{ textAlign: 'center' }}>{m?.name ?? user?.name}</T>
          <T v="small">{m?.email ?? user?.email}</T>
          {m?.systemId ? <T v="small" style={{ color: C.textDim }}>{[m.systemId, m.course, m.year ? `Year ${m.year}` : null, m.section].filter(Boolean).join(' · ')}</T> : null}
          {role === 'super_admin' || role === 'admin' ? <View style={{ marginTop: 4 }}><Badge text={role === 'super_admin' ? 'Super admin' : 'Scanner admin'} tone="violet" /></View> : null}
        </View>
      </View>
      {m && <StatStrip items={[{ label: 'XP', value: String(m.xp), tone: C.accent }, { label: 'Rank', value: m.rank ? `#${m.rank}` : '–' }, { label: 'Attended', value: String(m.eventsAttended) }]} />}

      <Section title="Activity">
        <Group>
          <Row title="Certificates" left={<Icon ios="rosette" android="workspace_premium" />} chevron onPress={() => router.push('/certificates')} />
          <Row title="Leaderboard" left={<Icon ios="list.number" android="leaderboard" />} chevron onPress={() => router.push('/leaderboard')} />
        </Group>
      </Section>

      {(role === 'super_admin' || role === 'admin') && (
        <Section title="Staff">
          <Group>
            {role === 'super_admin' ? <Row title="Admin" left={<Icon ios="rectangle.stack.badge.person.crop" android="admin_panel_settings" />} chevron onPress={() => router.push('/admin')} /> : null}
            <Row title="Scan tickets" left={<Icon ios="qrcode.viewfinder" android="qr_code_scanner" />} chevron onPress={() => router.push('/scan')} />
          </Group>
        </Section>
      )}
      <Section title="Clubs">
        <Group>
          <Row title="Club management" subtitle="For club leads: logo, details, team and photos" left={<Icon ios="person.2.badge.gearshape" android="manage_accounts" />} chevron onPress={() => router.push('/manage')} />
        </Group>
      </Section>
      <Section title="Support">
        <Group>
          <Row title="Team Technova & contact us" left={<Icon ios="person.3" android="groups" />} chevron onPress={() => router.push('/team')} />
          <Row title="Edit profile on the website" left={<Icon ios="person.text.rectangle" android="badge" />} chevron onPress={() => void WebBrowser.openBrowserAsync(`${API_URL}/profile`)} />
        </Group>
      </Section>
      <Group>
        <Row title="Sign out" destructive left={<Icon ios="rectangle.portrait.and.arrow.right" android="logout" color={C.red} />} onPress={() => setConfirmOut(true)} />
      </Group>
      <T v="small" style={{ textAlign: 'center' }}>Technova app 1.0</T>

      <Sheet open={confirmOut} onClose={() => setConfirmOut(false)} title="Sign out?">
        <T v="dim">You&apos;ll need to sign in with Google again to see your tickets.</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Cancel" style={{ flex: 1 }} onPress={() => setConfirmOut(false)} />
          <Button title="Sign out" variant="danger" style={{ flex: 1 }} onPress={() => { setConfirmOut(false); void signOut() }} />
        </View>
      </Sheet>
    </Screen>
  )
}
