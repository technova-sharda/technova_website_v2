import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { C } from '@/constants/theme'
import { useSession } from '@/lib/session'

export default function TabsLayout() {
  const { user } = useSession()
  const staff = user?.role === 'admin' || user?.role === 'super_admin'
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
      <NativeTabs.Trigger name="tickets">
        <NativeTabs.Trigger.Label>Tickets</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="ticket.fill" md="confirmation_number" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scan" hidden={!staff}>
        <NativeTabs.Trigger.Label>Scan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="qrcode.viewfinder" md="qr_code_scanner" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="leaderboard">
        <NativeTabs.Trigger.Label>Ranks</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="trophy.fill" md="emoji_events" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
