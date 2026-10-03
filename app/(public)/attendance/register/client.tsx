"use client";

import { useState } from "react";
import { lookupAttendeeByEmail, updateAttendeeDetails, registerNewAttendee } from "@/lib/actions/hackathon";
import { Search, CheckCircle, AlertCircle, User, Hash, BookOpen, Building, GraduationCap, Phone, Mail, UserPlus } from "lucide-react";

export default function AttendeeRegisterClient() {
    const [mode, setMode] = useState<'lookup' | 'new'>('lookup');
    
    // Shared state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Lookup mode state
    const [emailLookup, setEmailLookup] = useState("");
    const [attendee, setAttendee] = useState<any>(null);

    // New/Update Form fields
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [mobile, setMobile] = useState("");
    const [systemId, setSystemId] = useState("");
    const [section, setSection] = useState("");
    const [department, setDepartment] = useState("");
    const [year, setYear] = useState("");
    const [saving, setSaving] = useState(false);

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); setSuccess(""); setAttendee(null);
        if (!emailLookup.trim()) { setError("Please enter your email."); return; }
        setLoading(true);
        const result = await lookupAttendeeByEmail(emailLookup.trim());
        if (result.error) {
            setError(result.error);
        } else if (result.attendee) {
            setAttendee(result.attendee);
            setSystemId(result.attendee.system_id || "");
            setSection(result.attendee.section || "");
            setDepartment(result.attendee.department || "");
            setYear(result.attendee.year || "");
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!attendee) return;
        if (!systemId.trim() || !section.trim() || !department.trim() || !year) {
            setError("Please fill in all fields.");
            return;
        }
        setSaving(true); setError("");
        const result = await updateAttendeeDetails(attendee.id, {
            system_id: systemId,
            section: section,
            department: department,
            year: year,
            email: attendee.email
        });
        if (result.error) {
            setError(result.error);
        } else {
            setSuccess(result.message || "Details saved!");
            setAttendee({ ...attendee, system_id: systemId, section, department, year });
        }
        setSaving(false);
    };

    const handleRegisterNew = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !email.trim() || !systemId.trim() || !section.trim() || !department.trim() || !year) {
            setError("Please fill in all required fields.");
            return;
        }
        setSaving(true); setError(""); setSuccess("");
        const result = await registerNewAttendee({
            name, email, mobile, system_id: systemId, section, department, year
        });
        
        if (result.error) {
            setError(result.error);
        } else {
            setSuccess(result.message || "Registration successful!");
            // Switch to show their completed profile
            setAttendee(result.attendee);
            setMode('lookup');
        }
        setSaving(false);
    };

    const switchMode = (newMode: 'lookup' | 'new') => {
        setMode(newMode);
        setError(""); setSuccess(""); setAttendee(null);
        // Reset fields when switching
        setName(""); setEmail(""); setMobile(""); setSystemId(""); setSection(""); setDepartment(""); setYear("");
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/20">
                        <User className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-black tracking-tight">{mode === 'lookup' ? 'Complete Your Registration' : 'New Registration'}</h1>
                    <p className="text-gray-400 text-sm mt-2">
                        {mode === 'lookup' ? 'Enter your email to verify your registration, then fill in your academic details.' : 'Register yourself for the event and fill in your details.'}
                    </p>
                </div>

                {/* Mode Toggles */}
                {!attendee && (
                    <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 mb-6">
                        <button
                            onClick={() => switchMode('lookup')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'lookup' ? 'bg-violet-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <Search className="w-4 h-4" /> Find Existing
                        </button>
                        <button
                            onClick={() => switchMode('new')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'new' ? 'bg-violet-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <UserPlus className="w-4 h-4" /> Register New
                        </button>
                    </div>
                )}

                {/* Email Lookup */}
                {mode === 'lookup' && !attendee && (
                    <form onSubmit={handleLookup} className="space-y-4">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Your Email</label>
                                <input
                                    type="email"
                                    value={emailLookup}
                                    onChange={e => setEmailLookup(e.target.value)}
                                    placeholder="your.email@example.com"
                                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 placeholder-gray-600"
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-lg shadow-violet-500/20"
                            >
                                {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Looking up...</> : <><Search className="w-4 h-4" /> Find My Registration</>}
                            </button>
                        </div>
                    </form>
                )}

                {/* Error */}
                {error && (
                    <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                {/* Success */}
                {success && (
                    <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <p className="text-emerald-400 text-sm">{success}</p>
                    </div>
                )}

                {/* New Registration Form */}
                {mode === 'new' && !attendee && (
                    <form onSubmit={handleRegisterNew} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider border-b border-white/10 pb-2 mb-4">Personal Info</p>
                        
                        <div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1.5"><User className="w-3.5 h-3.5" /> Full Name *</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Doe" className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 placeholder-gray-600" required />
                        </div>
                        
                        <div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1.5"><Mail className="w-3.5 h-3.5" /> Email Address *</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. john@example.com" className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 placeholder-gray-600" required />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1.5"><Phone className="w-3.5 h-3.5" /> Mobile Number</label>
                            <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="e.g. 9876543210" className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 placeholder-gray-600" />
                        </div>

                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider border-b border-white/10 pb-2 mb-4 pt-2">Academic Details</p>

                        <div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1.5"><Hash className="w-3.5 h-3.5" /> System ID *</label>
                            <input type="text" inputMode="numeric" pattern="[0-9]*" value={systemId} onChange={e => setSystemId(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 2024012345" className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 placeholder-gray-600" required />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1.5"><Building className="w-3.5 h-3.5" /> Dept *</label>
                                <input type="text" value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. CSE" className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 placeholder-gray-600" required />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1.5"><BookOpen className="w-3.5 h-3.5" /> Section *</label>
                                <select value={section} onChange={e => setSection(e.target.value)} className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 appearance-none" required>
                                    <option value="" disabled>Select</option>
                                    {'ABCDEFGHIJKLMNOPQRS'.split('').map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1.5"><GraduationCap className="w-3.5 h-3.5" /> Year *</label>
                            <select value={year} onChange={e => setYear(e.target.value)} className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 appearance-none" required>
                                <option value="" disabled>Select Year</option>
                                <option value="1st Year">1st Year</option>
                                <option value="2nd Year">2nd Year</option>
                                <option value="3rd Year">3rd Year</option>
                                <option value="4th Year">4th Year</option>
                            </select>
                        </div>

                        <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-lg shadow-violet-500/20 mt-4">
                            {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Registering...</> : <><UserPlus className="w-4 h-4" /> Complete Registration</>}
                        </button>
                    </form>
                )}

                {/* Details Form (Update Mode for Existing Attendee) */}
                {attendee && (
                    <div className="space-y-4">
                        {/* Found info */}
                        <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4 mb-4">
                            <p className="text-xs text-violet-400 font-bold uppercase tracking-wider mb-1">Registration Details</p>
                            <p className="text-lg font-bold text-white">{attendee.name}</p>
                            <p className="text-sm text-gray-400">{attendee.email}</p>
                        </div>

                        {/* Editable fields */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Your Academic Details</p>

                            <div>
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1.5">
                                    <Hash className="w-3.5 h-3.5" /> System ID
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={systemId}
                                    onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setSystemId(v); }}
                                    placeholder="e.g. 2024012345"
                                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 placeholder-gray-600"
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1.5">
                                    <BookOpen className="w-3.5 h-3.5" /> Section
                                </label>
                                <select
                                    value={section}
                                    onChange={e => setSection(e.target.value)}
                                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 appearance-none"
                                >
                                    <option value="" disabled>Select your section</option>
                                    {'ABCDEFGHIJKLMNOPQRS'.split('').map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1.5">
                                    <Building className="w-3.5 h-3.5" /> Department / Course
                                </label>
                                <input
                                    type="text"
                                    value={department}
                                    onChange={e => setDepartment(e.target.value)}
                                    placeholder="e.g. CSE, ECE, MBA"
                                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 placeholder-gray-600"
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1.5">
                                    <GraduationCap className="w-3.5 h-3.5" /> Year
                                </label>
                                <select
                                    value={year}
                                    onChange={e => setYear(e.target.value)}
                                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 appearance-none"
                                >
                                    <option value="" disabled>Select your year</option>
                                    <option value="1st Year">1st Year</option>
                                    <option value="2nd Year">2nd Year</option>
                                    <option value="3rd Year">3rd Year</option>
                                    <option value="4th Year">4th Year</option>
                                </select>
                            </div>

                            <button
                                onClick={handleUpdate}
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-lg shadow-violet-500/20"
                            >
                                {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4" /> Save My Details</>}
                            </button>
                        </div>

                        {/* Go back button */}
                        <button onClick={() => switchMode('lookup')} className="w-full mt-4 text-center text-gray-500 hover:text-white text-sm py-2 transition-colors">
                            ← Return to home
                        </button>
                    </div>
                )}

                {/* Footer */}
                <p className="text-center text-gray-600 text-xs mt-8">&copy; 2026 TechNova | Sharda University</p>
            </div>
        </div>
    );
}
