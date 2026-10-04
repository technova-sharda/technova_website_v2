'use client'

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Camera, Check, ImageUp, Loader2, Pencil, Plus, ShieldCheck, Trash2, Users, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ImageCropper, type CropOptions } from "@/components/ui/image-cropper"
import {
    addMember, removeMember, updateClubDetails, updateMember, uploadClubLogo, uploadMemberPhoto,
    type ClubDetail, type ManagedClub, type ManagedMember,
} from "@/lib/actions/club-management"

const ROLE_SUGGESTIONS = ["Club Lead", "Club Co-Lead", "Technical Head", "Projects & Operations Lead", "Editorial Head", "PR Head", "Design Lead", "Content Lead", "Coordinator", "Core Team"]
const input = "w-full h-10 rounded-lg bg-zinc-950 border border-white/10 px-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50"
const isLead = (role: string) => /^(club\s+)?lead(\s*\(.*\))?$/i.test(role.trim())

function Avatar({ src, name, size = 56 }: { src: string | null; name: string; size?: number }) {
    const initials = name.split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase()
    return src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} style={{ width: size, height: size }} className="rounded-xl object-cover border border-white/10 shrink-0" />
    ) : (
        <div style={{ width: size, height: size }} className="rounded-xl bg-white/10 flex items-center justify-center text-gray-300 font-semibold shrink-0">{initials}</div>
    )
}

const PHOTO_CROP: CropOptions = { title: "Crop photo", aspects: [{ label: "Square", value: 1 }], round: true, type: "image/jpeg", maxSize: 900 }
const LOGO_CROP: CropOptions = { title: "Crop logo", aspects: [{ label: "Square", value: 1 }, { label: "Wide 3:2", value: 3 / 2 }, { label: "Banner 2:1", value: 2 }], type: "image/png", maxSize: 1024 }

/** Hidden file input + trigger: pick an image, crop it, then upload it through a server action. */
function ImageUpload({ onFile, busy, label, icon: Icon = ImageUp, className = "", crop }: { onFile: (f: File) => Promise<void>; busy: boolean; label: string; icon?: any; className?: string; crop: CropOptions }) {
    const ref = useRef<HTMLInputElement>(null)
    const [picked, setPicked] = useState<{ src: string; name: string } | null>(null)
    const close = () => { if (picked) URL.revokeObjectURL(picked.src); setPicked(null) }
    const pick = (f: File) => {
        if (!f.type.startsWith("image/")) return void toast.error("Choose an image file")
        setPicked({ src: URL.createObjectURL(f), name: f.name })
    }
    return (
        <>
            <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = "" }} />
            <button type="button" disabled={busy} onClick={() => ref.current?.click()} className={`inline-flex items-center gap-1.5 text-xs font-medium disabled:opacity-60 ${className}`}>
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />} {label}
            </button>
            {picked && <ImageCropper src={picked.src} fileName={picked.name} options={crop} onCancel={close} onDone={async file => { await onFile(file); close() }} />}
        </>
    )
}

function MemberCard({ m, canEditLeads, onSaved, onRemove }: { m: ManagedMember; canEditLeads: boolean; onSaved: () => void; onRemove: (m: ManagedMember) => void }) {
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState({ name: m.name, role: m.role ?? "", email: m.email ?? "", phone: m.phone ?? "", linkedin_id: m.linkedin_id ?? "" })
    const [saving, startSaving] = useTransition()
    const [uploading, setUploading] = useState(false)
    const locked = m.isLead && !canEditLeads

    const save = () => startSaving(async () => {
        const res = await updateMember(m.id, form)
        if ("error" in res) return void toast.error(res.error)
        toast.success(`${form.name} updated`)
        setEditing(false)
        onSaved()
    })
    const upload = async (file: File) => {
        setUploading(true)
        const fd = new FormData(); fd.append("file", file)
        const res = await uploadMemberPhoto(m.id, fd)
        setUploading(false)
        if ("error" in res) return void toast.error(res.error)
        toast.success("Photo updated")
        onSaved()
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start gap-3">
                <div className="relative">
                    <Avatar src={m.photo_url || m.fallback_photo} name={m.name} />
                    <div className="absolute -bottom-2 -right-2">
                        <ImageUpload onFile={upload} busy={uploading} label="" icon={Camera} crop={PHOTO_CROP} className="h-7 w-7 justify-center rounded-full bg-amber-500 text-black shadow" />
                    </div>
                </div>
                <div className="min-w-0 flex-1">
                    {!editing ? (
                        <>
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-white truncate">{m.name}</p>
                                {m.isLead && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">Manages club</span>}
                            </div>
                            <p className="text-sm text-amber-300/90">{m.role || "Core Team"}</p>
                            <p className="text-xs text-gray-500 truncate mt-1">{[m.email, m.phone].filter(Boolean).join(" · ") || "No contact details"}</p>
                        </>
                    ) : (
                        <div className="grid gap-2">
                            <input className={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
                            <input className={input} list="role-suggestions" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Role" disabled={locked} />
                            <input className={input} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email (used for login access)" disabled={locked} />
                            <div className="grid grid-cols-2 gap-2">
                                <input className={input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone" />
                                <input className={input} value={form.linkedin_id} onChange={e => setForm({ ...form, linkedin_id: e.target.value })} placeholder="LinkedIn URL" />
                            </div>
                            {locked && <p className="text-xs text-gray-500">Role and email of the Club Lead can only be changed by the President, VP or Tech Lead.</p>}
                        </div>
                    )}
                </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 justify-end">
                {editing ? (
                    <>
                        <button onClick={() => setEditing(false)} disabled={saving} className="h-9 px-3 rounded-lg border border-white/10 text-sm text-gray-300 inline-flex items-center gap-1.5"><X className="w-4 h-4" /> Cancel</button>
                        <button onClick={save} disabled={saving} className="h-9 px-3 rounded-lg bg-amber-500 text-black text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save</button>
                    </>
                ) : (
                    <>
                        <button onClick={() => setEditing(true)} className="h-9 px-3 rounded-lg border border-white/10 text-sm text-gray-200 hover:bg-white/5 inline-flex items-center gap-1.5"><Pencil className="w-4 h-4" /> Edit</button>
                        {!locked && <button onClick={() => onRemove(m)} className="h-9 px-3 rounded-lg border border-red-500/20 text-sm text-red-300 hover:bg-red-500/10 inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Remove</button>}
                    </>
                )}
            </div>
        </div>
    )
}

export function ClubManager({ clubs, detail }: { clubs: ManagedClub[]; detail: ClubDetail }) {
    const router = useRouter()
    const { club, members, canEditLeads } = detail
    const [details, setDetails] = useState({ description: club.description ?? "", linkedin_url: club.linkedin_url ?? "", instagram_url: club.instagram_url ?? "", contact_email: club.contact_email ?? "" })
    const [newMember, setNewMember] = useState({ name: "", role: "Coordinator", email: "", phone: "", linkedin_id: "" })
    const [savingDetails, startDetails] = useTransition()
    const [adding, startAdding] = useTransition()
    const [removing, startRemoving] = useTransition()
    const [logoBusy, setLogoBusy] = useState(false)
    const [toRemove, setToRemove] = useState<ManagedMember | null>(null)
    const refresh = () => router.refresh()

    const saveDetails = () => startDetails(async () => {
        const res = await updateClubDetails(club.id, details)
        if ("error" in res) return void toast.error(res.error)
        toast.success("Club details saved")
        refresh()
    })
    const uploadLogo = async (file: File) => {
        setLogoBusy(true)
        const fd = new FormData(); fd.append("file", file)
        const res = await uploadClubLogo(club.id, fd)
        setLogoBusy(false)
        if ("error" in res) return void toast.error(res.error)
        toast.success("Logo updated")
        refresh()
    }
    const add = () => startAdding(async () => {
        const res = await addMember(club.id, newMember)
        if ("error" in res) return void toast.error(res.error)
        toast.success(`${newMember.name} added`)
        setNewMember({ name: "", role: "Coordinator", email: "", phone: "", linkedin_id: "" })
        refresh()
    })
    const confirmRemove = () => toRemove && startRemoving(async () => {
        const res = await removeMember(toRemove.id)
        if ("error" in res) return void toast.error(res.error)
        toast.success(`${toRemove.name} removed`)
        setToRemove(null)
        refresh()
    })

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-16">
            <datalist id="role-suggestions">{ROLE_SUGGESTIONS.filter(r => canEditLeads || !isLead(r)).map(r => <option key={r} value={r} />)}</datalist>

            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3"><Users className="w-7 h-7 text-amber-400" /> Club Management</h1>
                <p className="text-gray-400 mt-1 text-sm flex items-start gap-1.5"><ShieldCheck className="w-4 h-4 mt-0.5 text-green-400 shrink-0" /> Changes show on the public club pages within seconds.</p>
            </div>

            {clubs.length > 1 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                    {clubs.map(c => (
                        <Link key={c.id} href={`/club-management?club=${c.id}`} className={`shrink-0 px-4 h-10 inline-flex items-center rounded-full text-sm border transition-colors ${c.id === club.id ? "bg-amber-500 text-black border-amber-500 font-semibold" : "border-white/10 text-gray-300 hover:bg-white/5"}`}>{c.name}</Link>
                    ))}
                </div>
            )}

            {/* Club profile */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-6">
                <div className="flex flex-col sm:flex-row gap-5">
                    <div className="flex sm:flex-col items-center gap-3">
                        <div className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center overflow-hidden shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {club.logo_url ? <img src={club.logo_url} alt={club.name} className="w-20 h-20 object-contain" /> : <span className="text-black font-bold">{club.name[0]}</span>}
                        </div>
                        <ImageUpload onFile={uploadLogo} busy={logoBusy} label="Change logo" crop={LOGO_CROP} className="h-9 px-3 rounded-lg border border-white/10 text-gray-200 hover:bg-white/5" />
                    </div>
                    <div className="flex-1 grid gap-3">
                        <h2 className="text-xl font-bold text-white">{club.name}</h2>
                        <textarea value={details.description} onChange={e => setDetails({ ...details, description: e.target.value })} rows={4} placeholder="About the club (shown on the club page)" className={`${input} h-auto py-2`} />
                        <div className="grid sm:grid-cols-3 gap-2">
                            <input className={input} value={details.linkedin_url} onChange={e => setDetails({ ...details, linkedin_url: e.target.value })} placeholder="LinkedIn page URL" />
                            <input className={input} value={details.instagram_url} onChange={e => setDetails({ ...details, instagram_url: e.target.value })} placeholder="Instagram URL" />
                            <input className={input} type="email" value={details.contact_email} onChange={e => setDetails({ ...details, contact_email: e.target.value })} placeholder="Contact email" />
                        </div>
                        <div className="flex justify-end">
                            <button onClick={saveDetails} disabled={savingDetails} className="h-10 px-4 rounded-lg bg-amber-500 text-black text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60">{savingDetails && <Loader2 className="w-4 h-4 animate-spin" />} Save details</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Members */}
            <section className="space-y-3">
                <h2 className="text-lg font-semibold text-white">Coordinators <span className="text-gray-500 font-normal">({members.length})</span></h2>
                <div className="grid md:grid-cols-2 gap-3">
                    {members.map(m => <MemberCard key={m.id} m={m} canEditLeads={canEditLeads} onSaved={refresh} onRemove={setToRemove} />)}
                </div>
            </section>

            {/* Add member */}
            <section className="rounded-2xl border border-dashed border-white/15 p-4 md:p-6 space-y-3">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Plus className="w-5 h-5 text-amber-400" /> Add a coordinator</h2>
                <div className="grid sm:grid-cols-2 gap-2">
                    <input className={input} value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} placeholder="Full name" />
                    <input className={input} list="role-suggestions" value={newMember.role} onChange={e => setNewMember({ ...newMember, role: e.target.value })} placeholder="Role" />
                    <input className={input} type="email" value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })} placeholder="Email" />
                    <input className={input} value={newMember.phone} onChange={e => setNewMember({ ...newMember, phone: e.target.value })} placeholder="Phone" />
                    <input className={`${input} sm:col-span-2`} value={newMember.linkedin_id} onChange={e => setNewMember({ ...newMember, linkedin_id: e.target.value })} placeholder="LinkedIn URL (optional)" />
                </div>
                <p className="text-xs text-gray-500">You can add their photo right after, from their card.</p>
                <div className="flex justify-end">
                    <button onClick={add} disabled={adding || !newMember.name.trim()} className="h-10 px-4 rounded-lg bg-white text-black text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">{adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add</button>
                </div>
            </section>

            <Dialog open={!!toRemove} onOpenChange={open => { if (!open && !removing) setToRemove(null) }}>
                <DialogContent className="bg-zinc-950 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Remove {toRemove?.name}?</DialogTitle>
                        <DialogDescription className="text-gray-400">They&apos;ll no longer appear on the {club.name} page. You can add them again later.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <button onClick={() => setToRemove(null)} disabled={removing} className="h-10 px-4 rounded-lg border border-white/10 text-gray-300">Cancel</button>
                        <button onClick={confirmRemove} disabled={removing} className="h-10 px-4 rounded-lg bg-red-600 text-white font-semibold inline-flex items-center gap-2 disabled:opacity-60">{removing && <Loader2 className="w-4 h-4 animate-spin" />} Remove</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
