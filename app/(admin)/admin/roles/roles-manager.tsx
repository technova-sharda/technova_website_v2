'use client'

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Crown, History, Loader2, Search, ShieldCheck, ScanLine, UserMinus, Users } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { searchUsersForRole, setUserRole, type ManagedRole, type RoleChange, type RoleUser } from "@/lib/actions/roles"
import { PageHeader } from "@/components/admin/ui"

const ROLE_INFO: Record<ManagedRole, { label: string; help: string; badge: string }> = {
    super_admin: { label: "Super Admin", help: "Full admin panel, including this page", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    admin: { label: "Admin", help: "Event QR scanner only", badge: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
    student: { label: "Student", help: "Normal student access", badge: "bg-white/5 text-gray-300 border-white/10" },
}
const ROLE_ORDER: ManagedRole[] = ["super_admin", "admin", "student"]

function roleLabel(role: string | null) {
    return role && role in ROLE_INFO ? ROLE_INFO[role as ManagedRole].label : (role ?? "Student")
}

function RoleBadge({ role }: { role: string | null }) {
    const info = role && role in ROLE_INFO ? ROLE_INFO[role as ManagedRole] : null
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${info?.badge ?? "bg-purple-500/15 text-purple-300 border-purple-500/30"}`}>
            {roleLabel(role)}
        </span>
    )
}

function Avatar({ user }: { user: RoleUser }) {
    const initials = (user.name || user.email || "?").split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase()
    return user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.image} alt="" referrerPolicy="no-referrer" loading="lazy" className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0" />
    ) : (
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-gray-300 shrink-0">{initials}</div>
    )
}

type Pending = { user: RoleUser; role: ManagedRole }

function UserRow({ user, isSelf, onChange }: { user: RoleUser; isSelf: boolean; onChange: (p: Pending) => void }) {
    const current = (user.role ?? "student") as ManagedRole
    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar user={user} />
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white truncate">{user.name || "Unnamed"}</span>
                        {isSelf && <span className="text-[10px] uppercase tracking-wider text-gray-500 border border-white/10 rounded px-1.5 py-0.5">You</span>}
                    </div>
                    <div className="text-sm text-gray-500 truncate">{user.email}</div>
                </div>
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
                <RoleBadge role={user.role} />
                {isSelf ? (
                    <span className="text-xs text-gray-500 sm:w-[220px] sm:text-right">Another super admin can change your role</span>
                ) : (
                    <>
                        <select
                            aria-label={`Role for ${user.name || user.email}`}
                            value={ROLE_ORDER.includes(current) ? current : ""}
                            onChange={e => onChange({ user, role: e.target.value as ManagedRole })}
                            className="h-9 rounded-lg bg-black border border-white/10 text-sm text-white px-2 focus:outline-none focus:border-blue-500/50"
                        >
                            {!ROLE_ORDER.includes(current) && <option value="" disabled>{roleLabel(user.role)}</option>}
                            {ROLE_ORDER.map(r => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
                        </select>
                        {current !== "student" && (
                            <button
                                onClick={() => onChange({ user, role: "student" })}
                                className="h-9 px-3 rounded-lg text-sm text-red-300 border border-red-500/20 hover:bg-red-500/10 transition-colors inline-flex items-center gap-1.5"
                                title="Make a normal student"
                            >
                                <UserMinus className="w-4 h-4" /> Remove
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export function RolesManager({ holders, changes, currentUserId }: { holders: RoleUser[]; changes: RoleChange[]; currentUserId: string }) {
    const router = useRouter()
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<RoleUser[]>([])
    const [searching, setSearching] = useState(false)
    const [pending, setPending] = useState<Pending | null>(null)
    const [saving, startSaving] = useTransition()

    useEffect(() => {
        const q = query.trim()
        if (q.length < 2) return
        let cancelled = false
        const timer = setTimeout(async () => {
            setSearching(true)
            try {
                const found = await searchUsersForRole(q)
                if (!cancelled) setResults(found)
            } catch (e: any) {
                if (!cancelled) toast.error(e?.message || "Search failed")
            } finally {
                if (!cancelled) setSearching(false)
            }
        }, 300)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [query])

    const groups = useMemo(() => ({
        super_admin: holders.filter(u => u.role === "super_admin"),
        admin: holders.filter(u => u.role === "admin"),
        other: holders.filter(u => u.role !== "super_admin" && u.role !== "admin"),
    }), [holders])

    const confirmChange = () => {
        if (!pending) return
        const { user, role } = pending
        startSaving(async () => {
            const result = await setUserRole(user.id, role)
            if ("error" in result) {
                toast.error(result.error)
                return
            }
            toast.success(`${user.name || user.email} is now ${ROLE_INFO[role].label}`)
            setResults(prev => prev.map(u => (u.id === user.id ? { ...u, role } : u)))
            setPending(null)
            router.refresh()
        })
    }

    const showResults = query.trim().length >= 2

    return (
        <div>
            <div className="space-y-6 max-w-5xl">
                <PageHeader icon={ShieldCheck} title="Admin Roles" description="Give or take away admin access. Changes apply on the person's next page load; nobody needs to sign out." />

                <div className="grid sm:grid-cols-3 gap-3">
                    {([["super_admin", Crown], ["admin", ScanLine], ["student", Users]] as const).map(([r, Icon]) => (
                        <div key={r} className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                            <div className="flex items-center gap-2 text-white font-medium"><Icon className="w-4 h-4 text-gray-400" /> {ROLE_INFO[r].label}</div>
                            <p className="text-sm text-gray-500 mt-1">{ROLE_INFO[r].help}</p>
                        </div>
                    ))}
                </div>

                {/* Add / change anyone */}
                <section className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Find a person</h2>
                    <div className="relative">
                        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search by name or email (they must have signed in once)"
                            className="w-full h-11 pl-9 pr-9 rounded-xl bg-black border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
                        />
                        {searching && <Loader2 className="w-4 h-4 text-gray-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                    </div>
                    {showResults && (
                        <div className="space-y-2">
                            {results.length === 0 && !searching && <p className="text-sm text-gray-500">No one found. They need to sign in to the site once before they can be given a role.</p>}
                            {results.map(u => <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} onChange={setPending} />)}
                        </div>
                    )}
                </section>

                {([
                    ["Super Admins", groups.super_admin],
                    ["Admins (scanner only)", groups.admin],
                    ["Other roles", groups.other],
                ] as const).map(([title, list]) => list.length > 0 && (
                    <section key={title} className="space-y-3">
                        <h2 className="text-lg font-semibold text-white">{title} <span className="text-gray-500 font-normal">({list.length})</span></h2>
                        <div className="space-y-2">
                            {list.map(u => <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} onChange={setPending} />)}
                        </div>
                    </section>
                ))}

                <section className="space-y-3">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2"><History className="w-5 h-5 text-gray-400" /> Recent changes</h2>
                    {changes.length === 0 ? (
                        <p className="text-sm text-gray-500">No changes recorded yet.</p>
                    ) : (
                        <div className="rounded-xl border border-white/10 divide-y divide-white/5">
                            {changes.map(c => (
                                <div key={c.id} className="p-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                    <span className="text-gray-300">
                                        <span className="text-white font-medium">{c.user_name || c.user_email}</span>: {roleLabel(c.old_role)} → {roleLabel(c.new_role)}
                                    </span>
                                    <span className="text-gray-500">
                                        by {c.changed_by_email || "unknown"} · {new Date(c.changed_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <Dialog open={!!pending} onOpenChange={open => { if (!open && !saving) setPending(null) }}>
                <DialogContent className="bg-zinc-950 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Change role?</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            {pending && (
                                <>
                                    <span className="text-white">{pending.user.name || pending.user.email}</span> will go from{" "}
                                    <b>{roleLabel(pending.user.role)}</b> to <b>{ROLE_INFO[pending.role].label}</b>
                                    {" "}({ROLE_INFO[pending.role].help.toLowerCase()}).
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <button onClick={() => setPending(null)} disabled={saving} className="h-10 px-4 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5">Cancel</button>
                        <button onClick={confirmChange} disabled={saving} className="h-10 px-4 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 disabled:opacity-60 inline-flex items-center gap-2">
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Change role
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
