"use client";

import { useState, useRef, useEffect } from "react";
import {
    uploadHackathonData, getHackathonTeams, deleteAllHackathonTeams,
    getEvaluators, addEvaluator, removeEvaluator,
    getHackathonSettings, startTimer, stopTimer, pushAnnouncement, clearAnnouncement,
    getSchedule, addScheduleItem, deleteScheduleItem, updateTeamStatus, toggleEvaluationPeriod,
    getCheckedInParticipantsData, getFoodLogsData
} from "@/lib/actions/hackathon";
import { Upload, FileDown, CheckCircle, AlertCircle, Users, Cpu, Clock, Calendar, Trash2, QrCode, StopCircle, X, Mail, Star, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import EvaluatorDashboardClient from "./evaluate/client";

export default function HackathonAdminPage() {
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [teams, setTeams] = useState<any[]>([]);
    const [evaluators, setEvaluators] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [schedule, setSchedule] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [evalEmail, setEvalEmail] = useState("");
    const [announcement, setAnnouncement] = useState("");
    const [sendingQr, setSendingQr] = useState(false);
    const [deletingTeams, setDeletingTeams] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        const [teamsData, evaluatorsData, settingsData, scheduleData] = await Promise.all([
            getHackathonTeams(),
            getEvaluators(),
            getHackathonSettings(),
            getSchedule()
        ]);
        setTeams(teamsData);
        setEvaluators(evaluatorsData);
        setSettings(settingsData);
        setSchedule(scheduleData);
        setLoading(false);
    }

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage(null);
        setUploading(true);

        const formData = new FormData(e.currentTarget);
        const file = formData.get('file') as File;

        if (!file || file.size === 0) {
            setMessage({ type: 'error', text: 'Please select a valid CSV or XLSX file.' });
            setUploading(false);
            return;
        }

        try {
            const result = await uploadHackathonData(formData);
            if (result.error) {
                setMessage({ type: 'error', text: result.error });
            } else {
                setMessage({ type: 'success', text: result.message || 'Upload successful!' });
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                loadData();
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'An unexpected error occurred.' });
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteAllTeams = async () => {
        if (!confirm("WARNING\n\nThis will permanently delete ALL teams, evaluations, and participants from this hackathon. This cannot be undone.\n\nAre you absolutely sure you want to proceed?")) return;

        setDeletingTeams(true);
        setMessage(null);

        try {
            const res = await deleteAllHackathonTeams();
            if (res.error) {
                setMessage({ type: 'error', text: res.error });
            } else {
                setMessage({ type: 'success', text: "All teams have been successfully cleared." });
                loadData();
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || "Failed to delete teams." });
        } finally {
            setDeletingTeams(false);
        }
    };

    const handleAddEvaluator = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!evalEmail) return;

        const res = await addEvaluator(evalEmail);
        if (res.error) {
            setMessage({ type: 'error', text: res.error });
        } else {
            setEvalEmail("");
            setMessage({ type: 'success', text: "Evaluator added successfully." });
            loadData();
        }
    };

    const handleRemoveEvaluator = async (id: string) => {
        await removeEvaluator(id);
        loadData();
    };

    const handleStartTimer = async () => {
        if (!confirm("Are you sure you want to start the 24-hour timer? This will be visible on the public dashboard.")) return;
        const res = await startTimer(24);
        if (res.error) {
            setMessage({ type: 'error', text: res.error });
        } else {
            setMessage({ type: 'success', text: "Timer started successfully!" });
            loadData();
        }
    };

    const handleStopTimer = async () => {
        if (!confirm("Are you sure you want to stop the timer?")) return;
        const res = await stopTimer();
        if (res.error) {
            setMessage({ type: 'error', text: res.error });
        } else {
            setMessage({ type: 'success', text: "Timer stopped." });
            loadData();
        }
    };

    const handleClearAnnouncement = async () => {
        const res = await clearAnnouncement();
        if (res.error) {
            setMessage({ type: 'error', text: res.error });
        } else {
            setMessage({ type: 'success', text: "Announcement cleared." });
            loadData();
        }
    };

    const handleDeleteScheduleItem = async (id: string) => {
        if (!confirm("Delete this schedule item?")) return;
        const res = await deleteScheduleItem(id);
        if (res.error) {
            setMessage({ type: 'error', text: res.error });
        } else {
            setMessage({ type: 'success', text: "Schedule item deleted." });
            loadData();
        }
    };

    const handlePushAnnouncement = async () => {
        if (!announcement) return;
        const res = await pushAnnouncement(announcement);
        if (res.error) {
            setMessage({ type: 'error', text: res.error });
        } else {
            setMessage({ type: 'success', text: "Announcement pushed to live dashboard." });
            setAnnouncement("");
            loadData();
        }
    };

    const handleToggleEvaluationPeriod = async () => {
        const newState = !settings?.evaluation_open;
        if (!confirm(`Are you sure you want to ${newState ? 'OPEN' : 'CLOSE'} the evaluation period?`)) return;

        const res = await toggleEvaluationPeriod(newState);
        if (res.error) {
            setMessage({ type: 'error', text: res.error });
        } else {
            setMessage({ type: 'success', text: `Evaluation period ${newState ? 'OPENED' : 'CLOSED'}.` });
            loadData();
        }
    };

    const handleAddSchedule = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = {
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            start_time: new Date(formData.get('start_time') as string).toISOString(),
            end_time: formData.get('end_time') ? new Date(formData.get('end_time') as string).toISOString() : undefined,
            event_type: formData.get('event_type') as string,
        };

        const res = await addScheduleItem(data);
        if (res.error) {
            setMessage({ type: 'error', text: res.error });
        } else {
            setMessage({ type: 'success', text: "Schedule item added." });
            (e.target as HTMLFormElement).reset();
            loadData();
        }
    }
    const handleToggleShortlist = async (teamId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'shortlisted' ? 'evaluating' : 'shortlisted';
        const res = await updateTeamStatus(teamId, newStatus);
        if (res.error) {
            setMessage({ type: 'error', text: res.error });
        } else {
            loadData();
        }
    };

    const downloadCSV = (data: any[], filename: string) => {
        if (!data || data.length === 0) {
            setMessage({ type: 'error', text: 'No data to download.' });
            return;
        }
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    };

    const handleDownloadCheckIn = async () => {
        const result = await getCheckedInParticipantsData();
        if (result.error) {
            setMessage({ type: 'error', text: result.error });
        } else {
            downloadCSV(result.data, `checkin_data_${new Date().toISOString().split('T')[0]}.csv`);
        }
    };

    const handleDownloadFoodLogs = async () => {
        const result = await getFoodLogsData();
        if (result.error) {
            setMessage({ type: 'error', text: result.error });
        } else {
            downloadCSV(result.data, `food_logs_${new Date().toISOString().split('T')[0]}.csv`);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
            <div className="flex flex-col gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
                        Hackathon Management
                    </h1>
                    <p className="text-gray-400 mt-1 md:mt-2 text-sm md:text-base">Manage teams, evaluators, logistics, and the 24hr live timer.</p>
                </div>

                <div className="flex gap-3 flex-wrap">
                    <Link
                        href="/admin/hackathon/scan"
                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-medium transition-colors w-fit shadow-xl text-sm md:text-base"
                    >
                        <QrCode className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" /> Logistics Scanner
                    </Link>
                    <button
                        onClick={handleDownloadCheckIn}
                        className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/20 text-blue-400 px-4 py-2.5 rounded-xl font-medium transition-colors text-sm"
                    >
                        <Download className="w-4 h-4" /> Check-in Data
                    </button>
                    <button
                        onClick={handleDownloadFoodLogs}
                        className="flex items-center gap-2 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/20 text-orange-400 px-4 py-2.5 rounded-xl font-medium transition-colors text-sm"
                    >
                        <Download className="w-4 h-4" /> Food Logs
                    </button>
                </div>
            </div>

            <Tabs defaultValue="teams" className="w-full">
                {message && (
                    <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${message.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
                        {message.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
                        <p className="text-sm">{message.text}</p>
                    </div>
                )}
                <TabsList className="bg-white/[0.03] border border-white/10 p-1 rounded-xl mb-6 md:mb-8 flex overflow-x-auto h-auto gap-1 md:gap-2">
                    <TabsTrigger value="teams" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 rounded-lg px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-base whitespace-nowrap">
                        <Users className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" /> Teams & Import
                    </TabsTrigger>
                    <TabsTrigger value="evaluators" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 rounded-lg px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-base whitespace-nowrap">
                        <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" /> Evaluators & Grading
                    </TabsTrigger>
                    <TabsTrigger value="timer" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 rounded-lg px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-base whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" /> Timer & Live
                    </TabsTrigger>
                    <TabsTrigger value="schedule" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400 rounded-lg px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-base whitespace-nowrap">
                        <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" /> Schedule
                    </TabsTrigger>
                </TabsList>

                {/* Teams & Import Tab */}
                <TabsContent value="teams" className="mt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Upload Section */}
                        <div className="lg:col-span-1 border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 shadow-xl backdrop-blur-xl h-fit w-full">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                                    <Upload className="w-5 h-5" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">Import Data</h2>
                            </div>

                            <p className="text-sm text-gray-400 mb-6">
                                Upload an Excel (.xlsx) or CSV file downloaded from Google Forms. Ensure columns include &apos;Team Name&apos;, &apos;Idea&apos;, &apos;Leader Name&apos;, &apos;Leader Email&apos;, etc.
                            </p>

                            <form onSubmit={handleUpload} className="space-y-4">
                                <div className="w-full overflow-hidden">
                                    <input
                                        type="file"
                                        name="file"
                                        accept=".csv, .xlsx"
                                        className="block w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border file:border-white/10 file:bg-white/5 file:text-white file:font-semibold hover:file:bg-white/10 cursor-pointer"
                                        ref={fileInputRef}
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={uploading || deletingTeams}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                >
                                    {uploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        "Upload & Sync Teams"
                                    )}
                                </button>

                                {teams.length > 0 && (
                                    <div className="pt-4 border-t border-white/10 mt-4">
                                        <button
                                            type="button"
                                            onClick={handleDeleteAllTeams}
                                            disabled={uploading || deletingTeams}
                                            className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-500 font-medium py-2 text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                        >
                                            {deletingTeams ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                                                    Deleting All Teams...
                                                </>
                                            ) : (
                                                <>
                                                    <Trash2 className="w-4 h-4" /> Clear All Teams Data
                                                </>
                                            )}
                                        </button>
                                        <p className="text-xs text-center text-red-400 mt-2">Danger: Deletes all teams & scores.</p>
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Teams List */}
                        <div className="lg:col-span-2 border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-white">Registered Teams</h2>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-sm font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                                        {teams.length} Teams
                                    </div>
                                    {teams.length > 0 && (
                                        <button
                                            onClick={async () => {
                                                if (!confirm(`This will email QR codes to all shortlisted participants. Continue?`)) return;
                                                setSendingQr(true);
                                                setMessage(null);
                                                try {
                                                    const res = await fetch('/api/admin/hackathon-qr-emails', { method: 'POST' });
                                                    const data = await res.json();
                                                    if (data.error) {
                                                        setMessage({ type: 'error', text: data.error });
                                                    } else {
                                                        setMessage({ type: 'success', text: `QR codes emailed! ${data.sent} sent, ${data.failed} failed.` });
                                                    }
                                                } catch (err: any) {
                                                    setMessage({ type: 'error', text: err.message || 'Failed to send QR emails.' });
                                                } finally {
                                                    setSendingQr(false);
                                                }
                                            }}
                                            disabled={sendingQr}
                                            className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 px-4 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {sendingQr ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <Mail className="w-3.5 h-3.5" /> Email QR Codes
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                {loading ? (
                                    <div className="text-center py-12">
                                        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                        <p className="text-gray-400">Loading teams...</p>
                                    </div>
                                ) : teams.length === 0 ? (
                                    <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                                        <FileDown className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                                        <p className="text-gray-400">No teams found. Import a file to get started.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        <div className="flex flex-col gap-6">
                                            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center text-center">
                                                <Users className="w-12 h-12 text-gray-500 mb-4 opacity-50" />
                                                <p className="text-gray-400 text-sm max-w-sm">
                                                    Team Details are now managed securely inside the <strong className="text-white">Evaluators & Grading</strong> tab. Here is the imported overview:
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-6 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center text-center">
                                                    <h3 className="text-3xl font-bold text-blue-400 mb-2">{teams.length}</h3>
                                                    <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-wide">Total Teams</p>
                                                </div>
                                                <div className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col items-center justify-center text-center">
                                                    <h3 className="text-3xl font-bold text-amber-400 mb-2">{teams.filter(t => t.status === 'pending').length}</h3>
                                                    <p className="text-xs font-semibold text-amber-400/80 uppercase tracking-wide">Pending</p>
                                                </div>
                                                <div className="p-6 rounded-xl bg-purple-500/10 border border-purple-500/20 flex flex-col items-center justify-center text-center">
                                                    <h3 className="text-3xl font-bold text-purple-400 mb-2">{teams.filter(t => t.status === 'evaluating').length}</h3>
                                                    <p className="text-xs font-semibold text-purple-400/80 uppercase tracking-wide">Evaluating</p>
                                                </div>
                                                <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center text-center">
                                                    <h3 className="text-3xl font-bold text-emerald-400 mb-2">{teams.filter(t => t.status === 'shortlisted').length}</h3>
                                                    <p className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wide">Shortlisted</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Final Evaluation Results Table */}
                                        <div className="mt-8">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                                    <Star className="w-5 h-5 text-amber-500" />
                                                    Final Evaluation Results
                                                </h3>
                                                <div className="text-sm text-gray-400">
                                                    Sorted by Highest Score
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 shadow-2xl">
                                                <table className="w-full text-sm text-left text-gray-400">
                                                    <thead className="text-xs text-gray-400 uppercase bg-black/40 border-b border-white/10">
                                                        <tr>
                                                            <th className="px-4 py-4 font-semibold">Rank</th>
                                                            <th className="px-4 py-4 font-semibold">Team Name</th>
                                                            <th className="px-4 py-4 font-semibold">Project Title</th>
                                                            <th className="px-4 py-4 font-semibold text-center">Round 1 Score</th>
                                                            <th className="px-4 py-4 font-semibold text-center">Round 2 Score</th>
                                                            <th className="px-4 py-4 font-semibold text-center">Final Score</th>
                                                            <th className="px-4 py-4 font-semibold">Status</th>
                                                            <th className="px-4 py-4 font-semibold text-right">Shortlist Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[...teams].sort((a, b) => {
                                                            const getAvg = (t: any) => {
                                                                const evals = t.hackathon_evaluations || [];
                                                                const r1 = evals.filter((e: any) => e.evaluation_round === 1);
                                                                const r2 = evals.filter((e: any) => e.evaluation_round === 2);
                                                                const r1Avg = r1.length ? r1.reduce((sum: number, e: any) => sum + Number(e.total_score), 0) / r1.length : 0;
                                                                const r2Avg = r2.length ? r2.reduce((sum: number, e: any) => sum + Number(e.total_score), 0) / r2.length : 0;
                                                                return r1Avg + r2Avg;
                                                            };
                                                            return getAvg(b) - getAvg(a);
                                                        }).map((team, index) => (
                                                            <tr key={team.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                                <td className="px-4 py-4">
                                                                    <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${index === 0 ? 'bg-amber-500/20 text-amber-500' : index === 1 ? 'bg-gray-300/20 text-gray-300' : index === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-white/5 text-gray-400'}`}>
                                                                        {index + 1}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-4 font-bold text-white">
                                                                    {team.name}
                                                                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                                                                        <span className="font-mono text-amber-500">{team.team_code}</span>
                                                                        <span>•</span>
                                                                        <span>Leader: {team.hackathon_participants?.find((p: any) => p.role === 'Leader')?.name || 'Unknown'}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-4 font-medium text-emerald-400 max-w-xs truncate" title={team.project_objective}>
                                                                    {team.idea_title}
                                                                </td>
                                                                <td className="px-4 py-4 font-mono text-center">
                                                                    {(() => {
                                                                        const r1 = team.hackathon_evaluations?.filter((e: any) => e.evaluation_round === 1) || [];
                                                                        const total = r1.reduce((sum: number, ev: any) => sum + Number(ev.total_score), 0);
                                                                        return <span className={total > 0 ? "text-amber-400 font-bold" : "text-gray-600"} title={r1.length ? `Rated by ${r1.length} evaluator(s)` : ''}>{total > 0 ? (total / r1.length).toFixed(1) : '-'}</span>;
                                                                    })()}
                                                                </td>
                                                                <td className="px-4 py-4 font-mono text-center border-l border-white/5">
                                                                    {(() => {
                                                                        const r2 = team.hackathon_evaluations?.filter((e: any) => e.evaluation_round === 2) || [];
                                                                        const total = r2.reduce((sum: number, ev: any) => sum + Number(ev.total_score), 0);
                                                                        return <span className={total > 0 ? "text-amber-400 font-bold" : "text-gray-600"} title={r2.length ? `Rated by ${r2.length} evaluator(s)` : ''}>{total > 0 ? (total / r2.length).toFixed(1) : '-'}</span>;
                                                                    })()}
                                                                </td>
                                                                <td className="px-4 py-4 font-mono text-center border-l border-white/5">
                                                                    {(() => {
                                                                        const evals = team.hackathon_evaluations || [];
                                                                        const r1 = evals.filter((e: any) => e.evaluation_round === 1);
                                                                        const r2 = evals.filter((e: any) => e.evaluation_round === 2);
                                                                        const r1Avg = r1.length ? r1.reduce((sum: number, ev: any) => sum + Number(ev.total_score), 0) / r1.length : 0;
                                                                        const r2Avg = r2.length ? r2.reduce((sum: number, ev: any) => sum + Number(ev.total_score), 0) / r2.length : 0;
                                                                        const finalScore = r1Avg + r2Avg;
                                                                        return <span className={finalScore > 0 ? "text-emerald-400 font-bold text-base" : "text-gray-600"} title={`R1: ${r1Avg.toFixed(1)} + R2: ${r2Avg.toFixed(1)}`}>{finalScore > 0 ? finalScore.toFixed(1) : '—'}</span>;
                                                                    })()}
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border w-fit ${team.status === 'pending' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                                                                        team.status === 'evaluating' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                                            team.status === 'shortlisted' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                                                'bg-red-500/10 text-red-400 border-red-500/20'
                                                                        }`}>
                                                                        {team.status.toUpperCase()}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-4 text-right">
                                                                    <button
                                                                        onClick={() => handleToggleShortlist(team.id, team.status)}
                                                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${team.status === 'shortlisted'
                                                                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/30'
                                                                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                                                            }`}
                                                                    >
                                                                        {team.status === 'shortlisted' ? 'Remove from Shortlist' : 'Mark as Shortlisted'}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Evaluators Tab */}
                <TabsContent value="evaluators" className="mt-0 space-y-8">
                    {/* Evaluation Period Toggle */}
                    <div className="border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 shadow-xl backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h2 className="text-xl font-bold text-white mb-1">Global Evaluation Period</h2>
                            <p className="text-gray-400 text-sm">When open, evaluators can submit scores. When closed, they can only view final peer-reviewed results.</p>
                        </div>
                        <button
                            onClick={handleToggleEvaluationPeriod}
                            className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${settings?.evaluation_open
                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                                }`}
                        >
                            {settings?.evaluation_open ? 'PERIOD IS OPEN' : 'PERIOD IS CLOSED'}
                        </button>
                    </div>

                    <div className="border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="flex-1 max-w-md">
                                <h2 className="text-xl font-bold text-white mb-2">Evaluator Management</h2>
                                <p className="text-gray-400 text-sm mb-6">Add evaluator emails here so they can securely access the evaluation portal to score teams. They will log in using this email.</p>

                                <form onSubmit={handleAddEvaluator} className="flex gap-3">
                                    <input
                                        type="email"
                                        value={evalEmail}
                                        onChange={(e) => setEvalEmail(e.target.value)}
                                        placeholder="Evaluator Email (e.g. judge@company.com)"
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-amber-500 text-white"
                                        required
                                    />
                                    <button type="submit" className="bg-amber-600 hover:bg-amber-500 px-6 py-2 rounded-xl text-white font-medium transition-colors whitespace-nowrap">
                                        Add
                                    </button>
                                </form>
                                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                    <p className="text-sm text-blue-400 font-medium mb-1">Evaluator Portal Link</p>
                                    <p className="text-xs text-gray-400 mb-2">Share this secure link with your evaluators after adding them:</p>
                                    <div className="flex items-center gap-2 bg-black/50 p-2.5 rounded-lg border border-white/5 overflow-hidden">
                                        <code className="text-xs text-amber-400 select-all flex-1 truncate overflow-hidden break-all">https://www.technovashardauniversity.in/admin/hackathon/evaluate</code>
                                        <Link href="/admin/hackathon/evaluate" target="_blank" className="text-blue-400 hover:text-blue-300 text-xs underline whitespace-nowrap flex-shrink-0">
                                            Open Portal
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 border-l border-white/10 pl-0 md:pl-8">
                                <h3 className="text-lg font-semibold text-white mb-4">Current Evaluators</h3>
                                {evaluators.length === 0 ? (
                                    <p className="text-gray-500 text-sm italic">No evaluators added yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {evaluators.map(ev => (
                                            <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                                                <div>
                                                    <p className="font-medium text-white">{ev.name}</p>
                                                    <p className="text-xs text-gray-400">{ev.email}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveEvaluator(ev.id)}
                                                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                    title="Remove Evaluator"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
                        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
                            <Star className="w-6 h-6 text-amber-500" />
                            <div>
                                <h2 className="text-xl font-bold text-white">Evaluate Teams</h2>
                                <p className="text-sm text-gray-400">Score teams based on the 6-point rubric. You must be added as an evaluator above first.</p>
                            </div>
                        </div>
                        <EvaluatorDashboardClient initialTeams={[]} evaluationOpen={settings?.evaluation_open ?? false} />
                    </div>
                </TabsContent>

                {/* Timer Tab */}
                <TabsContent value="timer" className="mt-0 border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Clock className={`w-16 h-16 mb-4 ${settings?.is_running ? 'text-emerald-500 animate-pulse' : 'text-blue-500/50'}`} />
                        <h2 className="text-2xl font-bold text-white mb-2">Live Timer Controls</h2>
                        <p className="text-gray-400 max-w-md mb-8">Start the 24-hour countdown and push real-time announcements to the public dashboard.</p>

                        <div className="w-full max-w-md space-y-4">
                            {settings?.is_running ? (
                                <div className="space-y-4 w-full mb-6">
                                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                        <p className="font-bold flex justify-center items-center gap-2">
                                            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" /></span> Timer is actively running!
                                        </p>
                                        <p className="text-xs mt-1 text-center">Started at: {new Date(settings.timer_start).toLocaleString()}</p>
                                    </div>
                                    <button
                                        onClick={handleStopTimer}
                                        className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 py-3 rounded-xl text-red-400 font-bold text-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <StopCircle className="w-5 h-5" /> STOP TIMER
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleStartTimer}
                                    className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl text-white font-bold text-lg transition-colors shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                                >
                                    START 24HR TIMER
                                </button>
                            )}

                            <div className="pt-6 border-t border-white/10 text-left">
                                <label className="block text-sm text-gray-400 mb-2">Live Announcement Banner</label>
                                <textarea
                                    value={announcement}
                                    onChange={(e) => setAnnouncement(e.target.value)}
                                    placeholder={settings?.active_announcement || "Type an announcement to display across all screens..."}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:border-blue-500 resize-none h-24 text-white"
                                />
                                <button
                                    onClick={handlePushAnnouncement}
                                    className="w-full bg-white/10 hover:bg-white/20 py-2 rounded-xl text-white mt-2 transition-colors"
                                >
                                    Push Notification
                                </button>
                                {settings?.active_announcement && (
                                    <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                                        <p className="text-xs text-emerald-400 flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> Currently showing: &quot;{settings.active_announcement}&quot;
                                        </p>
                                        <button
                                            onClick={handleClearAnnouncement}
                                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors" title="Clear Announcement"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Schedule Tab */}
                <TabsContent value="schedule" className="mt-0 border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
                    <div className="flex flex-col lg:flex-row gap-8">
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-white mb-2">Event Schedule</h2>
                            <p className="text-gray-400 text-sm mb-6">Manage checkpoints, meal times, and pitch timings for the live dashboard timeline.</p>

                            <form onSubmit={handleAddSchedule} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400">Title</label>
                                        <input type="text" name="title" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400">Type</label>
                                        <select name="event_type" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white [&>option]:bg-zinc-900">
                                            <option value="Activity">Activity</option>
                                            <option value="Meal">Meal</option>
                                            <option value="Evaluation">Evaluation</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400">Start Time</label>
                                        <input type="datetime-local" name="start_time" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400">End Time (Optional)</label>
                                        <input type="datetime-local" name="end_time" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400">Description (Optional)</label>
                                    <input type="text" name="description" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white" />
                                </div>
                                <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 px-6 py-2.5 rounded-xl text-white font-medium transition-colors">
                                    Add Schedule Item
                                </button>
                            </form>
                        </div>

                        <div className="flex-1 lg:border-l border-white/10 lg:pl-8">
                            <h3 className="text-lg font-semibold text-white mb-4">Live Timeline</h3>
                            {schedule.length === 0 ? (
                                <p className="text-gray-500 text-sm italic">No events scheduled.</p>
                            ) : (
                                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                                    {schedule.map(item => (
                                        <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                            <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-zinc-900 bg-purple-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2" />
                                            <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors shadow">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-white text-sm">{item.title}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${item.event_type === 'Meal' ? 'bg-orange-500/20 text-orange-400' :
                                                            item.event_type === 'Evaluation' ? 'bg-blue-500/20 text-blue-400' :
                                                                'bg-gray-500/20 text-gray-400'
                                                            }`}>
                                                            {item.event_type}
                                                        </span>
                                                        <button
                                                            onClick={() => handleDeleteScheduleItem(item.id)}
                                                            className="p-1 rounded-md text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                                            title="Delete event"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <time className="block text-xs font-medium text-emerald-400 mb-2">
                                                    {new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </time>
                                                {item.description && <div className="text-gray-400 text-xs">{item.description}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div >
    );
}
