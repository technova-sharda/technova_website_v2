import { useState } from 'react'
import { View } from 'react-native'
import { C } from '@/constants/theme'
import { useLeaderboard } from '@/lib/queries'
import { Avatar, ErrorState, Group, Loading, Row, Screen, Segmented, StatStrip, T } from '@/components/ui'

export default function LeaderboardScreen() {
  const [period, setPeriod] = useState<'all-time' | 'monthly' | 'weekly'>('all-time')
  const board = useLeaderboard(period)
  return (
    <Screen refreshing={board.isRefetching} onRefresh={() => void board.refetch()}>
      <Segmented value={period} onChange={setPeriod} options={[{ value: 'all-time', label: 'All time' }, { value: 'monthly', label: 'This month' }, { value: 'weekly', label: 'This week' }]} />
      {board.data?.me && <StatStrip items={[{ label: 'Your rank', value: `#${board.data.me.rank}`, hint: `of ${board.data.me.totalUsers}` }, { label: 'Your XP', value: String(board.data.me.xp) }]} />}
      {board.isLoading ? <Loading rows={8} /> : board.error ? <ErrorState error={board.error} onRetry={() => void board.refetch()} /> : (
        <Group>
          {board.data!.users.map(u => (
            <Row key={u.id} selected={u.isMe}
              left={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <T v="mono" style={{ width: 28, textAlign: 'right', color: u.rank <= 3 ? C.accent : C.textMuted, fontWeight: '600' }}>{u.rank}</T>
                <Avatar uri={u.image} name={u.name} size={32} />
              </View>}
              title={`${u.name}${u.isMe ? ' (you)' : ''}`}
              right={<T v="mono" style={{ color: C.text }}>{u.xp} XP</T>} />
          ))}
        </Group>
      )}
    </Screen>
  )
}
