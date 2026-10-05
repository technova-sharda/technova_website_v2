import { router } from 'expo-router'
import { useManageableClubs } from '@/lib/admin'
import { Avatar, Empty, ErrorState, Group, Loading, Row, Screen, Section } from '@/components/ui'

export default function ManageClubs() {
  const clubs = useManageableClubs()
  return (
    <Screen refreshing={clubs.isRefetching} onRefresh={() => void clubs.refetch()}>
      {clubs.isLoading ? <Loading rows={5} /> : clubs.error ? <ErrorState error={clubs.error} onRetry={() => void clubs.refetch()} /> : (
        <Section title="Clubs you manage" hint="Changes show on the website's Clubs and Leadership pages within a minute.">
          <Group>
            {clubs.data!.length === 0 ? <Empty icon={{ ios: 'person.2', android: 'groups' }} title="No clubs to manage" hint="Club leads can edit their own club. Ask an executive if you should have access." /> : clubs.data!.map(c => (
              <Row key={c.id} left={<Avatar uri={c.logo_url} name={c.name} />} title={c.name} subtitle={`${c.memberCount} members`} chevron
                onPress={() => router.push({ pathname: '/manage/[id]', params: { id: c.id } })} />
            ))}
          </Group>
        </Section>
      )}
    </Screen>
  )
}
