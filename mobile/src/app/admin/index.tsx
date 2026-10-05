import { router } from 'expo-router'
import { C } from '@/constants/theme'
import { useLogs, useOverview } from '@/lib/admin'
import { useSession } from '@/lib/session'
import { Empty, ErrorState, Group, Icon, Loading, Row, Screen, Section, StatStrip, T } from '@/components/ui'

const TODO_ICON: Record<string, { ios: string; android: string; color: string }> = {
  attendance: { ios: 'person.badge.clock', android: 'how_to_reg', color: C.amber },
  certificates: { ios: 'rosette', android: 'workspace_premium', color: C.violet },
  'email-certificates': { ios: 'envelope.badge', android: 'forward_to_inbox', color: C.violet },
  feedback: { ios: 'text.bubble', android: 'rate_review', color: C.blue },
  'low-registrations': { ios: 'chart.line.downtrend.xyaxis', android: 'trending_down', color: C.red },
  draft: { ios: 'doc.badge.ellipsis', android: 'draft', color: C.textDim },
}

/** Admin home: today's numbers, what needs doing, and every admin area. Super admins only (the server checks too). */
export default function AdminHome() {
  const { user } = useSession()
  const allowed = user?.role === 'super_admin'
  const o = useOverview()
  const logs = useLogs(1, '') // 403 for everyone but the activity-log viewers; used only to show the row
  if (!allowed) return <Screen><Group><Empty icon={{ ios: 'lock', android: 'lock' }} title="Admins only" hint="Ask a super admin if you need access." /></Group></Screen>
  const d = o.data
  const go = (path: string) => () => router.push(path as never)

  return (
    <Screen refreshing={o.isRefetching} onRefresh={() => void o.refetch()}>
      {o.isLoading ? <Loading rows={2} /> : o.error ? <ErrorState error={o.error} onRetry={() => void o.refetch()} /> : d && (
        <Section title="Last 30 days">
          <StatStrip items={[
            { label: 'Registrations', value: String(d.kpis.regs30), hint: d.kpis.change === null ? undefined : `${d.kpis.change >= 0 ? '+' : ''}${d.kpis.change}% vs prior`, tone: d.kpis.change !== null && d.kpis.change < 0 ? C.red : undefined },
            { label: 'Turnout', value: d.kpis.avgTurnout === null ? '–' : `${d.kpis.avgTurnout}%`, hint: '4 months' },
            { label: 'Rating', value: d.kpis.avgRating ?? '–', hint: `${d.kpis.ratingCount} ratings` },
          ]} />
        </Section>
      )}

      {d && (
        <Section title={`Needs attention${d.todos.length ? ` · ${d.todos.length}` : ''}`}>
          {d.todos.length === 0 ? <Group><Row title="Nothing pending" subtitle="Attendance, certificates and feedback are done for recent events." left={<Icon ios="checkmark.circle" android="check_circle" color={C.green} />} /></Group> : (
            <Group>
              {d.todos.slice(0, 8).map(t => {
                const ic = TODO_ICON[t.kind] ?? TODO_ICON.draft
                return <Row key={t.kind + t.eventId} title={t.title} numberOfLines={2} subtitle={t.detail} left={<Icon ios={ic.ios} android={ic.android} color={ic.color} />} chevron onPress={go(`/admin/event/${t.eventId}`)} />
              })}
            </Group>
          )}
        </Section>
      )}

      {d && d.nextUp.length > 0 && (
        <Section title="Live and next">
          <Group>
            {d.nextUp.map(e => (
              <Row key={e.id} title={e.title} subtitle={new Date(e.start).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                right={<T v="mono">{e.registered}{e.capacity ? `/${e.capacity}` : ''}</T>} chevron onPress={go(`/admin/event/${e.id}`)} />
            ))}
          </Group>
        </Section>
      )}

      <Section title="Manage">
        <Group>
          <Row title="Events" subtitle="Create, edit, registrations, attendance, feedback, ECR" left={<Icon ios="calendar" android="event" />} chevron onPress={go('/admin/events')} />
          <Row title="Scan tickets" left={<Icon ios="qrcode.viewfinder" android="qr_code_scanner" />} chevron onPress={go('/scan')} />
          <Row title="People" subtitle="Look up a student's events, certificates and XP" left={<Icon ios="person.crop.rectangle.stack" android="person_search" />} chevron onPress={go('/admin/people')} />
          <Row title="Certificates" subtitle="Find any certificate by ID, student or event" left={<Icon ios="rosette" android="workspace_premium" />} chevron onPress={go('/admin/certificates')} />
          <Row title="Forms" subtitle="Responses, open/close, CSV export" left={<Icon ios="doc.text" android="description" />} chevron onPress={go('/admin/forms')} />
          <Row title="Club management" left={<Icon ios="person.2.badge.gearshape" android="manage_accounts" />} chevron onPress={go('/manage')} />
        </Group>
      </Section>
      <Section title="Insights">
        <Group>
          <Row title="Analytics" subtitle="Every event's numbers, sortable" left={<Icon ios="tablecells" android="table_chart" />} chevron onPress={go('/admin/analytics')} />
          <Row title="Ask Technova" subtitle="Questions in plain English, answered from the data" left={<Icon ios="sparkles" android="auto_awesome" />} chevron onPress={go('/admin/ask')} />
        </Group>
      </Section>
      <Section title="Access">
        <Group>
          <Row title="Admin roles" subtitle="Who is a super admin or scanner admin" left={<Icon ios="person.badge.key" android="admin_panel_settings" />} chevron onPress={go('/admin/roles')} />
          {logs.data ? <Row title="Activity log" subtitle="Who changed what, and when" left={<Icon ios="list.bullet.rectangle" android="history" />} chevron onPress={go('/admin/logs')} /> : null}
        </Group>
      </Section>
    </Screen>
  )
}
