import { useState } from 'react'
import { View } from 'react-native'
import { C } from '@/constants/theme'
import { adminApi, useAdminMutation, useFeedbackInfo, type FeedbackForm, type FeedbackThemes } from '@/lib/admin'
import { useToast } from '@/components/toast'
import { Badge, Box, Button, Empty, ErrorState, Group, Loading, Row, Section, StatStrip, T } from '@/components/ui'

const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
function formState(f: FeedbackForm) {
  if (f.closes_at && new Date(f.closes_at).getTime() <= Date.now()) return { text: 'Closed', tone: 'neutral' as const, open: false }
  if (f.is_released) return { text: 'Open', tone: 'green' as const, open: true }
  return { text: f.release_mode === 'automatic' ? 'Opens after event' : 'Not released', tone: 'amber' as const, open: false }
}

function Bullets({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items.length) return null
  return (
    <View style={{ gap: 4 }}>
      <T v="label" style={{ color }}>{title}</T>
      {items.map((x, i) => <T key={i} v="dim">• {x}</T>)}
    </View>
  )
}

/** Feedback forms for one event: open/close them, see the numbers, and summarise written comments. */
export function FeedbackPanel({ eventId }: { eventId: string }) {
  const toast = useToast()
  const info = useFeedbackInfo(eventId, true)
  const [themes, setThemes] = useState<FeedbackThemes | null>(null)
  const keys = [['admin', 'feedback', eventId]]
  const release = useAdminMutation((id: string) => adminApi(`/feedback/${id}/release`, { method: 'POST' }), keys)
  const close = useAdminMutation((id: string) => adminApi(`/feedback/${id}/close`, { method: 'POST' }), keys)
  const summarise = useAdminMutation(() => adminApi<FeedbackThemes>(`/events/${eventId}/feedback-summary`, { method: 'POST' }), [])

  if (info.isLoading) return <Loading rows={3} />
  if (info.error) return <ErrorState error={info.error} onRetry={() => void info.refetch()} />
  const { forms, analytics: a } = info.data!

  return (
    <View style={{ gap: 20 }}>
      {a && (
        <StatStrip items={[
          { label: 'Avg rating', value: a.averageRating === null ? '–' : `${Number(a.averageRating).toFixed(1)}/5` },
          { label: 'Responses', value: String(a.totalResponses) },
          { label: 'Response rate', value: `${Math.round(a.responseRate)}%`, hint: `of ${a.totalRegistrations} registered` },
        ]} />
      )}

      <Section title="Forms" hint="Students see an open form on the event page and in their tickets.">
        {forms.length === 0 ? <Group><Empty title="No feedback form" hint="Create one on the website: Events → this event → Feedback." /></Group> : (
          <Group>
            {forms.map(f => {
              const st = formState(f)
              const busy = (release.isPending && release.variables === f.id) || (close.isPending && close.variables === f.id)
              return (
                <Row key={f.id} title={f.title || (f.day_number ? `Day ${f.day_number}` : 'Feedback')}
                  subtitle={`${f.response_count} responses · ${f.questions.length} questions${f.released_at ? ` · released ${fmt(f.released_at)}` : ''}`}
                  right={
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Badge text={st.text} tone={st.tone} />
                      {st.open
                        ? <Button size="sm" title="Close" loading={busy} onPress={() => close.mutate(f.id, { onSuccess: () => toast.success('Form closed'), onError: e => toast.error("Couldn't close", e.message) })} />
                        : <Button size="sm" title={f.closes_at ? 'Reopen' : 'Release'} loading={busy} onPress={() => release.mutate(f.id, { onSuccess: () => toast.success('Form is open', 'Students can submit now.'), onError: e => toast.error("Couldn't release", e.message) })} />}
                    </View>
                  } />
              )
            })}
          </Group>
        )}
      </Section>

      <Section title="What students said" action={<Button size="sm" title={themes ? 'Refresh' : 'Summarise'} icon={{ ios: 'sparkles', android: 'auto_awesome' }} loading={summarise.isPending}
        onPress={() => summarise.mutate(undefined, { onSuccess: setThemes, onError: e => toast.error("Couldn't summarise", e.message) })} />}>
        {themes ? (
          <Box>
            <T>{themes.overall}</T>
            <Bullets title="Liked" items={themes.praise} color={C.green} />
            <Bullets title="Complaints" items={themes.complaints} color={C.red} />
            <Bullets title="Suggestions" items={themes.suggestions} color={C.blue} />
            <T v="small">From {themes.commentsRead} written comments.</T>
          </Box>
        ) : <T v="small">Reads every written comment and groups them into what went well, what didn&apos;t, and suggestions.</T>}
      </Section>
    </View>
  )
}
