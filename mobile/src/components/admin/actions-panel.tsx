import { useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { C } from '@/constants/theme'
import { api } from '@/lib/api'
import { adminApi, useAdminMutation, useBlasts } from '@/lib/admin'
import { downloadAndOpen } from '@/lib/download'
import { useToast } from '@/components/toast'
import { Button, Field, Group, Icon, Row, Section, Sheet, SwitchRow, T } from '@/components/ui'

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const ECR = [
  { format: 'pdf', title: 'ECR (PDF)', subtitle: 'Sharda format, ready to submit', mime: 'application/pdf', icon: { ios: 'doc.richtext', android: 'picture_as_pdf' } },
  { format: 'docx', title: 'ECR (Word)', subtitle: 'Editable copy', mime: DOCX, icon: { ios: 'doc.text', android: 'description' } },
  { format: 'full', title: 'ECR with analytics (PDF)', subtitle: 'Adds turnout, ratings and charts', mime: 'application/pdf', icon: { ios: 'chart.bar.doc.horizontal', android: 'analytics' } },
] as const

type Ev = { id: string; title: string; registrations_closed?: boolean; is_past_event?: boolean; end_time: string }

/** Settings and one-off tasks for an event: registrations, past-events listing, ECR, email, edit, delete. */
export function ActionsPanel({ event, registered }: { event: Ev; registered: number }) {
  const toast = useToast()
  const qc = useQueryClient()
  const keys = [['admin', 'event', event.id], ['admin', 'events'], ['admin', 'overview']]
  const [now] = useState(() => Date.now())
  const ended = new Date(event.end_time).getTime() < now

  const regs = useAdminMutation((closed: boolean) => adminApi(`/events/${event.id}/registrations`, { method: 'POST', body: { closed } }), keys)
  const past = useAdminMutation(() => adminApi(`/events/${event.id}/past`, { method: 'POST' }), keys)
  const [downloading, setDownloading] = useState<string | null>(null)
  const ecr = async (x: (typeof ECR)[number]) => {
    setDownloading(x.format)
    try { await downloadAndOpen(`/api/admin/events/${event.id}/ecr?format=${x.format}`, { mimeType: x.mime, title: x.title }) }
    catch (e) { toast.error("Couldn't download", e instanceof Error ? e.message : 'Try again') }
    finally { setDownloading(null) }
  }

  // email
  const [mailOpen, setMailOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [mailStep, setMailStep] = useState<'write' | 'confirm'>('write')
  const blasts = useBlasts(event.id, true)
  const send = useAdminMutation(() => api<{ message: string }>('/api/admin/blast-email', { method: 'POST', body: { eventId: event.id, subject: subject.trim(), message: message.trim() } }), [['admin', 'blasts', event.id]])
  const closeMail = () => { setMailOpen(false); setMailStep('write') }

  // delete
  const [delOpen, setDelOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const del = useAdminMutation(() => adminApi(`/events/${event.id}`, { method: 'DELETE', body: { confirmTitle: typed } }), [])
  const titleMatches = typed.trim() === event.title.trim()

  return (
    <View style={{ gap: 20 }}>
      <Section title="Registrations">
        <Group>
          <SwitchRow title="Accepting registrations" subtitle={event.registrations_closed ? 'Closed. Students see "Registrations closed".' : 'Open to students'}
            value={!event.registrations_closed} disabled={regs.isPending}
            onChange={open => regs.mutate(!open, { onSuccess: () => toast.success(open ? 'Registrations open' : 'Registrations closed'), onError: e => toast.error("Couldn't update", e.message) })} />
          <SwitchRow title="Show in past events" subtitle={ended ? 'Listed on the website\'s past events page' : 'Available after the event ends'}
            value={!!event.is_past_event} disabled={past.isPending || (!ended && !event.is_past_event)}
            onChange={() => past.mutate(undefined, { onSuccess: () => toast.success('Updated'), onError: e => toast.error("Couldn't update", e.message) })} />
        </Group>
      </Section>

      <Section title="Event completion report" hint="Downloads to the phone and opens the share sheet: save to Files, open in a PDF viewer, or send on WhatsApp.">
        <Group>
          {ECR.map(x => (
            <Row key={x.format} title={x.title} subtitle={x.subtitle} left={<Icon {...x.icon} />} disabled={!!downloading && downloading !== x.format}
              right={downloading === x.format ? <T v="small">Preparing…</T> : <Icon ios="arrow.down.circle" android="download" color={C.textMuted} />}
              onPress={downloading ? undefined : () => void ecr(x)} />
          ))}
        </Group>
      </Section>

      <Section title="Email participants">
        <Group>
          <Row title="Write an email" subtitle={`Goes to all ${registered} registered students`} left={<Icon ios="envelope" android="mail" />} chevron onPress={() => setMailOpen(true)} disabled={registered === 0} />
          {(blasts.data ?? []).slice(0, 5).map(b => (
            <Row key={b.id} title={b.subject || 'Email'} subtitle={`${new Date(b.sent_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}${b.recipients_count != null ? ` · ${b.recipients_count} sent` : ''}`} />
          ))}
        </Group>
      </Section>

      <Section title="Event">
        <Group>
          <Row title="Edit details" left={<Icon ios="pencil" android="edit" />} chevron onPress={() => router.push({ pathname: '/admin/event-form', params: { id: event.id } })} />
          <Row title="Delete event" destructive left={<Icon ios="trash" android="delete" color={C.red} />} onPress={() => setDelOpen(true)} />
        </Group>
      </Section>

      <Sheet open={mailOpen} onClose={closeMail} title={mailStep === 'write' ? 'Email participants' : 'Send this email?'}>
        {mailStep === 'write' ? (
          <>
            <Field label="Subject" required value={subject} onChangeText={setSubject} placeholder="Venue changed to Block 10, Room 204" maxLength={150} />
            <Field label="Message" required value={message} onChangeText={setMessage} multiline placeholder="Write the update students need" helper="Sent from Technova with the event name and date." />
            <Button variant="primary" title="Review" disabled={!subject.trim() || !message.trim()} onPress={() => setMailStep('confirm')} />
          </>
        ) : (
          <>
            <T>This sends &quot;{subject.trim()}&quot; to {registered} students. Emails can&apos;t be unsent.</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Back" style={{ flex: 1 }} onPress={() => setMailStep('write')} />
              <Button title={`Send to ${registered}`} variant="primary" style={{ flex: 1 }} loading={send.isPending}
                onPress={() => send.mutate(undefined, { onSuccess: r => { toast.success('Email sent', r.message); setSubject(''); setMessage(''); closeMail() }, onError: e => toast.error("Couldn't send", e.message) })} />
            </View>
          </>
        )}
      </Sheet>

      <Sheet open={delOpen} onClose={() => { setDelOpen(false); setTyped('') }} title="Delete event">
        <T>This permanently deletes the event and everything attached to it: {registered} registrations, check-ins, feedback, certificates and XP.</T>
        <Field label="Type the event name to confirm" value={typed} onChangeText={setTyped} placeholder={event.title} autoCapitalize="none" autoCorrect={false} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Cancel" style={{ flex: 1 }} onPress={() => { setDelOpen(false); setTyped('') }} />
          <Button title="Delete" variant="danger" style={{ flex: 1 }} disabled={!titleMatches} loading={del.isPending}
            onPress={() => del.mutate(undefined, {
              onSuccess: () => { setDelOpen(false); toast.success('Event deleted'); void qc.invalidateQueries({ queryKey: ['admin'] }); router.back() },
              onError: e => toast.error("Couldn't delete", e.message),
            })} />
        </View>
      </Sheet>
    </View>
  )
}
