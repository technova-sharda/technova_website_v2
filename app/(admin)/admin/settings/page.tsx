import { addSponsorship, getSponsorships, deleteSponsorship } from "@/lib/actions/sponsorships";
import { Trash2, IndianRupee, Settings, Plus, Building2, Calendar, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PageHeader } from "@/components/admin/ui"

export default async function SettingsPage() {
    const sponsorships = await getSponsorships();

    // Calculate totals
    const totalIncome = sponsorships.filter(s => s.amount > 0).reduce((sum, s) => sum + s.amount, 0);
    const totalDeductions = sponsorships.filter(s => s.amount < 0).reduce((sum, s) => sum + Math.abs(s.amount), 0);
    const netBalance = totalIncome - totalDeductions;

    return (
        <div>
            <div className="space-y-6 max-w-5xl">
                <PageHeader icon={Settings} title="Settings & finances" tone="blue" description="Sponsorships and expenses." />

                {/* Financial Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Total Income */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-green-600/20 to-green-500/10 border border-green-500/30">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-green-600/30 flex items-center justify-center">
                                <TrendingUp className="w-7 h-7 text-green-400" />
                            </div>
                            <div>
                                <p className="text-green-400/80 text-sm font-medium">Total Income</p>
                                <p className="text-3xl font-bold text-white">₹{totalIncome.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Total Deductions */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-red-600/20 to-red-500/10 border border-red-500/30">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-red-600/30 flex items-center justify-center">
                                <TrendingDown className="w-7 h-7 text-red-400" />
                            </div>
                            <div>
                                <p className="text-red-400/80 text-sm font-medium">Total Expenses</p>
                                <p className="text-3xl font-bold text-white">₹{totalDeductions.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Net Balance */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-600/20 to-blue-500/10 border border-blue-500/30">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-blue-600/30 flex items-center justify-center">
                                <IndianRupee className="w-7 h-7 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-blue-400/80 text-sm font-medium">Net Balance</p>
                                <p className={`text-3xl font-bold ${netBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                                    ₹{netBalance.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Add Income / Expense */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Add Income */}
                    <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-green-400" />
                            Add Sponsorship / Income
                        </h2>
                        <form action={addSponsorship} className="space-y-4">
                            <input type="hidden" name="type" value="income" />
                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">Source / Company</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        name="source"
                                        required
                                        type="text"
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 pl-10 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500/50 transition-all"
                                        placeholder="e.g. OpenAI"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">Amount (₹)</label>
                                    <input
                                        name="amount"
                                        required
                                        type="number"
                                        min="1"
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500/50 transition-all"
                                        placeholder="10000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">Date</label>
                                    <input
                                        name="date"
                                        type="date"
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500/50 transition-all"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(34,197,94,0.2)] hover:shadow-[0_0_30px_rgba(34,197,94,0.4)]"
                            >
                                <Plus className="w-4 h-4 inline-block mr-2" />
                                Add Income
                            </button>
                        </form>
                    </div>

                    {/* Add Deduction */}
                    <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Minus className="w-5 h-5 text-red-400" />
                            Add Expense / Deduction
                        </h2>
                        <form action={async (formData: FormData) => {
                            "use server"
                            // Convert to negative for deduction
                            const amount = parseFloat(formData.get("amount") as string)
                            formData.set("amount", (-Math.abs(amount)).toString())
                            await addSponsorship(formData)
                        }} className="space-y-4">
                            <input type="hidden" name="type" value="expense" />
                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">Description</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        name="source"
                                        required
                                        type="text"
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 pl-10 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/50 transition-all"
                                        placeholder="e.g. Event Venue Booking"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">Amount (₹)</label>
                                    <input
                                        name="amount"
                                        required
                                        type="number"
                                        min="1"
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/50 transition-all"
                                        placeholder="5000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">Date</label>
                                    <input
                                        name="date"
                                        type="date"
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/50 transition-all"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:shadow-[0_0_30px_rgba(239,68,68,0.4)]"
                            >
                                <Minus className="w-4 h-4 inline-block mr-2" />
                                Add Expense
                            </button>
                        </form>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl overflow-hidden">
                    <div className="p-6 border-b border-white/10">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-400" />
                            Transaction History
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 border-b border-white/10">
                                <tr>
                                    <th className="px-6 py-4 font-medium text-gray-400 text-sm uppercase tracking-wide">Type</th>
                                    <th className="px-6 py-4 font-medium text-gray-400 text-sm uppercase tracking-wide">Description</th>
                                    <th className="px-6 py-4 font-medium text-gray-400 text-sm uppercase tracking-wide">Date</th>
                                    <th className="px-6 py-4 font-medium text-gray-400 text-sm uppercase tracking-wide">Amount</th>
                                    <th className="px-6 py-4 font-medium text-gray-400 text-sm uppercase tracking-wide text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {sponsorships.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <IndianRupee className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                            <p className="text-gray-400">No transactions recorded yet</p>
                                        </td>
                                    </tr>
                                ) : (
                                    sponsorships.map((s) => (
                                        <tr key={s.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4">
                                                {s.amount >= 0 ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                                                        <TrendingUp className="w-3 h-3" /> Income
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                                                        <TrendingDown className="w-3 h-3" /> Expense
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-medium text-white">{s.source}</span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-400">
                                                {new Date(s.received_at).toLocaleDateString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`font-medium ${s.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {s.amount >= 0 ? '+' : ''}₹{s.amount.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <form action={async () => {
                                                    "use server";
                                                    await deleteSponsorship(s.id);
                                                }}>
                                                    <button
                                                        type="submit"
                                                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </form>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
