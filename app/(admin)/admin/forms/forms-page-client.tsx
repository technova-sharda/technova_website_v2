"use client"

import { useState } from "react"
import { Trash2, Settings, ArrowRight, FileText, Users, Calendar, Loader2, Copy } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EmptyState, PageHeader } from "@/components/admin/ui"
import Link from "next/link"
import { deleteForm, duplicateForm } from "@/lib/actions/forms"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { CreateFormDialog } from "./create-form-dialog"

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}

export function FormsPageClient({ forms: initialForms }: { forms: any[] }) {
    const [forms, setForms] = useState(initialForms)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
    const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
    const [typed, setTyped] = useState("")
    const router = useRouter()

    async function handleDuplicate(id: string) {
        setDuplicatingId(id)
        try {
            await duplicateForm(id)
            toast.success("Form duplicated!")
            router.refresh()
        } catch (err: any) {
            toast.error(err.message || "Failed to duplicate")
        } finally {
            setDuplicatingId(null)
        }
    }

    async function handleDelete(id: string) {
        setDeletingId(id)
        try {
            await deleteForm(id)
            setForms(forms.filter(f => f.id !== id))
            toast.success("Form deleted")
            setConfirmDeleteId(null)
            setTyped("")
        } catch (err: any) {
            toast.error(err.message || "Failed to delete form")
        } finally {
            setDeletingId(null)
        }
    }

    const toDelete = forms.find(f => f.id === confirmDeleteId) ?? null
    const status = (f: any) => !f.is_active
        ? { label: "Closed", cls: "border-white/10 bg-white/5 text-gray-400" }
        : f.is_published
            ? { label: "Accepting responses", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" }
            : { label: "Not published", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300" }

    return (
        <div className="space-y-6 pb-12">
            <PageHeader icon={FileText} title="Forms & surveys" tone="blue" description="Registrations, nominations and feedback." actions={<CreateFormDialog />} />

            {forms.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
                    <EmptyState icon={FileText} title="No forms yet" hint="Create a form to collect responses, feedback and nominations." action={<CreateFormDialog />} />
                </div>
            ) : (
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {forms.map((form) => {
                        const st = status(form)
                        return (
                            <li key={form.id} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] transition-colors hover:border-white/20">
                                <div className="flex flex-1 flex-col p-4 sm:p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <Link href={`/admin/forms/${form.id}/responses`} className="line-clamp-2 font-semibold text-white hover:text-amber-300">{form.title}</Link>
                                        <span className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                                    </div>
                                    <p className="mt-2 line-clamp-2 flex-1 text-sm text-gray-400">{form.description || "No description."}</p>
                                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                                        <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /><b className="font-semibold text-white">{form.response_count}</b> responses</span>
                                        {form.deadline && <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Due {formatDate(form.deadline)}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 border-t border-white/5 p-3">
                                    <Link href={`/admin/forms/${form.id}/responses`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-black hover:bg-amber-400">
                                        Responses <ArrowRight className="h-4 w-4" />
                                    </Link>
                                    <Link href={`/admin/forms/${form.id}/edit`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/5">
                                        <Settings className="h-4 w-4" /> Edit form
                                    </Link>
                                    <button onClick={() => handleDuplicate(form.id)} disabled={duplicatingId === form.id} title="Duplicate form" aria-label="Duplicate form"
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-white/5 hover:text-white disabled:opacity-50">
                                        {duplicatingId === form.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                    <button onClick={() => setConfirmDeleteId(form.id)} title="Delete form" aria-label="Delete form"
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-rose-500/10 hover:text-rose-400">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}

            <Dialog open={!!toDelete} onOpenChange={o => { if (!o && !deletingId) { setConfirmDeleteId(null); setTyped("") } }}>
                <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md border-white/10 bg-zinc-950 text-white">
                    <DialogHeader className="text-left">
                        <DialogTitle>Delete this form?</DialogTitle>
                        <DialogDescription className="text-gray-400">This can&apos;t be undone.</DialogDescription>
                    </DialogHeader>
                    {toDelete && (
                        <div className="space-y-3 text-sm">
                            <p className="font-medium text-white">{toDelete.title}</p>
                            {toDelete.response_count > 0 && (
                                <>
                                    <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200">Its <b>{toDelete.response_count} responses</b> will be deleted too. Export them from Responses first if you need them.</p>
                                    <label className="block space-y-1.5">
                                        <span className="text-xs text-gray-400">Type the form name to confirm</span>
                                        <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={toDelete.title} autoFocus className="h-10 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 text-sm text-white placeholder:text-gray-700 focus:border-rose-500/50 focus:outline-none" />
                                    </label>
                                </>
                            )}
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => { setConfirmDeleteId(null); setTyped("") }} disabled={!!deletingId} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-200 hover:bg-white/5">Cancel</button>
                                <button onClick={() => handleDelete(toDelete.id)} disabled={!!deletingId || (toDelete.response_count > 0 && typed.trim() !== String(toDelete.title).trim())}
                                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-40">
                                    {deletingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete form
                                </button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
