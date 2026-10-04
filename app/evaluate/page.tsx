import { AlertTriangle } from "lucide-react"
import { checkHackathonRole, getHackathonSettings, getTeamsForEvaluation } from "@/lib/actions/hackathon"
import { createAdminClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import EvaluatorDashboardClient from "@/app/(admin)/admin/hackathon/evaluate/client"

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

export default async function HackathonEvaluatePage({ searchParams }: { searchParams: { token?: string } }) {
    const { role } = await checkHackathonRole()
    const token = searchParams.token

    let evaluator = null
    if (token) {
        evaluator = await getEvaluatorByToken(token)
    }

    // Only organizers and evaluators can evaluate
    if (!evaluator && role !== 'organizer' && role !== 'evaluator') {
        redirect("/hackathon-portal")
    }

    const settings = await getHackathonSettings()
    const initialTeams = await getTeamsForEvaluation(1)

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-400">
                        Evaluator Portal
                    </h1>
                    <p className="text-gray-400 mt-2 text-sm md:text-base">
                        Welcome{evaluator ? `, ${evaluator.name}` : ''}. Score teams based on the 6-point rubric. Select a team to expand and submit your evaluation.
                    </p>
                </div>

                {!settings?.evaluation_open && (
                    <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>The evaluation period is currently <strong>closed</strong>. You can view teams but cannot submit scores.</span>
                    </div>
                )}

                <div className="border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
                    <EvaluatorDashboardClient initialTeams={initialTeams} evaluationOpen={settings?.evaluation_open ?? false} evaluationRounds={settings?.evaluation_rounds ?? 2} evaluatorToken={token} />
                </div>
            </div>
        </div>
    )
}
