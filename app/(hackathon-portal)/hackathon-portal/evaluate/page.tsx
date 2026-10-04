import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { checkHackathonRole, checkEvaluatorAccess, getHackathonSettings, getTeamsForEvaluation } from "@/lib/actions/hackathon"
import { createAdminClient } from "@/lib/supabase/server"
import PortalEvaluatorClient from "./client"
import { ShieldAlert, ClipboardCheck } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic";

async function getEvaluatorByToken(token: string) {
    const supabase = createAdminClient()
    const { data } = await supabase
        .from('hackathon_evaluators')
        .select('id, name, email')
        .eq('magic_token', token)
        .maybeSingle()
    return data
}

export default async function HackathonPortalEvaluatePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
    const session = await auth()
    const { role, user } = await checkHackathonRole()

    if (role === 'none') redirect("/")

    const resolvedParams = await searchParams
    const token = resolvedParams.token
    let evaluator = await checkEvaluatorAccess()

    if (!evaluator && token) {
        evaluator = await getEvaluatorByToken(token)
    }

    const isOrganizer = role === 'organizer'

    if (!evaluator && !isOrganizer) {
        return (
            <div className="max-w-lg mx-auto px-4 py-16">
                <div className="bg-red-50 border border-red-200 p-8 rounded-2xl text-center">
                    <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Evaluator Access Denied</h1>
                    <p className="text-gray-500 mb-6">Your email ({session?.user?.email}) is not registered as an evaluator for this hackathon.</p>
                    <Link href="/hackathon-portal" className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl font-medium transition-colors">
                        Return to Portal
                    </Link>
                </div>
            </div>
        )
    }

    const settings = await getHackathonSettings()
    const initialTeams = await getTeamsForEvaluation(1)

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8 border-b border-gray-200 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg">
                            <ClipboardCheck className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Evaluate Teams</h1>
                    </div>
                    <p className="text-gray-500 mt-1 text-sm">Welcome, {evaluator?.name || user?.name}. Review and score the assigned teams below.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">{evaluator?.name || user?.name}</p>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Lead Evaluator</p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm border-2 border-white shadow">
                        {(evaluator?.name || user?.name || '?').charAt(0).toUpperCase()}
                    </div>
                </div>
            </div>

            {/* Evaluation Dashboard */}
            <PortalEvaluatorClient initialTeams={initialTeams} evaluationOpen={settings?.evaluation_open ?? false} evaluationRounds={settings?.evaluation_rounds ?? 2} evaluatorToken={token} />
        </div>
    )
}
