'use client'

import { istDateKey } from '@/lib/dates/ist'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import jsQR from 'jsqr'
import {
    CheckCircle, XCircle, Camera, Loader2, Upload, RefreshCw, ArrowLeft,
    Users, UserCheck, Search, ChevronDown, Clock, QrCode, List, UserPlus, LogOut
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Attendee {
    id: string
    userId?: string
    name: string
    email: string
    image?: string
    attended: boolean
    checked_in_at?: string
    registered_at: string
    // Daily check-in fields
    daysCheckedIn?: number
    checkedInToday?: boolean
    checkedInOnDay?: boolean | null
    checkinDates?: string[]
}

interface EventInfo {
    id: string
    title: string
    start_time: string
    end_time?: string
    is_multi_day?: boolean
}

export default function ScannerPage() {
    const [scanResult, setScanResult] = useState<'success' | 'error' | 'already' | null>(null)
    const [message, setMessage] = useState('')
    const [scannedName, setScannedName] = useState('')
    const [isScanning, setIsScanning] = useState(false)
    const [mode, setMode] = useState<'camera' | 'file'>('camera')
    const [cameraActive, setCameraActive] = useState(false)

    // Luma-style features
    const [events, setEvents] = useState<EventInfo[]>([])
    const [selectedEvent, setSelectedEvent] = useState<string>('')
    const [attendees, setAttendees] = useState<Attendee[]>([])
    const [allAttendees, setAllAttendees] = useState<Attendee[]>([])
    const [loadingAttendees, setLoadingAttendees] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeTab, setActiveTab] = useState<'scanner' | 'checkins' | 'registered'>('scanner')
    const [showEventDropdown, setShowEventDropdown] = useState(false)
    const [checkingInId, setCheckingInId] = useState<string | null>(null)
    const [checkingOutId, setCheckingOutId] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<'all' | 'checked' | 'pending'>('all')

    // Day filter for multi-day events
    const [eventDaysList, setEventDaysList] = useState<string[]>([])
    const [selectedDay, setSelectedDay] = useState<string>('') // empty = all days
    const [isMultiDay, setIsMultiDay] = useState(false)

    // Camera device selection for Android compatibility
    const [cameraDevices, setCameraDevices] = useState<{ id: string; label: string }[]>([])
    const [selectedCameraId, setSelectedCameraId] = useState<string>('')
    const [cameraError, setCameraError] = useState<string>('')
    const [isLoadingCamera, setIsLoadingCamera] = useState(false)

    const scannerRef = useRef<Html5Qrcode | null>(null)

    // Detect Android and default to file mode for better reliability
    useEffect(() => {
        const isAndroid = /android/i.test(navigator.userAgent)
        if (isAndroid) {
            setMode('file')
        }
    }, [])

    // Fetch live events on mount
    useEffect(() => {
        async function fetchEvents() {
            try {
                const res = await fetch('/api/events/live')
                const data = await res.json()
                if (data.events && data.events.length > 0) {
                    setEvents(data.events)
                    // Restore previously selected event from sessionStorage
                    const savedEventId = sessionStorage.getItem('scanner_selected_event')
                    if (savedEventId && data.events.some((e: EventInfo) => e.id === savedEventId)) {
                        setSelectedEvent(savedEventId)
                    } else {
                        setSelectedEvent(data.events[0].id)
                    }
                }
            } catch (error) {
                console.error('Failed to fetch events:', error)
            }
        }
        fetchEvents()
    }, [])

    // Reset day filter when event changes
    useEffect(() => {
        setSelectedDay('')
        setEventDaysList([])
        setIsMultiDay(false)
    }, [selectedEvent])

    // Fetch attendees when event or day filter changes
    const fetchAttendees = useCallback(async () => {
        if (!selectedEvent) return

        setLoadingAttendees(true)
        try {
            const res = await fetch(`/api/events/${selectedEvent}/attendees`)
            const data = await res.json()
            if (data.attendees) {
                setAttendees(data.attendees)
                setAllAttendees(data.attendees) // Same array, for compatibility
            }
            if (data.eventDaysList) {
                setEventDaysList(data.eventDaysList)
            }
            if (data.isMultiDay !== undefined) {
                setIsMultiDay(data.isMultiDay)
            }
        } catch (error) {
            console.error('Failed to fetch attendees:', error)
        } finally {
            setLoadingAttendees(false)
        }
    }, [selectedEvent]) // Remove selectedDay dependency - filtering is client-side

    useEffect(() => {
        fetchAttendees()
    }, [fetchAttendees])

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                if (scannerRef.current.isScanning) {
                    scannerRef.current.stop().catch(console.error)
                }
                scannerRef.current.clear()
            }
        }
    }, [])

    // Stats use allAttendees for consistent counts
    const stats = {
        registered: allAttendees.length,
        checkedIn: allAttendees.filter(a => a.attended).length,
        pending: allAttendees.filter(a => !a.attended).length,
        // Day-specific stats
        checkedInToday: allAttendees.filter(a => a.checkedInToday).length,
        checkedInOnDay: selectedDay
            ? allAttendees.filter(a => a.checkinDates?.includes(selectedDay)).length
            : 0
    }

    // Apply search filter
    const searchFilteredAttendees = attendees.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // For "Checked In" tab: filter by selected day if day is selected
    const checkedInAttendees = selectedDay
        ? searchFilteredAttendees.filter(a => a.checkinDates?.includes(selectedDay))
        : searchFilteredAttendees.filter(a => a.attended)

    // For "All/Registered" tab: apply status filter but show ALL attendees (not day-filtered)
    const registeredAttendees = searchFilteredAttendees.filter(a => {
        if (statusFilter === 'checked') return a.attended
        if (statusFilter === 'pending') return !a.attended
        return true // 'all'
    })

    // Manual check-in handler for when QR scanning fails
    const handleManualCheckIn = async (attendeeId: string) => {
        if (!selectedEvent || checkingInId) return

        setCheckingInId(attendeeId)
        try {
            const response = await fetch(`/api/events/${selectedEvent}/checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registrationId: attendeeId })
            })

            const result = await response.json()

            if (result.success) {
                // Refresh the attendee list to show updated status
                fetchAttendees()
            } else {
                console.error('Manual check-in failed:', result.message)
                alert(result.message || 'Check-in failed. Please try again.')
            }
        } catch (error) {
            console.error('Manual check-in error:', error)
            alert('Check-in failed. Please try again.')
        } finally {
            setCheckingInId(null)
        }
    }

    // Check-out handler for removing attendees who leave early
    const handleCheckOut = async (attendeeId: string) => {
        if (!selectedEvent || checkingOutId) return
        if (!confirm('Are you sure you want to check out this attendee?')) return

        setCheckingOutId(attendeeId)
        try {
            const response = await fetch(`/api/events/${selectedEvent}/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registrationId: attendeeId })
            })

            const result = await response.json()

            if (result.success) {
                fetchAttendees()
            } else {
                console.error('Check-out failed:', result.message)
                alert(result.message || 'Check-out failed. Please try again.')
            }
        } catch (error) {
            console.error('Check-out error:', error)
            alert('Check-out failed. Please try again.')
        } finally {
            setCheckingOutId(null)
        }
    }

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
            scannerRef.current.pause(true)
        }

        try {
            // Parse the QR code JSON data first
            let qrData: Record<string, string>
            try {
                qrData = JSON.parse(decodedText)
            } catch {
                // If the QR code is not valid JSON, it might be an old format or invalid
                console.error('Invalid QR format:', decodedText)
                setScanResult('error')
                setMessage('Invalid QR code format')
                setScannedName('')
                setIsScanning(false)
                return
            }

            // Validate required fields (supports both short and long key formats)
            const token = qrData.token || qrData.t
            const userId = qrData.userId || qrData.u
            const eventId = qrData.eventId || qrData.e

            if (!token || !userId || !eventId) {
                console.error('Missing required QR fields:', qrData)
                setScanResult('error')
                setMessage('Invalid QR code data')
                setScannedName('')
                setIsScanning(false)
                return
            }

            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(qrData)
            })

            const result = await response.json()

            if (result.success) {
                setScanResult('success')
                setMessage('Check-in successful!')
                setScannedName(result.userName)
                // Refresh attendee list
                fetchAttendees()
            } else if (result.message === 'Already checked in') {
                setScanResult('already')
                setMessage('Already checked in')
                setScannedName(result.userName || 'Attendee')
            } else {
                setScanResult('error')
                setMessage(result.message || 'Invalid QR Code')
                setScannedName('')
            }
        } catch {
            setScanResult('error')
            setMessage('Scan failed. Please try again.')
            setScannedName('')
        }

        setIsScanning(false)

        setTimeout(() => {
            setScanResult(null)
            setMessage('')
            setScannedName('')
            if (scannerRef.current && mode === 'camera') {
                scannerRef.current.resume()
            }
        }, 3000)
    }

    const startCamera = async (cameraId?: string) => {
        setScanResult(null)
        setMessage('')
        setCameraError('')
        setIsLoadingCamera(true)

        try {
            // Clear any existing instance first
            if (scannerRef.current) {
                try {
                    if (scannerRef.current.isScanning) {
                        await scannerRef.current.stop()
                    }
                    scannerRef.current.clear()
                } catch {
                    // Ignore cleanup errors
                }
                scannerRef.current = null
            }

            // Longer delay for Android devices to release camera resources
            await new Promise(resolve => setTimeout(resolve, 500))

            // CRITICAL FOR ANDROID: Request camera permission FIRST
            // On Android, enumerateDevices() returns empty until getUserMedia() is called
            let permissionGranted = false
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                })
                // Stop the stream immediately - we just needed to trigger permission
                stream.getTracks().forEach(track => track.stop())
                permissionGranted = true

                // Wait a bit for Android to fully release the camera
                await new Promise(resolve => setTimeout(resolve, 500))
            } catch (permError) {
                // Try with any camera (front)
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
                    stream.getTracks().forEach(track => track.stop())
                    permissionGranted = true
                    await new Promise(resolve => setTimeout(resolve, 500))
                } catch (err) {
                    // Fail silently, error handled below
                }
            }

            if (!permissionGranted) {
                setCameraError('Camera permission denied. Please allow camera access in your browser settings.')
                return // Exit early, error message is set
            }

            // NOW enumerate cameras (after permission is granted)
            let cameras: { id: string; label: string }[] = []
            try {
                const deviceList = await Html5Qrcode.getCameras()
                cameras = deviceList.map(d => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 8)}` }))
                setCameraDevices(cameras)
            } catch (camError) {
                // Ignore camera enumeration errors
            }

            // Create new instance with Android-friendly settings
            scannerRef.current = new Html5Qrcode("reader", {
                verbose: false,
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                // Disable BarcodeDetector API - fixes Samsung/Chrome issues
                useBarCodeDetectorIfSupported: false
            })

            const qrConfig = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            }

            // Strategy: Prefer device ID if provided, else find back camera, else fallback
            let cameraToUse = cameraId

            if (!cameraToUse && cameras.length > 0) {
                // Try to find a back/rear camera by label
                const backCamera = cameras.find(c =>
                    c.label.toLowerCase().includes('back') ||
                    c.label.toLowerCase().includes('rear') ||
                    c.label.toLowerCase().includes('environment')
                )
                if (backCamera) {
                    cameraToUse = backCamera.id
                } else if (cameras.length === 1) {
                    // Only one camera available, use it
                    cameraToUse = cameras[0].id
                }
            }

            // Try to start camera
            const attemptStart = async () => {
                // Method 1: Use specific camera ID
                if (cameraToUse) {
                    try {
                        await scannerRef.current!.start(
                            cameraToUse,
                            qrConfig,
                            handleScanSuccess,
                            () => { }
                        )
                        setSelectedCameraId(cameraToUse)
                        setCameraActive(true)
                        return true
                    } catch (err) {
                        // Attempt next method
                    }
                }

                // Method 2: Try facingMode environment
                try {
                    await new Promise(resolve => setTimeout(resolve, 300))
                    await scannerRef.current!.start(
                        { facingMode: "environment" },
                        qrConfig,
                        handleScanSuccess,
                        () => { }
                    )
                    setCameraActive(true)
                    return true
                } catch (err) {
                    // Attempt next method
                }

                // Method 3: Try any camera with user facingMode
                try {
                    await new Promise(resolve => setTimeout(resolve, 300))
                    await scannerRef.current!.start(
                        { facingMode: "user" },
                        qrConfig,
                        handleScanSuccess,
                        () => { }
                    )
                    setCameraActive(true)
                    return true
                } catch (err) {
                    // Attempt next method
                }

                // Method 4: Try first available camera ID
                if (cameras.length > 0 && cameras[0].id !== cameraToUse) {
                    try {
                        await new Promise(resolve => setTimeout(resolve, 300))
                        await scannerRef.current!.start(
                            cameras[0].id,
                            qrConfig,
                            handleScanSuccess,
                            () => { }
                        )
                        setSelectedCameraId(cameras[0].id)
                        setCameraActive(true)
                        return true
                    } catch (err) {
                        // Fail silently
                    }
                }

                return false
            }

            const success = await attemptStart()

            if (!success) {
                throw new Error('All camera start methods failed')
            }

        } catch (err) {
            console.error("Camera start failed:", err)
            const errorMsg = cameraDevices.length === 0
                ? "No cameras found. Please allow camera permissions in your browser settings."
                : "Camera failed to start. Try selecting a different camera below, or use 'Scan from File' option."
            setCameraError(errorMsg)
            setMessage(errorMsg)
            setScanResult('error')
        } finally {
            setIsLoadingCamera(false)
        }
    }

    const stopCamera = async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop()
                }
                scannerRef.current.clear()
            } catch (err) {
                console.error("Stop camera error:", err)
            }
            setCameraActive(false)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsScanning(true)
        setScanResult(null)
        setMessage('')

        try {
            // Stop camera if active
            if (cameraActive) await stopCamera()

            // Use canvas and jsQR for more reliable file scanning
            const imageData = await loadImageData(file)
            const code = jsQR(imageData.data, imageData.width, imageData.height)

            if (code) {
                handleScanSuccess(code.data)
            } else {
                throw new Error('No QR code found')
            }
        } catch (err) {
            console.error("File scan error", err)
            setScanResult('error')
            setMessage("Could not detect QR code. Try using the camera instead.")
            setIsScanning(false)
        }

        // Reset the file input so the same file can be uploaded again
        e.target.value = ''
    }

    // Helper function to load image data from file
    const loadImageData = (file: File): Promise<ImageData> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (event) => {
                const img = new Image()
                img.onload = () => {
                    const canvas = document.createElement('canvas')
                    canvas.width = img.width
                    canvas.height = img.height
                    const ctx = canvas.getContext('2d')
                    if (!ctx) {
                        reject(new Error('Could not get canvas context'))
                        return
                    }
                    ctx.drawImage(img, 0, 0)
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
                    resolve(imageData)
                }
                img.onerror = () => reject(new Error('Failed to load image'))
                img.src = event.target?.result as string
            }
            reader.onerror = () => reject(new Error('Failed to read file'))
            reader.readAsDataURL(file)
        })
    }


    const switchMode = async (newMode: 'camera' | 'file') => {
        if (newMode === mode) return
        if (newMode === 'file') await stopCamera()
        setMode(newMode)
        setScanResult(null)
        setMessage('')
    }

    const selectedEventInfo = events.find(e => e.id === selectedEvent)

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-medium hidden sm:inline">Back</span>
                        </Link>

                        <div className="flex items-center gap-2">
                            <QrCode className="w-6 h-6 text-blue-400" />
                            <h1 className="text-xl font-bold">Event Check-in</h1>
                        </div>

                        <button
                            onClick={fetchAttendees}
                            className="p-2 text-gray-400 hover:text-white transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-5 h-5 ${loadingAttendees ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-6">
                {/* Event Selector */}
                {events.length > 0 && (
                    <div className="mb-6 relative">
                        <button
                            onClick={() => setShowEventDropdown(!showEventDropdown)}
                            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/50 transition-colors"
                        >
                            <div className="text-left">
                                <p className="text-xs text-gray-500 uppercase tracking-wider">Scanning for</p>
                                <p className="font-bold text-lg">{selectedEventInfo?.title || 'Select Event'}</p>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showEventDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {showEventDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden z-50 shadow-xl">
                                {events.map(event => (
                                    <button
                                        key={event.id}
                                        onClick={() => {
                                            setSelectedEvent(event.id)
                                            sessionStorage.setItem('scanner_selected_event', event.id)
                                            setShowEventDropdown(false)
                                        }}
                                        className={`w-full p-4 text-left hover:bg-white/5 transition-colors ${selectedEvent === event.id ? 'bg-blue-600/20 border-l-4 border-blue-500' : ''}`}
                                    >
                                        <p className="font-medium">{event.title}</p>
                                        <p className="text-sm text-gray-500">{formatDate(event.start_time)}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Day Filter for Multi-day Events */}
                {isMultiDay && eventDaysList.length > 1 && (
                    <div className="mb-6">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Select Day</p>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            <button
                                onClick={() => setSelectedDay('')}
                                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedDay === ''
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                All Days
                            </button>
                            {eventDaysList.map((day, index) => {
                                const dayDate = new Date(day + 'T00:00:00')
                                const dayLabel = dayDate.toLocaleDateString('en-IN', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short'
                                })
                                const isToday = day === istDateKey(new Date())
                                const dayCheckedIn = allAttendees.filter(a => a.checkinDates?.includes(day)).length

                                return (
                                    <button
                                        key={day}
                                        onClick={() => setSelectedDay(day)}
                                        className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedDay === day
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span>Day {index + 1}</span>
                                            {isToday && <span className="bg-green-500 w-2 h-2 rounded-full"></span>}
                                        </span>
                                        <span className="text-xs opacity-70 block">{dayLabel}</span>
                                        <span className="text-xs text-green-400">{dayCheckedIn} checked in</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                        <Users className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                        <p className="text-2xl font-bold">{stats.registered}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Registered</p>
                    </div>
                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
                        <UserCheck className="w-6 h-6 mx-auto mb-2 text-green-400" />
                        <p className="text-2xl font-bold text-green-400">{stats.checkedIn}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Checked In</p>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                        <Clock className="w-6 h-6 mx-auto mb-2 text-amber-400" />
                        <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Pending</p>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex bg-white/5 p-1 rounded-xl mb-6">
                    <button
                        onClick={() => setActiveTab('scanner')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${activeTab === 'scanner' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Camera className="w-5 h-5" />
                        <span className="hidden sm:inline">Scanner</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('checkins')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${activeTab === 'checkins' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <UserCheck className="w-5 h-5" />
                        <span className="hidden sm:inline">Checked In</span>
                        <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full">{stats.checkedIn}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('registered')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${activeTab === 'registered' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <List className="w-5 h-5" />
                        <span className="hidden sm:inline">All</span>
                        <span className="bg-white/10 text-gray-400 text-xs px-2 py-0.5 rounded-full">{stats.registered}</span>
                    </button>
                </div>

                {/* Scanner Tab */}
                {activeTab === 'scanner' && (
                    <div className="flex flex-col items-center">
                        {/* Mode Switcher */}
                        <div className="flex bg-white/5 p-1 rounded-lg mb-6">
                            <button
                                onClick={() => switchMode('camera')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'camera' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                Camera
                            </button>
                            <button
                                onClick={() => switchMode('file')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'file' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                Upload
                            </button>
                        </div>

                        {/* Scanner Container */}
                        <div className="relative w-full max-w-md bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 min-h-[350px] flex flex-col items-center justify-center">
                            {mode === 'camera' && (
                                <div className="w-full relative">
                                    <div id="reader" className="w-full h-full"></div>

                                    {cameraActive && (
                                        <div className="absolute top-4 right-4 z-50">
                                            <button
                                                onClick={() => stopCamera()}
                                                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-colors border border-white/10"
                                                title="Stop Scanning"
                                            >
                                                <XCircle className="w-6 h-6" />
                                            </button>
                                        </div>
                                    )}
                                    {!cameraActive && !scanResult && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                                            {isLoadingCamera ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                                                    <p className="text-gray-400">Starting camera...</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => startCamera()}
                                                        className="flex items-center gap-2 bg-blue-600 px-8 py-4 rounded-xl hover:bg-blue-700 transition-colors font-medium"
                                                    >
                                                        <Camera className="w-6 h-6" />
                                                        Start Scanning
                                                    </button>

                                                    {/* Show camera error and options */}
                                                    {cameraError && (
                                                        <div className="text-center max-w-xs">
                                                            <p className="text-red-400 text-sm mb-3">{cameraError}</p>

                                                            {/* Camera selector dropdown */}
                                                            {cameraDevices.length > 1 && (
                                                                <div className="mb-3">
                                                                    <p className="text-xs text-gray-500 mb-1">Select Camera:</p>
                                                                    <select
                                                                        value={selectedCameraId}
                                                                        onChange={(e) => {
                                                                            setSelectedCameraId(e.target.value)
                                                                            startCamera(e.target.value)
                                                                        }}
                                                                        className="bg-zinc-800 border border-white/20 rounded-lg px-3 py-2 text-sm w-full"
                                                                    >
                                                                        <option value="">Auto-detect</option>
                                                                        {cameraDevices.map(cam => (
                                                                            <option key={cam.id} value={cam.id}>
                                                                                {cam.label}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            )}

                                                            <button
                                                                onClick={() => setMode('file')}
                                                                className="text-blue-400 hover:text-blue-300 text-sm underline block mx-auto mt-2"
                                                            >
                                                                Use file upload instead
                                                            </button>

                                                            <div className="mt-4 p-3 bg-white/5 rounded-lg text-left">
                                                                <p className="text-xs text-gray-500 font-bold mb-1">How to enable camera:</p>
                                                                <ol className="text-[10px] text-gray-400 list-decimal pl-4 space-y-1">
                                                                    <li>Click the <span className="font-bold text-gray-300">lock icon</span> next to the URL</li>
                                                                    <li>Toggle <span className="font-bold text-gray-300">Camera</span> to ON</li>
                                                                    <li>Refresh the page and try again</li>
                                                                </ol>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {mode === 'file' && (
                                <div className="p-8 w-full text-center">
                                    {/* Hidden divs for scanner instances */}
                                    <div id="reader" className="hidden"></div>
                                    <div id="file-reader" className="hidden"></div>

                                    {/* Take Photo directly - best for Android */}
                                    <label className="flex flex-col items-center gap-4 cursor-pointer p-6 border-2 border-dashed border-blue-500/50 bg-blue-500/10 rounded-xl hover:bg-blue-500/20 transition-colors mb-4">
                                        <Camera className="w-10 h-10 text-blue-400" />
                                        <div className="text-sm text-center">
                                            <span className="font-bold text-white block">Take Photo of QR Code</span>
                                            <span className="text-gray-400">Opens camera directly</span>
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={handleFileUpload}
                                        />
                                    </label>

                                    {/* Upload from gallery */}
                                    <label className="flex flex-col items-center gap-4 cursor-pointer p-6 border-2 border-dashed border-gray-700 rounded-xl hover:border-blue-500 hover:bg-white/5 transition-colors">
                                        <Upload className="w-10 h-10 text-gray-500" />
                                        <div className="text-sm text-center">
                                            <span className="font-bold text-white block">Upload from Gallery</span>
                                            <span className="text-gray-400">Select existing QR image</span>
                                        </div>
                                        <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                                    </label>
                                </div>
                            )}

                            {/* Result Overlay */}
                            {scanResult && (
                                <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 p-6 text-center ${scanResult === 'success' ? 'bg-green-950/95' :
                                    scanResult === 'already' ? 'bg-amber-950/95' : 'bg-red-950/95'
                                    }`}>
                                    {scanResult === 'success' ? (
                                        <CheckCircle className="w-20 h-20 mb-4 text-green-500" />
                                    ) : scanResult === 'already' ? (
                                        <UserCheck className="w-20 h-20 mb-4 text-amber-500" />
                                    ) : (
                                        <XCircle className="w-20 h-20 mb-4 text-red-500" />
                                    )}

                                    {scannedName && (
                                        <p className="text-2xl font-bold mb-2">{scannedName}</p>
                                    )}

                                    <p className={`text-lg font-medium ${scanResult === 'success' ? 'text-green-400' :
                                        scanResult === 'already' ? 'text-amber-400' : 'text-red-400'
                                        }`}>
                                        {message}
                                    </p>

                                    {scanResult === 'error' && (
                                        <button
                                            onClick={() => {
                                                setScanResult(null)
                                                if (mode === 'camera') startCamera()
                                            }}
                                            className="mt-6 flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Try Again
                                        </button>
                                    )}
                                </div>
                            )}

                            {isScanning && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
                                    <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Checked In Tab */}
                {activeTab === 'checkins' && (
                    <div>
                        {/* Search */}
                        <div className="relative mb-4">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search checked-in attendees..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-green-500/50 focus:outline-none"
                            />
                        </div>

                        {/* List */}
                        <div className="space-y-2">
                            {checkedInAttendees.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>No check-ins yet</p>
                                </div>
                            ) : (
                                checkedInAttendees.map(attendee => (
                                    <div key={attendee.id} className="flex items-center gap-4 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold">
                                            {attendee.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{attendee.name}</p>
                                            <p className="text-sm text-gray-500 truncate">{attendee.email}</p>
                                        </div>
                                        <button
                                            onClick={() => handleCheckOut(attendee.id)}
                                            disabled={checkingOutId === attendee.id}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex-shrink-0 border border-red-500/30"
                                            title="Check Out"
                                        >
                                            {checkingOutId === attendee.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <LogOut className="w-4 h-4" />
                                            )}
                                            <span className="hidden sm:inline">Check Out</span>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* All Registered Tab */}
                {activeTab === 'registered' && (
                    <div>
                        {/* Search */}
                        <div className="relative mb-4">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search all registered..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:outline-none"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'all'
                                    ? 'bg-white/10 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                All ({searchFilteredAttendees.length})
                            </button>
                            <button
                                onClick={() => setStatusFilter('checked')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'checked'
                                    ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                                    : 'text-gray-400 hover:text-green-400 hover:bg-green-500/10'
                                    }`}
                            >
                                <span className="flex items-center justify-center gap-1.5">
                                    <CheckCircle className="w-4 h-4" />
                                    Checked ({stats.checkedIn})
                                </span>
                            </button>
                            <button
                                onClick={() => setStatusFilter('pending')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'pending'
                                    ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                                    : 'text-gray-400 hover:text-amber-400 hover:bg-amber-500/10'
                                    }`}
                            >
                                <span className="flex items-center justify-center gap-1.5">
                                    <Clock className="w-4 h-4" />
                                    Pending ({stats.pending})
                                </span>
                            </button>
                        </div>

                        {/* List */}
                        <div className="space-y-2">
                            {registeredAttendees.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>No registrations yet</p>
                                </div>
                            ) : (
                                registeredAttendees.map(attendee => {
                                    // For multi-day events with day filter: check if checked in on that specific day
                                    const checkedInOnSelectedDay = selectedDay
                                        ? attendee.checkinDates?.includes(selectedDay)
                                        : false
                                    // Show check-in button if: no day selected and not attended, OR day selected and not checked in that day
                                    const showCheckInButton = selectedDay
                                        ? !checkedInOnSelectedDay
                                        : !attendee.attended

                                    return (
                                        <div
                                            key={attendee.id}
                                            className={`flex items-center gap-4 p-4 rounded-xl border ${selectedDay
                                                ? checkedInOnSelectedDay
                                                    ? 'bg-green-500/5 border-green-500/20'
                                                    : 'bg-white/[0.02] border-white/10'
                                                : attendee.attended
                                                    ? 'bg-green-500/5 border-green-500/20'
                                                    : 'bg-white/[0.02] border-white/10'
                                                }`}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${(selectedDay ? checkedInOnSelectedDay : attendee.attended)
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-white/10 text-gray-400'
                                                }`}>
                                                {attendee.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{attendee.name}</p>
                                                <p className="text-sm text-gray-500 truncate">{attendee.email}</p>
                                                {/* Show days checked in for multi-day events */}
                                                {isMultiDay && attendee.daysCheckedIn !== undefined && attendee.daysCheckedIn > 0 && (
                                                    <p className="text-xs text-green-400 mt-0.5">
                                                        {attendee.daysCheckedIn}/{eventDaysList.length} days checked in
                                                    </p>
                                                )}
                                            </div>
                                            {showCheckInButton ? (
                                                <button
                                                    onClick={() => handleManualCheckIn(attendee.id)}
                                                    disabled={checkingInId === attendee.id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex-shrink-0"
                                                    title={selectedDay ? `Check in for ${selectedDay}` : 'Manual Check-in'}
                                                >
                                                    {checkingInId === attendee.id ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            <span className="hidden sm:inline">Checking...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UserPlus className="w-4 h-4" />
                                                            <span className="hidden sm:inline">
                                                                {selectedDay ? 'Check In Today' : 'Check In'}
                                                            </span>
                                                        </>
                                                    )}
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                                    <button
                                                        onClick={() => handleCheckOut(attendee.id)}
                                                        disabled={checkingOutId === attendee.id}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-medium border border-red-500/30"
                                                        title="Check Out"
                                                    >
                                                        {checkingOutId === attendee.id ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <LogOut className="w-3 h-3" />
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                )}

                <p className="text-gray-600 text-xs text-center mt-8">Technova Event Check-in v3.0</p>
            </div>
        </div>
    )
}
