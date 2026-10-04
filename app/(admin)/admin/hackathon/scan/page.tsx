"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { processHackathonQrScan, getAllParticipantsForScan } from "@/lib/actions/hackathon";
import { ArrowLeft, Camera, QrCode, CheckCircle, AlertCircle, Coffee, ChevronDown, Search, UserCheck, LogOut, ChevronLeft, ChevronRight, X, Utensils } from "lucide-react";
import { createClient } from "@/supabase/client";

const MEAL_ROUNDS = [
    "Breakfast - Day 1",
    "Lunch - Day 1",
    "Snacks - Day 1",
    "Dinner - Day 1",
    "Breakfast - Day 2",
    "Lunch - Day 2",
];

const ITEMS_PER_PAGE = 15;

export default function HackathonScannerPage() {
    const [mode, setMode] = useState<'checkin' | 'food'>('checkin');
    const [customMeals, setCustomMeals] = useState<string[]>(MEAL_ROUNDS);
    const [selectedMeal, setSelectedMeal] = useState(MEAL_ROUNDS[0]);
    const [scanResult, setScanResult] = useState<'success' | 'error' | 'already' | null>(null);
    const [message, setMessage] = useState("");
    const [participantName, setParticipantName] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState("");

    // Search state
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [allParticipants, setAllParticipants] = useState<any[]>([]);
    const [loadingParticipants, setLoadingParticipants] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const scannerRef = useRef<Html5Qrcode | null>(null);

    // Fetch custom meals from admin settings
    useEffect(() => {
        const fetchMeals = async () => {
            const supabase = createClient();
            const { data } = await supabase.from('hackathon_settings').select('custom_meals').single();
            if (data?.custom_meals && Array.isArray(data.custom_meals) && data.custom_meals.length > 0) {
                setCustomMeals(data.custom_meals);
                setSelectedMeal(data.custom_meals[0]);
            }
        };
        fetchMeals();
    }, []);

    // Load all participants when search mode is activated
    useEffect(() => {
        if (showSearch && allParticipants.length === 0) {
            loadAllParticipants();
        }
    }, [showSearch]);

    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                if (scannerRef.current.isScanning) {
                    scannerRef.current.stop().catch(console.error);
                }
                scannerRef.current.clear();
            }
        };
    }, []);

    const loadAllParticipants = async () => {
        setLoadingParticipants(true);
        let allData: any[] = [];
        let page = 1;
        const batchSize = 100;
        while (true) {
            const result = await getAllParticipantsForScan(page, batchSize);
            allData = [...allData, ...result.participants];
            if (allData.length >= result.total || result.participants.length < batchSize) break;
            page++;
        }
        setAllParticipants(allData);
        setLoadingParticipants(false);
    };

    // Client-side filtering
    const filteredParticipants = useMemo(() => {
        if (!searchQuery || searchQuery.length < 1) return allParticipants;
        const q = searchQuery.toLowerCase();
        return allParticipants.filter(p => {
            const name = (p.name || '').toLowerCase();
            const email = (p.email || '').toLowerCase();
            const phone = (p.phone || '').toLowerCase();
            const teamCode = (p.hackathon_teams?.team_code || '').toLowerCase();
            const teamName = (p.hackathon_teams?.name || '').toLowerCase();
            return name.includes(q) || email.includes(q) || phone.includes(q) || teamCode.includes(q) || teamName.includes(q);
        });
    }, [allParticipants, searchQuery]);

    const totalPages = Math.ceil(filteredParticipants.length / ITEMS_PER_PAGE);
    const paginatedParticipants = filteredParticipants.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    useEffect(() => { setCurrentPage(1); }, [searchQuery]);

    const startCamera = async () => {
        setScanResult(null);
        setMessage("");
        setCameraError("");
        setShowSearch(false);

        try {
            if (scannerRef.current) {
                try {
                    if (scannerRef.current.isScanning) await scannerRef.current.stop();
                    scannerRef.current.clear();
                } catch { }
                scannerRef.current = null;
            }

            scannerRef.current = new Html5Qrcode("reader", {
                verbose: false,
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                useBarCodeDetectorIfSupported: false
            });

            await scannerRef.current.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                handleScanSuccess,
                () => { }
            );

            setCameraActive(true);
        } catch (err) {
            console.error(err);
            setCameraError("Camera failed to start. Please check permissions.");
        }
    };

    const modeRef = useRef(mode);
    const selectedMealRef = useRef(selectedMeal);
    useEffect(() => { modeRef.current = mode; }, [mode]);
    useEffect(() => { selectedMealRef.current = selectedMeal; }, [selectedMeal]);

    const stopCamera = async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch (err) {
                console.error(err);
            }
            setCameraActive(false);
        }
    };

    const playSuccessSound = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const playTone = (freq: number, type: OscillatorType, startTime: number, duration: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = type;
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
                osc.start(startTime);
                osc.stop(startTime + duration);
            };
            const now = ctx.currentTime;
            playTone(900, 'square', now, 0.1);
            playTone(1200, 'square', now + 0.1, 0.2);
        } catch(e) { console.warn("Audio playback failed", e) }
    };

    const handleScanSuccess = async (decodedText: string) => {
        setIsScanning(true);
        playSuccessSound();
        if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.pause(true);
        }

        try {
            const participantId = decodedText.trim();
            const currentMode = modeRef.current;
            const currentMeal = selectedMealRef.current;
            const result = await processHackathonQrScan(participantId, currentMode, currentMode === 'food' ? currentMeal : undefined);

            if (result.success) {
                setScanResult('success');
                setMessage(result.message || "Success!");
                setParticipantName(result.participant.name);
            } else if (result.message === "Already checked in") {
                setScanResult('already');
                setMessage("Participant already checked in.");
                setParticipantName(result.participant.name);
            } else {
                setScanResult('error');
                setMessage(result.error || "Invalid QR Code.");
            }
        } catch (err) {
            setScanResult('error');
            setMessage("Scan failed.");
        }

        setTimeout(() => {
            setScanResult(null);
            setMessage("");
            setParticipantName("");
            setIsScanning(false);
            if (scannerRef.current) {
                scannerRef.current.resume();
            }
        }, 3000);
    };

    const handleManualAction = async (participantId: string, actionStr: 'checkin' | 'checkout' | 'food' | 'food_unlog') => {
        setProcessingId(participantId);
        try {
            const result = await processHackathonQrScan(participantId, actionStr, (actionStr === 'food' || actionStr === 'food_unlog') ? selectedMeal : undefined);
            if (result.success) {
                setMessage(result.message || "Success!");
                setScanResult('success');
                setAllParticipants(prev => prev.map(p => {
                    if (p.id !== participantId) return p;
                    return {
                        ...p,
                        is_checked_in: actionStr === 'checkout' ? false : (actionStr === 'checkin' ? true : p.is_checked_in),
                        food_count: actionStr === 'food' ? (p.food_count || 0) + 1 : (actionStr === 'food_unlog' ? Math.max(0, (p.food_count || 1) - 1) : p.food_count)
                    };
                }));
            } else if (result.message === "Already checked in" || result.message === "Not checked in") {
                setMessage(result.message);
                setScanResult('already');
            } else {
                setMessage(result.error || "Failed.");
                setScanResult('error');
            }
        } catch {
            setMessage("Action failed.");
            setScanResult('error');
        }
        setProcessingId(null);
        setTimeout(() => { setScanResult(null); setMessage(""); }, 3000);
    };

    return (
        <div className="min-h-screen bg-black text-white p-4">
            <header className="max-w-md mx-auto py-3 flex items-center justify-between mb-4">
                <Link href="/admin/hackathon" className="text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-emerald-400" />
                    <h1 className="text-lg font-bold">Hackathon Scanner</h1>
                </div>
                <div className="w-6" />
            </header>

            <main className="max-w-md mx-auto space-y-4">
                {/* Mode Selector */}
                <div className="flex bg-white/5 p-1 rounded-xl">
                    <button
                        onClick={() => setMode('checkin')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-medium text-xs transition-colors ${mode === 'checkin' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <CheckCircle className="w-3.5 h-3.5" /> Check-in
                    </button>
                    <button
                        onClick={() => setMode('food')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-medium text-xs transition-colors ${mode === 'food' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Coffee className="w-3.5 h-3.5" /> Meals
                    </button>
                </div>

                {/* Meal Round Selector */}
                {mode === 'food' && (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                        <label className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2 block">
                            Active Meal Round
                        </label>
                        <div className="relative">
                            <select
                                value={selectedMeal}
                                onChange={(e) => setSelectedMeal(e.target.value)}
                                className="w-full bg-black/60 border border-white/20 rounded-lg px-4 py-2.5 text-white text-sm font-medium appearance-none focus:outline-none focus:border-orange-500 cursor-pointer"
                            >
                                {customMeals.map(meal => (
                                    <option key={meal} value={meal}>{meal}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                        <p className="text-[11px] text-orange-400/60 mt-2">Each participant can only scan once per meal round.</p>
                    </div>
                )}

                {/* Toggle: Camera vs Search */}
                <div className="flex bg-white/5 p-1 rounded-xl">
                    <button
                        onClick={() => { setShowSearch(false); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors ${!showSearch ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Camera className="w-3.5 h-3.5" /> QR Camera
                    </button>
                    <button
                        onClick={() => { setShowSearch(true); stopCamera(); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors ${showSearch ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Search className="w-3.5 h-3.5" /> Search & {mode === 'food' ? 'Log/Unlog Meal' : 'Check-in/Out'}
                    </button>
                </div>

                {/* Status message */}
                {scanResult && showSearch && (
                    <div className={`p-3 rounded-xl text-sm font-medium text-center ${scanResult === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' :
                        scanResult === 'already' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' :
                            'bg-red-500/20 text-red-400 border border-red-500/20'
                        }`}>
                        {message}
                    </div>
                )}

                {/* Search Mode */}
                {showSearch ? (
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search by name, team ID, email, phone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
                                autoFocus
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
                            <span>{filteredParticipants.length} participant{filteredParticipants.length !== 1 ? 's' : ''} {searchQuery ? 'found' : 'total'}</span>
                            {totalPages > 1 && <span>Page {currentPage} of {totalPages}</span>}
                        </div>

                        {loadingParticipants ? (
                            <div className="text-center py-6">
                                <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-2" />
                                <p className="text-gray-500 text-xs">Loading all participants...</p>
                            </div>
                        ) : paginatedParticipants.length === 0 ? (
                            <div className="text-center py-6 text-gray-500 text-sm border border-dashed border-white/10 rounded-xl">
                                {searchQuery ? `No participants found for "${searchQuery}"` : 'No participants found'}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {paginatedParticipants.map((p: any) => (
                                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                                        <div className="flex-1 min-w-0 mr-3">
                                            <p className="text-sm font-bold text-white truncate">{p.name}</p>
                                            <p className="text-[11px] text-gray-500 truncate">
                                                {p.hackathon_teams?.team_code && <span className="text-amber-400 font-mono mr-1.5">{p.hackathon_teams.team_code}</span>}
                                                {p.hackathon_teams?.name || ''} · {p.role}
                                            </p>
                                            <p className="text-[11px] text-gray-600 truncate">{p.email}</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {mode === 'checkin' && (
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded ${p.is_checked_in ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-500 bg-white/5'}`}>
                                                    {p.is_checked_in ? 'In' : 'Out'}
                                                </span>
                                            )}
                                            {mode === 'food' && (
                                                <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-1 rounded inline-flex items-center gap-1"><Utensils className="w-3 h-3" /> {p.food_count}</span>
                                            )}

                                            {mode === 'checkin' ? (
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => handleManualAction(p.id, 'checkin')}
                                                        disabled={processingId === p.id || p.is_checked_in}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 bg-emerald-600 hover:bg-emerald-500 text-white"
                                                    >
                                                        {processingId === p.id ? '...' : p.is_checked_in ? 'Done' : 'Check In'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleManualAction(p.id, 'checkout')}
                                                        disabled={processingId === p.id || !p.is_checked_in}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 bg-rose-600 hover:bg-rose-500 text-white"
                                                    >
                                                        {processingId === p.id ? '...' : !p.is_checked_in ? 'Out' : 'Check Out'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => handleManualAction(p.id, 'food')}
                                                        disabled={processingId === p.id}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 bg-orange-600 hover:bg-orange-500 text-white"
                                                    >
                                                        {processingId === p.id ? '...' : 'Log'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleManualAction(p.id, 'food_unlog')}
                                                        disabled={processingId === p.id}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 bg-rose-600 hover:bg-rose-500 text-white"
                                                    >
                                                        {processingId === p.id ? '...' : 'Unlog'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white disabled:opacity-30 transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = currentPage - 2 + i;
                                        }
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${currentPage === pageNum ? 'bg-emerald-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white disabled:opacity-30 transition-all"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Camera Mode */
                    <>
                        <div className="text-center">
                            <p className="text-xs text-gray-400">
                                {mode === 'checkin'
                                    ? "Scan participants' IDs to mark them as arrived."
                                    : `Scanning for: ${selectedMeal}`}
                            </p>
                        </div>

                        <div className="relative w-full aspect-square bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 flex flex-col items-center justify-center">
                            <div id="reader" className="w-full h-full absolute inset-0"></div>

                            {!cameraActive && !scanResult && (
                                <div className="z-10 flex flex-col items-center p-6 text-center">
                                    <button
                                        onClick={startCamera}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-full font-bold flex items-center gap-3 transition-colors shadow-[0_0_30px_rgba(52,211,153,0.3)] mb-4"
                                    >
                                        <Camera className="w-6 h-6" /> START SCANNING
                                    </button>
                                    {cameraError && <p className="text-red-400 text-sm">{cameraError}</p>}
                                </div>
                            )}

                            {scanResult && (
                                <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md ${scanResult === 'success' ? 'bg-emerald-500/90' :
                                    scanResult === 'already' ? 'bg-amber-500/90' : 'bg-red-500/90'
                                    }`}>
                                    {scanResult === 'success' ? <CheckCircle className="w-16 h-16 text-white mb-4 drop-shadow-md" /> :
                                        <AlertCircle className="w-16 h-16 text-white mb-4 drop-shadow-md" />}

                                    <h2 className="text-2xl font-black text-white drop-shadow-md tracking-tight mb-2">
                                        {scanResult === 'success' ? 'SUCCESS' : scanResult === 'already' ? 'ALREADY SCANNED' : 'ERROR'}
                                    </h2>
                                    {participantName && <p className="text-xl font-bold text-white mb-1">{participantName}</p>}
                                    <p className="text-white/90 font-medium text-sm">{message}</p>
                                </div>
                            )}
                        </div>

                        {cameraActive && !scanResult && (
                            <button
                                onClick={stopCamera}
                                className="w-full py-3 text-center text-gray-400 hover:text-white font-medium transition-colors text-sm"
                            >
                                Stop Camera
                            </button>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
