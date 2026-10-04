import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { checkEvaluatorAccess, getHackathonSettings, getTeamsForEvaluation } from "@/lib/actions/hackathon"
import { createAdminClient } from "@/lib/supabase/server"
import EvaluatorDashboardClient from "@/app/(admin)/admin/hackathon/evaluate/client"
import { ShieldAlert, LogOut } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic";

// Helper to fetch evaluator by magic token
async function getEvaluatorByToken(token: string) {
    const supabase = createAdminClient()
    const { data } = await supabase
        .from('hackathon_evaluators')
        .select('id, name, email')
        .eq('magic_token', token)
        .maybeSingle()
    return data
}

export default async function EvaluatorPage({ searchParams }: { searchParams: { token?: string } }) {
    const session = await auth()
    const token = searchParams.token

    let evaluator = await checkEvaluatorAccess()

    // If no evaluator in session but token is provided, try to fetch by token
    if (!evaluator && token) {
        evaluator = await getEvaluatorByToken(token)
    }

    const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'super_admin'

    if (!evaluator && !isAdmin) {
        if (!session || !session.user) redirect('/login')
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-2xl max-w-md text-center">
                    <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-white mb-2">Evaluator Access Denied</h1>
                    <p className="text-gray-400 mb-6">Your email ({session?.user?.email}) is not registered as an evaluator for this hackathon.</p>
                    <Link href="/" className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                        Return to Home
                    </Link>
                </div>
            </div>
        )
    }

    const settings = await getHackathonSettings()
    const initialTeams = await getTeamsForEvaluation(1)

    return (
        <div className="min-h-screen bg-black p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8 border-b border-white/10 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-400">Evaluator Portal</h1>
                        <p className="text-gray-400 mt-2">Welcome, {evaluator?.name || session?.user?.name}. Please review the assigned teams below.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300">
                            {(evaluator as any)?.email || session?.user?.email}
                        </span>
                        {isAdmin && (
                            <Link href="/admin/hackathon" className="text-sm text-emerald-400 hover:text-emerald-300 underline">
                                Back to Admin Area
                            </Link>
                        )}
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
                    <EvaluatorDashboardClient initialTeams={initialTeams} evaluationOpen={settings?.evaluation_open ?? false} evaluationRounds={settings?.evaluation_rounds ?? 2} evaluatorToken={token} />
                </div>
            </div>
        </div>
    )
}
