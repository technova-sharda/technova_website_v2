import { Alert, Pressable, View } from 'react-native'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { C } from '@/constants/theme'
import { API_URL } from '@/lib/config'
import { useMe } from '@/lib/queries'
import { useSession } from '@/lib/session'
import { Avatar, Card, Icon, Screen, T } from '@/components/ui'

export default function ProfileScreen() {
  const { user, signOut } = useSession()
  const me = useMe()
  const m = me.data
  const items: { ios: string; android: string; title: string; onPress: () => void; danger?: boolean }[] = [
    { ios: 'rosette', android: 'workspace_premium', title: 'My certificates', onPress: () => router.push('/certificates') },
    { ios: 'person.text.rectangle', android: 'badge', title: 'Edit profile (website)', onPress: () => void WebBrowser.openBrowserAsync(`${API_URL}/profile`) },
    { ios: 'globe', android: 'language', title: 'Open technovashardauniversity.in', onPress: () => void WebBrowser.openBrowserAsync(API_URL) },
    ...(m?.isStaff ? [{ ios: 'rectangle.stack.badge.person.crop', android: 'admin_panel_settings', title: 'Admin panel (website)', onPress: () => void WebBrowser.openBrowserAsync(`${API_URL}/admin/dashboard`) }] : []),
    { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', title: 'Sign out', danger: true, onPress: () => Alert.alert('Sign out?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => void signOut() }]) },
  ]
  return (
    <Screen refreshing={me.isRefetching} onRefresh={() => void me.refetch()}>
      <View style={{ alignItems: 'center', gap: 8, marginTop: 8 }}>
        <Avatar uri={m?.image ?? user?.image} name={m?.name ?? user?.name} size={88} />
        <T v="h2">{m?.name ?? user?.name}</T>
        <T v="dim">{m?.email ?? user?.email}</T>
        {m?.systemId && <T v="small">{m.systemId}{m.course ? ` · ${m.course}` : ''}{m.year ? ` · Year ${m.year}` : ''}</T>}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[['XP', m?.xp ?? '–'], ['Rank', m?.rank ? `#${m.rank}` : '–'], ['Attended', m?.eventsAttended ?? '–']].map(([label, value]) => (
          <Card key={label as string} style={{ flex: 1, alignItems: 'center', paddingVertical: 14 }}>
            <T v="h2" style={{ color: C.amber }}>{String(value)}</T>
            <T v="small">{label as string}</T>
          </Card>
        ))}
      </View>
      <Card style={{ padding: 0 }}>
        {items.map((it, i) => (
          <Pressable key={it.title} onPress={it.onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: i ? 1 : 0, borderColor: C.border, opacity: pressed ? 0.7 : 1 })}>
            <Icon ios={it.ios} android={it.android} color={it.danger ? C.red : C.textDim} />
            <T style={{ flex: 1, color: it.danger ? C.red : C.text }}>{it.title}</T>
            {!it.danger && <Icon ios="chevron.right" android="chevron_right" size={16} color={C.textMuted} />}
          </Pressable>
        ))}
      </Card>
      <T v="small" style={{ textAlign: 'center' }}>Technova app · v1.0</T>
    </Screen>
  )
}
