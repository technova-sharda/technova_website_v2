"use client";

import { useState, useRef, useEffect } from "react";
import {
    uploadHackathonData, getHackathonTeams, deleteAllHackathonTeams,
    getEvaluators, addEvaluator, removeEvaluator,
    getHackathonSettings, startTimer, stopTimer, pushAnnouncement, clearAnnouncement,
    getSchedule, addScheduleItem, deleteScheduleItem, updateTeamStatus, toggleEvaluationPeriod,
    getCheckedInParticipantsData, getFoodLogsData,
    getVolunteers, addVolunteer, removeVolunteer, uploadVolunteersData, updateVolunteerShift,
    addHackathonTeamManually, updateHackathonTeamDetails, updateCustomMeals, updateHackathonName,
    updateEvaluationRounds, emailShortlistedTeams, emailSingleTeam, blastCustomEmail,
    getHackathonRoles, addHackathonRole, removeHackathonRole, approveScoreEdit, sendEvaluatorInvite, getEditRequests,
    importEventAttendees, getEventAttendees, deleteEventAttendees, sendAttendeeQrEmails,
    getAttendanceCheckpoints, updateAttendanceCheckpoints, getAttendanceReport,
    saveAttendanceEventSettings, getAttendanceEventSettings, updateSingleAttendee,
    getHackathonTeamUpdates,
    getGateLogs
} from "@/lib/actions/hackathon";
import * as XLSX from "xlsx";
import { Download, Upload, Users, AlertCircle, CheckCircle, Search, Trash2, Mail, ExternalLink, RefreshCw, Save, Edit2, X, FileDown, Cpu, Clock, Calendar, QrCode, StopCircle, Star, UserCheck, Plus, ChevronLeft, ChevronRight, Edit, Shield, Utensils, Settings, Send, Minus, MapPin, DoorOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import LiveTimer from "../components/LiveTimer";
import EvaluatorDashboardClient from "@/app/(admin)/admin/hackathon/evaluate/client";

const ITEMS_PER_PAGE = 10;

export default function HackathonManageClient() {
    // Tab persistence via URL hash
    const [activeTab, setActiveTab] = useState(() => {
        if (typeof window !== 'undefined') {
            const hash = window.location.hash.replace('#', '');
            if (['teams', 'evaluators', 'volunteers', 'attendance', 'settings'].includes(hash)) return hash;
        }
        return 'teams';
    });
    const handleTabChange = (val: string) => {
        setActiveTab(val);
        window.location.hash = val;
        if (val === 'attendance' && attendees.length === 0 && attSettingsLoaded) loadAttendees();
    };

    const [currentPage, setCurrentPage] = useState(1);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [teams, setTeams] = useState<any[]>([]);
    const [evaluators, setEvaluators] = useState<any[]>([]);
    const [volunteers, setVolunteers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [evaluationRounds, setEvaluationRounds] = useState(2);
    const [searchQuery, setSearchQuery] = useState("");
    const [sendingEmails, setSendingEmails] = useState(false);
    const [selectedTheme, setSelectedTheme] = useState("ALL");
    const [schedule, setSchedule] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [evalEmail, setEvalEmail] = useState("");
    const [volEmail, setVolEmail] = useState("");
    const [volName, setVolName] = useState("");
    const [volTeam, setVolTeam] = useState("Registration & Stage Team");
    const [volShift, setVolShift] = useState("Whole Day");
    const [roleEmail, setRoleEmail] = useState("");
    const [roleType, setRoleType] = useState("admin");
    const [announcement, setAnnouncement] = useState("");
    const [sendingQr, setSendingQr] = useState(false);
    const [volSendingEmails, setVolSendingEmails] = useState(false);
    const [volEmailResult, setVolEmailResult] = useState<any>(null);
    const [selectedCollege, setSelectedCollege] = useState("ALL");
    const [newEvaluatorEmail, setNewEvaluatorEmail] = useState("");
    const [evaluatorList, setEvaluatorList] = useState<any[]>([]);
    const [scheduleItems, setScheduleItems] = useState<any[]>([]);
    const [deletingTeams, setDeletingTeams] = useState(false);
    const [showManualAdd, setShowManualAdd] = useState(false);
    const [addingManualMode, setAddingManualMode] = useState(false);
    const [sendingMailTeamId, setSendingMailTeamId] = useState<string | null>(null);
    const [mailResult, setMailResult] = useState<{ teamId: string, sentTo: string[], failedTo: string[], message: string } | null>(null);
    const [teamUpdates, setTeamUpdates] = useState<any[]>([]);
    
    // Custom Email Blast states
    const [customEmailSubject, setCustomEmailSubject] = useState("");
    const [customEmailBody, setCustomEmailBody] = useState("");
    const [customEmailTarget, setCustomEmailTarget] = useState<'all' | 'shortlisted'>('all');
    const [blastingEmail, setBlastingEmail] = useState(false);

    // Team Edit states
    const [editingTeam, setEditingTeam] = useState<any>(null);
    const [editRequests, setEditRequests] = useState<any[]>([]);
    const [editFormData, setEditFormData] = useState({
        teamName: '',
        ideaTitle: '',
        teamCode: '',
        theme: '',
        projectObjective: '',
        leader: { id: '', name: '', email: '', phone: '', course: '', section: '', system_id: '', year: '', college: '' },
        members: [{ id: '', name: '', email: '', phone: '', course: '', section: '', system_id: '', year: '', college: '' }, { id: '', name: '', email: '', phone: '', course: '', section: '', system_id: '', year: '', college: '' }, { id: '', name: '', email: '', phone: '', course: '', section: '', system_id: '', year: '', college: '' }, { id: '', name: '', email: '', phone: '', course: '', section: '', system_id: '', year: '', college: '' }]
    });

    const [customMeals, setCustomMeals] = useState<string[]>(["Breakfast - Day 1", "Lunch - Day 1", "Snacks - Day 1", "Dinner - Day 1", "Breakfast - Day 2", "Lunch - Day 2"]);
    const [newMeal, setNewMeal] = useState("");
    const [hackathonName, setHackathonName] = useState("CodeMania Hackathon");

    // Attendance states
    const [attendees, setAttendees] = useState<any[]>([]);
    const [attCheckpoints, setAttCheckpoints] = useState<string[]>(['Registration', 'Food', 'Exit']);
    const [attEventTag, setAttEventTag] = useState('general');
    const [attEventName, setAttEventName] = useState('Event');
    const [attUploading, setAttUploading] = useState(false);
    const [attSendingEmails, setAttSendingEmails] = useState(false);
    const [attEmailResult, setAttEmailResult] = useState<any>(null);
    const [attSearchQuery, setAttSearchQuery] = useState('');
    const [attShardaOnly, setAttShardaOnly] = useState(false);
    const [attCurrentPage, setAttCurrentPage] = useState(1);
    const [newCheckpoint, setNewCheckpoint] = useState('');
    const [attLoading, setAttLoading] = useState(false);
    const [attSettingsSaved, setAttSettingsSaved] = useState(false);
    const [attSettingsLoaded, setAttSettingsLoaded] = useState(false);

    // Inline Editing
    const [editingAttendeeId, setEditingAttendeeId] = useState<string | null>(null);
    const [editAttendeeFormData, setEditAttendeeFormData] = useState<any>({});
    const [editSaving, setEditSaving] = useState(false);

    const handleEditStart = (attendee: any) => {
        setEditingAttendeeId(attendee.id);
        setEditAttendeeFormData({ ...attendee });
    };

    const handleEditCancel = () => {
        setEditingAttendeeId(null);
        setEditAttendeeFormData({});
    };

    const handleEditSave = async () => {
        if (!editingAttendeeId) return;
        setEditSaving(true);
        const result = await updateSingleAttendee(editingAttendeeId, editAttendeeFormData);
        if (result.success) {
            setMessage({ type: 'success', text: 'Attendee updated successfully.' });
            setAttendees(prev => prev.map(a => a.id === editingAttendeeId ? { ...a, ...editAttendeeFormData } : a));
            setEditingAttendeeId(null);
        } else {
            setMessage({ type: 'error', text: result.error || 'Failed to update attendee.' });
        }
        setEditSaving(false);
    };

    const ATT_ITEMS_PER_PAGE = 15;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const attFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        const [teamsData, evaluatorsData, volunteersData, settingsData, scheduleData, rolesData, editReqData, checkpointsData, teamUpdatesData] = await Promise.all([
            getHackathonTeams(),
            getEvaluators(),
            getVolunteers(),
            getHackathonSettings(),
            getSchedule(),
            getHackathonRoles(),
            getEditRequests(),
            getAttendanceCheckpoints(),
            getHackathonTeamUpdates()
        ]);
        setTeams(teamsData);
        setEvaluators(evaluatorsData);
        setVolunteers(volunteersData);
        setSettings(settingsData);
        setSchedule(scheduleData);
        setRoles(rolesData);
        setEditRequests(editReqData);
        setTeamUpdates(teamUpdatesData);
        if (checkpointsData) setAttCheckpoints(checkpointsData);
        if (settingsData?.custom_meals && Array.isArray(settingsData.custom_meals)) {
            setCustomMeals(settingsData.custom_meals);
        }
        if (settingsData?.hackathon_name) {
            setHackathonName(settingsData.hackathon_name);
        }
        // Load attendance event settings from DB
        const attSettings = await getAttendanceEventSettings();
        if (attSettings) {
            setAttEventTag(attSettings.eventTag);
            setAttEventName(attSettings.eventName);
            if (attSettings.checkpoints) setAttCheckpoints(attSettings.checkpoints);
            setAttSettingsLoaded(true);
        }
        setLoading(false);
    }

    // Auto-load attendees once settings are loaded
    useEffect(() => {
        if (attSettingsLoaded && attendees.length === 0) {
            loadAttendees();
        }
    }, [attSettingsLoaded]);

    async function loadAttendees(tag?: string) {
        setAttLoading(true);
        const tagToUse = tag || attEventTag;
        const data = await getEventAttendees(tagToUse || undefined);
        setAttendees(data);
        setAttLoading(false);
    }

    const handleAttUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAttUploading(true);
        setMessage(null);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);
            const result = await importEventAttendees(rows, attEventTag);
            if (result.error) {
                setMessage({ type: 'error', text: result.error });
            } else {
                setMessage({ type: 'success', text: result.message || `Imported ${result.imported} attendees.` });
                loadAttendees();
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to parse file. Please use CSV or XLSX.' });
        }
        setAttUploading(false);
        if (attFileInputRef.current) attFileInputRef.current.value = '';
    };

    const handleExportAttendance = async () => {
        const report = await getAttendanceReport(attEventTag);
        if (!report || report.length === 0) {
            setMessage({ type: 'error', text: 'No attendance data to export.' });
            return;
        }
        const rows = report.map((a: any) => {
            const row: any = {
                'Name': a.name,
                'System ID': a.system_id || '',
                'Section': a.section || '',
                'Department': a.department || '',
                'Email': a.email || '',
                'Mobile': a.mobile || '',
                'College': a.college || '',
            };
            attCheckpoints.forEach(cp => {
                const scan = a.event_attendance_scans?.find((s: any) => s.checkpoint === cp);
                row[`${cp}`] = scan ? '✓' : '✗';
                row[`${cp} Time`] = scan ? new Date(scan.scanned_at).toLocaleString() : '';
            });
            return row;
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
        XLSX.writeFile(wb, `attendance_${attEventTag}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const filteredAttendees = attendees.filter((a: any) => {
        if (attShardaOnly) {
            const isSharda = (a.university || a.college || a.department || '').toLowerCase().includes('sharda');
            if (!isSharda) return false;
        }
        if (!attSearchQuery) return true;
        const q = attSearchQuery.toLowerCase();
        return (a.name || '').toLowerCase().includes(q) ||
            (a.email || '').toLowerCase().includes(q) ||
            (a.system_id || '').toLowerCase().includes(q) ||
            (a.department || '').toLowerCase().includes(q) ||
            (a.section || '').toLowerCase().includes(q);
    });
    const attTotalPages = Math.ceil(filteredAttendees.length / ATT_ITEMS_PER_PAGE);
    const paginatedAttendees = filteredAttendees.slice((attCurrentPage - 1) * ATT_ITEMS_PER_PAGE, attCurrentPage * ATT_ITEMS_PER_PAGE);

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

    const handleAddManualTeam = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setAddingManualMode(true);
        setMessage(null);

        const formData = new FormData(e.currentTarget);

        const data = {
            teamName: formData.get('teamName') as string,
            ideaTitle: formData.get('ideaTitle') as string,
            teamCode: formData.get('teamCode') as string,
            theme: formData.get('theme') as string,
            leader: {
                name: formData.get('leaderName') as string,
                email: formData.get('leaderEmail') as string,
                phone: formData.get('leaderPhone') as string,
                course: formData.get('leaderCourse') as string,
                section: formData.get('leaderSection') as string,
                system_id: formData.get('leaderSystemId') as string,
                year: formData.get('leaderYear') as string,
                college: formData.get('leaderCollege') as string
            },
            members: [
                { 
                    name: formData.get('m1Name') as string, email: formData.get('m1Email') as string, phone: formData.get('m1Phone') as string,
                    course: formData.get('m1Course') as string, section: formData.get('m1Section') as string, system_id: formData.get('m1SystemId') as string, year: formData.get('m1Year') as string, college: formData.get('m1College') as string 
                },
                { 
                    name: formData.get('m2Name') as string, email: formData.get('m2Email') as string, phone: formData.get('m2Phone') as string,
                    course: formData.get('m2Course') as string, section: formData.get('m2Section') as string, system_id: formData.get('m2SystemId') as string, year: formData.get('m2Year') as string, college: formData.get('m2College') as string 
                },
                { 
                    name: formData.get('m3Name') as string, email: formData.get('m3Email') as string, phone: formData.get('m3Phone') as string,
                    course: formData.get('m3Course') as string, section: formData.get('m3Section') as string, system_id: formData.get('m3SystemId') as string, year: formData.get('m3Year') as string, college: formData.get('m3College') as string 
                },
                { 
                    name: formData.get('m4Name') as string, email: formData.get('m4Email') as string, phone: formData.get('m4Phone') as string,
                    course: formData.get('m4Course') as string, section: formData.get('m4Section') as string, system_id: formData.get('m4SystemId') as string, year: formData.get('m4Year') as string, college: formData.get('m4College') as string 
                },
            ].filter(m => m.name && m.name.trim() !== '')
        };

        const res = await addHackathonTeamManually(data);
        if (res.error) {
            setMessage({ type: 'error', text: res.error });
        } else {
            setMessage({ type: 'success', text: "Team added manually!" });
            setShowManualAdd(false);
            loadData();
        }
        setAddingManualMode(false);
    };

    async function handleUpdateTeam(e: React.FormEvent) {
        e.preventDefault();
        if (!editingTeam) return;

        setMessage(null);
        try {
            const res = await updateHackathonTeamDetails(editingTeam.id, editFormData);
            if (res.error) {
                setMessage({ type: 'error', text: res.error });
            } else {
                setMessage({ type: 'success', text: "Team updated successfully." });
                setEditingTeam(null);
                loadData();
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || "Failed to update team." });
        }
    }

    const handleSaveMeals = async () => {
        setMessage(null);
        try {
            const res = await updateCustomMeals(customMeals);
            if (res.error) setMessage({ type: 'error', text: res.error });
            else setMessage({ type: 'success', text: "Meal rounds updated successfully." });
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message || "Failed to save meal rounds." });
        }
    };

    const handleDeleteAllTeams = async () => {
        if (!confirm("🚨 WARNING 🚨\n\nThis will permanently delete ALL teams, evaluations, and participants from this hackathon. This cannot be undone.\n\nAre you absolutely sure you want to proceed?")) return;

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

    const handleSendEvaluatorInvite = async (evalId?: string) => {
        setSendingEmails(true);
        setMessage(null);
        try {
            const res = await sendEvaluatorInvite(evalId);
            if (!res.success) throw new Error(res.error || 'Failed to send invite(s)');
            setMessage({ type: 'success', text: res.message || 'Invitation(s) sent successfully' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        }
        setSendingEmails(false);
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

    const handleDownloadAccommodation = () => {
        const accommodationTeams = teams.filter((t: any) => t.need_accommodation);
        if (accommodationTeams.length === 0) {
            setMessage({ type: 'error', text: 'No teams require accommodation.' });
            return;
        }
        const exportData = accommodationTeams.map((t: any) => {
            const members = t.hackathon_participants || [];
            const leader = members.find((m: any) => m.role?.toLowerCase() === 'leader') || members[0];
            return {
                'Team Name': t.name,
                'Team ID': t.team_code || '-',
                'Team Lead': leader?.name || '-',
                'Contact': leader?.phone || '-',
                'Email': leader?.email || '-',
                'College': leader?.college || '-',
                'Total Members': members.length,
                'Boys': t.accommodation_boys || 0,
                'Girls': t.accommodation_girls || 0,
                'Sex Ratio': t.sex_ratio || '-',
                'Arrival Date': t.arrival_date || '-',
                'Departure Date': t.departure_date || '-',
                'Mentor': t.mentor_name || '-',
                'Remarks': t.remarks || '-',
            };
        });
        downloadCSV(exportData, `accommodation_data_${new Date().toISOString().split('T')[0]}.csv`);
        setMessage({ type: 'success', text: `Downloaded accommodation data for ${accommodationTeams.length} team(s).` });
    };

    const handleDownloadVolunteers = () => {
        if (!volunteers || volunteers.length === 0) {
            setMessage({ type: 'error', text: 'No volunteers to download.' });
            return;
        }
        
        const exportData = volunteers.map((v: any) => ({
            'Name': v.name,
            'Email': v.email,
            'Role Team': v.team_name,
            'Shift': v.shift || '',
            'Checked In': v.is_checked_in ? 'Yes' : 'No',
            'Check-in Time': v.check_in_time ? new Date(v.check_in_time).toLocaleString() : '',
            'Meals Scanned': v.food_count || 0,
        }));
        
        downloadCSV(exportData, `volunteers_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const handleDownloadGateLogs = async () => {
        setMessage({ type: 'success', text: 'Fetching gate logs...' });
        try {
            const result = await getGateLogs();
            if (result.error && result.data.length === 0) {
                setMessage({ type: 'error', text: result.error });
                return;
            }
            if (!result.data || result.data.length === 0) {
                setMessage({ type: 'error', text: 'No gate logs recorded yet. Logs will appear once scanning begins.' });
                return;
            }
            downloadCSV(result.data, `gate_logs_${new Date().toISOString().split('T')[0]}.csv`);
            setMessage({ type: 'success', text: `Downloaded ${result.data.length} gate log entries.` });
            setTimeout(() => setMessage(null), 3000);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to fetch gate logs.' });
        }
    };

    const uniqueThemes = [...new Set(teams.map(t => t.theme).filter(Boolean))];
    const uniqueColleges = Array.from(new Set(
        teams.flatMap(t => (t.hackathon_participants || []).map((p:any) => p.college || "Unknown"))
    )).filter(Boolean);

    const filteredTeams = teams.filter(t => {
        const matchesSearch = !searchQuery || t.name?.toLowerCase().includes(searchQuery.toLowerCase()) || t.idea_title?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTheme = selectedTheme === 'ALL' || t.theme === selectedTheme;
        const teamColleges = (t.hackathon_participants || []).map((p:any) => p.college || "Unknown");
        const matchesCollege = selectedCollege === 'ALL' || teamColleges.includes(selectedCollege);
        return matchesSearch && matchesTheme && matchesCollege;
    });
    const totalPages = Math.ceil(filteredTeams.length / ITEMS_PER_PAGE);
    const paginatedTeams = filteredTeams.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const avgScore = teams.length > 0 ? (teams.reduce((sum, t) => sum + (t.final_score || 0), 0) / teams.length).toFixed(1) : '0';
    const handleTimerAction = async (action: 'start' | 'reset') => {
        try {
            if (action === 'start') {
                const res = await startTimer(24);
                if (res.error) setMessage({ type: 'error', text: res.error });
                else { setMessage({ type: 'success', text: 'Timer started!' }); const s = await getHackathonSettings(); setSettings(s); }
            } else {
                const res = await stopTimer();
                if (res.error) setMessage({ type: 'error', text: res.error });
                else { setMessage({ type: 'success', text: 'Timer reset!' }); const s = await getHackathonSettings(); setSettings(s); }
            }
        } catch { setMessage({ type: 'error', text: 'Timer action failed.' }); }
    };

    const inviteEvaluator = async (email: string) => {
        try {
            const res = await addEvaluator(email, 'General');
            return res;
        } catch (e: any) {
            return { error: e.message || 'Failed' };
        }
    };

    const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-indigo-500 focus:ring-0 focus:outline-none/30 focus:border-purple-400 transition-all placeholder-gray-400";
    const cardCls = "bg-white border border-gray-200 rounded-xl shadow-sm p-6 shadow-none";

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            {/* Breadcrumb + Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-sm text-gray-400 font-mono mb-1">
                        <Link href="/hackathon-portal" className="hover:text-gray-600 transition-colors">Dashboard</Link>
                        <ChevronRight className="w-3 h-3" />
                        <span className="text-gray-600 font-medium">Hackathon Management</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Manage Hackathon</h1>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Link href="/hackathon-portal/scan" className="flex items-center gap-2 bg-gray-100 hover:bg-gray-50 text-gray-900 px-4 py-2 rounded-xl shadow-sm font-medium transition-colors text-sm">
                        <QrCode className="w-4 h-4 text-emerald-400" /> Scanner
                    </Link>
                    <button onClick={handleDownloadCheckIn} className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl shadow-sm text-sm transition-colors">
                        <Download className="w-3.5 h-3.5" /> Check-in
                    </button>
                    <button onClick={handleDownloadFoodLogs} className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl shadow-sm text-sm transition-colors">
                        <Download className="w-3.5 h-3.5" /> Food Logs
                    </button>
                    <button onClick={handleDownloadAccommodation} className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl shadow-sm text-sm transition-colors">
                        <Download className="w-3.5 h-3.5" /> Accommodation
                    </button>
                    <button onClick={handleDownloadGateLogs} className="flex items-center gap-2 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 px-3 py-2 rounded-xl shadow-sm text-sm transition-colors">
                        <DoorOpen className="w-3.5 h-3.5" /> Gate Logs
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
                        <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                    </div>
                    <p className="text-sm text-gray-400 font-mono tracking-wider animate-pulse">Loading hackathon data...</p>
                </div>
            ) : (
            <>

            {/* Summary Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
                <div className={cardCls}><p className="text-xs font-semibold text-gray-400 font-mono uppercase tracking-wider mb-2">Total Teams</p><div className="flex items-end gap-2"><span className="text-3xl font-bold text-gray-900">{teams.length}</span>{teams.length > 0 && <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full font-medium mb-1">+{teams.filter(t => t.status === 'pending').length} pending</span>}</div></div>
                <div className={cardCls}><p className="text-xs font-semibold text-gray-400 font-mono uppercase tracking-wider mb-2">Checked-in</p><div className="flex items-end gap-2"><span className="text-3xl font-bold text-emerald-600">{teams.filter(t => t.checked_in).length}</span><div className="flex-1 h-1.5 bg-gray-100 rounded-full mb-2 max-w-[80px]"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${teams.length > 0 ? (teams.filter(t => t.checked_in).length / teams.length * 100) : 0}%` }} /></div></div></div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {message && (
                    <div className={`mb-6 p-4 rounded-xl shadow-sm flex items-start gap-3 ${message.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                        {message.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
                        <p className="text-sm">{message.text}</p>
                    </div>
                )}
                {mailResult && mailResult.failedTo.length > 0 && (
                    <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium">⚠️ Some emails failed for this team</p>
                                <p className="text-xs text-amber-600 mt-1">Failed: {mailResult.failedTo.join(', ')}</p>
                                {mailResult.sentTo.length > 0 && <p className="text-xs text-emerald-600 mt-0.5">Succeeded: {mailResult.sentTo.join(', ')}</p>}
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <button
                                    onClick={async () => {
                                        setSendingMailTeamId(mailResult.teamId);
                                        const res = await emailSingleTeam(mailResult.teamId);
                                        if (res.error) setMessage({ type: 'error', text: res.error });
                                        else {
                                            setMessage({ type: 'success', text: res.message || 'Retry sent!' });
                                            if (res.failedTo && res.failedTo.length > 0) {
                                                setMailResult({ teamId: mailResult.teamId, sentTo: res.sentTo || [], failedTo: res.failedTo, message: res.message || '' });
                                            } else {
                                                setMailResult(null);
                                            }
                                            loadData();
                                        }
                                        setSendingMailTeamId(null);
                                    }}
                                    disabled={!!sendingMailTeamId}
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
                                >
                                    <RefreshCw className="w-3 h-3" /> Retry
                                </button>
                                <button onClick={() => setMailResult(null)} className="px-2 py-1.5 text-amber-500 hover:text-amber-700 text-xs">Dismiss</button>
                            </div>
                        </div>
                    </div>
                )}
                <TabsList className="bg-white border border-gray-200 p-1 rounded-xl shadow-sm mb-6 md:mb-8 flex overflow-x-auto h-auto gap-1 md:gap-2 shadow-none">
                    <TabsTrigger value="teams" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm text-gray-500 font-mono tracking-wider rounded-xl px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-base whitespace-nowrap">
                        <Users className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" /> Teams & Import
                    </TabsTrigger>
                    <TabsTrigger value="evaluators" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700 text-gray-500 font-mono tracking-wider rounded-xl px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-base whitespace-nowrap">
                        <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" /> Evaluators & Grading
                    </TabsTrigger>
                    <TabsTrigger value="volunteers" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 text-gray-500 font-mono tracking-wider rounded-xl px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-base whitespace-nowrap">
                        <UserCheck className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" /> Volunteers
                    </TabsTrigger>

                    <TabsTrigger value="attendance" onClick={() => { if (attendees.length === 0) loadAttendees(); }} className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 text-gray-500 font-mono tracking-wider rounded-xl px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-base whitespace-nowrap">
                        <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" /> Attendance
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="data-[state=active]:bg-yellow-100 data-[state=active]:text-yellow-700 text-gray-500 font-mono tracking-wider rounded-xl px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-base whitespace-nowrap">
                        <Settings className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" /> Settings & Roles
                    </TabsTrigger>
                </TabsList>

                {/* Teams & Import Tab */}
                {/* Teams Tab */}
                <TabsContent value="teams" className="mt-0 space-y-6">
                    {/* Search / Filter / Actions Bar */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 shadow-none">
                        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                                <div className="relative flex-1 max-w-sm">
                                    <input type="text" placeholder="Search teams, members..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-indigo-500 focus:ring-0 focus:outline-none/20 focus:border-purple-300 placeholder-gray-400" />
                                    <Search className="w-4 h-4 text-gray-400 font-mono absolute left-3 top-1/2 -translate-y-1/2" />
                                </div>
                                <select value={selectedTheme} onChange={e => { setSelectedTheme(e.target.value); setCurrentPage(1); }} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none appearance-none cursor-pointer">
                                    <option value="ALL">All Tracks</option>
                                    {uniqueThemes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select value={selectedCollege} onChange={e => { setSelectedCollege(e.target.value); setCurrentPage(1); }} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none appearance-none cursor-pointer truncate max-w-[200px]">
                                    <option value="ALL">All Colleges</option>
                                    {uniqueColleges.map((c: any) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <button onClick={async () => {
                                    setMessage({ type: 'success', text: 'Fetching latest data for export...' });
                                    try {
                                        const freshTeams = await getHackathonTeams();
                                        // Keep same filter logic as UI if search/filters are active, or just export all fresh data?
                                        // The original logic used filteredTeams. To keep it consistent, apply filters to freshTeams
                                        const exportTeams = freshTeams.filter((t: any) => {
                                            const matchesSearch = t.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                                                  t.team_code?.toLowerCase().includes(searchQuery.toLowerCase());
                                            const matchesTheme = selectedTheme === 'ALL' || t.theme === selectedTheme;
                                            return matchesSearch && matchesTheme;
                                        });

                                        const exportData = exportTeams.map((t: any) => {
                                            const members = t.hackathon_participants || [];
                                        const leader = members.find((p: any) => p.role === 'leader' || p.role === 'Leader') || members[0] || {};
                                        const otherMembers = members.filter((p: any) => p.id !== leader.id);
                                        const row: any = {
                                            'Team ID': t.team_code || '',
                                            'Team Name': t.name || '',
                                            'Idea/Project Title': t.idea_title || '',
                                            'Track': t.theme || '',
                                            'Project Objective': t.project_objective || '',
                                            'Status': t.status || '',
                                            'Table Number': t.table_number || '',
                                            'College Name': leader.college || members[0]?.college || '',
                                            'Leader Name': leader.name || '',
                                            'Leader Email': leader.email || '',
                                            'Leader Phone': leader.phone || '',
                                            'Leader System ID': leader.system_id || '',
                                            'Leader Course': leader.course || '',
                                            'Leader Section': leader.section || '',
                                            'Leader Year': leader.year || '',
                                        };
                                        for (let i = 0; i < 4; i++) {
                                            const m = otherMembers[i] || {};
                                            row[`Member ${i + 1} Name`] = m.name || '';
                                            row[`Member ${i + 1} Email`] = m.email || '';
                                            row[`Member ${i + 1} Phone`] = m.phone || '';
                                            row[`Member ${i + 1} College`] = m.college || '';
                                            row[`Member ${i + 1} System ID`] = m.system_id || '';
                                            row[`Member ${i + 1} Course`] = m.course || '';
                                            row[`Member ${i + 1} Section`] = m.section || '';
                                            row[`Member ${i + 1} Year`] = m.year || '';
                                        }
                                        row['Total Members'] = members.length;
                                        row['Student Coordinator'] = t.student_coordinator || '';
                                        row['Coordinator Phone'] = t.coordinator_phone || '';
                                        row['Need Accommodation'] = t.need_accommodation ? 'Yes' : 'No';
                                        row['Accommodation Boys'] = t.accommodation_boys || 0;
                                        row['Accommodation Girls'] = t.accommodation_girls || 0;
                                        row['Sex Ratio'] = t.sex_ratio || '';
                                        row['Arrival Date'] = t.arrival_date || '';
                                        row['Departure Date'] = t.departure_date || '';
                                        row['Mentor'] = t.mentor_name || '';
                                        row['Remarks'] = t.remarks || '';
                                        row['QR Emailed'] = t.qr_emailed ? 'Yes' : 'No';
                                        row['Checked In'] = members.some((p: any) => p.is_checked_in) ? 'Yes' : 'No';
                                        return row;
                                        });
                                        downloadCSV(exportData, `hackathon_teams_complete_${new Date().toISOString().split('T')[0]}.csv`);
                                        setMessage(null);
                                    } catch (error) {
                                        console.error(error);
                                        setMessage({ type: 'error', text: 'Failed to fetch latest data.' });
                                    }
                                }} className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm transition-colors">
                                    <Download className="w-3.5 h-3.5" /> Export CSV
                                </button>
                                <button onClick={async () => { if (!confirm(`This will email QR codes to all teams that haven't been emailed yet. Continue?`)) return; setMessage({ type: 'success', text: '📧 Sending QR code emails...' }); try { const res = await fetch('/api/admin/hackathon-qr-emails', { method: 'POST' }); const data = await res.json(); if (data.error) setMessage({ type: 'error', text: data.error }); else setMessage({ type: data.failed > 0 ? 'error' : 'success', text: data.message || `QR codes emailed! ${data.sent} sent, ${data.failed} failed, ${data.skipped} skipped.` }); loadData(); } catch (err: any) { setMessage({ type: 'error', text: err.message || 'Failed to send QR emails.' }); } }} className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-3 py-2 rounded-xl text-sm transition-colors">
                                    <Mail className="w-3.5 h-3.5" /> Send QR Codes
                                </button>
                                <button onClick={async () => { if (!confirm(`⚠️ This will RE-SEND QR codes to ALL teams, including those already emailed. Continue?`)) return; setMessage({ type: 'success', text: '📧 Resending QR codes to ALL teams...' }); try { const res = await fetch('/api/admin/hackathon-qr-emails?resend=true', { method: 'POST' }); const data = await res.json(); if (data.error) setMessage({ type: 'error', text: data.error }); else setMessage({ type: data.failed > 0 ? 'error' : 'success', text: data.message || `QR codes re-sent! ${data.sent} sent, ${data.failed} failed.` }); loadData(); } catch (err: any) { setMessage({ type: 'error', text: err.message || 'Failed to send QR emails.' }); } }} className="flex items-center gap-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 px-3 py-2 rounded-xl text-sm transition-colors">
                                    <RefreshCw className="w-3.5 h-3.5" /> Resend All
                                </button>
                                <button onClick={() => setShowManualAdd(true)} className="flex items-center gap-1.5 bg-emerald-500 hover:bg-white text-black font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] text-gray-900 px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-none">
                                    <Plus className="w-3.5 h-3.5" /> Add Team
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm shadow-none overflow-hidden">
                        {loading ? (
                            <div className="text-center py-16">
                                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-gray-400 font-mono text-sm">Loading teams...</p>
                            </div>
                        ) : filteredTeams.length === 0 ? (
                            <div className="text-center py-16">
                                <FileDown className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-400 font-mono text-sm">No teams found. Import a file or add manually.</p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-500 font-mono tracking-wider uppercase bg-gray-50/80 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold w-12">#</th>
                                                <th className="px-4 py-3 font-semibold">Team ID</th>
                                                <th className="px-4 py-3 font-semibold">Team Name</th>
                                                <th className="px-4 py-3 font-semibold">Idea Title</th>
                                                <th className="px-4 py-3 font-semibold">Track</th>
                                                <th className="px-4 py-3 font-semibold text-center">College</th>
                                                <th className="px-4 py-3 font-semibold text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {paginatedTeams.map((team: any, index: number) => {
                                                const members = team.hackathon_participants || [];
                                                return (
                                                <tr key={team.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3.5 text-gray-400 font-mono font-mono text-xs">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                    <td className="px-4 py-3.5 text-gray-500 font-mono tracking-wider font-mono text-xs">{team.team_code || '—'}</td>
                                                    <td className="px-4 py-3.5 font-semibold text-gray-900">{team.name}</td>
                                                    <td className="px-4 py-3.5 text-gray-600 max-w-[200px] truncate" title={team.idea_title}>{team.idea_title || 'TBD'}</td>
                                                    <td className="px-4 py-3.5">{team.theme && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-xl text-xs font-medium border border-purple-100">{team.theme}</span>}</td>
                                                    <td className="px-4 py-3.5">
                                                        <span className="text-xs text-gray-600 block text-center max-w-[150px] truncate" title={members[0]?.college || '-'}>{members[0]?.college || '-'}</span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => { setEditingTeam(team); setEditFormData({ teamName: team.name || '', ideaTitle: team.idea_title || '', teamCode: team.team_code || '', theme: team.theme || '', projectObjective: team.project_objective || '', leader: { id: (members.find((p: any) => p.role === 'leader') || members[0] || {}).id || '', name: (members.find((p: any) => p.role === 'leader') || members[0] || {}).name || '', email: (members.find((p: any) => p.role === 'leader') || members[0] || {}).email || '', phone: (members.find((p: any) => p.role === 'leader') || members[0] || {}).phone || '', course: '', section: '', system_id: '', year: '', college: '' }, members: members.filter((p: any) => p.role !== 'leader').map((m: any) => ({ id: m.id || '', name: m.name || '', email: m.email || '', phone: m.phone || '', course: '', section: '', system_id: '', year: '', college: '' })) }); }} className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-400 font-mono hover:text-gray-700 transition-colors" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                                                            <button 
                                                                onClick={async () => {
                                                                    if (!confirm(`Send QR Code to team ${team.name}?`)) return;
                                                                    setMessage({ type: 'success', text: `📧 Sending QR to ${team.name}...` });
                                                                    try {
                                                                        // Pass resend=true so we can resend to failed/single teams even if marked emailed
                                                                        const res = await fetch('/api/admin/hackathon-qr-emails?resend=true', {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({ teamIds: [team.id] })
                                                                        });
                                                                        const data = await res.json();
                                                                        if (data.error) setMessage({ type: 'error', text: data.error });
                                                                        else setMessage({ type: data.failed > 0 ? 'error' : 'success', text: data.message || `QR sent! ${data.sent} sent, ${data.failed} failed.` });
                                                                        loadData();
                                                                    } catch (err: any) {
                                                                        setMessage({ type: 'error', text: err.message || 'Failed to send QR.' });
                                                                    }
                                                                }}
                                                                className={`p-1.5 hover:bg-gray-100 rounded-xl transition-colors ${team.qr_emailed ? 'text-green-500 hover:text-green-600' : 'text-blue-500 hover:text-blue-600'}`} 
                                                                title={team.qr_emailed ? "Resend QR Code" : "Send QR Code"}
                                                            >
                                                                <Mail className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                                        <span className="text-sm text-gray-500 font-mono tracking-wider">Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredTeams.length)} of {filteredTeams.length}</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 text-sm"><ChevronLeft className="w-4 h-4" /></button>
                                            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => { const page = currentPage <= 4 ? i + 1 : currentPage + i - 3; if (page < 1 || page > totalPages) return null; return <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1.5 rounded-xl text-sm font-medium ${page === currentPage ? 'bg-purple-600 text-gray-900' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{page}</button>; })}
                                            {totalPages > 7 && <span className="px-2 py-1.5 text-gray-400 font-mono">...</span>}
                                            {totalPages > 7 && <button onClick={() => setCurrentPage(totalPages)} className={`px-3 py-1.5 rounded-xl text-sm font-medium ${totalPages === currentPage ? 'bg-purple-600 text-gray-900' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{totalPages}</button>}
                                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 text-sm"><ChevronRight className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Team Update Logs Section */}
                    {teamUpdates.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-6 mt-8 shadow-none">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-500" /> Recent Team Updates
                            </h3>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                                {teamUpdates.map((update) => (
                                    <div key={update.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="font-bold text-gray-900">{update.hackathon_teams?.name || 'Unknown Team'}</span>
                                                <span className="text-gray-500 font-mono text-xs ml-2">({update.hackathon_teams?.team_code})</span>
                                            </div>
                                            <span className="text-xs text-gray-400 font-mono">
                                                {new Date(update.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="text-gray-700 space-y-1">
                                            <p className="text-xs text-gray-500 font-mono mb-2">Updated by: {update.update_data?.updated_by} ({update.update_data?.email})</p>
                                            <ul className="list-disc pl-5">
                                                {(update.update_data?.changes || []).map((c: string, idx: number) => (
                                                    <li key={idx} className="text-sm">{c}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Timer + Schedule (full width, no evaluators management) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Timer & Announcement */}
                        <div className="bg-gray-100 rounded-xl shadow-sm p-6 text-gray-900 relative">
                            <a href="/hackathon/live" target="_blank" className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors group" title="Open Live Dashboard">
                                <ExternalLink className="w-4 h-4 text-gray-400 font-mono group-hover:text-gray-900" />
                            </a>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 font-mono mb-3 text-center">Timer</p>
                            <div className="text-4xl font-black font-mono tracking-wider mb-2 text-center">
                                <LiveTimer timerEnd={settings?.timer_start && settings?.duration_hours && settings?.is_running ? new Date(new Date(settings.timer_start).getTime() + settings.duration_hours * 3600000).toISOString() : null} />
                            </div>
                            <div className="flex gap-2 justify-center text-[10px] text-gray-500 font-mono tracking-wider uppercase tracking-wider mb-4">
                                <span className="w-14 text-center">Hours</span><span className="w-14 text-center">Minutes</span><span className="w-14 text-center">Seconds</span>
                            </div>
                            <div className="flex gap-3 justify-center mb-5">
                                <button onClick={() => handleTimerAction('start')} className="bg-emerald-500 hover:bg-white text-black font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] text-gray-900 px-6 py-2 rounded-xl text-sm font-medium transition-colors">Start</button>
                                <button onClick={() => handleTimerAction('reset')} className="bg-gray-100 hover:bg-white text-gray-900 hover:text-black font-bold uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] border border-gray-200 text-gray-900 px-6 py-2 rounded-xl text-sm font-medium transition-colors">Stop</button>
                            </div>
                            {/* Announcement */}
                            <div className="border-t border-gray-200 pt-4">
                                <label className="block text-xs font-semibold text-gray-400 font-mono uppercase tracking-wider mb-2">Live Announcement</label>
                                <textarea
                                    value={announcement}
                                    onChange={(e) => setAnnouncement(e.target.value)}
                                    placeholder={settings?.active_announcement || "Type an announcement for all screens..."}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl shadow-sm p-3 focus:outline-none focus:border-indigo-500 focus:ring-0 focus:outline-none resize-none h-20 text-sm text-gray-900 placeholder-gray-500"
                                />
                                <div className="flex gap-2 mt-2">
                                    <button onClick={handlePushAnnouncement} className="flex-1 bg-emerald-500 hover:bg-white text-black font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5">
                                        <Send className="w-3.5 h-3.5" /> Push
                                    </button>
                                    {settings?.active_announcement && (
                                        <button onClick={handleClearAnnouncement} className="bg-gray-100 hover:bg-white text-gray-900 hover:text-black font-bold uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] border border-gray-200 py-2 px-4 rounded-xl text-sm font-medium transition-colors text-red-400 hover:text-red-300">Clear</button>
                                    )}
                                </div>
                                {settings?.active_announcement && (
                                    <div className="mt-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                        <p className="text-[11px] text-emerald-400 flex items-center gap-1 truncate">
                                            <CheckCircle className="w-3 h-3 flex-shrink-0" /> Showing: &quot;{settings.active_announcement}&quot;
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Event Schedule */}
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 shadow-none">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-emerald-600" /> Event Schedule</h3>
                            <form onSubmit={handleAddSchedule} className="space-y-3 mb-5">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] text-gray-500 font-mono tracking-wider uppercase font-semibold">Title</label>
                                        <input type="text" name="title" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-0 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 font-mono tracking-wider uppercase font-semibold">Type</label>
                                        <select name="event_type" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none [&>option]:bg-white">
                                            <option value="Activity">Activity</option>
                                            <option value="Meal">Meal</option>
                                            <option value="Evaluation">Evaluation</option>
                                            <option value="Break">Break</option>
                                            <option value="Ceremony">Ceremony</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] text-gray-500 font-mono tracking-wider uppercase font-semibold">Start Time</label>
                                        <input type="datetime-local" name="start_time" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 font-mono tracking-wider uppercase font-semibold">End Time <span className="text-gray-300">(opt.)</span></label>
                                        <input type="datetime-local" name="end_time" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none" />
                                    </div>
                                </div>
                                <input type="text" name="description" placeholder="Description (optional)" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none placeholder-gray-400" />
                                <button type="submit" className="w-full bg-emerald-500 hover:bg-white text-black font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] text-gray-900 py-2 rounded-xl text-sm font-medium transition-colors">Add Schedule Item</button>
                            </form>
                            <div className="space-y-2 max-h-52 overflow-y-auto">
                                {schedule.map((item: any) => (
                                    <div key={item.id} className={`flex items-center justify-between rounded-xl px-3 py-2 ${item.event_type === 'Meal' ? 'bg-orange-50 border border-orange-200' : item.event_type === 'Evaluation' ? 'bg-blue-50 border border-blue-200' : item.event_type === 'Break' ? 'bg-yellow-50 border border-yellow-200' : item.event_type === 'Ceremony' ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50 border border-gray-200'}`}>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.event_type === 'Meal' ? 'bg-orange-400' : item.event_type === 'Evaluation' ? 'bg-blue-500' : item.event_type === 'Break' ? 'bg-yellow-500' : item.event_type === 'Ceremony' ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                                            <span className="text-sm font-medium text-gray-900 truncate">{item.title}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${item.event_type === 'Meal' ? 'bg-orange-100 text-orange-600' : item.event_type === 'Evaluation' ? 'bg-blue-100 text-blue-600' : item.event_type === 'Break' ? 'bg-yellow-100 text-yellow-700' : item.event_type === 'Ceremony' ? 'bg-purple-100 text-purple-600' : 'bg-emerald-100 text-emerald-600'}`}>{item.event_type}</span>
                                            <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">{new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <button onClick={() => handleDeleteScheduleItem(item.id)} className="p-1 text-red-400/60 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0" title="Delete">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                {schedule.length === 0 && <p className="text-sm text-gray-400 font-mono text-center py-4 italic">No events scheduled yet.</p>}
                            </div>
                        </div>
                    </div>

                    {/* Import & Tools */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 shadow-none">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4"><Upload className="w-5 h-5 text-emerald-600" /> Import Data</h3>
                            <p className="text-sm text-gray-500 font-mono tracking-wider mb-4">Upload an Excel (.xlsx) or CSV file from Google Forms.</p>
                            <form onSubmit={handleUpload} className="space-y-3">
                                <input type="file" name="file" accept=".csv,.xlsx" ref={fileInputRef} required className="block w-full text-sm text-gray-500 font-mono tracking-wider file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-gray-200 file:bg-gray-50 file:text-gray-700 file:font-semibold hover:file:bg-gray-100 cursor-pointer" />
                                <button type="submit" disabled={uploading} className="w-full bg-emerald-500 hover:bg-white text-black font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] text-gray-900 font-medium py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm">{uploading ? <><div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /> Importing...</> : 'Upload & Sync Teams'}</button>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => window.open('/api/admin/hackathon-template', '_blank')} className="flex-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-medium py-2 rounded-xl text-sm flex items-center justify-center gap-1"><Download className="w-3.5 h-3.5" /> Template</button>
                                    <button type="button" onClick={() => setShowManualAdd(true)} className="flex-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-medium py-2 rounded-xl text-sm flex items-center justify-center gap-1"><Plus className="w-3.5 h-3.5" /> Manual</button>
                                </div>
                            </form>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 shadow-none">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4"><Mail className="w-5 h-5 text-emerald-600" /> Email Blast</h3>
                            <div className="space-y-3">
                                <input type="text" value={customEmailSubject} onChange={e => setCustomEmailSubject(e.target.value)} placeholder="Subject line..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none placeholder-gray-400" />
                                <textarea value={customEmailBody} onChange={e => setCustomEmailBody(e.target.value)} placeholder="Message body..." rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none placeholder-gray-400 resize-none" />
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex gap-1">
                                        <span className="px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">Emails All Participants</span>
                                    </div>
                                    <button onClick={async () => { if (!customEmailSubject || !customEmailBody) { setMessage({ type: 'error', text: 'Subject and Body required!' }); return; } if (!confirm(`Send to ${customEmailTarget === 'all' ? 'ALL participants' : 'SHORTLISTED teams'}?`)) return; setBlastingEmail(true); try { const res = await blastCustomEmail(customEmailSubject, customEmailBody, customEmailTarget); if (res.error) setMessage({ type: 'error', text: res.error }); else { setMessage({ type: 'success', text: res.message || 'Sent!' }); setCustomEmailSubject(''); setCustomEmailBody(''); } } catch { setMessage({ type: 'error', text: 'Failed.' }); } setBlastingEmail(false); }} disabled={blastingEmail} className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-900 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /> {blastingEmail ? '...' : 'Send'}</button>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white border border-red-100 rounded-xl shadow-sm p-6 shadow-none">
                            <h3 className="text-lg font-bold text-red-600 flex items-center gap-2 mb-2"><Trash2 className="w-5 h-5" /> Danger Zone</h3>
                            <p className="text-sm text-gray-500 font-mono tracking-wider mb-4">Permanently delete all teams, evaluations, and participant data.</p>
                            <button onClick={handleDeleteAllTeams} disabled={uploading || deletingTeams} className="bg-[#FF6B00] hover:bg-white text-black font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] text-gray-900 font-medium py-2.5 px-6 rounded-xl shadow-sm text-sm transition-all disabled:opacity-50 flex items-center gap-2">
                                {deletingTeams ? <><div className="w-4 h-4 border-2 border-red-300 border-t-gray-900 rounded-full animate-spin" /> Deleting...</> : <><Trash2 className="w-4 h-4" /> Clear All Data</>}
                            </button>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="evaluators" className="mt-0 space-y-8">
                    {/* Evaluation Period Toggle */}
                    <div className="border border-gray-200 bg-white rounded-xl shadow-sm p-6 shadow-none  flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 mb-1">Global Evaluation Period</h2>
                            <p className="text-gray-500 font-mono tracking-wider text-sm">When open, evaluators can submit scores. When closed, they can only view final peer-reviewed results.</p>
                        </div>
                        <button
                            onClick={handleToggleEvaluationPeriod}
                            className={`px-6 py-3 rounded-xl shadow-sm font-bold transition-all whitespace-nowrap ${settings?.evaluation_open
                                ? 'bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                                }`}
                        >
                            {settings?.evaluation_open ? 'PERIOD IS OPEN' : 'PERIOD IS CLOSED'}
                        </button>
                    </div>

                    <div className="border border-gray-200 bg-white rounded-xl shadow-sm p-6 shadow-none ">
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="flex-1 max-w-md">
                                <h2 className="text-xl font-bold text-gray-900 mb-2">Evaluator Management</h2>
                                <p className="text-gray-500 font-mono tracking-wider text-sm mb-6">Add evaluator emails here so they can securely access the evaluation portal to score teams. They will log in using this email.</p>

                                <form onSubmit={handleAddEvaluator} className="flex gap-3">
                                    <input
                                        type="email"
                                        value={evalEmail}
                                        onChange={(e) => setEvalEmail(e.target.value)}
                                        placeholder="Evaluator Email (e.g. judge@company.com)"
                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-4 py-2 focus:outline-none focus:border-amber-500 text-gray-900"
                                        required
                                    />
                                    <button type="submit" className="bg-amber-600 hover:bg-amber-500 px-6 py-2 rounded-xl shadow-sm text-gray-900 font-medium transition-colors whitespace-nowrap">
                                        Add
                                    </button>
                                </form>
                                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl shadow-sm">
                                    <p className="text-sm text-emerald-600 font-medium mb-1">Evaluator Portal Link</p>
                                    <p className="text-xs text-gray-500 font-mono tracking-wider mb-2">Share this secure link with your evaluators after adding them:</p>
                                    <div className="flex items-center gap-2 bg-gray-100 p-2.5 rounded-xl border border-gray-200 overflow-hidden">
                                        <code className="text-xs text-orange-600 select-all flex-1 truncate overflow-hidden break-all">https://www.technovashardauniversity.in/hackathon-portal</code>
                                        <Link href="/hackathon-portal/evaluate" target="_blank" className="text-emerald-600 hover:text-blue-300 text-xs underline whitespace-nowrap flex-shrink-0">
                                            Open Portal
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 border-l border-gray-200 pl-0 md:pl-8">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Current Evaluators</h3>
                                    {evaluators.length > 0 && (
                                        <button
                                            onClick={() => handleSendEvaluatorInvite()}
                                            disabled={sendingEmails}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-500/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            <Send className="w-4 h-4" />
                                            Send to All
                                        </button>
                                    )}
                                </div>
                                {evaluators.length === 0 ? (
                                    <p className="text-gray-500 font-mono tracking-wider text-sm italic">No evaluators added yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {evaluators.map(ev => (
                                            <div key={ev.id} className="group flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 hover:border-gray-200 transition-colors">
                                                <div>
                                                    <p className="font-medium text-gray-900">{ev.name}</p>
                                                    <p className="text-xs text-gray-500 font-mono tracking-wider">{ev.email}</p>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleSendEvaluatorInvite(ev.id)}
                                                        disabled={sendingEmails}
                                                        className="p-2 text-emerald-600 hover:bg-blue-400/10 rounded-xl transition-colors"
                                                        title="Send Magic Link"
                                                    >
                                                        <Send className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveEvaluator(ev.id)}
                                                        className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                                                        title="Remove Evaluator"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Edit Request Approvals */}
                    <div className="border border-gray-200 bg-white rounded-xl shadow-sm p-6 shadow-none">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-500" />
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Edit Requests</h2>
                                    <p className="text-sm text-gray-500 font-mono tracking-wider">Evaluators who have requested permission to re-edit their submitted scores.</p>
                                </div>
                            </div>
                            <button onClick={async () => { const r = await getEditRequests(); setEditRequests(r); }} className="text-sm text-emerald-600 hover:text-blue-500 font-medium">
                                Refresh
                            </button>
                        </div>
                        {editRequests.length === 0 ? (
                            <p className="text-sm text-gray-400 font-mono italic text-center py-6">No pending edit requests.</p>
                        ) : (
                            <div className="space-y-3">
                                {editRequests.map((req: any) => (
                                    <div key={req.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl shadow-sm p-4">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">
                                                {req.hackathon_evaluators?.name || req.hackathon_evaluators?.email || 'Unknown Evaluator'}
                                                <span className="text-gray-400 font-mono font-normal ml-1.5">requests edit for</span>
                                            </p>
                                            <p className="text-sm text-gray-700 mt-0.5">
                                                Team: <strong>{req.hackathon_teams?.name || 'Unknown'}</strong>
                                                {req.hackathon_teams?.team_code && <span className="text-gray-400 font-mono ml-1">({req.hackathon_teams.team_code})</span>}
                                                <span className="text-gray-400 font-mono ml-2">• Round {req.evaluation_round}</span>
                                                <span className="text-gray-400 font-mono ml-2">• Score: {req.total_score}</span>
                                            </p>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                const res = await approveScoreEdit(req.team_id, req.evaluation_round);
                                                if (res.success) {
                                                    setMessage({ type: 'success', text: `Edit approved for ${req.hackathon_evaluators?.name || 'evaluator'}` });
                                                    setEditRequests(editRequests.filter((r: any) => r.id !== req.id));
                                                } else {
                                                    setMessage({ type: 'error', text: res.error || 'Failed to approve' });
                                                }
                                            }}
                                            className="bg-emerald-500 hover:bg-white text-black font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] text-gray-900 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
                                        >
                                            Approve Edit
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* Volunteers Tab */}
                <TabsContent value="volunteers" className="mt-0 border border-gray-200 bg-white rounded-xl shadow-sm p-6 shadow-none ">
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex-1 max-w-md">
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Volunteer Management</h2>
                            <p className="text-gray-500 font-mono tracking-wider text-sm mb-6">Add student volunteers who can scan QR codes for check-in, checkout, and meals. They will log in with their Sharda University email.</p>

                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                if (!volEmail) return;
                                const res = await addVolunteer(volEmail, volName || 'Volunteer', volTeam, volShift, undefined);
                                if (res.error) {
                                    setMessage({ type: 'error', text: res.error });
                                } else {
                                    setVolEmail("");
                                    setVolName("");
                                    setVolShift("Whole Day");
                                    setMessage({ type: 'success', text: "Volunteer added successfully." });
                                    loadData();
                                }
                            }} className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input
                                        type="text"
                                        value={volName}
                                        onChange={(e) => setVolName(e.target.value)}
                                        placeholder="Volunteer Name"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-4 py-2 focus:outline-none focus:border-emerald-500 text-gray-900"
                                    />
                                    <select
                                        value={volTeam}
                                        onChange={(e) => setVolTeam(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-4 py-2 focus:outline-none focus:border-emerald-500 text-gray-900"
                                    >
                                        <option value="Registration & Stage Team">Registration & Stage Team</option>
                                        <option value="Media Team">Media Team</option>
                                        <option value="Hospitality Team">Hospitality Team</option>
                                        <option value="Food Team">Food Team</option>
                                        <option value="Judging & Evaluation Team">Judging & Evaluation Team</option>
                                        <option value="Discipline & ERT Team">Discipline & ERT Team</option>
                                    </select>
                                    <select
                                        value={volShift}
                                        onChange={(e) => setVolShift(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-4 py-2 focus:outline-none focus:border-emerald-500 text-gray-900"
                                    >
                                        <option value="Morning">Morning Shift</option>
                                        <option value="Night">Night Shift</option>
                                        <option value="Whole Day">Whole Day Shift</option>
                                    </select>
                                </div>
                                <div className="flex gap-3">
                                    <input
                                        type="email"
                                        value={volEmail}
                                        onChange={(e) => setVolEmail(e.target.value)}
                                        placeholder="student@ug.sharda.ac.in"
                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-4 py-2 focus:outline-none focus:border-emerald-500 text-gray-900"
                                        required
                                    />
                                    <button type="submit" className="bg-emerald-500 hover:bg-white text-black font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] px-6 py-2 rounded-xl shadow-sm text-gray-900 font-medium transition-colors whitespace-nowrap">
                                        Add
                                    </button>
                                </div>
                            </form>

                            {/* Bulk Upload */}
                            <div className="mt-6 p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl shadow-sm">
                                <p className="text-sm text-violet-400 font-bold mb-1">📁 Bulk Upload Volunteers</p>
                                <p className="text-xs text-gray-500 font-mono tracking-wider mb-3">Upload an Excel file with columns: S.No, Name, Role, System ID, Section, Year, Mobile Number, Department, Email</p>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.currentTarget);
                                    const file = formData.get('volFile') as File;
                                    if (!file || file.size === 0) {
                                        setMessage({ type: 'error', text: 'Please select a valid Excel file.' });
                                        return;
                                    }
                                    setUploading(true);
                                    setMessage(null);
                                    try {
                                        const uploadFormData = new FormData();
                                        uploadFormData.append('file', file);
                                        const result = await uploadVolunteersData(uploadFormData);
                                        if (result.error) {
                                            setMessage({ type: 'error', text: result.error });
                                        } else {
                                            setMessage({ type: 'success', text: result.message || 'Volunteers uploaded!' });
                                            loadData();
                                        }
                                    } catch (err: any) {
                                        setMessage({ type: 'error', text: err.message || 'Upload failed.' });
                                    } finally {
                                        setUploading(false);
                                    }
                                }} className="flex gap-2">
                                    <input
                                        type="file"
                                        name="volFile"
                                        accept=".xlsx,.xls,.csv"
                                        className="flex-1 bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 file:mr-3 file:px-3 file:py-1 file:rounded-xl file:bg-violet-600 file:text-gray-900 file:border-0 file:text-xs file:cursor-pointer"
                                    />
                                    <button
                                        type="submit"
                                        disabled={uploading}
                                        className="bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-xl text-gray-900 text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                                    >
                                        {uploading ? 'Uploading...' : 'Upload'}
                                    </button>
                                </form>
                            </div>

                            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl shadow-sm">
                                <p className="text-sm text-orange-600 font-bold mb-2 flex items-center gap-2"><Mail className="w-4 h-4" /> Send QR Codes</p>
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2 text-xs">
                                        <span className="text-gray-600">Total: <strong>{volunteers.length}</strong></span>
                                        <span className="text-emerald-600">Emailed: <strong>{volunteers.filter((v: any) => v.qr_emailed).length}</strong></span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        <button
                                            disabled={volSendingEmails}
                                            onClick={async () => {
                                                setVolSendingEmails(true); setVolEmailResult(null);
                                                try {
                                                    const res = await fetch(`/api/admin/hackathon-qr-emails-volunteers?resend=false`, { method: 'POST' });
                                                    setVolEmailResult(await res.json());
                                                    loadData();
                                                } catch(e: any) {
                                                    setVolEmailResult({ error: e.message || 'Error' });
                                                } finally {
                                                    setVolSendingEmails(false);
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {volSendingEmails ? 'Sending...' : <><Send className="w-3.5 h-3.5" /> Send Pending QRs</>}
                                        </button>
                                        <button
                                            disabled={volSendingEmails}
                                            onClick={async () => {
                                                if(!confirm('Are you sure you want to resend QR emails to ALL volunteers?')) return;
                                                setVolSendingEmails(true); setVolEmailResult(null);
                                                try {
                                                    const res = await fetch(`/api/admin/hackathon-qr-emails-volunteers?resend=true`, { method: 'POST' });
                                                    setVolEmailResult(await res.json());
                                                    loadData();
                                                } catch(e: any) {
                                                    setVolEmailResult({ error: e.message || 'Error' });
                                                } finally {
                                                    setVolSendingEmails(false);
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                        >
                                            Resend All
                                        </button>
                                    </div>
                                    {volEmailResult && (
                                        <div className={`mt-2 p-2 rounded-lg text-xs ${volEmailResult.error && !volEmailResult.sent ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            <p className="font-bold">{volEmailResult.message || volEmailResult.error}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm">
                                <p className="text-sm text-emerald-600 font-medium mb-1">Scanner Links</p>
                                <p className="text-xs text-gray-500 font-mono tracking-wider mb-2">Share these links with respective roles:</p>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 bg-gray-100 p-2.5 rounded-xl border border-gray-200 overflow-hidden">
                                        <code className="text-xs text-emerald-600 select-all flex-1 truncate">Participant Scanner</code>
                                        <Link href="/hackathon-portal/scan" target="_blank" className="text-green-400 hover:text-green-300 text-xs underline whitespace-nowrap flex-shrink-0">
                                            Open
                                        </Link>
                                    </div>
                                    <div className="flex items-center gap-2 bg-gray-100 p-2.5 rounded-xl border border-gray-200 overflow-hidden">
                                        <code className="text-xs text-violet-400 select-all flex-1 truncate">Volunteer Scanner</code>
                                        <Link href="/hackathon-portal/volunteer-scan" target="_blank" className="text-violet-400 hover:text-violet-300 text-xs underline whitespace-nowrap flex-shrink-0">
                                            Open
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 border-l border-gray-200 pl-0 md:pl-8">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Current Volunteers</h3>
                                <button
                                    type="button"
                                    onClick={handleDownloadVolunteers}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-medium text-emerald-600 transition-colors"
                                >
                                    <Download className="w-3.5 h-3.5" /> Download CSV
                                </button>
                            </div>
                            
                            {volunteers.length === 0 ? (
                                <p className="text-gray-500 font-mono tracking-wider text-sm italic">No volunteers added yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {volunteers.map((v: any) => (
                                        <div key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900 flex flex-wrap items-center gap-2">
                                                    {v.name}
                                                    {v.team_name && (
                                                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] uppercase tracking-wider font-bold">
                                                            {v.team_name}
                                                        </span>
                                                    )}
                                                </p>
                                                <div className="text-xs text-gray-500 font-mono tracking-wider mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                                    <span>{v.email}</span>
                                                    {v.mobile && <span>• Phone: {v.mobile}</span>}
                                                    {v.system_id && <span>• Sys ID: {v.system_id}</span>}
                                                    {v.department && <span>• {v.department} {v.section ? `(${v.section})` : ''} {v.year && `- Yr ${v.year}`}</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                                <select
                                                    value={v.shift || ''}
                                                    onChange={async (e) => {
                                                        const res = await updateVolunteerShift(v.id, e.target.value);
                                                        if (!res.error) loadData();
                                                    }}
                                                    className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 font-mono focus:outline-none focus:border-blue-400 min-w-[120px]"
                                                >
                                                    <option value="">No Shift</option>
                                                    <option value="Both Slots">Both Slots</option>
                                                    <option value="Slot 1 (9 AM to 5 PM)">Slot 1 (9 AM to 5 PM)</option>
                                                    <option value="Slot 2 (5 PM to 9 AM)">Slot 2 (5 PM to 9 AM)</option>
                                                </select>
                                                <button
                                                    onClick={async () => { await removeVolunteer(v.id); loadData(); }}
                                                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                                                    title="Remove Volunteer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>


                {/* Settings Tab */}
                <TabsContent value="settings" className="mt-0 border border-gray-200 bg-white rounded-xl shadow-sm p-6 shadow-none ">
                    <div className="max-w-xl">
                        <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-yellow-400" /> Platform Settings
                        </h2>
                        <p className="text-gray-500 font-mono tracking-wider text-sm mb-8">Manage global platform configurations and tracking schemas.</p>

                        <div className="bg-gray-50 border border-gray-200 rounded-xl shadow-sm p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <Utensils className="w-4 h-4 text-orange-400" /> Verify & Track Custom Meals
                            </h3>
                            <p className="text-xs text-gray-500 font-mono tracking-wider mb-6">Define exactly which meals food volunteers can scan and distribute. This syncs directly to all volunteers' Verify & Track dropdowns.</p>

                            <div className="space-y-3 mb-6">
                                {customMeals.map((meal, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl shadow-sm hover:border-orange-500/30 transition-colors">
                                        <span className="text-sm font-medium text-gray-700">{meal}</span>
                                        <button
                                            onClick={() => setCustomMeals(customMeals.filter((_, i) => i !== idx))}
                                            className="text-red-400 hover:bg-red-500/10 hover:text-red-300 p-1.5 rounded-xl transition-colors"
                                            title="Delete Meal Round"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                {customMeals.length === 0 && (
                                    <p className="text-sm text-gray-500 font-mono tracking-wider italic py-4 text-center border border-dashed border-gray-200 rounded-xl shadow-sm">No meals currently defined.</p>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newMeal}
                                    onChange={(e) => setNewMeal(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newMeal.trim() !== '') {
                                            if (!customMeals.includes(newMeal.trim())) setCustomMeals([...customMeals, newMeal.trim()]);
                                            setNewMeal('');
                                        }
                                    }}
                                    placeholder="Add a new meal (e.g. Day 3 Breakfast)"
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-orange-500 transition-colors"
                                />
                                <button
                                    onClick={() => {
                                        if (newMeal.trim() !== '' && !customMeals.includes(newMeal.trim())) {
                                            setCustomMeals([...customMeals, newMeal.trim()]);
                                            setNewMeal('');
                                        }
                                    }}
                                    className="bg-[#FF6B00] hover:bg-white text-black font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] text-gray-900 px-6 py-3 rounded-xl shadow-sm text-sm font-bold transition-colors shadow-lg shadow-orange-500/20"
                                >
                                    Add Meal
                                </button>
                            </div>

                            <button
                                onClick={handleSaveMeals}
                                className="w-full bg-gray-100 hover:bg-gray-200 py-3 rounded-xl shadow-sm text-gray-900 mt-6 font-bold transition-colors border border-gray-200 flex items-center justify-center gap-2"
                            >
                                <CheckCircle className="w-4 h-4" /> Save Meal Rounds
                            </button>
                        </div>

                        <div className="bg-gray-50 border border-gray-200 rounded-xl shadow-sm p-6 mt-6 relative overflow-hidden">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <Star className="w-4 h-4 text-orange-600" /> Evaluation Rounds
                            </h3>
                            <p className="text-xs text-gray-500 font-mono tracking-wider mb-6">Set how many rounds of evaluation are required for this hackathon (e.g., 1 for screening, 2 for grand finale).</p>

                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    min="1"
                                    max="5"
                                    value={evaluationRounds}
                                    onChange={(e) => setEvaluationRounds(parseInt(e.target.value) || 1)}
                                    className="w-24 bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-4 py-3 text-gray-900 text-center font-bold focus:outline-none focus:border-amber-500 transition-colors"
                                />
                                <button
                                    onClick={async () => {
                                        const res = await updateEvaluationRounds(evaluationRounds);
                                        if (res.success) {
                                            setMessage({ type: 'success', text: `Max evaluation rounds updated to ${evaluationRounds}` });
                                        } else {
                                            setMessage({ type: 'error', text: res.error || "Failed to update rounds" });
                                        }
                                    }}
                                    className="bg-amber-600 hover:bg-amber-500 text-gray-900 px-6 py-3 rounded-xl shadow-sm text-sm font-bold transition-colors shadow-lg shadow-amber-500/20"
                                >
                                    Update Rounds
                                </button>
                            </div>
                        </div>

                        <div className="bg-gray-50 border border-gray-200 rounded-xl shadow-sm p-6 mt-6 relative overflow-hidden">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <Settings className="w-4 h-4 text-purple-600" /> Hackathon Name
                            </h3>
                            <p className="text-xs text-gray-500 font-mono tracking-wider mb-6">Set the global name of the hackathon which will appear on portals and emails.</p>

                            <div className="flex items-center gap-4">
                                <input
                                    type="text"
                                    value={hackathonName}
                                    onChange={(e) => setHackathonName(e.target.value)}
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-4 py-3 text-gray-900 font-bold focus:outline-none focus:border-purple-500 transition-colors"
                                />
                                <button
                                    onClick={async () => {
                                        const res = await updateHackathonName(hackathonName);
                                        if (res.success) {
                                            setMessage({ type: 'success', text: `Hackathon name updated to ${hackathonName}` });
                                        } else {
                                            setMessage({ type: 'error', text: res.error || "Failed to update name" });
                                        }
                                    }}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl shadow-sm text-sm font-bold transition-colors shadow-lg shadow-purple-500/20"
                                >
                                    Update Name
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Roles Section (merged) */}
                    <div className="border border-gray-200 bg-white rounded-xl shadow-sm p-6 shadow-none mt-6">
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="w-full md:w-1/3 bg-gray-50 border border-gray-200 rounded-xl shadow-sm p-6 relative overflow-hidden h-fit">
                                <h3 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-rose-600" /> Assign Role
                                </h3>
                                <p className="text-xs text-gray-500 font-mono tracking-wider mb-6">Assign special permissions to users based on their email. Super Admins always have full access.</p>
                                
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    setMessage(null);
                                    const res = await addHackathonRole(roleEmail, roleType);
                                    if (res.success) {
                                        setMessage({ type: 'success', text: 'Role assigned successfully' });
                                        setRoleEmail('');
                                        loadData();
                                    } else {
                                        setMessage({ type: 'error', text: res.error || 'Failed to assign role' });
                                    }
                                }} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 font-mono tracking-wider uppercase tracking-wider mb-2">User Email</label>
                                        <input
                                            type="email"
                                            required
                                            value={roleEmail}
                                            onChange={(e) => setRoleEmail(e.target.value)}
                                            placeholder="admin@example.com"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-rose-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 font-mono tracking-wider uppercase tracking-wider mb-2">Role Type</label>
                                        <select
                                            value={roleType}
                                            onChange={(e) => setRoleType(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-rose-500 transition-colors appearance-none"
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="student_lead">Student Lead</option>
                                            <option value="volunteer">Volunteer</option>
                                        </select>
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full bg-rose-600 hover:bg-rose-500 text-gray-900 px-6 py-3 rounded-xl shadow-sm text-sm font-bold transition-colors shadow-lg shadow-rose-500/20"
                                    >
                                        Assign Role
                                    </button>
                                </form>
                            </div>

                            <div className="flex-1 border border-gray-200 bg-white rounded-xl shadow-sm p-6 shadow-none ">
                                <h3 className="text-xl font-semibold text-gray-900 mb-6">Assigned Roles</h3>
                                {roles.length === 0 ? (
                                    <p className="text-gray-500 font-mono tracking-wider text-sm italic">No custom roles assigned yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {roles.map((r, idx) => (
                                            <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl shadow-sm hover:border-gray-200 transition-colors gap-4">
                                                <div>
                                                    <p className="font-semibold text-gray-900 text-sm">{r.email}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                                                            r.role === 'admin' ? 'bg-amber-50 text-amber-700' :
                                                            r.role === 'student_lead' ? 'bg-purple-50 text-purple-700' :
                                                            'bg-blue-50 text-blue-700'
                                                        }`}>
                                                            {r.role.replace('_', ' ')}
                                                        </span>
                                                        <span className="text-xs text-gray-500 font-mono tracking-wider">
                                                            Assigned {new Date(r.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        const res = await removeHackathonRole(r.id);
                                                        if (res.success) {
                                                            setMessage({ type: 'success', text: 'Role removed' });
                                                            loadData();
                                                        } else {
                                                            setMessage({ type: 'error', text: res.error || 'Failed to remove role' });
                                                        }
                                                    }}
                                                    className="self-end md:self-auto p-2 hover:bg-red-500/20 text-gray-500 font-mono tracking-wider hover:text-red-400 rounded-xl transition-colors group"
                                                    title="Remove Role"
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
                </TabsContent>

            {/* Edit Team Modal */}
            {editingTeam && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm p-4" onClick={() => setEditingTeam(null)}>
                    <div className="bg-white rounded-xl shadow-sm p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Edit Team: {editingTeam.name}</h2>
                            <button onClick={() => setEditingTeam(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X className="w-5 h-5 text-gray-500 font-mono tracking-wider" /></button>
                        </div>
                        <form onSubmit={handleUpdateTeam} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 font-mono tracking-wider uppercase tracking-wider mb-1">Team Name</label>
                                    <input type="text" value={editFormData.teamName} onChange={e => setEditFormData({ ...editFormData, teamName: e.target.value })} className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 font-mono tracking-wider uppercase tracking-wider mb-1">Team Code</label>
                                    <input type="text" value={editFormData.teamCode} onChange={e => setEditFormData({ ...editFormData, teamCode: e.target.value })} className={inputCls} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 font-mono tracking-wider uppercase tracking-wider mb-1">Idea Title</label>
                                <input type="text" value={editFormData.ideaTitle} onChange={e => setEditFormData({ ...editFormData, ideaTitle: e.target.value })} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 font-mono tracking-wider uppercase tracking-wider mb-1">Track / Theme</label>
                                <input type="text" value={editFormData.theme} onChange={e => setEditFormData({ ...editFormData, theme: e.target.value })} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 font-mono tracking-wider uppercase tracking-wider mb-1">Project Description</label>
                                <textarea value={editFormData.projectObjective} onChange={e => setEditFormData({ ...editFormData, projectObjective: e.target.value })} rows={3} className={inputCls + " resize-none"} />
                            </div>
                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="text-sm font-bold text-gray-900 mb-3">Team Leader</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="text" placeholder="Name" value={editFormData.leader.name} onChange={e => setEditFormData({ ...editFormData, leader: { ...editFormData.leader, name: e.target.value } })} className={inputCls} />
                                    <input type="email" placeholder="Email" value={editFormData.leader.email} onChange={e => setEditFormData({ ...editFormData, leader: { ...editFormData.leader, email: e.target.value } })} className={inputCls} />
                                    <input type="text" placeholder="Phone" value={editFormData.leader.phone} onChange={e => setEditFormData({ ...editFormData, leader: { ...editFormData.leader, phone: e.target.value } })} className={inputCls} />
                                    <input type="text" placeholder="College" value={editFormData.leader.college} onChange={e => setEditFormData({ ...editFormData, leader: { ...editFormData.leader, college: e.target.value } })} className={inputCls} />
                                </div>
                            </div>
                            <div className="border-t border-gray-200 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-gray-900">Team Members ({editFormData.members.length})</h3>
                                    <button type="button" onClick={() => setEditFormData({ ...editFormData, members: [...editFormData.members, { id: '', name: '', email: '', phone: '', course: '', section: '', system_id: '', year: '', college: '' }] })} className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-purple-500 bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded-xl transition-colors">
                                        <Plus className="w-3 h-3" /> Add Member
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {editFormData.members.map((m, idx) => (
                                        <div key={idx} className="flex gap-2 items-start">
                                            <div className="flex-1 grid grid-cols-3 gap-2">
                                                <input type="text" placeholder={`Member ${idx + 1} Name`} value={m.name} onChange={e => { const members = [...editFormData.members]; members[idx] = { ...members[idx], name: e.target.value }; setEditFormData({ ...editFormData, members }); }} className={inputCls} />
                                                <input type="email" placeholder="Email" value={m.email} onChange={e => { const members = [...editFormData.members]; members[idx] = { ...members[idx], email: e.target.value }; setEditFormData({ ...editFormData, members }); }} className={inputCls} />
                                                <input type="text" placeholder="Phone" value={m.phone} onChange={e => { const members = [...editFormData.members]; members[idx] = { ...members[idx], phone: e.target.value }; setEditFormData({ ...editFormData, members }); }} className={inputCls} />
                                            </div>
                                            <button type="button" onClick={() => { const members = editFormData.members.filter((_, i) => i !== idx); setEditFormData({ ...editFormData, members }); }} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors flex-shrink-0 mt-0.5" title="Remove member">
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {editFormData.members.length === 0 && <p className="text-sm text-gray-400 font-mono italic text-center py-3">No members added. Click &quot;Add Member&quot; above.</p>}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-gray-200">
                                <button type="submit" className="flex-1 bg-emerald-500 hover:bg-white text-black font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] text-gray-900 font-medium py-2.5 rounded-xl shadow-sm transition-all text-sm">Save Changes</button>
                                <button type="button" onClick={() => setEditingTeam(null)} className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl shadow-sm transition-all text-sm">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manual Add Team Modal */}
            {showManualAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm p-4" onClick={() => setShowManualAdd(false)}>
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-600" /> Add Team Manually</h2>
                            <button onClick={() => setShowManualAdd(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <form onSubmit={handleAddManualTeam} className="space-y-5">
                            {/* Team Info */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Team Information</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Team Name *</label>
                                        <input type="text" name="teamName" required className={inputCls} placeholder="e.g. Code Crusaders" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Team Code</label>
                                        <input type="text" name="teamCode" className={inputCls} placeholder="e.g. TC-042" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Idea Title *</label>
                                        <input type="text" name="ideaTitle" required className={inputCls} placeholder="Project idea title" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Track / Theme</label>
                                        <input type="text" name="theme" className={inputCls} placeholder="e.g. HealthTech" />
                                    </div>
                                </div>
                            </div>

                            {/* Leader */}
                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Team Leader</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Name *</label><input type="text" name="leaderName" required className={inputCls} placeholder="Leader name" /></div>
                                    <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Email *</label><input type="email" name="leaderEmail" required className={inputCls} placeholder="leader@email.com" /></div>
                                    <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone</label><input type="text" name="leaderPhone" className={inputCls} placeholder="Phone" /></div>
                                    <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">College</label><input type="text" name="leaderCollege" className={inputCls} placeholder="College" /></div>
                                    <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Course</label><input type="text" name="leaderCourse" className={inputCls} placeholder="Course" /></div>
                                    <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Section</label><input type="text" name="leaderSection" className={inputCls} placeholder="Section" /></div>
                                    <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">System ID</label><input type="text" name="leaderSystemId" className={inputCls} placeholder="System ID" /></div>
                                    <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Year</label><input type="text" name="leaderYear" className={inputCls} placeholder="Year" /></div>
                                </div>
                            </div>

                            {/* Members */}
                            {[1, 2, 3, 4].map(n => (
                                <div key={n} className="border-t border-gray-100 pt-4">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Member {n} <span className="text-gray-300 font-normal">(optional)</span></h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Name</label><input type="text" name={`m${n}Name`} className={inputCls} placeholder={`Member ${n} name`} /></div>
                                        <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Email</label><input type="email" name={`m${n}Email`} className={inputCls} placeholder="Email" /></div>
                                        <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone</label><input type="text" name={`m${n}Phone`} className={inputCls} placeholder="Phone" /></div>
                                        <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">College</label><input type="text" name={`m${n}College`} className={inputCls} placeholder="College" /></div>
                                        <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Course</label><input type="text" name={`m${n}Course`} className={inputCls} placeholder="Course" /></div>
                                        <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Section</label><input type="text" name={`m${n}Section`} className={inputCls} placeholder="Section" /></div>
                                        <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">System ID</label><input type="text" name={`m${n}SystemId`} className={inputCls} placeholder="System ID" /></div>
                                        <div><label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Year</label><input type="text" name={`m${n}Year`} className={inputCls} placeholder="Year" /></div>
                                    </div>
                                </div>
                            ))}

                            <div className="flex gap-3 pt-4 border-t border-gray-200">
                                <button type="submit" disabled={addingManualMode} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                    {addingManualMode ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Adding...</> : <><Plus className="w-4 h-4" /> Add Team</>}
                                </button>
                                <button type="button" onClick={() => setShowManualAdd(false)} className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl text-sm transition-colors">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

                {/* Attendance Tab */}
                <TabsContent value="attendance" className="mt-0 space-y-6">
                    {/* Event Config */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 shadow-none">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4"><MapPin className="w-4 h-4 text-violet-500" /> Event Attendance Tracking</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 font-mono tracking-wider uppercase tracking-wider mb-1">Event Tag (ID)</label>
                                <input type="text" value={attEventTag} onChange={e => { setAttEventTag(e.target.value); setAttSettingsSaved(false); }} placeholder="e.g. hackathon_2026" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 font-mono tracking-wider uppercase tracking-wider mb-1">Event Name (for emails)</label>
                                <input type="text" value={attEventName} onChange={e => { setAttEventName(e.target.value); setAttSettingsSaved(false); }} placeholder="e.g. AWS Student Community Day" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
                            </div>
                            <div className="flex items-end gap-2">
                                <button onClick={async () => {
                                    await saveAttendanceEventSettings(attEventTag, attEventName);
                                    setAttSettingsSaved(true);
                                    loadAttendees(attEventTag);
                                    setTimeout(() => setAttSettingsSaved(false), 3000);
                                }} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-sm text-sm font-bold transition-all ${attSettingsSaved ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-600 hover:bg-violet-500 text-gray-900'}`}>
                                    {attSettingsSaved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : 'Save & Load'}
                                </button>
                                <button onClick={() => { setAttEventTag(''); setAttEventName(''); setAttSettingsSaved(false); setAttendees([]); }} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-all shadow-sm whitespace-nowrap" title="Clear fields to start a new event">
                                    <Plus className="w-4 h-4 inline-block mr-1" /> New Event
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-violet-50 border border-violet-200 rounded-xl shadow-sm">
                            <MapPin className="w-4 h-4 text-violet-500 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs text-violet-700 font-medium">Student Self-Registration Form</p>
                                <p className="text-[11px] text-violet-500">Share this link with students so they can fill in their System ID, Section, and Department.</p>
                            </div>
                            <a href="/attendance/register" target="_blank" className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-gray-900 rounded-xl text-xs font-medium transition-all">
                                <ExternalLink className="w-3 h-3" /> Open Form
                            </a>
                        </div>
                    </div>

                    {/* Import + Actions */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 shadow-none">
                        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-900">Import Attendees</h3>
                            <div className="flex gap-2 flex-wrap">
                                <label className={`flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm text-sm font-medium cursor-pointer transition-all ${attUploading ? 'bg-gray-100 text-gray-400 font-mono' : 'bg-violet-600 hover:bg-violet-500 text-gray-900'}`}>
                                    <Upload className="w-4 h-4" /> {attUploading ? 'Importing...' : 'Upload CSV/XLSX'}
                                    <input ref={attFileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleAttUpload} className="hidden" disabled={attUploading} />
                                </label>
                                <button onClick={() => loadAttendees()} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl shadow-sm text-sm font-medium transition-all">
                                    <RefreshCw className="w-4 h-4" /> Refresh
                                </button>
                                <button onClick={handleExportAttendance} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl shadow-sm text-sm font-medium transition-all">
                                    <Download className="w-4 h-4" /> Export Report
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 font-mono">Upload a CSV/XLSX with columns: Name, Email, Mobile, System ID, Section, Department, College. The event tag above filters which attendees are shown.</p>
                    </div>

                    {/* Checkpoints Config */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 shadow-none">
                        <h3 className="text-sm font-bold text-gray-900 mb-3">Checkpoints</h3>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {attCheckpoints.map((cp, i) => (
                                <span key={i} className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 text-violet-700 px-3 py-1.5 rounded-xl text-xs font-medium">
                                    {cp}
                                    <button onClick={async () => { const updated = attCheckpoints.filter((_, idx) => idx !== i); setAttCheckpoints(updated); await updateAttendanceCheckpoints(updated); }} className="text-violet-400 hover:text-red-500 ml-1">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input type="text" value={newCheckpoint} onChange={e => setNewCheckpoint(e.target.value)} placeholder="New checkpoint name" className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
                            <button onClick={async () => { if (!newCheckpoint.trim()) return; const updated = [...attCheckpoints, newCheckpoint.trim()]; setAttCheckpoints(updated); setNewCheckpoint(''); await updateAttendanceCheckpoints(updated); }} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-gray-900 rounded-xl text-sm font-medium transition-all">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* QR Email Section */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 shadow-none">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3"><Mail className="w-4 h-4 text-violet-500" /> Send QR Code Emails</h3>
                        <div className="flex items-center gap-4 mb-3">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 text-sm">
                                    <span className="text-gray-500 font-mono tracking-wider">Total: <strong className="text-gray-900">{attendees.length}</strong></span>
                                    <span className="text-emerald-600">Emailed: <strong>{attendees.filter(a => a.qr_emailed).length}</strong></span>
                                    <span className="text-orange-600">Pending: <strong>{attendees.filter(a => !a.qr_emailed && a.email).length}</strong></span>
                                </div>
                            </div>
                            <button onClick={async () => {
                                setAttSendingEmails(true); setAttEmailResult(null);
                                const result = await sendAttendeeQrEmails(attEventTag, attEventName);
                                setAttEmailResult(result);
                                setAttSendingEmails(false);
                                loadAttendees();
                            }} disabled={attSendingEmails} className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-gray-900 rounded-xl shadow-sm text-sm font-bold transition-all disabled:opacity-50">
                                {attSendingEmails ? <><div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send All QR Emails</>}
                            </button>
                        </div>
                        {attEmailResult && (
                            <div className={`p-3 rounded-xl shadow-sm text-sm ${attEmailResult.error && !attEmailResult.sent ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                                <p className="font-medium">{attEmailResult.message || attEmailResult.error}</p>
                                {attEmailResult.failedEmails && attEmailResult.failedEmails.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-xs font-bold text-red-600 mb-1">Failed emails (retry these):</p>
                                        <p className="text-xs text-red-500 break-all">{attEmailResult.failedEmails.join(', ')}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Attendee List */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 shadow-none">
                        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-900">Attendees ({filteredAttendees.length})</h3>
                            <div className="flex gap-2 items-center">
                                <div className="relative flex-1 md:w-64">
                                    <input type="text" placeholder="Search attendees..." value={attSearchQuery} onChange={e => { setAttSearchQuery(e.target.value); setAttCurrentPage(1); }} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
                                    <Search className="w-4 h-4 text-gray-400 font-mono absolute left-3 top-1/2 -translate-y-1/2" />
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-2 rounded-xl text-sm whitespace-nowrap select-none transition-colors">
                                    <input type="checkbox" checked={attShardaOnly} onChange={(e) => { setAttShardaOnly(e.target.checked); setAttCurrentPage(1); }} className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer" />
                                    <span className="font-medium text-gray-700">Sharda Only</span>
                                </label>
                                <button onClick={async () => { if (confirm('Delete ALL attendees for this event tag? This cannot be undone.')) { await deleteEventAttendees(attEventTag); setAttendees([]); setMessage({ type: 'success', text: 'All attendees deleted.' }); }}} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="Delete all attendees">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {attLoading ? (
                            <div className="text-center py-8"><div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-2" /><p className="text-gray-500 font-mono tracking-wider text-sm">Loading attendees...</p></div>
                        ) : filteredAttendees.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 font-mono text-sm border-2 border-dashed border-gray-200 rounded-xl shadow-sm">No attendees found. Import a CSV/XLSX file above.</div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 text-gray-500 font-mono tracking-wider text-xs uppercase">
                                                <th className="px-3 py-2 text-left font-semibold">#</th>
                                                <th className="px-3 py-2 text-left font-semibold">Name</th>
                                                <th className="px-3 py-2 text-left font-semibold">System ID</th>
                                                <th className="px-3 py-2 text-left font-semibold">Section</th>
                                                <th className="px-3 py-2 text-left font-semibold">Department</th>
                                                <th className="px-3 py-2 text-left font-semibold">Year</th>
                                                <th className="px-3 py-2 text-left font-semibold">Email</th>
                                                <th className="px-3 py-2 text-center font-semibold">QR Sent</th>
                                                {attCheckpoints.map(cp => (
                                                    <th key={cp} className="px-3 py-2 text-center font-semibold">{cp}</th>
                                                ))}
                                                <th className="px-3 py-2 text-center font-semibold">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedAttendees.map((a: any, idx: number) => {
                                                const isEditing = editingAttendeeId === a.id;
                                                return (
                                                    <tr key={a.id} className="border-t border-gray-200 hover:bg-gray-50">
                                                        <td className="px-3 py-2 text-gray-400 font-mono text-xs">{(attCurrentPage - 1) * ATT_ITEMS_PER_PAGE + idx + 1}</td>
                                                        <td className="px-3 py-2">
                                                            {isEditing ? <input value={editAttendeeFormData.name} onChange={e => setEditAttendeeFormData({ ...editAttendeeFormData, name: e.target.value })} className="w-full text-xs p-1 border rounded" /> : <span className="font-medium text-gray-900">{a.name}</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-violet-600 font-mono text-xs">
                                                            {isEditing ? <input value={editAttendeeFormData.system_id || ''} onChange={e => setEditAttendeeFormData({ ...editAttendeeFormData, system_id: e.target.value })} className="w-full text-xs p-1 border rounded" /> : (a.system_id || '—')}
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-600 text-xs">
                                                            {isEditing ? <input value={editAttendeeFormData.section || ''} onChange={e => setEditAttendeeFormData({ ...editAttendeeFormData, section: e.target.value })} className="w-full text-xs p-1 border rounded" /> : (a.section || '—')}
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-600 text-xs">
                                                            {isEditing ? <input value={editAttendeeFormData.department || ''} onChange={e => setEditAttendeeFormData({ ...editAttendeeFormData, department: e.target.value })} className="w-full text-xs p-1 border rounded" /> : (a.department || '—')}
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-600 text-xs">
                                                            {isEditing ? <input value={editAttendeeFormData.year || ''} onChange={e => setEditAttendeeFormData({ ...editAttendeeFormData, year: e.target.value })} className="w-full text-xs p-1 border rounded" /> : (a.year || '—')}
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-500 font-mono tracking-wider text-xs truncate max-w-[150px]">
                                                            {isEditing ? <input value={editAttendeeFormData.email || ''} onChange={e => setEditAttendeeFormData({ ...editAttendeeFormData, email: e.target.value })} className="w-full text-xs p-1 border rounded" /> : (a.email || '—')}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            {a.qr_emailed ? <span className="text-emerald-500 text-xs font-bold">✓</span> : <span className="text-gray-300 text-xs">✗</span>}
                                                        </td>
                                                        {attCheckpoints.map(cp => {
                                                            const scan = a.event_attendance_scans?.find((s: any) => s.checkpoint === cp);
                                                            return (
                                                                <td key={cp} className="px-3 py-2 text-center">
                                                                    {scan ? <span className="text-emerald-500 text-xs font-bold" title={new Date(scan.scanned_at).toLocaleString()}>✓</span> : <span className="text-gray-300 text-xs">✗</span>}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-3 py-2 text-center">
                                                            {isEditing ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <button onClick={handleEditSave} disabled={editSaving} className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"><Save className="w-4 h-4" /></button>
                                                                    <button onClick={handleEditCancel} disabled={editSaving} className="text-gray-400 font-mono hover:text-gray-600"><X className="w-4 h-4" /></button>
                                                                </div>
                                                            ) : (
                                                                <button onClick={() => handleEditStart(a)} className="text-violet-600 hover:text-violet-700 p-1 bg-violet-50 rounded-xl"><Edit2 className="w-3.5 h-3.5" /></button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {attTotalPages > 1 && (
                                    <div className="flex items-center justify-between px-3 py-3 border-t border-gray-200">
                                        <span className="text-xs text-gray-500 font-mono tracking-wider">Page {attCurrentPage} of {attTotalPages}</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => setAttCurrentPage(p => Math.max(1, p - 1))} disabled={attCurrentPage === 1} className="p-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                                            <button onClick={() => setAttCurrentPage(p => Math.min(attTotalPages, p + 1))} disabled={attCurrentPage === attTotalPages} className="p-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </TabsContent>

            </Tabs>

            </>
            )}
        </div>
    );
}
