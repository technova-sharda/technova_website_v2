'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Search, Save, CheckCircle2, AlertTriangle, Users, Edit3, Mail, ChevronRight, Loader2, Shield, Eye, GraduationCap, Phone, MapPin, CalendarDays, BedDouble, Star } from 'lucide-react'
import Link from 'next/link'

interface Member {
    id: string
    name: string
    email: string
    phone: string | null
    role: string
    college: string | null
    course: string | null
    section: string | null
    system_id: string | null
    year: string | null
}

interface TeamData {
    id: string
    name: string
    team_code: string
    idea_title: string
    theme: string | null
    project_objective: string | null
    status: string
    table_number: number | null
    mentor_name: string | null
    student_coordinator: string | null
    coordinator_phone: string | null
    need_accommodation: boolean
    accommodation_boys: number
    accommodation_girls: number
    sex_ratio: string | null
    arrival_date: string | null
    departure_date: string | null
}

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

export default function TeamUpdatePage() {
    const [step, setStep] = useState<'lookup' | 'view' | 'edit' | 'success'>('lookup')
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [team, setTeam] = useState<TeamData | null>(null)
    const [members, setMembers] = useState<Member[]>([])
    const [leaderId, setLeaderId] = useState<string | null>(null)
    const [isLeader, setIsLeader] = useState(true)
    const [saving, setSaving] = useState(false)
    const [changes, setChanges] = useState<string[]>([])

    // Editable fields
    const [ideaTitle, setIdeaTitle] = useState('')
    const [projectObjective, setProjectObjective] = useState('')
    const [theme, setTheme] = useState('')
    const [mentorName, setMentorName] = useState('')
    const [needAccommodation, setNeedAccommodation] = useState(false)
    const [accommodationBoys, setAccommodationBoys] = useState(0)
    const [accommodationGirls, setAccommodationGirls] = useState(0)
    const [arrivalDate, setArrivalDate] = useState('')
    const [departureDate, setDepartureDate] = useState('')
    const [editableMembers, setEditableMembers] = useState<Member[]>([])

    const handleLookup = async () => {
        if (!email.trim()) {
            setError('Please enter your registered email')
            return
        }
        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/team-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'lookup', email: email.trim() }),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Something went wrong')
                setLoading(false)
                return
            }

            setTeam(data.team)
            setMembers(data.members)
            setLeaderId(data.leaderId)
            setIsLeader(data.isLeader !== false)
            setIdeaTitle(data.team.idea_title || '')
            setProjectObjective(data.team.project_objective || '')
            setTheme(data.team.theme || '')
            setMentorName(data.team.mentor_name || '')
            setNeedAccommodation(data.team.need_accommodation || false)
            setAccommodationBoys(data.team.accommodation_boys || 0)
            setAccommodationGirls(data.team.accommodation_girls || 0)
            setArrivalDate(data.team.arrival_date || '')
            setDepartureDate(data.team.departure_date || '')
            setEditableMembers(data.members.map((m: Member) => ({ ...m })))
            setStep('view')
        } catch {
            setError('Network error. Please try again.')
        }
        setLoading(false)
    }

    const handleSave = async () => {
        if (!team) return
        if (!isLeader) {
            setError('Only the team leader can save changes. Please ask your team leader to update.')
            return
        }
        setSaving(true)
        setError(null)

        try {
            const updates: any = {}
            
            if (ideaTitle !== (team.idea_title || '')) updates.idea_title = ideaTitle
            if (projectObjective !== (team.project_objective || '')) updates.project_objective = projectObjective
            if (theme !== (team.theme || '')) updates.theme = theme
            if (mentorName !== (team.mentor_name || '')) updates.mentor_name = mentorName
            if (needAccommodation !== (team.need_accommodation || false)) updates.need_accommodation = needAccommodation
            if (needAccommodation) {
                if (accommodationBoys !== (team.accommodation_boys || 0)) updates.accommodation_boys = accommodationBoys
                if (accommodationGirls !== (team.accommodation_girls || 0)) updates.accommodation_girls = accommodationGirls
                if (arrivalDate !== (team.arrival_date || '')) updates.arrival_date = arrivalDate
                if (departureDate !== (team.departure_date || '')) updates.departure_date = departureDate
            } else {
                // If toggling off, clear the fields
                if (team.need_accommodation) {
                    updates.accommodation_boys = 0
                    updates.accommodation_girls = 0
                    updates.arrival_date = ''
                    updates.departure_date = ''
                }
            }

            // Check member changes
            const memberUpdates = editableMembers
                .map((em, idx) => {
                    const orig = members[idx]
                    if (!orig) return null
                    const changes: any = { id: em.id }
                    if (em.name !== orig.name) changes.name = em.name
                    if (em.email !== orig.email) changes.email = em.email
                    if (em.phone !== orig.phone) changes.phone = em.phone
                    if (em.college !== orig.college) changes.college = em.college
                    if (em.course !== orig.course) changes.course = em.course
                    if (em.section !== orig.section) changes.section = em.section
                    if (em.system_id !== orig.system_id) changes.system_id = em.system_id
                    if (em.year !== orig.year) changes.year = em.year
                    return Object.keys(changes).length > 1 ? changes : null
                })
                .filter(Boolean)

            if (memberUpdates.length > 0) {
                updates.members = memberUpdates
            }

            if (Object.keys(updates).length === 0) {
                setError('No changes detected')
                setSaving(false)
                return
            }

            const res = await fetch('/api/team-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update',
                    email: email.trim(),
                    teamId: team.id,
                    updates,
                }),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Failed to update')
                setSaving(false)
                return
            }

            setChanges(data.changes || [])
            setStep('success')
        } catch {
            setError('Network error. Please try again.')
        }
        setSaving(false)
    }

    const updateMember = (idx: number, field: keyof Member, value: string) => {
        setEditableMembers(prev => {
            const next = [...prev]
            next[idx] = { ...next[idx], [field]: value }
            return next
        })
    }

    // Find leader for display
    const leader = members.find(m => m.role?.toLowerCase() === 'leader') || members[0]

    return (
        <div className="min-h-screen bg-[#03030F] text-white font-mono">
            {/* Header */}
            <div className="border-b border-white/10 bg-black/50">
                <div className="container mx-auto max-w-[800px] px-6 py-6 flex items-center gap-4">
                    <Link href="/hackathon" className="text-white/40 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-heading font-black uppercase tracking-tight flex items-center gap-2">
                            <Edit3 className="w-5 h-5 text-[#FF6B00]" />
                            Team Details
                        </h1>
                        <p className="text-[10px] text-white/40 tracking-widest uppercase mt-1">
                            Innovate Bharat Hackathon 2026 • By Technova Society
                        </p>
                    </div>
                </div>
            </div>

            <div className="container mx-auto max-w-[800px] px-6 py-10">
                <AnimatePresence mode="wait">
                    {/* STEP 1: LOOKUP */}
                    {step === 'lookup' && (
                        <motion.div
                            key="lookup"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4, ease: EASE_OUT }}
                        >
                            <div className="bg-white/5 border border-white/10 p-8 md:p-12">
                                <div className="text-center mb-8">
                                    <div className="w-16 h-16 mx-auto bg-[#FF6B00]/10 border border-[#FF6B00]/20 rounded-full flex items-center justify-center mb-4">
                                        <Mail className="w-7 h-7 text-[#FF6B00]" />
                                    </div>
                                    <h2 className="text-2xl font-heading font-black uppercase mb-2">Find Your Team</h2>
                                    <p className="text-sm text-white/50 font-sans">
                                        Enter the registered email address to view your team details. Any team member can look up their team.
                                    </p>
                                </div>

                                <div className="max-w-md mx-auto">
                                    <input
                                        type="email"
                                        placeholder="your.email@example.com"
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setError(null) }}
                                        onKeyDown={e => e.key === 'Enter' && handleLookup()}
                                        className="w-full bg-[#03030F] border border-white/20 text-white px-4 py-4 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors placeholder:text-white/30 mb-4"
                                    />

                                    {error && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-center gap-2 text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/20 p-3"
                                        >
                                            <AlertTriangle className="w-4 h-4 shrink-0" />
                                            {error}
                                        </motion.div>
                                    )}

                                    <motion.button
                                        whileTap={{ scale: 0.97 }}
                                        onClick={handleLookup}
                                        disabled={loading}
                                        className="w-full py-4 bg-[#FF6B00] text-black font-black uppercase tracking-wider text-sm hover:bg-[#FF8C00] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                        {loading ? 'Looking up...' : 'Find My Team'}
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* VIEW STATE — Show full team details */}
                    {step === 'view' && team && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                            {/* Team Header Card */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h2 className="text-2xl font-black text-white uppercase">{team.name}</h2>
                                            <span className="text-xs font-mono text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded">{team.team_code}</span>
                                        </div>
                                        <p className="text-white/50 text-sm">{team.idea_title || 'No project title set'}</p>
                                    </div>
                                    {team.theme && (
                                        <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider self-start">{team.theme}</span>
                                    )}
                                </div>

                                {/* Team Info Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                                        <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1">Team Lead</p>
                                        <p className="text-sm text-white font-semibold">{leader?.name || 'N/A'}</p>
                                    </div>
                                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                                        <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1">Contact</p>
                                        <p className="text-sm text-white font-mono">{leader?.phone || 'N/A'}</p>
                                    </div>
                                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                                        <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1">Email</p>
                                        <p className="text-sm text-white font-mono truncate">{leader?.email || 'N/A'}</p>
                                    </div>
                                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                                        <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1">College</p>
                                        <p className="text-sm text-white">{leader?.college || 'N/A'}</p>
                                    </div>
                                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                                        <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1">Coordinator</p>
                                        <p className="text-sm text-white">{team.student_coordinator || 'N/A'}</p>
                                    </div>
                                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                                        <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1">Mentor</p>
                                        <p className="text-sm text-white">{team.mentor_name || 'None'}</p>
                                    </div>
                                </div>

                                {/* Project Objective */}
                                {team.project_objective && (
                                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 mb-6">
                                        <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-2">Project Objective</p>
                                        <p className="text-sm text-white/70 leading-relaxed font-sans">{team.project_objective}</p>
                                    </div>
                                )}

                                {/* Accommodation Info */}
                                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 mb-6">
                                    <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-1"><BedDouble className="w-3 h-3" /> Accommodation</p>
                                    {team.need_accommodation ? (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-[#00FF41] animate-pulse" />
                                                <span className="text-sm text-[#00FF41] font-bold">Accommodation Required</span>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                                                <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2">
                                                    <p className="text-[8px] text-white/30 uppercase font-bold">Boys</p>
                                                    <p className="text-lg font-bold text-blue-400">{team.accommodation_boys || 0}</p>
                                                </div>
                                                <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2">
                                                    <p className="text-[8px] text-white/30 uppercase font-bold">Girls</p>
                                                    <p className="text-lg font-bold text-pink-400">{team.accommodation_girls || 0}</p>
                                                </div>
                                                <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2">
                                                    <p className="text-[8px] text-white/30 uppercase font-bold">Arrival</p>
                                                    <p className="text-xs text-white/60 font-mono">{team.arrival_date || 'Not set'}</p>
                                                </div>
                                                <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2">
                                                    <p className="text-[8px] text-white/30 uppercase font-bold">Departure</p>
                                                    <p className="text-xs text-white/60 font-mono">{team.departure_date || 'Not set'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-white/40">Not required</p>
                                    )}
                                </div>

                                {/* Members List */}
                                <h3 className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Team Members ({members.length})
                                </h3>
                                <div className="space-y-3">
                                    {members.map((m, i) => (
                                        <div key={i} className="flex flex-col md:flex-row md:items-center justify-between bg-white/[0.03] p-4 rounded-xl border border-white/5">
                                            <div>
                                                <div className="font-bold text-white flex items-center gap-2">
                                                    {m.role?.toLowerCase() === 'leader' ? <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> : null}
                                                    {m.name || 'Unnamed Participant'}
                                                    <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${m.role?.toLowerCase() === 'leader' ? 'bg-[#FF6B00]/20 text-[#FF6B00]' : 'bg-white/10 text-white/40'}`}>{m.role}</span>
                                                </div>
                                                {m.email && <div className="text-white/40 mt-0.5 text-xs font-mono">{m.email}</div>}
                                            </div>
                                            <div className="text-white/40 text-left md:text-right mt-2 md:mt-0 text-xs space-y-0.5">
                                                {m.college && <div className="flex items-center gap-1 md:justify-end"><GraduationCap className="w-3 h-3" />{m.college}</div>}
                                                {m.phone && <div className="flex items-center gap-1 md:justify-end"><Phone className="w-3 h-3" />{m.phone}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Edit Button */}
                                <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
                                    <button
                                        onClick={() => setStep('edit')}
                                        className="px-6 py-3 bg-white text-black font-bold uppercase tracking-widest text-sm rounded-xl hover:bg-white/90 transition-all flex items-center gap-2"
                                    >
                                        <Edit3 className="w-4 h-4" /> Update Team Details
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: EDIT */}
                    {step === 'edit' && team && (
                        <motion.div
                            key="edit"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4, ease: EASE_OUT }}
                        >
                            {/* Team header */}
                            <div className="bg-[#FF6B00]/10 border border-[#FF6B00]/20 p-6 mb-6">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h2 className="text-2xl font-heading font-black uppercase text-[#FF6B00]">{team.name}</h2>
                                        <span className="text-xs font-bold text-white/40 tracking-widest">{team.team_code}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {team.table_number && (
                                            <span className="text-sm text-black bg-[#00FF41] font-bold px-3 py-1">
                                                TABLE {team.table_number}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {/* Access Badge */}
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 flex items-center gap-1 ${
                                        isLeader ? 'bg-[#FF6B00]/20 text-[#FF6B00]' : 'bg-white/10 text-white/40'
                                    }`}>
                                        {isLeader ? <><Shield className="w-3 h-3" /> Leader Access</> : <><Eye className="w-3 h-3" /> View Only</>}
                                    </span>
                                </div>
                            </div>

                            {!isLeader && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-2 text-amber-400 text-sm mb-6 bg-amber-500/10 border border-amber-500/20 p-3"
                                >
                                    <Eye className="w-4 h-4 shrink-0" />
                                    You are viewing as a member. Only the team leader can save changes.
                                </motion.div>
                            )}

                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-2 text-red-400 text-sm mb-6 bg-red-500/10 border border-red-500/20 p-3"
                                >
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    {error}
                                </motion.div>
                            )}

                            {/* Team Details */}
                            <div className="bg-white/5 border border-white/10 p-6 mb-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-[#FF6B00] mb-4">Project Details</h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 block">Idea Title</label>
                                        <input
                                            type="text"
                                            value={ideaTitle}
                                            onChange={e => setIdeaTitle(e.target.value)}
                                            disabled={!isLeader}
                                            className="w-full bg-[#03030F] border border-white/10 text-white px-4 py-3 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 block">Theme / Track</label>
                                        <input
                                            type="text"
                                            value={theme}
                                            onChange={e => setTheme(e.target.value)}
                                            disabled={!isLeader}
                                            className="w-full bg-[#03030F] border border-white/10 text-white px-4 py-3 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 block">Project Objective</label>
                                        <textarea
                                            value={projectObjective}
                                            onChange={e => setProjectObjective(e.target.value)}
                                            rows={3}
                                            disabled={!isLeader}
                                            className="w-full bg-[#03030F] border border-white/10 text-white px-4 py-3 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 block">Mentor Name <span className="text-white/20">(if a mentor is accompanying your team)</span></label>
                                        <input
                                            type="text"
                                            value={mentorName}
                                            onChange={e => setMentorName(e.target.value)}
                                            disabled={!isLeader}
                                            placeholder="Leave empty if no mentor"
                                            className="w-full bg-[#03030F] border border-white/10 text-white px-4 py-3 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors placeholder:text-white/20 disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Accommodation */}
                            <div className="bg-white/5 border border-white/10 p-6 mb-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-[#FF6B00] mb-4 flex items-center gap-2">
                                    <BedDouble className="w-4 h-4" /> Accommodation
                                </h3>

                                <div className="space-y-4">
                                    {/* Toggle */}
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={needAccommodation}
                                                onChange={e => setNeedAccommodation(e.target.checked)}
                                                disabled={!isLeader}
                                                className="sr-only"
                                            />
                                            <div className={`w-11 h-6 rounded-full transition-colors ${needAccommodation ? 'bg-[#00FF41]' : 'bg-white/10'}`}>
                                                <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform mt-0.5 ${needAccommodation ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                                            </div>
                                        </div>
                                        <span className="text-sm text-white/70 group-hover:text-white transition-colors">
                                            {needAccommodation ? 'Accommodation is needed' : 'No accommodation needed'}
                                        </span>
                                    </label>

                                    {needAccommodation && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="space-y-4 pt-2"
                                        >
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 block">No. of Boys</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={accommodationBoys}
                                                        onChange={e => setAccommodationBoys(parseInt(e.target.value) || 0)}
                                                        disabled={!isLeader}
                                                        className="w-full bg-[#03030F] border border-white/10 text-blue-400 px-4 py-3 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 block">No. of Girls</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={accommodationGirls}
                                                        onChange={e => setAccommodationGirls(parseInt(e.target.value) || 0)}
                                                        disabled={!isLeader}
                                                        className="w-full bg-[#03030F] border border-white/10 text-pink-400 px-4 py-3 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 block flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Arrival Date & Time</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={arrivalDate}
                                                        onChange={e => setArrivalDate(e.target.value)}
                                                        disabled={!isLeader}
                                                        className="w-full bg-[#03030F] border border-white/10 text-white px-4 py-3 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed [color-scheme:dark]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 block flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Departure Date & Time</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={departureDate}
                                                        onChange={e => setDepartureDate(e.target.value)}
                                                        disabled={!isLeader}
                                                        className="w-full bg-[#03030F] border border-white/10 text-white px-4 py-3 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed [color-scheme:dark]"
                                                    />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </div>

                            {/* Members */}
                            <div className="bg-white/5 border border-white/10 p-6 mb-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-[#FF6B00] mb-4 flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Team Members ({editableMembers.length})
                                </h3>

                                <div className="space-y-6">
                                    {editableMembers.map((member, idx) => (
                                        <div key={member.id} className="border border-white/5 p-4 bg-[#03030F]">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${
                                                    member.role?.toLowerCase() === 'leader' ? 'bg-[#FF6B00] text-black' : 'bg-white/10 text-white/40'
                                                }`}>
                                                    {member.role}
                                                </span>
                                            </div>
                                            <div className="grid md:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-0.5 block">Name</label>
                                                    <input
                                                        type="text"
                                                        value={member.name}
                                                        onChange={e => updateMember(idx, 'name', e.target.value)}
                                                        disabled={!isLeader}
                                                        className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-0.5 block">Email</label>
                                                    <input
                                                        type="email"
                                                        value={member.email}
                                                        onChange={e => updateMember(idx, 'email', e.target.value)}
                                                        disabled={!isLeader}
                                                        className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-0.5 block">Phone</label>
                                                    <input
                                                        type="text"
                                                        value={member.phone || ''}
                                                        onChange={e => updateMember(idx, 'phone', e.target.value)}
                                                        disabled={!isLeader}
                                                        className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-0.5 block">College</label>
                                                    <input
                                                        type="text"
                                                        value={member.college || ''}
                                                        onChange={e => updateMember(idx, 'college', e.target.value)}
                                                        disabled={!isLeader}
                                                        className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-0.5 block">Course <span className="text-[8px] normal-case font-normal text-white/20">(Optional - Sharda Only)</span></label>
                                                    <input
                                                        type="text"
                                                        value={member.course || ''}
                                                        onChange={e => updateMember(idx, 'course', e.target.value)}
                                                        disabled={!isLeader}
                                                        className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-0.5 block">Section <span className="text-[8px] normal-case font-normal text-white/20">(Optional - Sharda Only)</span></label>
                                                    <input
                                                        type="text"
                                                        value={member.section || ''}
                                                        onChange={e => updateMember(idx, 'section', e.target.value)}
                                                        disabled={!isLeader}
                                                        className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-0.5 block">System ID <span className="text-[8px] normal-case font-normal text-white/20">(Optional - Sharda Only)</span></label>
                                                    <input
                                                        type="text"
                                                        value={member.system_id || ''}
                                                        onChange={e => updateMember(idx, 'system_id', e.target.value)}
                                                        disabled={!isLeader}
                                                        className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-0.5 block">Year <span className="text-[8px] normal-case font-normal text-white/20">(Optional - Sharda Only)</span></label>
                                                    <input
                                                        type="text"
                                                        value={member.year || ''}
                                                        onChange={e => updateMember(idx, 'year', e.target.value)}
                                                        disabled={!isLeader}
                                                        className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-[#FF6B00] focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Save Button */}
                            <div className="flex gap-4">
                                <button
                                    onClick={() => { setStep('view'); setError(null) }}
                                    className="px-6 py-4 border border-white/10 text-white/50 font-bold uppercase text-sm tracking-wider hover:border-white/30 transition-colors"
                                >
                                    Back
                                </button>
                                {isLeader ? (
                                    <motion.button
                                        whileTap={{ scale: 0.97 }}
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex-1 py-4 bg-[#00FF41] text-black font-black uppercase tracking-wider text-sm hover:bg-[#33FF66] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {saving ? 'Saving...' : 'Save Changes & Notify Admin'}
                                    </motion.button>
                                ) : (
                                    <div className="flex-1 py-4 bg-white/5 border border-white/10 text-white/30 font-bold uppercase text-sm tracking-wider flex items-center justify-center gap-2 cursor-not-allowed">
                                        <Eye className="w-4 h-4" /> View Only — Ask Leader to Edit
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: SUCCESS */}
                    {step === 'success' && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4, ease: EASE_OUT }}
                        >
                            <div className="bg-[#00FF41]/5 border border-[#00FF41]/20 p-8 md:p-12 text-center">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                                    className="w-20 h-20 mx-auto bg-[#00FF41]/20 rounded-full flex items-center justify-center mb-6"
                                >
                                    <CheckCircle2 className="w-10 h-10 text-[#00FF41]" />
                                </motion.div>
                                <h2 className="text-3xl font-heading font-black uppercase text-[#00FF41] mb-3">Updated!</h2>
                                <p className="text-white/50 font-sans mb-8">
                                    Your team data has been updated and the admin has been notified via email.
                                </p>

                                {changes.length > 0 && (
                                    <div className="bg-[#03030F] border border-white/10 p-4 mb-8 text-left max-w-md mx-auto">
                                        <div className="text-[10px] font-bold text-[#FF6B00] uppercase tracking-widest mb-2">Changes Applied:</div>
                                        <ul className="space-y-1">
                                            {changes.map((c, i) => (
                                                <li key={i} className="text-sm text-white/60 font-mono">• {c}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <Link
                                        href="/hackathon/teams"
                                        className="px-6 py-3 border border-white/10 text-white font-bold uppercase text-sm tracking-wider hover:border-white/30 transition-colors inline-flex items-center justify-center gap-2"
                                    >
                                        View All Teams
                                    </Link>
                                    <Link
                                        href="/hackathon"
                                        className="px-6 py-3 bg-[#FF6B00] text-black font-bold uppercase text-sm tracking-wider hover:bg-[#FF8C00] transition-colors inline-flex items-center justify-center gap-2"
                                    >
                                        Back to Hackathon <ChevronRight className="w-3 h-3" />
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
