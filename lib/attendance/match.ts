import type { RosterEntry } from "@/lib/actions/attendance"

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

export type Match = { toMark: RosterEntry[]; already: RosterEntry[]; pending: RosterEntry[]; notRegistered: string[] }

/** Finds registered students in a pasted/uploaded attendance list by email or system ID. */
export function matchAttendance(text: string, roster: RosterEntry[], dayKey: string): Match {
    const byEmail = new Map(roster.filter(r => r.email).map(r => [r.email!.toLowerCase(), r]))
    const bySystemId = new Map(roster.filter(r => r.systemId).map(r => [r.systemId!.toLowerCase(), r]))
    const found = new Map<string, RosterEntry>()
    const notRegistered = new Set<string>()

    for (const raw of text.match(EMAIL) ?? []) {
        const email = raw.toLowerCase()
        const entry = byEmail.get(email)
        if (entry) found.set(entry.registrationId, entry)
        else notRegistered.add(email)
    }
    for (const token of text.split(/[^A-Za-z0-9]+/)) {
        const entry = token.length >= 5 ? bySystemId.get(token.toLowerCase()) : undefined
        if (entry) found.set(entry.registrationId, entry)
    }

    const list = Array.from(found.values())
    return {
        toMark: list.filter(r => !r.paymentPending && !r.checkedInDays.includes(dayKey)),
        already: list.filter(r => !r.paymentPending && r.checkedInDays.includes(dayKey)),
        pending: list.filter(r => r.paymentPending),
        notRegistered: Array.from(notRegistered),
    }
}
