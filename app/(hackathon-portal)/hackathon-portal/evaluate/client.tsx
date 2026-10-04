"use client";

import { useState, useEffect } from "react";
import { submitEvaluation, getTeamsForEvaluation, requestEvaluationEdit } from "@/lib/actions/hackathon";
import { ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Star, ExternalLink, Play, Cpu, Users, Search, ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";

const CRITERIA = [
    { key: "innovation", label: "Innovation & Creativity", weight: 25, lowLabel: "NOVICE", highLabel: "EXPERT" },
    { key: "feasibility", label: "Technical Implementation", weight: 20, lowLabel: "BUGGY", highLabel: "FLAWLESS" },
    { key: "impact", label: "Practicality & Impact", weight: 20, lowLabel: "LOW", highLabel: "HIGH" },
    { key: "ux", label: "Presentation & Demo", weight: 15, lowLabel: "POOR", highLabel: "STUNNING" },
    { key: "presentation", label: "Teamwork & Collaboration", weight: 20, lowLabel: "SOLO", highLabel: "UNIFIED" },
];

export default function PortalEvaluatorClient({ initialTeams, evaluationOpen = true, evaluationRounds = 2, evaluatorToken }: { initialTeams: any[], evaluationOpen?: boolean, evaluationRounds?: number, evaluatorToken?: string }) {
    const [round, setRound] = useState(1);
    const [teams, setTeams] = useState<any[]>(initialTeams || []);
    const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
    const [scores, setScores] = useState({ innovation: 5, feasibility: 5, impact: 5, ux: 5, presentation: 5, feedback: "" });
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [loadingTeams, setLoadingTeams] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTrack, setFilterTrack] = useState('all');

    useEffect(() => {
        if (round !== 1 || !initialTeams) {
            setLoadingTeams(true);
            getTeamsForEvaluation(round).then(t => { setTeams(t); setCurrentTeamIndex(0); }).finally(() => setLoadingTeams(false));
        }
    }, [round, initialTeams]);

    const allTracks = [...new Set(teams.map((t: any) => t.theme).filter(Boolean))];
    const filteredTeams = teams.filter((t: any) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q || t.name?.toLowerCase().includes(q) || t.idea_title?.toLowerCase().includes(q) || t.team_code?.toLowerCase().includes(q) || t.hackathon_participants?.some((p: any) => p.name?.toLowerCase().includes(q));
        const matchesTrack = filterTrack === 'all' || t.theme === filterTrack;
        return matchesSearch && matchesTrack;
    });
    const team = filteredTeams[currentTeamIndex];
    const leader = team?.hackathon_participants?.find((p: any) => p.role?.toLowerCase() === 'leader') || team?.hackathon_participants?.[0] || {};
    const members = team?.hackathon_participants || [];

    useEffect(() => {
        if (team?.my_eval_details) {
            setScores({
                innovation: team.my_eval_details.innovation ?? 5,
                feasibility: team.my_eval_details.feasibility ?? 5,
                impact: team.my_eval_details.impact ?? 5,
                ux: team.my_eval_details.ux ?? 5,
                presentation: team.my_eval_details.presentation ?? 5,
                feedback: team.my_eval_details.feedback || ""
            });
        } else {
            setScores({ innovation: 5, feasibility: 5, impact: 5, ux: 5, presentation: 5, feedback: "" });
        }
        setMessage(null);
    }, [currentTeamIndex, team?.id]);

    const totalScore = ((Number(scores.innovation) * 2.5) + (Number(scores.feasibility) * 2) + (Number(scores.impact) * 2) + (Number(scores.ux) * 1.5) + (Number(scores.presentation) * 2));
    const calculatedRating = (totalScore / 10).toFixed(2);

    const handleSubmit = async () => {
        setSubmitting(true);
        setMessage(null);
        try {
            const res = await submitEvaluation(team.id, round, scores, evaluatorToken);
            if (res.error) {
                setMessage({ type: 'error', text: res.error });
            } else {
                setMessage({ type: 'success', text: "Evaluation submitted!" });
                setTeams(teams.map((t, i) => i === currentTeamIndex ? { ...t, has_evaluated: true, my_score: Math.round(totalScore * 10) / 10 } : t));
            }
        } catch {
            setMessage({ type: 'error', text: "Failed to submit evaluation." });
        }
        setSubmitting(false);
    };

    if (loadingTeams) return (
        <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading teams...</p>
        </div>
    );

    if (!team) return (
        <div className="text-center py-20">
            <Cpu className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No teams assigned for evaluation yet.</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Back Button + Search/Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Link href="/hackathon-portal" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Link>
                <div className="flex-1" />
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentTeamIndex(0); }} placeholder="Search teams..." className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-48 transition-all" />
                    </div>
                    <select value={filterTrack} onChange={e => { setFilterTrack(e.target.value); setCurrentTeamIndex(0); }} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none">
                        <option value="all">All Tracks</option>
                        {allTracks.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>
            {/* Round Selector */}
            {evaluationRounds > 1 && (
                <div className="flex bg-gray-100 rounded-xl p-1 w-full max-w-md mx-auto">
                    {Array.from({ length: evaluationRounds }, (_, i) => i + 1).map(r => (
                        <button key={r} onClick={() => setRound(r)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${round === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            Round {r}
                        </button>
                    ))}
                </div>
            )}

            {/* Main Content: Team Details + Score Card */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Left: Team Details */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        {/* Track Badge */}
                        {team.theme && (
                            <span className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-indigo-100">{team.theme} Track</span>
                        )}
                        {team.team_code && (
                            <span className="inline-block ml-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-mono font-bold border border-gray-200 mb-4">{team.team_code}</span>
                        )}

                        {/* Team Name & Members */}
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-1">{team.name}</h2>
                                <p className="text-gray-500 italic text-sm">&quot;{team.idea_title}&quot;</p>
                            </div>
                            <div className="flex -space-x-2">
                                {members.slice(0, 5).map((m: any, i: number) => (
                                    <div key={i} className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm" title={m.name}>{m.name?.charAt(0)?.toUpperCase() || '?'}</div>
                                ))}
                            </div>
                        </div>

                        {/* Project Abstract */}
                        <div className="mb-6">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Project Abstract</h3>
                            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{team.project_objective || 'No detailed abstract provided by the team.'}</p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            {team.github_url && (
                                <a href={team.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                                    <ExternalLink className="w-4 h-4" /> View GitHub Repository
                                </a>
                            )}
                            {team.demo_url && (
                                <a href={team.demo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                                    <Play className="w-4 h-4" /> Watch Demo Video
                                </a>
                            )}
                        </div>

                        {/* Team Info */}
                        <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                <Users className="w-4 h-4 flex-shrink-0" />
                                <span><strong className="text-gray-700">Team Lead:</strong> {leader.name || '—'}</span>
                                {leader.email && <span>• {leader.email}</span>}
                                {leader.college && <span>• <strong className="text-gray-600">{leader.college}</strong></span>}
                            </div>
                            {members.filter((m: any) => m.role !== 'leader' && m.role !== 'Leader').length > 0 && (
                                <div className="ml-7 space-y-1">
                                    {members.filter((m: any) => m.role !== 'leader' && m.role !== 'Leader').map((m: any, i: number) => (
                                        <p key={i} className="text-sm text-gray-500">
                                            {m.name || 'Unknown'}{m.college && <span className="text-gray-400"> — {m.college}</span>}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-6 py-4 shadow-sm">
                        <button onClick={() => setCurrentTeamIndex(i => Math.max(0, i - 1))} disabled={currentTeamIndex === 0}
                            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30 transition-colors">
                            <ChevronLeft className="w-4 h-4" /> Previous Team
                        </button>
                        <div className="text-center">
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Evaluation Progress</p>
                            <p className="text-sm font-bold text-gray-900">Team {currentTeamIndex + 1} of {filteredTeams.length}</p>
                        </div>
                        <button onClick={() => setCurrentTeamIndex(i => Math.min(filteredTeams.length - 1, i + 1))} disabled={currentTeamIndex === filteredTeams.length - 1}
                            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30 transition-colors">
                            Next Team <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Right: Score Card */}
                <div className="lg:col-span-2">
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm sticky top-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-gray-900">Score Card</h3>
                            {team.has_evaluated && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                        </div>

                        {!evaluationOpen ? (
                            <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                                <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm">Evaluation period is closed.</p>
                                {team.my_score && <p className="text-lg font-bold text-gray-900 mt-2">Your score: {team.my_score}/100</p>}
                            </div>
                        ) : team.has_evaluated ? (
                            <div className="text-center py-8">
                                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                                <h4 className="text-lg font-bold text-gray-900 mb-1">Evaluation Submitted</h4>
                                <p className="text-gray-500 text-sm mb-4">Score: <span className="text-emerald-600 font-bold">{team.my_score}</span>/100</p>
                                {team.edit_requested ? (
                                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium border border-amber-200">
                                        <AlertCircle className="w-4 h-4" /> Edit Request Pending
                                    </span>
                                ) : (
                                    <button onClick={async () => {
                                        if (!window.confirm("Request score edit? An admin must approve.")) return;
                                        setSubmitting(true);
                                        const res = await requestEvaluationEdit(team.id, round, evaluatorToken);
                                        if (res.success) setTeams(teams.map((t, i) => i === currentTeamIndex ? { ...t, edit_requested: true } : t));
                                        else setMessage({ type: 'error', text: res.error || "Failed" });
                                        setSubmitting(false);
                                    }} disabled={submitting} className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors">
                                        Request Score Edit
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="space-y-5">
                                    {CRITERIA.map(c => {
                                        const val = Number((scores as any)[c.key]) || 0;
                                        return (
                                            <div key={c.key} className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-sm font-bold text-gray-900">{c.label}</span>
                                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 uppercase tracking-widest">Weight: {c.weight}%</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1">
                                                            <input
                                                                type="range" min="0" max="10" step="0.5" value={val}
                                                                onChange={e => setScores({ ...scores, [c.key]: parseFloat(e.target.value) })}
                                                                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer"
                                                                style={{ background: `linear-gradient(to right, #4f46e5 ${val * 10}%, #e5e7eb ${val * 10}%)` }}
                                                            />
                                                            <div className="flex justify-between mt-1">
                                                                <span className="text-[10px] text-gray-400 font-bold uppercase">{c.lowLabel}</span>
                                                                <span className="text-[10px] text-gray-400 font-bold uppercase">{c.highLabel}</span>
                                                            </div>
                                                        </div>
                                                        <input
                                                            type="number" min="0" max="10" step="0.5"
                                                            value={val}
                                                            onChange={e => {
                                                                const v = parseFloat(e.target.value);
                                                                if (!isNaN(v) && v >= 0 && v <= 10) setScores({ ...scores, [c.key]: v });
                                                                else if (e.target.value === '') setScores({ ...scores, [c.key]: 0 });
                                                            }}
                                                            className="w-16 h-10 text-center font-bold text-lg text-indigo-700 bg-white border border-indigo-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                                                        />
                                                    </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Feedback */}
                                <textarea
                                    value={scores.feedback}
                                    onChange={e => setScores({ ...scores, feedback: e.target.value })}
                                    placeholder="Optional feedback..."
                                    rows={2}
                                    className="w-full mt-5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none placeholder-gray-400 transition-all"
                                />

                                {/* Calculated Rating */}
                                <div className="mt-5 pt-5 border-t border-gray-100">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Calculated Rating</p>
                                    <div className="flex items-end gap-1">
                                        <span className="text-4xl font-black text-gray-900">{calculatedRating}</span>
                                        <span className="text-lg text-gray-400 mb-1">/10</span>
                                        {parseFloat(calculatedRating) >= 7 && <CheckCircle className="w-6 h-6 text-emerald-500 ml-2 mb-1" />}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Total weighted score: <span className="font-bold text-gray-600">{totalScore.toFixed(2)}</span>/100</p>
                                </div>

                                {/* Submit / Request Edit */}
                                {team.has_evaluated && team.edit_requested ? (
                                    <>
                                        <button disabled className="w-full mt-5 bg-gray-300 text-gray-500 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm cursor-not-allowed">
                                            <Clock className="w-4 h-4" /> Edit Requested — Waiting for Approval
                                        </button>
                                        <p className="text-center text-xs text-amber-500 mt-2 font-medium">You have requested an edit. Please wait for admin approval.</p>
                                    </>
                                ) : team.has_evaluated ? (
                                    <>
                                        <button onClick={async () => {
                                            setSubmitting(true);
                                            setMessage(null);
                                            try {
                                                const res = await requestEvaluationEdit(team.id, round);
                                                if (res.error) {
                                                    setMessage({ type: 'error', text: res.error });
                                                } else {
                                                    setMessage({ type: 'success', text: 'Edit request sent to admin. You will be notified when approved.' });
                                                    setTeams(teams.map((t: any, i: number) => i === currentTeamIndex ? { ...t, edit_requested: true } : t));
                                                }
                                            } catch {
                                                setMessage({ type: 'error', text: 'Failed to request edit.' });
                                            }
                                            setSubmitting(false);
                                        }} disabled={submitting}
                                            className="w-full mt-5 bg-amber-500 hover:bg-amber-400 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-amber-500/20">
                                            {submitting ? (
                                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Requesting...</>
                                            ) : (
                                                <><AlertCircle className="w-4 h-4" /> Request Edit</>
                                            )}
                                        </button>
                                        <p className="text-center text-xs text-gray-400 mt-2">Your score is locked. Request admin approval to make changes.</p>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={handleSubmit} disabled={submitting}
                                            className="w-full mt-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-500/20">
                                            {submitting ? (
                                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                                            ) : (
                                                <><Play className="w-4 h-4 fill-current" /> Submit Evaluation</>
                                            )}
                                        </button>
                                        <button onClick={() => setMessage({ type: 'success', text: 'Draft saved locally.' })} className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors py-2">
                                            Save Draft
                                        </button>
                                    </>
                                )}
                            </>
                        )}

                        {message && (
                            <div className={`mt-4 p-3 rounded-xl flex items-start gap-2 text-sm ${message.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                                {message.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                                {message.text}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
