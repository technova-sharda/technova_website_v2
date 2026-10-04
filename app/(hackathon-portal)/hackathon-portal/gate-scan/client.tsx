"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { processGateScan, getGateStats, getOverdueParticipants } from "@/lib/actions/hackathon";
import { ArrowLeft, Camera, CheckCircle, AlertCircle, DoorOpen, DoorClosed, Users, Activity, BarChart3, Timer } from "lucide-react";

export default function GateScannerClient() {
    const [scanResult, setScanResult] = useState<'entry' | 'exit' | 'error' | null>(null);
    const [message, setMessage] = useState("");
    const [participantName, setParticipantName] = useState("");
    const [teamInfo, setTeamInfo] = useState("");
    const [timeOutside, setTimeOutside] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const [stats, setStats] = useState<{
        totalParticipants: number;
        totalScans: number;
        insideCount: number;
        outsideCount: number;
        trackedCount: number;
    } | null>(null);
    const [overdueList, setOverdueList] = useState<any[]>([]);
    const [showOverdue, setShowOverdue] = useState(false);

    const scannerRef = useRef<Html5Qrcode | null>(null);

    const loadStats = async () => {
        const [s, overdue] = await Promise.all([
            getGateStats(),
            getOverdueParticipants()
        ]);
        if (s) setStats(s);
        if (overdue) setOverdueList(overdue);
    };

    useEffect(() => {
        loadStats();
        // Auto-refresh stats every 15 seconds
        const interval = setInterval(loadStats, 15000);
        return () => clearInterval(interval);
    }, []);

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

    const startCamera = async () => {
        setScanResult(null);
        setMessage("");
        setCameraError("");

        try {
            if (scannerRef.current) {
                try {
                    if (scannerRef.current.isScanning) await scannerRef.current.stop();
                    scannerRef.current.clear();
                } catch { }
                scannerRef.current = null;
            }

            scannerRef.current = new Html5Qrcode("gate-reader", {
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

    const playSound = (isEntry: boolean) => {
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
            if (isEntry) {
                // Rising tone for entry
                playTone(600, 'square', now, 0.1);
                playTone(900, 'square', now + 0.1, 0.1);
                playTone(1200, 'square', now + 0.2, 0.2);
            } else {
                // Falling tone for exit
                playTone(1200, 'square', now, 0.1);
                playTone(900, 'square', now + 0.1, 0.1);
                playTone(600, 'square', now + 0.2, 0.2);
            }
        } catch (e) { console.warn("Audio playback failed", e) }
    };

    const playErrorSound = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            gain.gain.setValueAtTime(0.4, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) { console.warn("Audio playback failed", e) }
    };

    const handleScanSuccess = async (decodedText: string) => {
        if (isScanning) return; // Prevent double scans
        setIsScanning(true);

        if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.pause(true);
        }

        try {
            const participantId = decodedText.trim();
            const result = await processGateScan(participantId);

            if (result.success && result.direction) {
                playSound(result.direction === 'entry');
                setScanResult(result.direction as 'entry' | 'exit');
                setMessage(result.message || "Success!");
                setParticipantName(result.participant?.name || "");
                setTeamInfo(result.participant?.teamCode ? `${result.participant.teamName} (${result.participant.teamCode})` : "");
                setTimeOutside(result.timeOutside || "");
            } else {
                playErrorSound();
                setScanResult('error');
                setMessage(result.error || "Invalid QR Code.");
            }
        } catch (err) {
            playErrorSound();
            setScanResult('error');
            setMessage("Scan failed.");
        }

        // Auto-resume after feedback
        setTimeout(() => {
            setScanResult(null);
            setMessage("");
            setParticipantName("");
            setTeamInfo("");
            setTimeOutside("");
            setIsScanning(false);
            if (scannerRef.current) {
                try { scannerRef.current.resume(); } catch { }
            }
        }, 2500);

        loadStats();
    };

    return (
        <div className="min-h-screen bg-white text-gray-900 p-4">
            <header className="max-w-md mx-auto py-3 flex items-center justify-between mb-4">
                <Link href="/hackathon-portal" className="text-gray-400 hover:text-gray-900 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex items-center gap-2">
                    <DoorOpen className="w-5 h-5 text-teal-500" />
                    <h1 className="text-lg font-bold">Gate Scanner</h1>
                </div>
                <div className="w-6" />
            </header>

            <main className="max-w-md mx-auto space-y-4">
                {/* Info Banner */}
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
                    <p className="text-xs text-teal-700 font-medium text-center">
                        All participants start <strong>INSIDE</strong>. Scan when going <strong>out</strong> or coming <strong>back in</strong>. Direction auto-toggles.
                    </p>
                </div>

                {/* Stats Bar */}
                {stats && (
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <DoorOpen className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            <div className="text-xl font-black text-emerald-700">{stats.insideCount}</div>
                            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Inside</div>
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <DoorClosed className="w-3.5 h-3.5 text-orange-600" />
                            </div>
                            <div className="text-xl font-black text-orange-700">{stats.outsideCount}</div>
                            <div className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Outside</div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            <div className="text-xl font-black text-blue-700">{stats.totalScans}</div>
                            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Total Scans</div>
                        </div>
                    </div>
                )}

                {/* Progress Bar */}
                {stats && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Tracked</span>
                            <span>{stats.trackedCount} / {stats.totalParticipants}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-teal-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${stats.totalParticipants ? (stats.trackedCount / stats.totalParticipants) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Overdue Participants Panel */}
                {overdueList.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
                        <button
                            onClick={() => setShowOverdue(!showOverdue)}
                            className="w-full flex items-center justify-between p-3 text-red-700 hover:bg-red-100 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                <span className="font-bold text-sm">{overdueList.length} participant{overdueList.length !== 1 ? 's' : ''} out &gt; 30 mins!</span>
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest">{showOverdue ? 'Hide' : 'View'}</span>
                        </button>
                        
                        {showOverdue && (
                            <div className="p-3 border-t border-red-200 divide-y divide-red-100 max-h-60 overflow-y-auto">
                                {overdueList.map((p, i) => (
                                    <div key={i} className="py-2 first:pt-0 last:pb-0 flex items-start justify-between">
                                        <div>
                                            <p className="font-bold text-sm text-red-900">{p.name}</p>
                                            <p className="text-xs text-red-700">{p.teamName} ({p.teamCode})</p>
                                            <p className="text-xs text-red-600 font-mono mt-0.5">{p.phone}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap">
                                                {p.minsOutside >= 60 ? `${Math.floor(p.minsOutside/60)}h ${p.minsOutside%60}m` : `${p.minsOutside}m`} out
                                            </span>
                                            <p className="text-[10px] text-red-500 mt-1 uppercase tracking-wider">
                                                Since {new Date(p.scannedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit'})}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Camera Description */}
                <div className="text-center">
                    <p className="text-xs text-gray-400 font-mono">
                        Point camera at participant&apos;s QR code
                    </p>
                </div>

                {/* Camera Viewfinder */}
                <div className="relative w-full aspect-square bg-zinc-900 rounded-xl overflow-hidden border-2 border-teal-500/30 flex flex-col items-center justify-center">
                    <div id="gate-reader" className="w-full h-full absolute inset-0"></div>

                    {/* Corner HUD */}
                    <div className="absolute inset-8 pointer-events-none z-10 opacity-70">
                        <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-teal-400"></div>
                        <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-teal-400"></div>
                        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-teal-400"></div>
                        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-teal-400"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-teal-400 rounded-full animate-ping"></div>
                    </div>

                    {/* Start Button */}
                    {!cameraActive && !scanResult && (
                        <div className="z-20 flex flex-col items-center p-6 text-center">
                            <button
                                onClick={startCamera}
                                className="bg-teal-500 hover:bg-teal-400 text-white font-black uppercase tracking-widest px-8 py-4 rounded-2xl flex items-center gap-3 transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] shadow-lg shadow-teal-500/30"
                            >
                                <Camera className="w-6 h-6" /> START GATE SCAN
                            </button>
                            {cameraError && <p className="text-red-500 text-sm font-mono mt-3 bg-red-50 px-3 py-1.5 rounded-lg">{cameraError}</p>}
                        </div>
                    )}

                    {/* Scan Result Overlay */}
                    {scanResult && (
                        <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md transition-all ${
                            scanResult === 'entry' ? 'bg-emerald-500/90' :
                            scanResult === 'exit' ? 'bg-orange-500/90' :
                            'bg-red-500/90'
                        }`}>
                            {scanResult === 'entry' ? (
                                <DoorOpen className="w-20 h-20 text-white mb-4 drop-shadow-lg" />
                            ) : scanResult === 'exit' ? (
                                <DoorClosed className="w-20 h-20 text-white mb-4 drop-shadow-lg" />
                            ) : (
                                <AlertCircle className="w-20 h-20 text-white mb-4 drop-shadow-lg" />
                            )}

                            <h2 className="text-3xl font-black text-white drop-shadow-md tracking-tight mb-2">
                                {scanResult === 'entry' ? '↑ ENTRY' : scanResult === 'exit' ? '↓ EXIT' : 'ERROR'}
                            </h2>
                            {participantName && (
                                <p className="text-2xl font-bold text-white mb-1">{participantName}</p>
                            )}
                            {teamInfo && (
                                <p className="text-sm font-medium text-white/80 mb-2">{teamInfo}</p>
                            )}
                            {timeOutside && (
                                <p className="text-sm font-bold text-white bg-white/20 px-3 py-1 rounded-full mb-2 inline-flex items-center gap-1.5"><Timer className="w-4 h-4" /> {timeOutside}</p>
                            )}
                            <p className="text-white/90 font-medium text-sm">{message}</p>
                            <p className="text-white/50 text-[10px] font-mono mt-2">
                                {new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </p>
                        </div>
                    )}
                </div>

                {/* Stop Camera */}
                {cameraActive && !scanResult && (
                    <button
                        onClick={stopCamera}
                        className="w-full py-3 text-center text-gray-400 hover:text-gray-900 font-medium transition-colors text-sm"
                    >
                        Stop Camera
                    </button>
                )}
            </main>
        </div>
    );
}
