import { getEvaluatorByToken, getFormCandidates, getEvaluationCriteria, getEvaluationsByEvaluator } from "@/lib/actions/form-evaluation-actions"
import { getFormById } from "@/lib/actions/forms"
import { redirect } from "next/navigation"
import { EvaluatorPortalClient } from "./evaluator-portal-client"

export default async function FormEvaluatePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
    const { token } = await searchParams

    if (!token) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
                <div className="max-w-md text-center space-y-4">
                    <h1 className="text-4xl font-bold tracking-tighter text-red-400">Invalid Link</h1>
                    <p className="text-zinc-400">No evaluation token provided. Please use the link shared by the admin.</p>
                </div>
            </div>
        )
    }

    const evaluator = await getEvaluatorByToken(token)
    if (!evaluator) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
                <div className="max-w-md text-center space-y-4">
                    <h1 className="text-4xl font-bold tracking-tighter text-red-400">Invalid Token</h1>
                    <p className="text-zinc-400">This evaluation link is invalid or has expired.</p>
                </div>
            </div>
        )
    }

    const form = await getFormById(evaluator.form_id)
    if (!form) redirect("/")

    const candidates = await getFormCandidates(evaluator.form_id, token)
    const criteria = await getEvaluationCriteria(evaluator.form_id)
    const existingEvaluations = await getEvaluationsByEvaluator(evaluator.id, token)

    // Get form fields for showing candidate answers
    const questionFields = form.fields.filter((f: any) => f.type !== "section")

    return (
        <main className="min-h-screen bg-zinc-950 text-white">
            <EvaluatorPortalClient
                evaluator={evaluator}
                formTitle={form.title}
                candidates={candidates}
                criteria={criteria}
                existingEvaluations={existingEvaluations}
                fields={questionFields}
                token={token}
                evaluationsOpen={form.evaluations_open ?? true}
            />
        </main>
    )
}
