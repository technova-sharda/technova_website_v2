'use client'

import { useCallback, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import { Check, Loader2, RotateCw, X, ZoomIn } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export type CropOptions = {
    title: string
    /** Width / height choices; the first is the default. */
    aspects: { label: string; value: number }[]
    round?: boolean
    /** PNG keeps transparency (logos); JPEG is smaller (photos). */
    type?: "image/png" | "image/jpeg"
    maxSize?: number
}

function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error("Couldn't read this image"))
        img.src = src
    })
}

/** Draws the chosen area (after rotation) onto a canvas, at most maxSize px on the long side. */
async function cropToFile(src: string, area: Area, rotation: number, name: string, type: string, maxSize: number) {
    const img = await loadImage(src)
    const rad = (rotation * Math.PI) / 180
    const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad))
    const bw = img.width * cos + img.height * sin, bh = img.width * sin + img.height * cos

    const rotated = document.createElement("canvas")
    rotated.width = Math.round(bw); rotated.height = Math.round(bh)
    const rc = rotated.getContext("2d")!
    rc.translate(bw / 2, bh / 2)
    rc.rotate(rad)
    rc.drawImage(img, -img.width / 2, -img.height / 2)

    const scale = Math.min(1, maxSize / Math.max(area.width, area.height))
    const out = document.createElement("canvas")
    out.width = Math.max(1, Math.round(area.width * scale)); out.height = Math.max(1, Math.round(area.height * scale))
    const oc = out.getContext("2d")!
    if (type === "image/jpeg") { oc.fillStyle = "#fff"; oc.fillRect(0, 0, out.width, out.height) }
    oc.imageSmoothingQuality = "high"
    oc.drawImage(rotated, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height)

    const blob = await new Promise<Blob | null>(r => out.toBlob(r, type, 0.92))
    if (!blob) throw new Error("Couldn't crop this image")
    return new File([blob], name.replace(/\.[^.]+$/, "") + (type === "image/png" ? ".png" : ".jpg"), { type })
}

/** Crop step shown after picking an image: drag to move, pinch / slider to zoom, rotate, pick a shape. */
export function ImageCropper({ src, fileName, options, onCancel, onDone }: {
    src: string; fileName: string; options: CropOptions; onCancel: () => void; onDone: (file: File) => void | Promise<void>
}) {
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [rotation, setRotation] = useState(0)
    const [aspect, setAspect] = useState(options.aspects[0].value)
    const [area, setArea] = useState<Area | null>(null)
    const [busy, setBusy] = useState(false)
    const onComplete = useCallback((_: Area, px: Area) => setArea(px), [])

    const done = async () => {
        if (!area) return
        setBusy(true)
        try {
            await onDone(await cropToFile(src, area, rotation, fileName, options.type ?? "image/jpeg", options.maxSize ?? 1024))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Dialog open onOpenChange={o => { if (!o && !busy) onCancel() }}>
            <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-lg w-[calc(100vw-1.5rem)] p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-4 border-b border-white/10 text-left">
                    <DialogTitle className="text-base">{options.title}</DialogTitle>
                    <DialogDescription className="text-gray-400 text-xs">Drag to move, pinch or use the slider to zoom.</DialogDescription>
                </DialogHeader>
                <div className="relative h-[min(60dvh,380px)] bg-black">
                    <Cropper
                        image={src}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={aspect}
                        cropShape={options.round ? "round" : "rect"}
                        showGrid={!options.round}
                        minZoom={0.5}
                        maxZoom={4}
                        restrictPosition={false}
                        objectFit="contain"
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onComplete}
                    />
                </div>
                <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <ZoomIn className="w-4 h-4 text-gray-400 shrink-0" />
                        <input type="range" min={0.5} max={4} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="flex-1 accent-amber-500" aria-label="Zoom" />
                        <button type="button" onClick={() => setRotation(r => (r + 90) % 360)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-gray-200 hover:bg-white/5">
                            <RotateCw className="w-3.5 h-3.5" /> Rotate
                        </button>
                    </div>
                    {options.aspects.length > 1 && (
                        <div className="flex flex-wrap gap-2">
                            {options.aspects.map(a => (
                                <button key={a.label} type="button" onClick={() => setAspect(a.value)} className={`rounded-full px-3 py-1 text-xs border ${aspect === a.value ? "bg-amber-500 text-black border-amber-500" : "border-white/15 text-gray-300 hover:bg-white/5"}`}>
                                    {a.label}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" disabled={busy} onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-200 hover:bg-white/5 disabled:opacity-50">
                            <X className="w-4 h-4" /> Cancel
                        </button>
                        <button type="button" disabled={busy || !area} onClick={done} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-60">
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {busy ? "Uploading…" : "Crop and upload"}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
