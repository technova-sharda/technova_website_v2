"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { processVolunteerQrScan, getAllVolunteersForScan } from "@/lib/actions/hackathon";
import { ArrowLeft, Camera, QrCode, CheckCircle, AlertCircle, Search, UserCheck, LogOut, ChevronLeft, ChevronRight, X, Download } from "lucide-react";

const ITEMS_PER_PAGE = 15;

export default function VolunteerScannerClient() {
    const [scanResult, setScanResult] = useState<'success' | 'error' | 'already' | null>(null);
    const [message, setMessage] = useState("");
    const [volunteerName, setVolunteerName] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState("");

    // Search state
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [allVolunteers, setAllVolunteers] = useState<any[]>([]);
    const [loadingVolunteers, setLoadingVolunteers] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        if (showSearch && allVolunteers.length === 0) {
            loadAllVolunteers();
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

    const loadAllVolunteers = async () => {
        setLoadingVolunteers(true);
        const result = await getAllVolunteersForScan();
        setAllVolunteers(result.volunteers);
        setLoadingVolunteers(false);
    };

    const filteredVolunteers = useMemo(() => {
        if (!searchQuery || searchQuery.length < 1) return allVolunteers;
        const q = searchQuery.toLowerCase();
        return allVolunteers.filter(v => {
            const name = (v.name || '').toLowerCase();
            const email = (v.email || '').toLowerCase();
            const teamName = (v.team_name || '').toLowerCase();
            const mobile = (v.mobile || '').toLowerCase();
            const department = (v.department || '').toLowerCase();
            return name.includes(q) || email.includes(q) || teamName.includes(q) || mobile.includes(q) || department.includes(q);
        });
    }, [allVolunteers, searchQuery]);

    const totalPages = Math.ceil(filteredVolunteers.length / ITEMS_PER_PAGE);
    const paginatedVolunteers = filteredVolunteers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    useEffect(() => { setCurrentPage(1) }, [searchQuery]);

    const startCamera = async () => {
        setCameraError("");
        try {
            const scanner = new Html5Qrcode("vol-reader", {
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                verbose: false
            });
            scannerRef.current = scanner;

            await scanner.start(
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
            const volunteerId = decodedText.trim();
            const result = await processVolunteerQrScan(volunteerId, 'checkin');

            if (result.success) {
                setScanResult('success');
                setMessage(result.message || "Success!");
                setVolunteerName(result.volunteer?.name || '');
            } else if (result.message === "Already checked in") {
                setScanResult('already');
                setMessage("Volunteer already checked in.");
                setVolunteerName(result.volunteer?.name || '');
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
            setVolunteerName("");
            setIsScanning(false);
            if (scannerRef.current) {
                scannerRef.current.resume();
            }
        }, 3000);
    };

    const handleManualAction = async (volunteerId: string, action: 'checkin' | 'checkout') => {
        setProcessingId(volunteerId);
        try {
            const result = await processVolunteerQrScan(volunteerId, action);
            if (result.success) {
                setMessage(result.message || "Success!");
                setScanResult('success');
                setAllVolunteers(prev => prev.map(v => {
                    if (v.id !== volunteerId) return v;
                    return {
                        ...v,
                        is_checked_in: action === 'checkin',
                        check_in_time: action === 'checkin' ? new Date().toISOString() : v.check_in_time
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

    const handleDownloadAttendance = () => {
        const csvHeader = "Name,Email,Team/Role,Shift,Department,System ID,Section,Year,Mobile,Checked In,Check-in Time\n";
        const csvRows = allVolunteers.map(v =>
            `"${v.name}","${v.email}","${v.team_name || ''}","${v.shift || ''}","${v.department || ''}","${v.system_id || ''}","${v.section || ''}","${v.year || ''}","${v.mobile || ''}","${v.is_checked_in ? 'Yes' : 'No'}","${v.check_in_time ? new Date(v.check_in_time).toLocaleString() : ''}"`
        ).join('\n');
        const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `volunteer_attendance_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-white text-gray-900 p-4">
            <header className="max-w-md mx-auto py-3 flex items-center justify-between mb-4">
                <Link href="/hackathon-portal" className="text-gray-400 font-mono hover:text-gray-900 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-violet-400" />
                    <h1 className="text-lg font-bold">Volunteer Scanner</h1>
                </div>
                <button onClick={handleDownloadAttendance} className="text-gray-400 font-mono hover:text-gray-900 transition-colors" title="Download Attendance">
                    <Download className="w-5 h-5" />
                </button>
            </header>

            <main className="max-w-md mx-auto space-y-4">
                {/* Toggle: Camera vs Search */}
                <div className="flex bg-gray-50 p-1 rounded-xl shadow-sm">
                    <button
                        onClick={() => { setShowSearch(false); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-colors ${!showSearch ? 'bg-violet-600 text-gray-900 shadow-lg' : 'text-gray-400 font-mono hover:text-gray-900'}`}
                    >
                        <Camera className="w-3.5 h-3.5" /> QR Camera
                    </button>
                    <button
                        onClick={() => { setShowSearch(true); stopCamera(); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-colors ${showSearch ? 'bg-violet-600 text-gray-900 shadow-lg' : 'text-gray-400 font-mono hover:text-gray-900'}`}
                    >
                        <Search className="w-3.5 h-3.5" /> Search & Check-in/Out
                    </button>
                </div>

                {/* Status message */}
                {scanResult && showSearch && (
                    <div className={`p-3 rounded-xl shadow-sm text-sm font-medium text-center ${scanResult === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' :
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
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 font-mono tracking-wider" />
                            <input
                                type="text"
                                placeholder="Search by name, email, department, mobile..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl shadow-sm pl-10 pr-10 py-3 text-gray-900 text-sm focus:outline-none focus:border-violet-500"
                                autoFocus
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono tracking-wider hover:text-gray-900">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono tracking-wider px-1">
                            <span>{filteredVolunteers.length} volunteer{filteredVolunteers.length !== 1 ? 's' : ''} {searchQuery ? 'found' : 'total'}</span>
                            {totalPages > 1 && <span>Page {currentPage} of {totalPages}</span>}
                        </div>

                        {loadingVolunteers ? (
                            <div className="text-center py-6">
                                <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-2" />
                                <p className="text-gray-500 font-mono tracking-wider text-xs">Loading volunteers...</p>
                            </div>
                        ) : paginatedVolunteers.length === 0 ? (
                            <div className="text-center py-6 text-gray-500 font-mono tracking-wider text-sm border border-dashed border-gray-100 rounded-xl shadow-sm">
                                {searchQuery ? `No volunteers found for "${searchQuery}"` : 'No volunteers found'}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {paginatedVolunteers.map((v: any) => (
                                    <div key={v.id} className="flex items-center justify-between p-3 rounded-xl shadow-sm bg-gray-50 border border-gray-100">
                                        <div className="flex-1 min-w-0 mr-3">
                                            <p className="text-sm font-bold text-gray-900 truncate">{v.name}</p>
                                            <p className="text-[11px] text-gray-500 font-mono tracking-wider truncate">
                                                <span className="text-violet-400 font-medium mr-1.5">{v.team_name || 'Volunteer'}</span>
                                                {v.shift && <span className="text-blue-400 mr-1.5">· {v.shift}</span>}
                                                {v.department && <span>· {v.department}</span>}
                                            </p>
                                            <p className="text-[11px] text-gray-600 truncate">{v.email}</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded ${v.is_checked_in ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-500 font-mono tracking-wider bg-gray-50'}`}>
                                                {v.is_checked_in ? 'In' : 'Out'}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => handleManualAction(v.id, 'checkin')}
                                                    disabled={processingId === v.id || v.is_checked_in}
                                                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 bg-emerald-500 hover:bg-white text-black font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] text-gray-900"
                                                >
                                                    {processingId === v.id ? '...' : v.is_checked_in ? 'Done' : 'Check In'}
                                                </button>
                                                <button
                                                    onClick={() => handleManualAction(v.id, 'checkout')}
                                                    disabled={processingId === v.id || !v.is_checked_in}
                                                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 bg-rose-600 hover:bg-rose-500 text-gray-900"
                                                >
                                                    {processingId === v.id ? '...' : !v.is_checked_in ? 'Out' : 'Check Out'}
                                                </button>
                                            </div>
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
                                    className="p-2 rounded-xl bg-gray-50 border border-gray-100 text-gray-400 font-mono hover:text-gray-900 disabled:opacity-30 transition-all"
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
                                                className={`w-8 h-8 rounded-xl text-xs font-medium transition-all ${currentPage === pageNum ? 'bg-violet-600 text-gray-900' : 'bg-gray-50 text-gray-400 font-mono hover:text-gray-900'}`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-xl bg-gray-50 border border-gray-100 text-gray-400 font-mono hover:text-gray-900 disabled:opacity-30 transition-all"
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
                            <p className="text-xs text-gray-400 font-mono">
                                Scan volunteer QR codes to mark attendance.
                            </p>
                        </div>

                        <div className="relative w-full aspect-square bg-black rounded-xl shadow-sm overflow-hidden border border-[#00FF41]/20 flex flex-col items-center justify-center">
                            <div id="vol-reader" className="w-full h-full absolute inset-0"></div>

                            {/* Sniper HUD Overlay */}
                            <div className="absolute inset-8 pointer-events-none z-10 opacity-70">
                                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#00FF41]"></div>
                                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#00FF41]"></div>
                                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#00FF41]"></div>
                                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#00FF41]"></div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-emerald-500 rounded-full animate-ping"></div>
                            </div>

                            {!cameraActive && !scanResult && (
                                <div className="z-20 flex flex-col items-center p-6 text-center">
                                    <button
                                        onClick={startCamera}
                                        className="bg-emerald-500 hover:bg-white text-black font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] px-8 py-4 flex items-center gap-3 transition-colors mb-4"
                                    >
                                        <Camera className="w-6 h-6" /> START SCANNING
                                    </button>
                                    {cameraError && <p className="text-red-400 text-sm font-mono mt-2 bg-red-500/10 px-3 py-1 shadow-sm">{cameraError}</p>}
                                </div>
                            )}

                            {scanResult && (
                                <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md ${scanResult === 'success' ? 'bg-emerald-500/90' :
                                    scanResult === 'already' ? 'bg-amber-500/90' : 'bg-red-500/90'
                                    }`}>
                                    {scanResult === 'success' ? <CheckCircle className="w-16 h-16 text-gray-900 mb-4 drop-shadow-none" /> :
                                        <AlertCircle className="w-16 h-16 text-gray-900 mb-4 drop-shadow-none" />}

                                    <h2 className="text-2xl font-black text-gray-900 drop-shadow-none tracking-tight mb-2">
                                        {scanResult === 'success' ? 'SUCCESS' : scanResult === 'already' ? 'ALREADY SCANNED' : 'ERROR'}
                                    </h2>
                                    {volunteerName && <p className="text-xl font-bold text-gray-900 mb-1">{volunteerName}</p>}
                                    <p className="text-gray-900/90 font-medium text-sm">{message}</p>
                                </div>
                            )}
                        </div>

                        {cameraActive && !scanResult && (
                            <button
                                onClick={stopCamera}
                                className="w-full py-3 text-center text-gray-400 font-mono hover:text-gray-900 font-medium transition-colors text-sm"
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
