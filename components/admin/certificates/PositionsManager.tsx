"use client"

import { useEffect, useRef, useState } from "react"
import { Plus, Trash2, Upload, Loader2, QrCode, Search, Send, CheckCircle, Ban, Clock, Trophy, X, ImageIcon, Download } from "lucide-react"
import { Toast, useToast } from "@/components/ui/toast"
import type { QRRegion } from "@/types/custom"
import {
    getCertificatePositions,
    createCertificatePosition,
    updateCertificatePosition,
    deleteCertificatePosition,
    applyQrToAllPositions,
    searchEventParticipants,
    addPositionRecipient,
    removePositionRecipient,
    uploadPositionCertificateFile,
    setCertificateQrOverride,
    sendPositionCertificates,
    type PositionWithRecipients,
    type PositionRecipient,
    type ParticipantSearchResult,
} from "@/lib/actions/certificates"
import { CertificateCanvas } from "@/components/admin/certificates/CertificateCanvas"

interface PositionsManagerProps {
    eventId: string
    refreshKey?: number
    onChange?: () => void
}

interface QrEditorState {
    position: PositionWithRecipients
    recipient: PositionRecipient | null // null = editing the position default
    imageSrc: string
    qr: QRRegion
}

const SUGGESTED_TITLES = ['Top 1', 'Top 2', 'Top 3']

export function PositionsManager({ eventId, refreshKey, onChange }: PositionsManagerProps) {
    const [positions, setPositions] = useState<PositionWithRecipients[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSending, setIsSending] = useState(false)
    const [newTitle, setNewTitle] = useState('')
    const [isAdding, setIsAdding] = useState(false)
    const [qrEditor, setQrEditor] = useState<QrEditorState | null>(null)
    const { toast, showToast, hideToast } = useToast()

    const load = async () => {
        try {
            setPositions(await getCertificatePositions(eventId))
        } catch (error) {
            console.error('Failed to load positions:', error)
            showToast('Failed to load positions', 'error')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { load() }, [eventId, refreshKey])

    const run = async (action: () => Promise<unknown>, success?: string) => {
        try {
            await action()
            if (success) showToast(success, 'success')
            await load()
            onChange?.()
        } catch (error: any) {
            showToast(error.message || 'Something went wrong', 'error')
        }
    }

    const addPosition = async (title: string) => {
        if (!title.trim()) return
        setIsAdding(true)
        await run(() => createCertificatePosition(eventId, title))
        setNewTitle('')
        setIsAdding(false)
    }

    const handleSend = async () => {
        const ready = pending.filter(r => r.file_url).length
        if (!confirm(`Send ${ready} position certificate${ready === 1 ? '' : 's'}? Each student will receive an email.`)) return
        setIsSending(true)
        try {
            const result = await sendPositionCertificates(eventId)
            showToast(result.message, 'success')
            await load()
            onChange?.()
        } catch (error: any) {
            showToast(error.message || 'Failed to send', 'error')
        } finally {
            setIsSending(false)
        }
    }

    const openQrEditor = (position: PositionWithRecipients, recipient: PositionRecipient | null) => {
        const source = recipient?.file_preview_url
            ? recipient
            : position.recipients.find(r => r.file_preview_url)
        if (!source?.file_preview_url) {
            showToast('Upload a certificate first to place the QR on it', 'error')
            return
        }
        setQrEditor({
            position,
            recipient,
            imageSrc: source.file_preview_url,
            qr: recipient?.qr_region || position.qr_region,
        })
    }

    const pending = positions.flatMap(p => p.recipients).filter(r => r.status === 'pending')
    const readyCount = pending.filter(r => r.file_url).length
    const missingCount = pending.length - readyCount
    const unusedSuggestions = SUGGESTED_TITLES.filter(t => !positions.some(p => p.title.toLowerCase() === t.toLowerCase()))

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

            <p className="text-sm text-gray-400">
                Upload your ready-made certificate for each winner. Only the QR code is added. Students listed here don&apos;t get a participation certificate.
            </p>

            {positions.map(position => (
                <PositionCard
                    // Re-key on rename so the editable title resets to the saved value
                    key={`${position.id}-${position.title}`}
                    eventId={eventId}
                    position={position}
                    run={run}
                    onEditQr={recipient => openQrEditor(position, recipient)}
                    showToast={showToast}
                />
            ))}

            {/* Add position */}
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addPosition(newTitle)}
                        placeholder="Position title, e.g. Top 1, Best UI, Runner Up"
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder:text-gray-500"
                    />
                    <button
                        onClick={() => addPosition(newTitle)}
                        disabled={isAdding || !newTitle.trim()}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                    >
                        {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Add Position
                    </button>
                </div>
                {unusedSuggestions.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                        {unusedSuggestions.map(title => (
                            <button
                                key={title}
                                onClick={() => addPosition(title)}
                                disabled={isAdding}
                                className="px-2.5 py-1 text-xs rounded-full bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" />
                                {title}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Send */}
            {pending.length > 0 && (
                <div className="bg-gray-900 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4 justify-between">
                    <div className="text-sm">
                        <p className="text-white font-medium">{readyCount} position certificate{readyCount === 1 ? '' : 's'} ready to send</p>
                        {missingCount > 0 && <p className="text-amber-400">{missingCount} student{missingCount === 1 ? ' is' : 's are'} missing an uploaded certificate</p>}
                    </div>
                    <button
                        onClick={handleSend}
                        disabled={isSending || readyCount === 0}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {isSending ? 'Sending...' : `Send ${readyCount} certificate${readyCount === 1 ? '' : 's'}`}
                    </button>
                </div>
            )}

            {qrEditor && (
                <QrPlacementModal
                    state={qrEditor}
                    onClose={() => setQrEditor(null)}
                    onChange={qr => setQrEditor({ ...qrEditor, qr })}
                    onSavePosition={() => run(
                        () => updateCertificatePosition(qrEditor.position.id, { qr_region: qrEditor.qr }),
                        `QR placement saved for ${qrEditor.position.title}`
                    ).then(() => setQrEditor(null))}
                    onApplyAll={() => run(
                        () => applyQrToAllPositions(eventId, qrEditor.qr),
                        'QR placement applied to all positions'
                    ).then(() => setQrEditor(null))}
                    onSaveRecipient={() => run(
                        () => setCertificateQrOverride(qrEditor.recipient!.id, qrEditor.qr),
                        `QR placement saved for ${qrEditor.recipient!.user.name || 'this student'}`
                    ).then(() => setQrEditor(null))}
                    onResetRecipient={() => run(
                        () => setCertificateQrOverride(qrEditor.recipient!.id, null),
                        'Using the position QR placement'
                    ).then(() => setQrEditor(null))}
                />
            )}
        </div>
    )
}

// ==========================================
// Position card
// ==========================================

interface PositionCardProps {
    eventId: string
    position: PositionWithRecipients
    run: (action: () => Promise<unknown>, success?: string) => Promise<void>
    onEditQr: (recipient: PositionRecipient | null) => void
    showToast: (message: string, type: 'success' | 'error') => void
}

function PositionCard({ eventId, position, run, onEditQr, showToast }: PositionCardProps) {
    const [title, setTitle] = useState(position.title)

    const saveTitle = () => {
        if (title.trim() && title.trim() !== position.title) {
            run(() => updateCertificatePosition(position.id, { title }), 'Position renamed')
        } else {
            setTitle(position.title)
        }
    }

    const handleDelete = () => {
        const sent = position.recipients.filter(r => r.status !== 'pending').length
        const message = sent > 0
            ? `Delete "${position.title}"?\n\n${sent} certificate${sent === 1 ? ' was' : 's were'} already emailed. ${sent === 1 ? 'It' : 'They'} will be permanently deleted, and the download link and QR verification will stop working for ${sent === 1 ? 'that student' : 'those students'}.`
            : `Delete "${position.title}"${position.recipients.length > 0 ? ` and its ${position.recipients.length} unsent certificate${position.recipients.length === 1 ? '' : 's'}` : ''}?`
        if (!confirm(message)) return
        run(() => deleteCertificatePosition(position.id, sent > 0), 'Position deleted')
    }

    return (
        <div className="bg-gray-900 rounded-xl border border-gray-800">
            <div className="flex items-center gap-3 p-4 border-b border-gray-800">
                <Trophy className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className="flex-1 min-w-0 bg-transparent text-white font-semibold text-lg border-b border-transparent hover:border-gray-700 focus:border-violet-500 focus:outline-none"
                />
                <button
                    onClick={() => onEditQr(null)}
                    className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg flex items-center gap-2"
                    title="Place the QR code for all certificates in this position"
                >
                    <QrCode className="w-4 h-4" />
                    <span className="hidden sm:inline">QR placement</span>
                </button>
                <button
                    onClick={handleDelete}
                    className="p-2 text-red-400 hover:text-red-300"
                    title="Delete position"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            <div className="p-4 space-y-3">
                {position.recipients.map(recipient => (
                    <RecipientRow
                        key={recipient.id}
                        recipient={recipient}
                        usesOverride={!!recipient.qr_region}
                        run={run}
                        onEditQr={() => onEditQr(recipient)}
                        showToast={showToast}
                    />
                ))}

                <StudentSearch
                    eventId={eventId}
                    excludeIds={position.recipients.map(r => r.user_id)}
                    onSelect={student => run(() => addPositionRecipient(position.id, student.id))}
                />
            </div>
        </div>
    )
}

// ==========================================
// Recipient row
// ==========================================

interface RecipientRowProps {
    recipient: PositionRecipient
    usesOverride: boolean
    run: (action: () => Promise<unknown>, success?: string) => Promise<void>
    onEditQr: () => void
    showToast: (message: string, type: 'success' | 'error') => void
}

function RecipientRow({ recipient, usesOverride, run, onEditQr, showToast }: RecipientRowProps) {
    const [isUploading, setIsUploading] = useState(false)
    const isPending = recipient.status === 'pending'

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        if (!['image/png', 'image/jpeg'].includes(file.type)) {
            showToast('Upload a PNG or JPG image', 'error')
            return
        }
        if (file.size > 10 * 1024 * 1024) {
            showToast('File must be under 10MB', 'error')
            return
        }
        setIsUploading(true)
        const formData = new FormData()
        formData.append('certificateId', recipient.id)
        formData.append('file', file)
        await run(() => uploadPositionCertificateFile(formData), 'Certificate uploaded')
        setIsUploading(false)
    }

    return (
        <div className="flex items-center gap-3 bg-gray-800/60 rounded-lg p-2.5">
            {/* Thumbnail / upload */}
            <label className={`relative w-20 h-14 flex-shrink-0 rounded overflow-hidden flex items-center justify-center ${isPending ? 'cursor-pointer' : ''} ${recipient.file_preview_url ? 'bg-gray-700' : 'border border-dashed border-gray-600 hover:border-violet-500'}`}>
                {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                ) : recipient.file_preview_url ? (
                    <img src={recipient.file_preview_url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="text-center text-gray-500">
                        <Upload className="w-4 h-4 mx-auto" />
                        <span className="text-[10px]">Upload</span>
                    </div>
                )}
                {isPending && <input type="file" accept="image/png,image/jpeg" onChange={handleUpload} className="hidden" disabled={isUploading} />}
            </label>

            <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{recipient.user.name || 'Unknown'}</p>
                <p className="text-xs text-gray-500 truncate">{recipient.user.email}</p>
            </div>

            <StatusBadge recipient={recipient} />

            <div className="flex items-center gap-1">
                {recipient.file_url && isPending && (
                    <button
                        onClick={onEditQr}
                        className={`p-2 rounded hover:bg-gray-700 ${usesOverride ? 'text-violet-400' : 'text-gray-400'}`}
                        title={usesOverride ? 'Custom QR placement (click to adjust)' : 'Adjust QR for this certificate only'}
                    >
                        <QrCode className="w-4 h-4" />
                    </button>
                )}
                {recipient.file_url && isPending && (
                    <label className="p-2 rounded hover:bg-gray-700 text-gray-400 cursor-pointer" title="Replace file">
                        <ImageIcon className="w-4 h-4" />
                        <input type="file" accept="image/png,image/jpeg" onChange={handleUpload} className="hidden" disabled={isUploading} />
                    </label>
                )}
                {!isPending && (
                    <a
                        href={`/api/certificate?id=${recipient.certificate_id}`}
                        target="_blank"
                        className="p-2 rounded hover:bg-gray-700 text-gray-400"
                        title="Download with QR"
                    >
                        <Download className="w-4 h-4" />
                    </a>
                )}
                <button
                    onClick={() => {
                        if (!isPending && !confirm(`Delete ${recipient.user.name || 'this student'}'s ${recipient.status === 'revoked' ? 'revoked' : 'sent'} certificate?\n\nThe emailed download link and QR verification will stop working.`)) return
                        run(() => removePositionRecipient(recipient.id, !isPending), isPending ? undefined : 'Certificate deleted')
                    }}
                    className="p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400"
                    title={isPending ? 'Remove student' : 'Delete certificate'}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}

function StatusBadge({ recipient }: { recipient: PositionRecipient }) {
    if (recipient.status === 'valid') {
        return (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs">
                <CheckCircle className="w-3 h-3" /> Sent
            </span>
        )
    }
    if (recipient.status === 'revoked') {
        return (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 rounded-full text-xs">
                <Ban className="w-3 h-3" /> Revoked
            </span>
        )
    }
    return (
        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-300 rounded-full text-xs">
            <Clock className="w-3 h-3" /> {recipient.file_url ? 'Ready' : 'Needs file'}
        </span>
    )
}

// ==========================================
// Student search
// ==========================================

function StudentSearch({ eventId, excludeIds, onSelect }: {
    eventId: string
    excludeIds: string[]
    onSelect: (student: ParticipantSearchResult) => Promise<void>
}) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<ParticipantSearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const requestId = useRef(0)

    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([])
            return
        }
        const id = ++requestId.current
        setIsSearching(true)
        const timer = setTimeout(async () => {
            try {
                const found = await searchEventParticipants(eventId, query)
                if (id === requestId.current) setResults(found)
            } finally {
                if (id === requestId.current) setIsSearching(false)
            }
        }, 250)
        return () => clearTimeout(timer)
    }, [query, eventId])

    const visible = results.filter(r => !excludeIds.includes(r.id))

    return (
        <div className="relative">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus-within:border-violet-500">
                {isSearching ? <Loader2 className="w-4 h-4 text-gray-500 animate-spin" /> : <Search className="w-4 h-4 text-gray-500" />}
                <input
                    value={query}
                    onChange={e => { setQuery(e.target.value); setIsOpen(true) }}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 150)}
                    placeholder="Add student: search by email or name"
                    className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 focus:outline-none"
                />
            </div>
            {isOpen && query.trim().length >= 2 && !isSearching && (
                <div className="absolute z-20 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
                    {visible.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-gray-500">No registered student matches &quot;{query}&quot;</p>
                    ) : visible.map(student => (
                        <button
                            key={student.id}
                            onMouseDown={e => e.preventDefault()}
                            onClick={async () => {
                                setQuery('')
                                setIsOpen(false)
                                await onSelect(student)
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-700 flex items-center justify-between gap-2"
                        >
                            <div className="min-w-0">
                                <p className="text-sm text-white truncate">{student.name || 'Unnamed'}</p>
                                <p className="text-xs text-gray-400 truncate">{student.email}</p>
                            </div>
                            {!student.attended && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 flex-shrink-0">Not checked in</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ==========================================
// QR placement modal
// ==========================================

function QrPlacementModal({ state, onClose, onChange, onSavePosition, onApplyAll, onSaveRecipient, onResetRecipient }: {
    state: QrEditorState
    onClose: () => void
    onChange: (qr: QRRegion) => void
    onSavePosition: () => void
    onApplyAll: () => void
    onSaveRecipient: () => void
    onResetRecipient: () => void
}) {
    const [isSaving, setIsSaving] = useState(false)
    const wrap = (fn: () => void) => () => { setIsSaving(true); fn() }
    const { position, recipient, imageSrc, qr } = state

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-900 rounded-xl p-5 w-full max-w-4xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4 gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white">
                            {recipient ? `QR for ${recipient.user.name || 'this student'}` : `QR placement: ${position.title}`}
                        </h3>
                        <p className="text-sm text-gray-400">
                            {recipient
                                ? 'Only this certificate. Others in the position keep the shared placement.'
                                : 'Used for every certificate in this position. Drag the box to move it.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <CertificateCanvas imageSrc={imageSrc} qrRegion={qr} onQrChange={onChange} />

                <div className="mt-4">
                    <label className="text-xs text-gray-400">Size: {Math.round(qr.width)}% of width</label>
                    <input
                        type="range"
                        value={qr.width}
                        onChange={e => onChange({ ...qr, width: Number(e.target.value), height: Number(e.target.value) })}
                        className="w-full"
                        min={4}
                        max={30}
                    />
                </div>

                <div className="flex flex-wrap gap-2 justify-end mt-4">
                    {recipient ? (
                        <>
                            {recipient.qr_region && (
                                <button onClick={wrap(onResetRecipient)} disabled={isSaving} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
                                    Use position placement
                                </button>
                            )}
                            <button onClick={wrap(onSaveRecipient)} disabled={isSaving} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium">
                                Save for this certificate
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={wrap(onApplyAll)} disabled={isSaving} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
                                Apply to all positions
                            </button>
                            <button onClick={wrap(onSavePosition)} disabled={isSaving} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium">
                                Save for {position.title}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
