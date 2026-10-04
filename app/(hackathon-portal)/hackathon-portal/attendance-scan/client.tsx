"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { processAttendanceScan, getAllAttendeesForScan, getAttendanceCheckpoints } from "@/lib/actions/hackathon";
import { ArrowLeft, Camera, QrCode, CheckCircle, AlertCircle, ChevronDown, Search, ChevronLeft, ChevronRight, X, MapPin } from "lucide-react";

const ITEMS_PER_PAGE = 15;

export default function AttendanceScannerClient() {
    const [checkpoints, setCheckpoints] = useState<string[]>(['Registration', 'Food', 'Exit']);
    const [selectedCheckpoint, setSelectedCheckpoint] = useState('Registration');
    const [scanResult, setScanResult] = useState<'success' | 'error' | 'already' | null>(null);
    const [message, setMessage] = useState("");
    const [attendeeName, setAttendeeName] = useState("");
    const [attendeeDetails, setAttendeeDetails] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState("");

    // Search
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [allAttendees, setAllAttendees] = useState<any[]>([]);
    const [loadingAttendees, setLoadingAttendees] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const scannerRef = useRef<Html5Qrcode | null>(null);

    // Load checkpoints
    useEffect(() => {
        getAttendanceCheckpoints().then(cp => {
            if (cp && cp.length > 0) {
                setCheckpoints(cp);
                setSelectedCheckpoint(cp[0]);
            }
        });
    }, []);

    useEffect(() => {
        if (showSearch && allAttendees.length === 0) {
            loadAllAttendees();
        }
    }, [showSearch]);

    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                if (scannerRef.current.isScanning) scannerRef.current.stop().catch(console.error);
                scannerRef.current.clear();
            }
        };
    }, []);

    const loadAllAttendees = async () => {
        setLoadingAttendees(true);
        const result = await getAllAttendeesForScan();
        setAllAttendees(result.attendees);
        setLoadingAttendees(false);
    };

    const filteredAttendees = useMemo(() => {
        if (!searchQuery || searchQuery.length < 1) return allAttendees;
        const q = searchQuery.toLowerCase();
        return allAttendees.filter((a: any) => {
            return (a.name || '').toLowerCase().includes(q) ||
                (a.email || '').toLowerCase().includes(q) ||
                (a.mobile || '').toLowerCase().includes(q) ||
                (a.system_id || '').toLowerCase().includes(q) ||
                (a.department || '').toLowerCase().includes(q) ||
                (a.section || '').toLowerCase().includes(q);
        });
    }, [allAttendees, searchQuery]);

    const totalPages = Math.ceil(filteredAttendees.length / ITEMS_PER_PAGE);
    const paginatedAttendees = filteredAttendees.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    useEffect(() => { setCurrentPage(1); }, [searchQuery]);

    const hasScannedCheckpoint = (attendee: any, cp: string) => {
        return attendee.event_attendance_scans?.some((s: any) => s.checkpoint === cp);
    };

    const startCamera = async () => {
        setScanResult(null); setMessage(""); setCameraError(""); setShowSearch(false);
        try {
            if (scannerRef.current) {
                try { if (scannerRef.current.isScanning) await scannerRef.current.stop(); scannerRef.current.clear(); } catch { }
                scannerRef.current = null;
            }
            scannerRef.current = new Html5Qrcode("att-reader", {
                verbose: false,
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                useBarCodeDetectorIfSupported: false
            });
            await scannerRef.current.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                handleScanSuccess, () => { }
            );
            setCameraActive(true);
        } catch (err) {
            console.error(err);
            setCameraError("Camera failed to start. Please check permissions.");
        }
    };

    const stopCamera = async () => {
        if (scannerRef.current) {
            try { if (scannerRef.current.isScanning) await scannerRef.current.stop(); scannerRef.current.clear(); } catch { }
            setCameraActive(false);
        }
    };

    const handleScanSuccess = async (decodedText: string) => {
        setIsScanning(true);
        if (scannerRef.current && scannerRef.current.isScanning) scannerRef.current.pause(true);

        try {
            const result = await processAttendanceScan(decodedText.trim(), selectedCheckpoint);
            if (result.success) {
                setScanResult('success');
                setMessage(result.message || "Success!");
                setAttendeeName(result.attendee?.name || "");
                setAttendeeDetails(result.attendee?.system_id ? `SID: ${result.attendee.system_id}` : "");
            } else if (result.already) {
                setScanResult('already');
                setMessage(result.message || "Already scanned.");
                setAttendeeName(result.attendee?.name || "");
            } else {
                setScanResult('error');
                setMessage(result.error || "Invalid QR Code.");
            }
        } catch {
            setScanResult('error');
            setMessage("Scan failed.");
        }

        setTimeout(() => {
            setScanResult(null); setMessage(""); setAttendeeName(""); setAttendeeDetails(""); setIsScanning(false);
            if (scannerRef.current) scannerRef.current.resume();
        }, 3000);
    };

    const handleManualScan = async (attendeeQrCode: string) => {
        setProcessingId(attendeeQrCode);
        try {
            const result = await processAttendanceScan(attendeeQrCode, selectedCheckpoint);
            if (result.success) {
                setMessage(result.message || "Success!");
                setScanResult('success');
                // Update local state
                setAllAttendees(prev => prev.map(a => {
                    if (a.qr_code !== attendeeQrCode) return a;
                    return {
                        ...a,
                        event_attendance_scans: [...(a.event_attendance_scans || []), { checkpoint: selectedCheckpoint, scanned_at: new Date().toISOString() }]
                    };
                }));
            } else if (result.already) {
                setMessage(result.message || "Already scanned.");
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
        <div className="min-h-screen bg-white text-gray-900 p-4">
            <header className="max-w-md mx-auto py-3 flex items-center justify-between mb-4">
                <Link href="/hackathon-portal" className="text-gray-400 font-mono hover:text-gray-900 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-violet-400" />
                    <h1 className="text-lg font-bold">Attendance Scanner</h1>
                </div>
                <div className="w-6" />
            </header>

            <main className="max-w-md mx-auto space-y-4">
                {/* Checkpoint Selector */}
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl shadow-sm p-3">
                    <label className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2 block">
                        Active Checkpoint
                    </label>
                    <div className="relative">
                        <select
                            value={selectedCheckpoint}
                            onChange={(e) => setSelectedCheckpoint(e.target.value)}
                            className="w-full bg-white/60 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm font-medium appearance-none focus:outline-none focus:border-violet-500 cursor-pointer"
                        >
                            {checkpoints.map(cp => (
                                <option key={cp} value={cp}>{cp}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 font-mono pointer-events-none" />
                    </div>
                    <p className="text-[11px] text-violet-400/60 mt-2">Each attendee can only scan once per checkpoint.</p>
                </div>

                {/* Toggle: Camera vs Search */}
                <div className="flex bg-gray-50 p-1 rounded-xl shadow-sm">
                    <button
                        onClick={() => setShowSearch(false)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-colors ${!showSearch ? 'bg-violet-600 text-gray-900' : 'text-gray-400 font-mono hover:text-gray-900'}`}
                    >
                        <Camera className="w-3.5 h-3.5" /> QR Camera
                    </button>
                    <button
                        onClick={() => { setShowSearch(true); stopCamera(); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-colors ${showSearch ? 'bg-violet-600 text-gray-900' : 'text-gray-400 font-mono hover:text-gray-900'}`}
                    >
                        <Search className="w-3.5 h-3.5" /> Search & Mark
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
                                placeholder="Search by name, SID, email, department..."
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
                            <span>{filteredAttendees.length} attendee{filteredAttendees.length !== 1 ? 's' : ''} {searchQuery ? 'found' : 'total'}</span>
                            {totalPages > 1 && <span>Page {currentPage} of {totalPages}</span>}
                        </div>

                        {loadingAttendees ? (
                            <div className="text-center py-6">
                                <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-2" />
                                <p className="text-gray-500 font-mono tracking-wider text-xs">Loading attendees...</p>
                            </div>
                        ) : paginatedAttendees.length === 0 ? (
                            <div className="text-center py-6 text-gray-500 font-mono tracking-wider text-sm border border-dashed border-gray-100 rounded-xl shadow-sm">
                                {searchQuery ? `No attendees found for "${searchQuery}"` : 'No attendees found'}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {paginatedAttendees.map((a: any) => {
                                    const alreadyScanned = hasScannedCheckpoint(a, selectedCheckpoint);
                                    return (
                                        <div key={a.id} className="flex items-center justify-between p-3 rounded-xl shadow-sm bg-gray-50 border border-gray-100">
                                            <div className="flex-1 min-w-0 mr-3">
                                                <p className="text-sm font-bold text-gray-900 truncate">{a.name}</p>
                                                <p className="text-[11px] text-gray-500 font-mono tracking-wider truncate">
                                                    {a.system_id && <span className="text-violet-400 font-mono mr-1.5">{a.system_id}</span>}
                                                    {a.department || ''}{a.section ? ` · ${a.section}` : ''}
                                                </p>
                                                <div className="flex gap-1 mt-1">
                                                    {checkpoints.map(cp => (
                                                        <span key={cp} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${hasScannedCheckpoint(a, cp) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-50 text-gray-600'}`}>
                                                            {cp}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleManualScan(a.qr_code)}
                                                disabled={processingId === a.qr_code || alreadyScanned}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 ${alreadyScanned ? 'bg-emerald-600/20 text-emerald-400 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-500 text-gray-900'}`}
                                            >
                                                {processingId === a.qr_code ? '...' : alreadyScanned ? 'Done' : 'Mark'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                    className="p-2 rounded-xl bg-gray-50 border border-gray-100 text-gray-400 font-mono hover:text-gray-900 disabled:opacity-30 transition-all">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) pageNum = i + 1;
                                        else if (currentPage <= 3) pageNum = i + 1;
                                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                        else pageNum = currentPage - 2 + i;
                                        return (
                                            <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                                                className={`w-8 h-8 rounded-xl text-xs font-medium transition-all ${currentPage === pageNum ? 'bg-violet-600 text-gray-900' : 'bg-gray-50 text-gray-400 font-mono hover:text-gray-900'}`}>
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                    className="p-2 rounded-xl bg-gray-50 border border-gray-100 text-gray-400 font-mono hover:text-gray-900 disabled:opacity-30 transition-all">
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
                                Scanning for: <span className="text-violet-400 font-bold">{selectedCheckpoint}</span>
                            </p>
                        </div>

                        <div className="relative w-full aspect-square bg-zinc-900 rounded-xl shadow-sm overflow-hidden border border-gray-100 flex flex-col items-center justify-center">
                            <div id="att-reader" className="w-full h-full absolute inset-0"></div>

                            {!cameraActive && !scanResult && (
                                <div className="z-10 flex flex-col items-center p-6 text-center">
                                    <button onClick={startCamera}
                                        className="bg-violet-600 hover:bg-violet-500 text-gray-900 px-8 py-4 rounded-full font-bold flex items-center gap-3 transition-colors shadow-[0_0_30px_rgba(139,92,246,0.3)] mb-4">
                                        <Camera className="w-6 h-6" /> START SCANNING
                                    </button>
                                    {cameraError && <p className="text-red-400 text-sm">{cameraError}</p>}
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
                                    {attendeeName && <p className="text-xl font-bold text-gray-900 mb-1">{attendeeName}</p>}
                                    {attendeeDetails && <p className="text-sm text-gray-700 mb-1">{attendeeDetails}</p>}
                                    <p className="text-gray-900/90 font-medium text-sm">{message}</p>
                                </div>
                            )}
                        </div>

                        {cameraActive && !scanResult && (
                            <button onClick={stopCamera}
                                className="w-full py-3 text-center text-gray-400 font-mono hover:text-gray-900 font-medium transition-colors text-sm">
                                Stop Camera
                            </button>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
