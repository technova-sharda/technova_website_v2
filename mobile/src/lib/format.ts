const IST = 'Asia/Kolkata'
const opt = (o: Intl.DateTimeFormatOptions) => ({ timeZone: IST, ...o })
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', opt({ weekday: 'short', day: 'numeric', month: 'short' }))
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', opt({ hour: 'numeric', minute: '2-digit' }))
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-IN', opt({ day: 'numeric', month: 'short', year: 'numeric' }))
export function fmtWhen(start: string, end: string | null) {
  if (!end || fmtDay(start) === fmtDay(end)) return `${fmtDate(start)} · ${fmtTime(start)}${end ? ` – ${fmtTime(end)}` : ''}`
  return `${fmtDate(start)} – ${fmtDate(end)}`
}
export function relative(iso: string) {
  const d = new Date(iso).getTime() - Date.now()
  const days = Math.round(d / 86_400_000)
  if (Math.abs(d) < 3_600_000) return d > 0 ? 'starting soon' : 'just started'
  if (days === 0) return d > 0 ? 'today' : 'earlier today'
  if (days === 1) return 'tomorrow'
  if (days > 1 && days < 7) return `in ${days} days`
  return fmtDate(iso)
}
export const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] || 'there'
