import { useState } from 'react'
import { View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { C } from '@/constants/theme'
import { adminApi, useAdminMutation, useClubForManagement, type ClubForManagement, type ManagedMember } from '@/lib/admin'
import { pickImageForm } from '@/components/admin/pick-image'
import { useToast } from '@/components/toast'
import { Avatar, Badge, Box, Button, Empty, ErrorState, Field, Group, Icon, Loading, Row, Screen, Section, Sheet, T } from '@/components/ui'

type MemberForm = { name: string; role: string; email: string; phone: string; linkedin_id: string }
const blank: MemberForm = { name: '', role: 'Core Team', email: '', phone: '', linkedin_id: '' }
const isLeadRole = (r: string) => /^(club\s+)?lead(\s*\(.*\))?$/i.test(r.trim()) // same rule as the website

export default function ManageClub() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const data = useClubForManagement(id)
  if (data.isLoading) return <Screen><Loading rows={5} /></Screen>
  if (data.error || !data.data) return <Screen><ErrorState error={data.error ?? new Error('Club not found')} onRetry={() => void data.refetch()} /></Screen>
  return <ClubEditor key={id} d={data.data} refreshing={data.isRefetching} onRefresh={() => void data.refetch()} />
}

function ClubEditor({ d, refreshing, onRefresh }: { d: ClubForManagement; refreshing: boolean; onRefresh: () => void }) {
  const toast = useToast()
  const id = d.club.id
  const keys = [['manage', 'club', id], ['manage', 'clubs'], ['clubs'], ['club', id], ['team']]
  const [details, setDetails] = useState({ description: d.club.description ?? '', linkedin_url: d.club.linkedin_url ?? '', instagram_url: d.club.instagram_url ?? '', contact_email: d.club.contact_email ?? '' })
  const dirty = details.description !== (d.club.description ?? '') || details.linkedin_url !== (d.club.linkedin_url ?? '') || details.instagram_url !== (d.club.instagram_url ?? '') || details.contact_email !== (d.club.contact_email ?? '')
  const emailError = details.contact_email && !/^\S+@\S+\.\S+$/.test(details.contact_email.trim()) ? 'Enter a valid email' : null

  const saveDetails = useAdminMutation(() => adminApi(`/clubs/${id}`, { method: 'PATCH', body: details }), keys)
  const logo = useAdminMutation((fd: FormData) => adminApi(`/clubs/${id}/logo`, { method: 'POST', body: fd }), keys)
  const addMember = useAdminMutation((m: MemberForm) => adminApi(`/clubs/${id}/members`, { method: 'POST', body: m }), keys)
  const updateMember = useAdminMutation((v: { id: string; m: MemberForm }) => adminApi(`/members/${v.id}`, { method: 'PATCH', body: v.m }), keys)
  const removeMember = useAdminMutation((mid: string) => adminApi(`/members/${mid}`, { method: 'DELETE' }), keys)
  const photo = useAdminMutation((v: { id: string; fd: FormData }) => adminApi(`/members/${v.id}/photo`, { method: 'POST', body: v.fd }), keys)

  const [editing, setEditing] = useState<ManagedMember | 'new' | null>(null)
  const [form, setForm] = useState<MemberForm>(blank)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [tried, setTried] = useState(false)
  const openMember = (m: ManagedMember | 'new') => {
    setEditing(m); setConfirmRemove(false); setTried(false)
    setForm(m === 'new' ? blank : { name: m.name, role: m.role ?? '', email: m.email ?? '', phone: m.phone ?? '', linkedin_id: m.linkedin_id ?? '' })
  }
  const close = () => { setEditing(null); setConfirmRemove(false) }
  const lockedLead = editing !== null && editing !== 'new' && editing.isLead && !d.canEditLeads
  const leadBlocked = !d.canEditLeads && isLeadRole(form.role) && (editing === 'new' || (editing !== null && !editing.isLead))
  const memberErr = { name: !form.name.trim() ? 'Name is required' : null, email: form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim()) ? 'Enter a valid email' : null }

  const submitMember = () => {
    setTried(true)
    if (memberErr.name || memberErr.email || leadBlocked) return
    const done = { onSuccess: () => { toast.success(editing === 'new' ? 'Member added' : 'Member updated'); close() }, onError: (e: Error) => toast.error("Couldn't save", e.message) }
    if (editing === 'new') addMember.mutate(form, done)
    else if (editing) updateMember.mutate({ id: editing.id, m: form }, done)
  }
  const changePhoto = async (m: ManagedMember) => {
    const fd = await pickImageForm(true).catch(e => { toast.error("Couldn't use that photo", e instanceof Error ? e.message : 'Try another image'); return null })
    if (fd) photo.mutate({ id: m.id, fd }, { onSuccess: () => toast.success('Photo updated'), onError: e => toast.error("Couldn't upload", e.message) })
  }
  // Technova's own team (Technova Executives) has no club lead; everyone is listed in one section
  const isCore = /^technova/i.test(d.club.name)
  const leads = isCore ? [] : d.members.filter(m => m.isLead)
  const others = isCore ? d.members : d.members.filter(m => !m.isLead)
  const memberRow = (m: ManagedMember) => (
    <Row key={m.id} left={<Avatar uri={m.photo_url ?? m.fallback_photo} name={m.name} size={40} />} title={m.name}
      subtitle={[m.role, m.email].filter(Boolean).join(' · ') || undefined}
      right={!m.photo_url && !m.fallback_photo ? <Badge text="No photo" tone="amber" /> : null} chevron onPress={() => openMember(m)} />
  )

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Stack.Screen options={{ title: d.club.name }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar uri={d.club.logo_url} name={d.club.name} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="h2">{d.club.name}</T>
          <T v="small">{d.members.length} members</T>
        </View>
        <Button size="sm" title="Logo" icon={{ ios: 'photo', android: 'image' }} loading={logo.isPending}
          onPress={() => void pickImageForm(false).then(fd => fd && logo.mutate(fd, { onSuccess: () => toast.success('Logo updated'), onError: e => toast.error("Couldn't upload", e.message) })).catch(e => toast.error("Couldn't use that photo", e instanceof Error ? e.message : 'Try another image'))} />
      </View>

      <Section title="Details">
        <Box>
          <Field label="About the club" multiline value={details.description} onChangeText={v => setDetails(s => ({ ...s, description: v }))} maxLength={2000} helper={`${details.description.length}/2000 · shown on the club page`} />
          <Field label="Contact email" value={details.contact_email} onChangeText={v => setDetails(s => ({ ...s, contact_email: v }))} keyboardType="email-address" autoCapitalize="none" error={emailError} />
          <Field label="LinkedIn" value={details.linkedin_url} onChangeText={v => setDetails(s => ({ ...s, linkedin_url: v }))} autoCapitalize="none" keyboardType="url" placeholder="linkedin.com/company/…" />
          <Field label="Instagram" value={details.instagram_url} onChangeText={v => setDetails(s => ({ ...s, instagram_url: v }))} autoCapitalize="none" keyboardType="url" placeholder="instagram.com/…" />
          <Button variant="primary" title="Save details" disabled={!dirty || !!emailError} loading={saveDetails.isPending}
            onPress={() => saveDetails.mutate(undefined, { onSuccess: () => toast.success('Details saved'), onError: e => toast.error("Couldn't save", e.message) })} />
        </Box>
      </Section>

      {!isCore && (
        <Section title={`Club leads · ${leads.length}`} hint={d.canEditLeads ? undefined : 'Only the President, Vice President or Tech Lead can change club leads.'}>
          <Group>{leads.length ? leads.map(memberRow) : <Empty title="No club lead listed" />}</Group>
        </Section>
      )}
      <Section title={`${isCore ? 'Executives' : 'Members'} · ${others.length}`} action={<Button size="sm" variant="primary" title="Add" icon={{ ios: 'plus', android: 'add' }} onPress={() => openMember('new')} />}>
        <Group>{others.length ? others.map(memberRow) : <Empty title="No members yet" hint="Add the core team so students know who to contact." />}</Group>
      </Section>

      <Sheet open={editing !== null} onClose={close} title={editing === 'new' ? 'Add member' : confirmRemove ? 'Remove member' : 'Edit member'}>
        {confirmRemove && editing && editing !== 'new' ? (
          <>
            <T>Remove {editing.name} from {d.club.name}? They disappear from the club and leadership pages.</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Cancel" style={{ flex: 1 }} onPress={() => setConfirmRemove(false)} />
              <Button title="Remove" variant="danger" style={{ flex: 1 }} loading={removeMember.isPending}
                onPress={() => removeMember.mutate(editing.id, { onSuccess: () => { toast.success('Member removed'); close() }, onError: e => toast.error("Couldn't remove", e.message) })} />
            </View>
          </>
        ) : (
          <>
            {editing && editing !== 'new' && (
              <Row left={<Avatar uri={editing.photo_url ?? editing.fallback_photo} name={editing.name} size={48} />} title="Photo" subtitle="Square photos work best"
                right={<Button size="sm" title="Change" loading={photo.isPending} onPress={() => void changePhoto(editing)} />} />
            )}
            {lockedLead && <T v="small" style={{ color: C.amber }}>This is a club lead. You can update the phone number and LinkedIn; role and email are managed by the executives.</T>}
            <Field label="Name" required value={form.name} onChangeText={v => setForm(s => ({ ...s, name: v }))} error={tried ? memberErr.name : null} maxLength={120} />
            <Field label="Role" value={form.role} onChangeText={v => setForm(s => ({ ...s, role: v }))} editable={!lockedLead} maxLength={80} placeholder="Core Team"
              error={tried && leadBlocked ? 'Only the executives can assign the Club Lead role' : null} helper="e.g. Core Team, Design Head, Club Lead" />
            <Field label="Email" value={form.email} onChangeText={v => setForm(s => ({ ...s, email: v }))} editable={!lockedLead} keyboardType="email-address" autoCapitalize="none" error={tried ? memberErr.email : null} />
            <Field label="Phone" value={form.phone} onChangeText={v => setForm(s => ({ ...s, phone: v }))} keyboardType="phone-pad" maxLength={30} helper="Shown on the club page so students can reach them." />
            <Field label="LinkedIn" value={form.linkedin_id} onChangeText={v => setForm(s => ({ ...s, linkedin_id: v }))} autoCapitalize="none" placeholder="Profile URL or username" />
            <Button variant="primary" title={editing === 'new' ? 'Add member' : 'Save'} loading={addMember.isPending || updateMember.isPending} onPress={submitMember} />
            {editing && editing !== 'new' && !lockedLead && (
              <Button variant="danger" title="Remove from club" icon={{ ios: 'person.badge.minus', android: 'person_remove' }} onPress={() => setConfirmRemove(true)} />
            )}
          </>
        )}
      </Sheet>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Icon ios="info.circle" android="info" size={14} color={C.textMuted} />
        <T v="small" style={{ flex: 1 }}>Member phone numbers and emails are public on the website so students can contact the team.</T>
      </View>
    </Screen>
  )
}
