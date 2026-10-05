import { Linking, View } from 'react-native'
import type { Person } from '@/lib/types'
import { Avatar, Button, Row } from './ui'

/** A team member with call / email / LinkedIn actions. */
export function PersonRow({ p }: { p: Person }) {
  const actions = [
    p.phone && { ios: 'phone', android: 'call', url: `tel:${p.phone.replace(/\s+/g, '')}`, label: `Call ${p.name}` },
    p.email && { ios: 'envelope', android: 'mail', url: `mailto:${p.email}`, label: `Email ${p.name}` },
    p.linkedin && { ios: 'link', android: 'link', url: p.linkedin, label: `${p.name} on LinkedIn` },
  ].filter(Boolean) as { ios: string; android: string; url: string; label: string }[]
  return (
    <Row left={<Avatar uri={p.photo} name={p.name} size={40} />} title={p.name} subtitle={p.role ?? undefined}
      right={<View style={{ flexDirection: 'row', gap: 6 }}>{actions.map(a => <Button key={a.url} size="sm" icon={{ ios: a.ios, android: a.android }} accessibilityLabel={a.label} onPress={() => void Linking.openURL(a.url)} />)}</View>} />
  )
}
