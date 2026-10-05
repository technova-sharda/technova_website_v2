import { Linking } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { useTeam } from '@/lib/queries'
import { PersonRow } from '@/components/person'
import { Avatar, ErrorState, Group, Icon, Loading, Row, Screen, Section } from '@/components/ui'

/** Same inbox as the website footer; used until the server sends one. */
const TECHNOVA_EMAIL = 'technova@sharda.ac.in'

export default function TeamScreen() {
  const team = useTeam()
  if (team.isLoading) return <Screen><Loading rows={6} /></Screen>
  if (team.error || !team.data) return <Screen><ErrorState error={team.error} onRetry={() => void team.refetch()} /></Screen>
  const { mentors, executives, contact } = team.data
  const email = contact.email ?? TECHNOVA_EMAIL
  return (
    <Screen refreshing={team.isRefetching} onRefresh={() => void team.refetch()}>
      <Section title="Contact us" hint="For registration, ticket, certificate or app problems.">
        <Group>
          <Row title="Email the team" subtitle={email} left={<Icon ios="envelope" android="mail" />} chevron onPress={() => void Linking.openURL(`mailto:${email}?subject=${encodeURIComponent('Technova app help')}`)} />
          <Row title="Report a problem" subtitle="Describe what went wrong; the tech team follows up" left={<Icon ios="exclamationmark.bubble" android="report" />} chevron onPress={() => void WebBrowser.openBrowserAsync(contact.reportUrl)} />
        </Group>
      </Section>
      <Section title="Student team">
        <Group>{executives.map(p => <PersonRow key={p.id} p={p} />)}</Group>
      </Section>
      <Section title="Faculty mentors">
        <Group>{mentors.map(m => <Row key={m.name} left={<Avatar uri={m.photo} name={m.name} size={40} />} title={m.name} subtitle={m.role} />)}</Group>
      </Section>
    </Screen>
  )
}
