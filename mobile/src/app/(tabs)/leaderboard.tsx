import { useState } from 'react'
import { View } from 'react-native'
import { C } from '@/constants/theme'
import { useLeaderboard } from '@/lib/queries'
import { Avatar, Card, ErrorBox, Loading, Screen, Segmented, T } from '@/components/ui'

const MEDAL = ['#fbbf24', '#d4d4d8', '#d97706']

export default function LeaderboardScreen() {
  const [period, setPeriod] = useState<'all-time' | 'monthly' | 'weekly'>('all-time')
  const board = useLeaderboard(period)
  return (
    <Screen refreshing={board.isRefetching} onRefresh={() => void board.refetch()}>
      <T v="title">Leaderboard</T>
      <Segmented value={period} onChange={setPeriod} options={[{ value: 'all-time', label: 'All time' }, { value: 'monthly', label: 'Month' }, { value: 'weekly', label: 'Week' }]} />
      {board.data?.me && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a1408', borderColor: 'rgba(245,158,11,0.35)' }}>
          <View>
            <T v="label" style={{ color: C.amber }}>Your rank</T>
            <T v="h2">#{board.data.me.rank} <T v="small">of {board.data.me.totalUsers}</T></T>
          </View>
          <T v="h2" style={{ color: C.amber }}>{board.data.me.xp} XP</T>
        </Card>
      )}
      {board.isLoading ? <Loading /> : board.error ? <ErrorBox error={board.error} onRetry={() => void board.refetch()} /> : (
        <View style={{ gap: 8 }}>
          {board.data!.users.map(u => (
            <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: u.isMe ? C.amberSoft : C.surface, borderWidth: 1, borderColor: u.isMe ? 'rgba(245,158,11,0.4)' : C.border }}>
              <View style={{ width: 30, alignItems: 'center' }}>
                <T v="h3" style={{ color: u.rank <= 3 ? MEDAL[u.rank - 1] : C.textMuted }}>{u.rank}</T>
              </View>
              <Avatar uri={u.image} name={u.name} size={38} />
              <T style={{ flex: 1, fontWeight: u.isMe ? '700' : '500' }} numberOfLines={1}>{u.name}{u.isMe ? ' (you)' : ''}</T>
              <T v="h3" style={{ color: C.amber }}>{u.xp}</T>
            </View>
          ))}
        </View>
      )}
    </Screen>
  )
}
