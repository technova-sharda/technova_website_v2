"use client"

import { useEffect, useRef, useState } from "react"
import type { QRRegion, TextRegion } from "@/types/custom"
import { FONT_BASELINE_HEIGHT, PREVIEW_FONT_FEATURE_SETTINGS, getCertificateFont, getPreviewFontFamily } from "@/lib/certificates/fonts"

interface CertificateCanvasProps {
    imageSrc: string
    qrRegion: QRRegion
    onQrChange: (qr: QRRegion) => void
    nameRegion?: TextRegion | null
    onNameChange?: (region: TextRegion) => void
    sampleName?: string
    preview?: boolean
}

type DragTarget = 'qr' | 'name'

/**
 * Shows a certificate image at its natural aspect ratio with a draggable square QR box
 * and an optional draggable name field. Positions are percentages of the image, which is
 * exactly how the PDF generator places them.
 */
export function CertificateCanvas({
    imageSrc,
    qrRegion,
    onQrChange,
    nameRegion,
    onNameChange,
    sampleName = 'Participant Name',
    preview = false,
}: CertificateCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [aspect, setAspect] = useState<number | null>(null)
    const [height, setHeight] = useState(0)
    const drag = useRef<{ target: DragTarget, startX: number, startY: number, origX: number, origY: number } | null>(null)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const observer = new ResizeObserver(entries => setHeight(entries[0].contentRect.height))
        observer.observe(el)
        return () => observer.disconnect()
    }, [aspect])

    const startDrag = (e: React.PointerEvent, target: DragTarget) => {
        if (preview) return
        e.preventDefault()
        e.stopPropagation()
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        const orig = target === 'qr' ? qrRegion : nameRegion!
        drag.current = { target, startX: e.clientX, startY: e.clientY, origX: orig.x, origY: orig.y }
    }

    const onPointerMove = (e: React.PointerEvent) => {
        const d = drag.current
        const el = containerRef.current
        if (!d || !el) return
        const rect = el.getBoundingClientRect()
        const dx = ((e.clientX - d.startX) / rect.width) * 100
        const dy = ((e.clientY - d.startY) / rect.height) * 100

        if (d.target === 'qr') {
            const qrHeightPct = (qrRegion.width * rect.width) / rect.height
            onQrChange({
                ...qrRegion,
                x: clamp(d.origX + dx, 0, 100 - qrRegion.width),
                y: clamp(d.origY + dy, 0, 100 - qrHeightPct),
            })
        } else if (nameRegion && onNameChange) {
            onNameChange({ ...nameRegion, x: clamp(d.origX + dx, 0, 100), y: clamp(d.origY + dy, 0, 100) })
        }
    }

    const endDrag = () => { drag.current = null }

    // Same scale the PDF uses: fontSize is authored against an 800px-tall template
    const scale = height / FONT_BASELINE_HEIGHT
    const font = getCertificateFont(nameRegion?.fontFamily)
    const previewWeight = nameRegion?.fontWeight === 'bold' && (nameRegion.fontFamily === 'custom' || !font || font.hasBold) ? 700 : 400
    const translateX = nameRegion?.alignment === 'left' ? '0%' : nameRegion?.alignment === 'right' ? '-100%' : '-50%'

    return (
        <div
            ref={containerRef}
            className="relative w-full bg-gray-800 rounded-lg overflow-hidden select-none touch-none"
            style={{ aspectRatio: aspect ?? 1.414 }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
        >
            <img
                src={imageSrc}
                alt="Certificate"
                className="absolute inset-0 w-full h-full"
                draggable={false}
                onLoad={e => {
                    const img = e.currentTarget
                    if (img.naturalWidth && img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight)
                }}
            />

            {/* QR box: square, sized as % of width */}
            <div
                className={`absolute flex items-center justify-center ${preview ? '' : 'border-2 border-dashed border-violet-500 bg-violet-500/20 cursor-move'}`}
                style={{
                    left: `${qrRegion.x}%`,
                    top: `${qrRegion.y}%`,
                    width: `${qrRegion.width}%`,
                    aspectRatio: '1',
                }}
                onPointerDown={e => startDrag(e, 'qr')}
            >
                {preview ? <QrPlaceholder /> : <span className="text-[10px] sm:text-xs text-violet-300 font-medium pointer-events-none">QR Code</span>}
            </div>

            {nameRegion && (
                <div
                    className={`absolute ${preview ? '' : 'outline outline-1 outline-dashed outline-emerald-500 bg-emerald-500/10 cursor-move'}`}
                    style={{
                        left: `${nameRegion.x}%`,
                        top: `${nameRegion.y}%`,
                        transform: `translate(${translateX}, -50%)`,
                        fontFamily: getPreviewFontFamily(nameRegion.fontFamily),
                        fontSize: `${nameRegion.fontSize * scale}px`,
                        fontWeight: previewWeight,
                        letterSpacing: `${(nameRegion.letterSpacing || 0) * scale}px`,
                        color: nameRegion.color,
                        // Same typography as the PDF: kerning on, ligatures off
                        fontFeatureSettings: PREVIEW_FONT_FEATURE_SETTINGS,
                        fontKerning: 'normal',
                        lineHeight: 'normal',
                        whiteSpace: 'nowrap',
                    }}
                    onPointerDown={e => startDrag(e, 'name')}
                >
                    {sampleName}
                </div>
            )}
        </div>
    )
}

function QrPlaceholder() {
    return (
        <svg viewBox="0 0 21 21" className="w-full h-full bg-white p-[6%]" shapeRendering="crispEdges">
            {[[0, 0], [14, 0], [0, 14]].map(([x, y]) => (
                <g key={`${x}-${y}`}>
                    <rect x={x} y={y} width="7" height="7" fill="#000" />
                    <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
                    <rect x={x + 2} y={y + 2} width="3" height="3" fill="#000" />
                </g>
            ))}
            {[[9, 2], [10, 4], [8, 9], [12, 10], [16, 9], [9, 13], [14, 14], [17, 16], [11, 17], [15, 18], [19, 12]].map(([x, y]) => (
                <rect key={`${x}-${y}`} x={x} y={y} width="2" height="2" fill="#000" />
            ))}
        </svg>
    )
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value))
}
