"use client"

import { useState, useEffect, useMemo } from "react"
import { Upload, Eye, EyeOff, Save, Loader2, Type, QrCode, AlignLeft, AlignCenter, AlignRight } from "lucide-react"
import { Toast, useToast } from "@/components/ui/toast"
import type { QRRegion, TextRegion } from "@/types/custom"
import {
    createCertificateTemplate,
    getCertificateTemplate,
    uploadCertificateTemplate,
    uploadCertificateFont,
    getCertificateFontUrl,
    releaseCertificates,
} from "@/lib/actions/certificates"
import { CertificateCanvas } from "@/components/admin/certificates/CertificateCanvas"
import { ParticipationRecipients } from "@/components/admin/certificates/ParticipationRecipients"
import {
    CERTIFICATE_FONTS,
    FONT_CATEGORY_LABELS,
    buildFontFaceCss,
    getCertificateFont,
    type FontCategory,
} from "@/lib/certificates/fonts"

interface CertificateTemplateEditorProps {
    eventId: string
    refreshKey?: number   // bump to reload the recipient summary (e.g. positions changed)
    onSent?: () => void
}

const DEFAULT_NAME_REGION: TextRegion = {
    id: 'participant-name',
    field: 'participant_name',
    x: 50,
    y: 50,
    fontSize: 72,
    color: '#000000',
    fontWeight: 'normal',
    alignment: 'center',
    fontFamily: 'great-vibes',
    letterSpacing: 0,
}

const FONT_CSS = buildFontFaceCss()

export function CertificateTemplateEditor({ eventId, refreshKey, onSent }: CertificateTemplateEditorProps) {
    const [templateUrl, setTemplateUrl] = useState<string | null>(null)
    const [templatePreview, setTemplatePreview] = useState<string | null>(null)
    const [qrRegion, setQrRegion] = useState<QRRegion>({ x: 84, y: 7, width: 11, height: 11 })
    const [nameRegion, setNameRegion] = useState<TextRegion>(DEFAULT_NAME_REGION)
    const [customFontName, setCustomFontName] = useState<string | null>(null)
    const [sampleName, setSampleName] = useState('Participant Name')
    const [isDirty, setIsDirty] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [isUploadingFont, setIsUploadingFont] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [showPreview, setShowPreview] = useState(false)

    const { toast, showToast, hideToast } = useToast()

    useEffect(() => {
        async function loadTemplate() {
            try {
                const template = await getCertificateTemplate(eventId)
                if (template) {
                    setTemplateUrl(template.template_url)
                    setTemplatePreview(template.signedUrl || template.template_url)
                    setQrRegion(template.qr_region)
                    const existing = template.text_regions.find(r => r.field === 'participant_name')
                    if (existing) {
                        setNameRegion({ ...DEFAULT_NAME_REGION, fontFamily: undefined, ...existing })
                        if (existing.fontFamily === 'custom' && existing.customFontPath) {
                            await loadCustomFont(await getCertificateFontUrl(existing.customFontPath))
                            setCustomFontName(existing.customFontPath.split('/').pop()?.replace(/^\d+-/, '') || 'Custom font')
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load template:', error)
            } finally {
                setIsLoading(false)
            }
        }
        loadTemplate()
    }, [eventId])


    const updateName = (updates: Partial<TextRegion>) => {
        setNameRegion(prev => ({ ...prev, ...updates }))
        setIsDirty(true)
    }

    const updateQr = (qr: QRRegion) => {
        setQrRegion(qr)
        setIsDirty(true)
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return

        if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
            showToast('Please upload a PNG or JPG image', 'error')
            return
        }
        if (file.size > 10 * 1024 * 1024) {
            showToast('File size must be less than 10MB', 'error')
            return
        }

        setIsUploading(true)
        try {
            setTemplatePreview(URL.createObjectURL(file))
            const url = await uploadCertificateTemplate(file, eventId)
            setTemplateUrl(url)
            setIsDirty(true)
            showToast('Template uploaded. Place the name and QR, then save.', 'success')
        } catch (error) {
            console.error('Upload error:', error)
            showToast('Failed to upload template', 'error')
        } finally {
            setIsUploading(false)
        }
    }

    const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return

        setIsUploadingFont(true)
        try {
            const formData = new FormData()
            formData.append('eventId', eventId)
            formData.append('file', file)
            const result = await uploadCertificateFont(formData)
            await loadCustomFont(result.url)
            setCustomFontName(result.name)
            updateName({ fontFamily: 'custom', customFontPath: result.path })
            showToast('Font uploaded', 'success')
        } catch (error: any) {
            showToast(error.message || 'Failed to upload font', 'error')
        } finally {
            setIsUploadingFont(false)
        }
    }

    const saveTemplate = async () => {
        if (!templateUrl) {
            showToast('Please upload a template first', 'error')
            return false
        }
        setIsSaving(true)
        try {
            await createCertificateTemplate(eventId, templateUrl, qrRegion, [nameRegion])
            setIsDirty(false)
            return true
        } catch (error) {
            console.error('Save error:', error)
            showToast('Failed to save template', 'error')
            return false
        } finally {
            setIsSaving(false)
        }
    }

    const handleSave = async () => {
        if (await saveTemplate()) showToast('Template saved', 'success')
    }

    const handleSend = async (userIds: string[]) => {
        if (!confirm(`Send participation certificates to ${userIds.length} students? Each will receive an email.`)) return

        if (isDirty && !(await saveTemplate())) return

        setIsSending(true)
        try {
            const result = await releaseCertificates({ eventId, userIds })
            showToast(result.message, 'success')
            onSent?.()
        } catch (error: any) {
            showToast(error.message || 'Failed to send certificates', 'error')
        } finally {
            setIsSending(false)
        }
    }

    const fontsByCategory = useMemo(() => {
        const groups: Record<FontCategory, typeof CERTIFICATE_FONTS> = { script: [], serif: [], sans: [] }
        CERTIFICATE_FONTS.forEach(f => groups[f.category].push(f))
        return groups
    }, [])

    const selectedFont = getCertificateFont(nameRegion.fontFamily)
    const boldAvailable = nameRegion.fontFamily === 'custom' || !selectedFont || selectedFont.hasBold

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <style>{FONT_CSS}</style>
            {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

            {!templatePreview && (
                <div className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                    <p className="text-white font-medium mb-1">Upload the participation template</p>
                    <p className="text-gray-400 text-sm mb-4">PNG or JPG, with the name area left empty. Names are filled in from registrations.</p>
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg cursor-pointer transition-colors">
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {isUploading ? 'Uploading...' : 'Choose File'}
                        <input type="file" accept="image/png,image/jpeg" onChange={handleFileUpload} className="hidden" disabled={isUploading} />
                    </label>
                </div>
            )}

            {templatePreview && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Canvas */}
                    <div className="lg:col-span-2">
                        <div className="bg-gray-900 rounded-xl p-4">
                            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                                <h3 className="text-white font-semibold">Template</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowPreview(!showPreview)}
                                        className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2"
                                    >
                                        {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        {showPreview ? 'Edit' : 'Preview'}
                                    </button>
                                    <label className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg cursor-pointer flex items-center gap-2">
                                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                        Replace
                                        <input type="file" accept="image/png,image/jpeg" onChange={handleFileUpload} className="hidden" disabled={isUploading} />
                                    </label>
                                </div>
                            </div>

                            <CertificateCanvas
                                imageSrc={templatePreview}
                                qrRegion={qrRegion}
                                onQrChange={updateQr}
                                nameRegion={nameRegion}
                                onNameChange={region => { setNameRegion(region); setIsDirty(true) }}
                                sampleName={sampleName || 'Participant Name'}
                                preview={showPreview}
                            />

                            <div className="flex items-center gap-2 mt-3">
                                <label className="text-xs text-gray-500 whitespace-nowrap">Preview name</label>
                                <input
                                    value={sampleName}
                                    onChange={e => setSampleName(e.target.value)}
                                    className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                                    placeholder="Try a long name to check it fits"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Drag the name and the QR box to position them. The QR is generated for each student.</p>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="space-y-4">
                        <div className="bg-gray-900 rounded-xl p-4 space-y-3">
                            <h4 className="text-white font-semibold flex items-center gap-2">
                                <Type className="w-4 h-4 text-emerald-500" />
                                Name Style
                            </h4>

                            <div>
                                <label className="text-xs text-gray-400">Font</label>
                                <select
                                    value={nameRegion.fontFamily || ''}
                                    onChange={e => {
                                        const value = e.target.value
                                        if (value === 'custom' && !nameRegion.customFontPath) return
                                        updateName({ fontFamily: value || undefined })
                                    }}
                                    className="w-full mt-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                                >
                                    {(Object.keys(fontsByCategory) as FontCategory[]).map(category => (
                                        <optgroup key={category} label={FONT_CATEGORY_LABELS[category]}>
                                            {fontsByCategory[category].map(font => (
                                                <option key={font.id} value={font.id}>{font.label}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                    <optgroup label="Other">
                                        <option value="">Helvetica</option>
                                        {nameRegion.customFontPath && (
                                            <option value="custom">{customFontName || 'Uploaded font'}</option>
                                        )}
                                    </optgroup>
                                </select>
                                <label className="mt-2 inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 cursor-pointer">
                                    {isUploadingFont ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                    Upload your own font (.ttf / .otf)
                                    <input type="file" accept=".ttf,.otf" onChange={handleFontUpload} className="hidden" disabled={isUploadingFont} />
                                </label>
                            </div>

                            <div>
                                <div className="flex items-center justify-between">
                                    <label className="text-xs text-gray-400">Size</label>
                                    <input
                                        type="number"
                                        value={nameRegion.fontSize}
                                        onChange={e => updateName({ fontSize: Number(e.target.value) || 1 })}
                                        className="w-16 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-white text-xs text-right"
                                        min={8}
                                        max={240}
                                    />
                                </div>
                                <input
                                    type="range"
                                    value={nameRegion.fontSize}
                                    onChange={e => updateName({ fontSize: Number(e.target.value) })}
                                    className="w-full mt-1"
                                    min={12}
                                    max={200}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-400">Color</label>
                                    <input
                                        type="color"
                                        value={nameRegion.color}
                                        onChange={e => updateName({ color: e.target.value })}
                                        className="w-full mt-1 h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Weight</label>
                                    <select
                                        value={boldAvailable ? nameRegion.fontWeight : 'normal'}
                                        onChange={e => updateName({ fontWeight: e.target.value as 'normal' | 'bold' })}
                                        disabled={!boldAvailable}
                                        title={boldAvailable ? undefined : 'This font only has a regular weight'}
                                        className="w-full mt-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm disabled:opacity-50"
                                    >
                                        <option value="normal">Regular</option>
                                        <option value="bold">Bold</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-400">Align</label>
                                    <div className="mt-1 flex bg-gray-800 border border-gray-700 rounded overflow-hidden">
                                        {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([value, Icon]) => (
                                            <button
                                                key={value}
                                                onClick={() => updateName({ alignment: value })}
                                                className={`flex-1 py-1.5 flex justify-center ${nameRegion.alignment === value ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                                title={`Align ${value}`}
                                            >
                                                <Icon className="w-4 h-4" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Letter spacing</label>
                                    <input
                                        type="number"
                                        value={nameRegion.letterSpacing || 0}
                                        onChange={e => updateName({ letterSpacing: Number(e.target.value) })}
                                        className="w-full mt-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                                        min={-10}
                                        max={50}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-900 rounded-xl p-4">
                            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                                <QrCode className="w-4 h-4 text-violet-400" />
                                QR Code
                            </h4>
                            <label className="text-xs text-gray-400">Size</label>
                            <input
                                type="range"
                                value={qrRegion.width}
                                onChange={e => {
                                    const size = Number(e.target.value)
                                    updateQr({ ...qrRegion, width: size, height: size })
                                }}
                                className="w-full mt-1"
                                min={4}
                                max={30}
                            />
                            <span className="text-xs text-gray-500">{Math.round(qrRegion.width)}% of width</span>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={isSaving || !templateUrl || !isDirty}
                            className="w-full py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            {isSaving ? 'Saving...' : isDirty ? 'Save Template' : 'Saved'}
                        </button>
                    </div>
                </div>
            )}

            {/* Recipients + send */}
            <ParticipationRecipients
                eventId={eventId}
                refreshKey={refreshKey}
                canSend={!!templateUrl}
                isSending={isSending}
                onSend={handleSend}
            />
        </div>
    )
}

async function loadCustomFont(url: string) {
    try {
        const face = new FontFace('CertCustomFont', `url(${url})`)
        await face.load()
        // Replace any previously uploaded font so the preview uses the latest one
        document.fonts.forEach(f => { if (f.family === 'CertCustomFont') document.fonts.delete(f) })
        document.fonts.add(face)
    } catch (error) {
        console.error('Failed to load custom font:', error)
    }
}
