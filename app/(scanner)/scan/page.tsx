'use client'

/**
 * Event check-in scanner, built for a phone in one hand at the door.
 *
 * Speed: a scan updates the list on the spot (no reload of the whole list);
 * the list syncs quietly in the background a few seconds after the last scan.
 * The camera keeps running between scans; the result shows for ~1.2s (longer
 * for problems) and the next student can be scanned right away. The same QR
 * read twice within 4 seconds is ignored, so nobody is sent twice.
 */
import { istDateKey } from '@/lib/dates/ist'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import jsQR from 'jsqr'
import {
    CheckCircle2, XCircle, Camera, Loader2, Upload, RefreshCw, ArrowLeft, Users, UserCheck, Search, ChevronDown,
    QrCode, LogOut, CameraOff, ImageIcon, CircleAlert, X,
} from 'lucide-react'

interface Attendee {
    id: string
    userId?: string
    name: string
    email: string
    image?: string
    attended: boolean
    registered_at: string
    daysCheckedIn?: number
    checkedInToday?: boolean
    checkinDates?: string[]
}
interface EventInfo { id: string; title: string; start_time: string; end_time?: string }
type Result = { kind: 'success' | 'already' | 'error'; name: string; message: string }
type Tab = 'scan' | 'checked' | 'all'

const MODE_KEY = 'scanner_mode'
const EVENT_KEY = 'scanner_selected_event'
const fmtDay = (key: string) => new Date(`${key}T12:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtWhen = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

function beep(ok: boolean) {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const tone = (freq: number, at: number, dur: number) => {
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.connect(g); g.connect(ctx.destination)
            o.type = 'square'; o.frequency.setValueAtTime(freq, at)
            g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.35, at + 0.02); g.gain.exponentialRampToValueAtTime(0.01, at + dur)
            o.start(at); o.stop(at + dur)
        }
        const t = ctx.currentTime
        if (ok) { tone(900, t, 0.09); tone(1250, t + 0.09, 0.16) } else { tone(300, t, 0.25) }
    } catch { /* sound is optional */ }
    try { navigator.vibrate?.(ok ? 60 : [80, 60, 80]) } catch { /* optional */ }
}

export default function ScannerPage() {
    const [events, setEvents] = useState<EventInfo[] | null>(null)
    const [selectedEvent, setSelectedEvent] = useState('')
    const [showEvents, setShowEvents] = useState(false)
    const [attendees, setAttendees] = useState<Attendee[]>([])
    const [loadingList, setLoadingList] = useState(false)
    const [eventDaysList, setEventDaysList] = useState<string[]>([])
    const [isMultiDay, setIsMultiDay] = useState(false)
    const [selectedDay, setSelectedDay] = useState('')

    const [tab, setTab] = useState<Tab>('scan')
    const [query, setQuery] = useState('')
    const [mode, setMode] = useState<'camera' | 'photo'>('camera')
    const [cameraActive, setCameraActive] = useState(false)
    const [startingCamera, setStartingCamera] = useState(false)
    const [cameraError, setCameraError] = useState('')
    const [cameraDevices, setCameraDevices] = useState<{ id: string; label: string }[]>([])
    const [selectedCameraId, setSelectedCameraId] = useState('')
    const [result, setResult] = useState<Result | null>(null)
    const [busy, setBusy] = useState(false)
    const [recent, setRecent] = useState<{ name: string; kind: Result['kind']; at: number }[]>([])
    const [actingId, setActingId] = useState<string | null>(null)
    const [confirmOut, setConfirmOut] = useState<Attendee | null>(null)

    const scannerRef = useRef<Html5Qrcode | null>(null)
    const lockRef = useRef(false)
    const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 })
    const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const today = istDateKey(new Date())

    // Remember photo mode only for phones whose live camera failed before
    useEffect(() => {
        try { if (localStorage.getItem(MODE_KEY) === 'photo') setMode('photo') } catch { /* ignore */ }
    }, [])

    // Live events
    useEffect(() => {
        fetch('/api/events/live').then(r => r.json()).then(data => {
            const list: EventInfo[] = data.events ?? []
            setEvents(list)
            let saved = ''
            try { saved = sessionStorage.getItem(EVENT_KEY) ?? '' } catch { /* ignore */ }
            setSelectedEvent(list.some(e => e.id === saved) ? saved : list[0]?.id ?? '')
        }).catch(() => setEvents([]))
    }, [])

    const fetchAttendees = useCallback(async (quiet = false) => {
        if (!selectedEvent) return
        if (!quiet) setLoadingList(true)
        try {
            const data = await (await fetch(`/api/events/${selectedEvent}/attendees`, { cache: 'no-store' })).json()
            if (data.attendees) setAttendees(data.attendees)
            if (data.eventDaysList) setEventDaysList(data.eventDaysList)
            if (data.isMultiDay !== undefined) setIsMultiDay(data.isMultiDay)
        } catch { /* keep what we have */ } finally {
            if (!quiet) setLoadingList(false)
        }
    }, [selectedEvent])

    useEffect(() => {
        setSelectedDay(''); setEventDaysList([]); setIsMultiDay(false); setAttendees([]); setRecent([])
        fetchAttendees()
    }, [fetchAttendees])

    // Quiet sync with other scanners: a few seconds after the last scan, and every 45s while visible
    const scheduleSync = useCallback(() => {
        if (syncTimer.current) clearTimeout(syncTimer.current)
        syncTimer.current = setTimeout(() => fetchAttendees(true), 6000)
    }, [fetchAttendees])
    useEffect(() => {
        const t = setInterval(() => { if (document.visibilityState === 'visible') fetchAttendees(true) }, 45_000)
        return () => clearInterval(t)
    }, [fetchAttendees])

    useEffect(() => () => {
        const s = scannerRef.current
        if (s) { if (s.isScanning) s.stop().catch(() => {}); try { s.clear() } catch { /* ignore */ } }
        if (resultTimer.current) clearTimeout(resultTimer.current)
        if (syncTimer.current) clearTimeout(syncTimer.current)
    }, [])

    /** Marks one student checked in locally, so the list and numbers update instantly. */
    const markLocal = (match: (a: Attendee) => boolean, attended: boolean) => {
        setAttendees(list => list.map(a => !match(a) ? a : attended
            ? { ...a, attended: true, checkedInToday: true, checkinDates: Array.from(new Set([...(a.checkinDates ?? []), today])), daysCheckedIn: (a.checkinDates?.includes(today) ? a.daysCheckedIn : (a.daysCheckedIn ?? 0) + 1) }
            : { ...a, attended: false, checkedInToday: false, checkinDates: (a.checkinDates ?? []).filter(d => d !== today), daysCheckedIn: Math.max(0, (a.daysCheckedIn ?? 1) - 1) }))
    }

    const showResult = (r: Result) => {
        setResult(r)
        setRecent(list => [{ name: r.name || r.message, kind: r.kind, at: Date.now() }, ...list].slice(0, 6))
        beep(r.kind === 'success')
        if (resultTimer.current) clearTimeout(resultTimer.current)
        resultTimer.current = setTimeout(() => setResult(null), r.kind === 'success' ? 1200 : 2400)
    }

    const handleDecoded = async (text: string) => {
        const now = Date.now()
        if (lockRef.current) return
        if (text === lastRef.current.text && now - lastRef.current.at < 4000) return // same code still in front of the camera
        lockRef.current = true
        lastRef.current = { text, at: now }
        setBusy(true)
        try {
            let qr: Record<string, string>
            try { qr = JSON.parse(text) } catch { return showResult({ kind: 'error', name: '', message: 'Not a Technova ticket QR' }) }
            const userId = qr.userId || qr.u, eventId = qr.eventId || qr.e
            if (!(qr.token || qr.t) || !userId || !eventId) return showResult({ kind: 'error', name: '', message: 'Invalid ticket QR' })
            if (selectedEvent && eventId !== selectedEvent) {
                const other = events?.find(e => e.id === eventId)
                return showResult({ kind: 'error', name: '', message: other ? `Ticket is for "${other.title}"` : 'Ticket is for a different event' })
            }
            const res = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(qr) })
            const data = await res.json().catch(() => ({}))
            if (data.success) {
                markLocal(a => a.userId === userId, true)
                showResult({ kind: 'success', name: data.userName, message: data.isMultiDay ? `Day ${data.daysCheckedIn} checked in` : 'Checked in' })
                scheduleSync()
            } else if (/already checked in/i.test(data.message ?? '')) {
                showResult({ kind: 'already', name: data.userName || 'Attendee', message: data.message })
            } else {
                showResult({ kind: 'error', name: data.userName ?? '', message: data.message || 'Check-in failed' })
            }
        } catch {
            showResult({ kind: 'error', name: '', message: 'No connection. Try again.' })
        } finally {
            setBusy(false)
            setTimeout(() => { lockRef.current = false }, 350)
        }
    }

    const startCamera = async (cameraId?: string) => {
        setCameraError(''); setStartingCamera(true)
        try {
            if (scannerRef.current) {
                try { if (scannerRef.current.isScanning) await scannerRef.current.stop(); scannerRef.current.clear() } catch { /* ignore */ }
                scannerRef.current = null
                await new Promise(r => setTimeout(r, 200)) // let Android release the camera
            }
            // Android lists cameras only after permission, so ask first
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                stream.getTracks().forEach(t => t.stop())
            } catch {
                try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach(t => t.stop()) }
                catch { setCameraError('Camera permission is blocked. Allow camera for this site in the browser settings, or use Photo mode.'); return }
            }
            let cameras: { id: string; label: string }[] = []
            try { cameras = (await Html5Qrcode.getCameras()).map(d => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 6)}` })); setCameraDevices(cameras) } catch { /* ignore */ }

            scannerRef.current = new Html5Qrcode('reader', { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], useBarCodeDetectorIfSupported: false })
            const config = { fps: 15, qrbox: (w: number, h: number) => { const s = Math.floor(Math.min(w, h) * 0.72); return { width: s, height: s } }, aspectRatio: 1 }
            const onDecode = (text: string) => { void handleDecoded(text) }
            const back = cameraId || cameras.find(c => /back|rear|environment/i.test(c.label))?.id || (cameras.length === 1 ? cameras[0].id : undefined)
            const attempts: (string | MediaTrackConstraints)[] = [...(back ? [back] : []), { facingMode: 'environment' }, ...(cameras[0] && cameras[0].id !== back ? [cameras[0].id] : []), { facingMode: 'user' }]
            for (const target of attempts) {
                try {
                    await scannerRef.current.start(target, config, onDecode, () => {})
                    if (typeof target === 'string') setSelectedCameraId(target)
                    setCameraActive(true)
                    try { localStorage.removeItem(MODE_KEY) } catch { /* ignore */ }
                    return
                } catch { await new Promise(r => setTimeout(r, 150)) }
            }
            throw new Error('no camera started')
        } catch {
            setCameraError('The camera didn’t start. Pick another camera below, or use Photo mode.')
            try { localStorage.setItem(MODE_KEY, 'photo') } catch { /* ignore */ }
        } finally {
            setStartingCamera(false)
        }
    }

    const stopCamera = async () => {
        const s = scannerRef.current
        if (!s) return
        try { if (s.isScanning) await s.stop(); s.clear() } catch { /* ignore */ }
        setCameraActive(false)
    }

    const switchMode = async (m: 'camera' | 'photo') => {
        if (m === mode) return
        if (m === 'photo') await stopCamera()
        setMode(m); setCameraError('')
        try { if (m === 'photo') localStorage.setItem(MODE_KEY, 'photo'); else localStorage.removeItem(MODE_KEY) } catch { /* ignore */ }
    }

    const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        setBusy(true)
        try {
            const bitmap = await createImageBitmap(file)
            const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)) // big phone photos decode slowly
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
            const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
            setBusy(false)
            if (code) await handleDecoded(code.data)
            else showResult({ kind: 'error', name: '', message: 'No QR code found in that photo' })
        } catch {
            setBusy(false)
            showResult({ kind: 'error', name: '', message: 'Couldn’t read that photo' })
        }
    }

    const manualCheckIn = async (a: Attendee) => {
        if (actingId) return
        setActingId(a.id)
        try {
            const data = await (await fetch(`/api/events/${selectedEvent}/checkin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registrationId: a.id }) })).json()
            if (data.success) { markLocal(x => x.id === a.id, true); beep(true); scheduleSync() }
            else if (/already/i.test(data.message ?? '')) { markLocal(x => x.id === a.id, true) }
            else showResult({ kind: 'error', name: a.name, message: data.message || 'Check-in failed' })
        } catch { showResult({ kind: 'error', name: a.name, message: 'No connection. Try again.' }) } finally { setActingId(null) }
    }

    const checkOut = async (a: Attendee) => {
        setConfirmOut(null)
        setActingId(a.id)
        try {
            const data = await (await fetch(`/api/events/${selectedEvent}/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registrationId: a.id }) })).json()
            if (data.success) { markLocal(x => x.id === a.id, false); fetchAttendees(true) }
            else showResult({ kind: 'error', name: a.name, message: data.message || 'Check-out failed' })
        } catch { showResult({ kind: 'error', name: a.name, message: 'No connection. Try again.' }) } finally { setActingId(null) }
    }

    // Numbers: for multi-day events, "checked in" means today (or the chosen day)
    const day = isMultiDay ? (selectedDay || (eventDaysList.includes(today) ? today : '')) : ''
    const isIn = useCallback((a: Attendee) => (day ? !!a.checkinDates?.includes(day) : a.attended), [day])
    const total = attendees.length
    const checkedIn = attendees.filter(isIn).length
    const pct = total ? Math.round((checkedIn / total) * 100) : 0
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        const list = q ? attendees.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)) : attendees
        const base = tab === 'checked' ? list.filter(isIn) : list
        return tab === 'all' ? [...base].sort((a, b) => Number(isIn(a)) - Number(isIn(b)) || a.name.localeCompare(b.name)) : base
    }, [attendees, query, tab, isIn])
    const current = events?.find(e => e.id === selectedEvent)

    return (
        <div className="min-h-[100dvh] bg-black pb-[calc(76px+env(safe-area-inset-bottom))] text-white">
            {/* Top bar */}
            <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur">
                <div className="mx-auto flex max-w-xl items-center gap-2 px-3 py-2.5">
                    <Link href="/" className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
                    <button onClick={() => setShowEvents(v => !v)} disabled={!events?.length} className="min-w-0 flex-1 rounded-xl px-2 py-1 text-left hover:bg-white/5">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Checking in for</p>
                        <p className="flex items-center gap-1 truncate font-semibold">{current?.title ?? (events === null ? 'Loading…' : 'No live event')}{events && events.length > 1 && <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${showEvents ? 'rotate-180' : ''}`} />}</p>
                    </button>
                    <button onClick={() => fetchAttendees()} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Refresh list">
                        <RefreshCw className={`h-5 w-5 ${loadingList ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                {showEvents && events && (
                    <div className="mx-auto max-w-xl border-t border-white/10 px-3 pb-3">
                        {events.map(e => (
                            <button key={e.id} onClick={() => { setSelectedEvent(e.id); try { sessionStorage.setItem(EVENT_KEY, e.id) } catch { /* ignore */ } setShowEvents(false) }}
                                className={`mt-2 block w-full rounded-xl border px-3 py-2.5 text-left ${e.id === selectedEvent ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                                <p className="font-medium">{e.title}</p>
                                <p className="text-xs text-gray-500">{fmtWhen(e.start_time)}</p>
                            </button>
                        ))}
                    </div>
                )}
                {/* Progress */}
                {selectedEvent && (
                    <div className="mx-auto max-w-xl px-4 pb-3">
                        <div className="flex items-baseline justify-between text-sm">
                            <span><b className="text-xl text-emerald-400">{checkedIn}</b> <span className="text-gray-400">/ {total} checked in{day ? ` · ${day === today ? 'today' : fmtDay(day)}` : ''}</span></span>
                            <span className="text-xs text-gray-500">{total - checkedIn} to go</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                    </div>
                )}
            </header>

            <main className="mx-auto max-w-xl px-3 pt-3">
                {events !== null && events.length === 0 && (
                    <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
                        <QrCode className="mx-auto h-10 w-10 text-gray-600" />
                        <p className="mt-3 font-medium">No live event right now</p>
                        <p className="mt-1 text-sm text-gray-500">Events show here from when they&apos;re published until they end.</p>
                    </div>
                )}

                {isMultiDay && eventDaysList.length > 1 && (
                    <div className="-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1">
                        {eventDaysList.map((d, i) => {
                            const active = (selectedDay || (eventDaysList.includes(today) ? today : '')) === d
                            return (
                                <button key={d} onClick={() => setSelectedDay(d)} className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${active ? 'border-blue-500/50 bg-blue-500/15 text-white' : 'border-white/10 text-gray-400'}`}>
                                    <span className="flex items-center gap-1.5 font-semibold">Day {i + 1}{d === today && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}</span>
                                    <span className="block opacity-70">{fmtDay(d)}</span>
                                    <span className="text-emerald-400">{attendees.filter(a => a.checkinDates?.includes(d)).length} in</span>
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* Scan */}
                <section className={tab === 'scan' && selectedEvent ? 'space-y-3' : 'hidden'}>
                    <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-white/10 bg-zinc-950">
                        <div id="reader" className={`h-full w-full ${mode === 'camera' ? '' : 'hidden'} [&_video]:h-full [&_video]:w-full [&_video]:object-cover`} />

                        {mode === 'camera' && !cameraActive && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                                {startingCamera ? (
                                    <><Loader2 className="h-9 w-9 animate-spin text-blue-400" /><p className="text-sm text-gray-400">Starting camera…</p></>
                                ) : (
                                    <>
                                        <button onClick={() => startCamera()} className="flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-4 text-lg font-semibold active:scale-[0.98]">
                                            <Camera className="h-6 w-6" /> Start scanning
                                        </button>
                                        {cameraError && (
                                            <div className="max-w-xs space-y-3">
                                                <p className="text-sm text-rose-300">{cameraError}</p>
                                                {cameraDevices.length > 1 && (
                                                    <select value={selectedCameraId} onChange={e => { setSelectedCameraId(e.target.value); startCamera(e.target.value) }} className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm">
                                                        <option value="">Pick a camera</option>
                                                        {cameraDevices.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                                    </select>
                                                )}
                                                <button onClick={() => switchMode('photo')} className="text-sm text-blue-300 underline">Use Photo mode</button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {mode === 'photo' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
                                <label className="flex w-full max-w-xs cursor-pointer flex-col items-center gap-2 rounded-2xl bg-blue-600 px-6 py-5 text-center font-semibold active:scale-[0.98]">
                                    <Camera className="h-8 w-8" /> Take photo of ticket
                                    <span className="text-xs font-normal text-blue-100">Works on every phone</span>
                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
                                </label>
                                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-gray-300">
                                    <ImageIcon className="h-4 w-4" /> From gallery
                                    <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                                </label>
                            </div>
                        )}

                        {cameraActive && mode === 'camera' && (
                            <button onClick={stopCamera} className="absolute right-3 top-3 z-20 rounded-full bg-black/60 p-2.5 text-white backdrop-blur" aria-label="Stop camera"><CameraOff className="h-5 w-5" /></button>
                        )}

                        {busy && (
                            <div className="absolute inset-x-0 top-3 z-20 mx-auto flex w-fit items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs backdrop-blur"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…</div>
                        )}

                        {result && (
                            <button onClick={() => setResult(null)} className={`absolute inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-2xl p-4 text-left shadow-2xl ${result.kind === 'success' ? 'bg-emerald-600' : result.kind === 'already' ? 'bg-amber-500 text-black' : 'bg-rose-600'}`}>
                                {result.kind === 'success' ? <CheckCircle2 className="h-9 w-9 shrink-0" /> : result.kind === 'already' ? <UserCheck className="h-9 w-9 shrink-0" /> : <XCircle className="h-9 w-9 shrink-0" />}
                                <span className="min-w-0">
                                    {result.name && <span className="block truncate text-lg font-bold">{result.name}</span>}
                                    <span className="block text-sm opacity-90">{result.message}</span>
                                </span>
                            </button>
                        )}
                    </div>

                    <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1 text-sm">
                        <button onClick={() => switchMode('camera')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 ${mode === 'camera' ? 'bg-white/10 font-medium' : 'text-gray-400'}`}><Camera className="h-4 w-4" /> Live camera</button>
                        <button onClick={() => switchMode('photo')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 ${mode === 'photo' ? 'bg-white/10 font-medium' : 'text-gray-400'}`}><Upload className="h-4 w-4" /> Photo</button>
                    </div>

                    {recent.length > 0 && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                            <p className="mb-2 text-xs font-medium text-gray-400">Recent scans</p>
                            <ul className="space-y-1.5">
                                {recent.map(r => (
                                    <li key={r.at} className="flex items-center gap-2 text-sm">
                                        <span className={`h-2 w-2 shrink-0 rounded-full ${r.kind === 'success' ? 'bg-emerald-400' : r.kind === 'already' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                                        <span className="min-w-0 flex-1 truncate">{r.name}</span>
                                        <span className="text-xs text-gray-500">{new Date(r.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>

                {/* Lists */}
                {tab !== 'scan' && selectedEvent && (
                    <section className="space-y-3">
                        <label className="relative block">
                            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or email" inputMode="search"
                                className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-10 text-base placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none" />
                            {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500" aria-label="Clear"><X className="h-4 w-4" /></button>}
                        </label>
                        {loadingList && attendees.length === 0 ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-500" /></div>
                        ) : filtered.length === 0 ? (
                            <p className="py-12 text-center text-sm text-gray-500">{query ? 'Nobody matches that search' : tab === 'checked' ? 'Nobody checked in yet' : 'No registrations yet'}</p>
                        ) : (
                            <ul className="space-y-2">
                                {filtered.map(a => {
                                    const inNow = isIn(a)
                                    return (
                                        <li key={a.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${inNow ? 'border-emerald-500/25 bg-emerald-500/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}>
                                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${inNow ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-gray-400'}`}>{a.name.charAt(0).toUpperCase()}</span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-medium">{a.name}</span>
                                                <span className="block truncate text-xs text-gray-500">{a.email}</span>
                                                {isMultiDay && (a.daysCheckedIn ?? 0) > 0 && <span className="text-[11px] text-emerald-400">{a.daysCheckedIn}/{eventDaysList.length} days</span>}
                                            </span>
                                            {inNow ? (
                                                <button onClick={() => setConfirmOut(a)} disabled={actingId === a.id} className="flex h-10 items-center gap-1 rounded-xl border border-white/10 px-3 text-xs text-gray-400 active:bg-white/5" aria-label={`Check out ${a.name}`}>
                                                    {actingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 text-emerald-400" /> In</>}
                                                </button>
                                            ) : (
                                                <button onClick={() => manualCheckIn(a)} disabled={!!actingId} className="flex h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-semibold active:scale-[0.97] disabled:opacity-50">
                                                    {actingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check in'}
                                                </button>
                                            )}
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </section>
                )}
            </main>

            {/* Check-out confirm */}
            {confirmOut && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={() => setConfirmOut(null)}>
                    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950 p-5" onClick={e => e.stopPropagation()}>
                        <p className="flex items-center gap-2 font-semibold"><CircleAlert className="h-5 w-5 text-amber-400" /> Check out {confirmOut.name}?</p>
                        <p className="mt-2 text-sm text-gray-400">Use this if they were checked in by mistake or left early. Their check-in{isMultiDay ? ' for today' : ''} is removed.</p>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                            <button onClick={() => setConfirmOut(null)} className="h-12 rounded-2xl border border-white/10 font-medium">Keep</button>
                            <button onClick={() => checkOut(confirmOut)} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-rose-600 font-semibold"><LogOut className="h-4 w-4" /> Check out</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom tabs (thumb reach) */}
            <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
                <div className="mx-auto grid max-w-xl grid-cols-3">
                    {([['scan', 'Scan', QrCode, null], ['checked', 'Checked in', UserCheck, checkedIn], ['all', 'Everyone', Users, total]] as const).map(([id, label, Icon, n]) => (
                        <button key={id} onClick={() => setTab(id)} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${tab === id ? 'text-blue-400' : 'text-gray-500'}`}>
                            <Icon className="h-6 w-6" />
                            <span>{label}{n !== null ? ` · ${n}` : ''}</span>
                        </button>
                    ))}
                </div>
            </nav>
        </div>
    )
}
