export const PHASE_BADGE: Record<string, { text: string; tone: 'green' | 'blue' | 'amber' | 'neutral' | 'red' }> = {
  live: { text: 'Live', tone: 'green' }, upcoming: { text: 'Upcoming', tone: 'blue' }, draft: { text: 'Draft', tone: 'amber' }, ended: { text: 'Ended', tone: 'neutral' }, cancelled: { text: 'Cancelled', tone: 'red' },
}

export const roleLabel = (r: string | null) => (r === 'super_admin' ? 'Super admin' : r === 'admin' ? 'Scanner admin' : null)
