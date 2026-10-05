import { useEffect } from 'react'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { useQueryClient } from '@tanstack/react-query'
import { C } from '@/constants/theme'
import { prefetchAll } from '@/lib/queries'
import { useSession } from '@/lib/session'

/** Five tabs (Android's bottom bar fits five). Ranks, Team, Scan and Admin open from Home / Me. */
export default function TabsLayout() {
  const { user } = useSession()
  const qc = useQueryClient()
  useEffect(() => { prefetchAll(qc, { superAdmin: user?.role === 'super_admin' }) }, [qc, user?.role])
  return (
    <NativeTabs backgroundColor={C.bg} tintColor={C.amber} iconColor={C.textMuted} indicatorColor={C.amberSoft} labelStyle={{ selected: { color: C.amber } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="events">
        <NativeTabs.Trigger.Label>Events</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="event" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="clubs">
        <NativeTabs.Trigger.Label>Clubs</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.3.fill" md="groups" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tickets">
        <NativeTabs.Trigger.Label>Tickets</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="ticket.fill" md="confirmation_number" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
