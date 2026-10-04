import { getFormById } from "@/lib/actions/forms"
import { auth } from "@/lib/auth"
import { DynamicForm } from "@/components/public/dynamic-form"
import { redirect } from "next/navigation"
import { getUserFormResponse } from "@/lib/actions/forms"
import Link from "next/link"

export default async function PublicFormPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ ref?: string }> }) {
    const { id } = await params
    const resolvedSearch = await searchParams
    const session = await auth()
    
    if (!session) {
        const callbackUrl = encodeURIComponent(`/forms/${id}${resolvedSearch.ref ? `?ref=${resolvedSearch.ref}` : ''}`)
        redirect(`/login?callbackUrl=${callbackUrl}`)
    }

    const form = await getFormById(id)

    if (!form || !form.is_active) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
                <div className="max-w-md text-center space-y-4">
                    <h1 className="text-4xl font-bold tracking-tighter text-red-400">Form Not Found</h1>
                    <p className="text-zinc-400">This form might have been closed or does not exist.</p>
                    <Link href="/" className="inline-block mt-8 text-sm uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
                        Return Home
                    </Link>
                </div>
            </div>
        )
    }

    // Check if form is published
    if (!form.is_published) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
                <div className="max-w-md text-center space-y-4">
                    <h1 className="text-4xl font-bold tracking-tighter text-amber-400">Form Not Published</h1>
                    <p className="text-zinc-400">This form exists but hasn&apos;t been published yet. Please check back later.</p>
                    <Link href="/" className="inline-block mt-8 text-sm uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
                        Return Home
                    </Link>
                </div>
            </div>
        )
    }

    const existingResponse = await getUserFormResponse(id, session.user.id)

    // If user already submitted and editing is not allowed
    if (existingResponse && !form.allow_edit) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
                <div className="max-w-md text-center space-y-4 bg-zinc-900/80 border border-zinc-800 rounded-3xl p-10">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Already Submitted</h1>
                    <p className="text-zinc-400">You&apos;ve already submitted a response to this form. Editing is not allowed.</p>
                    <Link href="/" className="inline-block mt-6 text-sm text-blue-400 hover:underline">
                        Return Home
                    </Link>
                </div>
            </div>
        )
    }
    
    return (
        <main className="min-h-screen bg-zinc-950 text-white selection:bg-indigo-500/30">
            <DynamicForm 
                form={form} 
                existingResponse={existingResponse} 
                systemId={session.user.system_id || ''}
                referrerId={resolvedSearch.ref}
            />
        </main>
    )
}
