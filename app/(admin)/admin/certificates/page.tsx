import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getAnalyticsDataset } from "@/lib/analytics/dataset"
import { CertificatesHub, type HubEventRow } from "./certificates-hub"

export const metadata = { title: "Certificates" }

function buildHub(ds: Awaited<ReturnType<typeof getAnalyticsDataset>>) {
    const byEvent = new Map<string, HubEventRow>()
    for (const e of ds.events) {
        byEvent.set(e.id, { id: e.id, title: e.title, date: e.start_time, club: e.club, valid: 0, pending: 0, revoked: 0, emailed: 0, notEmailed: 0, downloads: 0, positions: 0 })
    }
    for (const c of ds.certificates) {
        const row = byEvent.get(c.event_id)
        if (!row) continue
        if (c.status === "valid") { row.valid++; if (c.emailed) row.emailed++; else row.notEmailed++ }
        else if (c.status === "pending") row.pending++
        else if (c.status === "revoked") row.revoked++
        if (c.position) row.positions++
        row.downloads += c.downloads
    }
    const rows = [...byEvent.values()].filter(r => r.valid + r.pending + r.revoked > 0).sort((a, b) => b.date.localeCompare(a.date))
    // Past events with attendance but no certificates yet: candidates to send
    const attendedEvents = new Set([...ds.checkins.map(c => c.event_id), ...ds.registrations.filter(r => r.attended).map(r => r.event_id)])
    const missing = ds.events
        .filter(e => (e.status === "live" || e.status === "completed") && new Date(e.end_time).getTime() < Date.now())
        .filter(e => !rows.some(r => r.id === e.id))
        .map(e => ({ id: e.id, title: e.title, date: e.start_time, hasAttendance: attendedEvents.has(e.id) }))
        .sort((a, b) => b.date.localeCompare(a.date))

    return { rows, missing }
}

export default async function CertificatesHubPage() {
    const session = await auth()
    if (session?.user?.role !== "super_admin") redirect("/admin/dashboard")

    const ds = await getAnalyticsDataset()
    const { rows, missing } = buildHub(ds)
    return <CertificatesHub rows={rows} missing={missing} generatedAt={ds.generatedAt} />
}
