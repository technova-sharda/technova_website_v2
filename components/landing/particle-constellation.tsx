'use client'

import { useEffect, useRef } from "react"

/**
 * Hero constellation: drifting amber points linked by faint lines, drawn toward
 * the cursor on desktop.
 *
 * Kept cheap on purpose:
 * - crisp on retina (devicePixelRatio, capped at 2)
 * - fewer points on small screens; no mouse work on touch devices
 * - stops drawing while the hero is off-screen or the tab is hidden
 * - one static frame when the visitor prefers reduced motion
 */
export function ParticleConstellation({ className = "" }: { className?: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx) return

        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches
        const mouse = { x: -9999, y: -9999 }
        let width = 0, height = 0, raf = 0, visible = true

        type P = { x: number; y: number; vx: number; vy: number; r: number; a: number }
        let points: P[] = []

        const setup = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            width = canvas.clientWidth
            height = canvas.clientHeight
            canvas.width = Math.round(width * dpr)
            canvas.height = Math.round(height * dpr)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            const count = Math.round(Math.min(90, Math.max(28, (width * height) / 16000)))
            points = Array.from({ length: count }, () => ({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r: Math.random() * 1.6 + 0.5,
                a: Math.random() * 0.5 + 0.15,
            }))
        }

        const LINK = 140
        const MOUSE = 190

        const frame = () => {
            ctx.clearRect(0, 0, width, height)
            for (const p of points) {
                if (!reduce) {
                    p.x += p.vx
                    p.y += p.vy
                    if (p.x < 0) p.x = width
                    else if (p.x > width) p.x = 0
                    if (p.y < 0) p.y = height
                    else if (p.y > height) p.y = 0
                    const dx = mouse.x - p.x, dy = mouse.y - p.y
                    const d2 = dx * dx + dy * dy
                    if (d2 < MOUSE * MOUSE) {
                        const f = (MOUSE - Math.sqrt(d2)) / MOUSE
                        p.vx += dx * f * 0.0007
                        p.vy += dy * f * 0.0007
                    }
                    p.vx *= 0.985
                    p.vy *= 0.985
                }
                ctx.beginPath()
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(245,166,35,${p.a})`
                ctx.fill()
            }
            ctx.lineWidth = 0.6
            for (let i = 0; i < points.length; i++) {
                for (let j = i + 1; j < points.length; j++) {
                    const dx = points[i].x - points[j].x, dy = points[i].y - points[j].y
                    const d2 = dx * dx + dy * dy
                    if (d2 < LINK * LINK) {
                        ctx.strokeStyle = `rgba(245,166,35,${(1 - Math.sqrt(d2) / LINK) * 0.16})`
                        ctx.beginPath()
                        ctx.moveTo(points[i].x, points[i].y)
                        ctx.lineTo(points[j].x, points[j].y)
                        ctx.stroke()
                    }
                }
            }
            if (mouse.x > -9000) {
                const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 200)
                g.addColorStop(0, "rgba(245,166,35,0.07)")
                g.addColorStop(1, "rgba(245,166,35,0)")
                ctx.fillStyle = g
                ctx.fillRect(0, 0, width, height)
            }
        }

        const loop = () => {
            frame()
            raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0
        }
        const start = () => { if (!raf && !reduce) raf = requestAnimationFrame(loop) }

        setup()
        frame()
        start()

        const onResize = () => { setup(); frame() }
        const onMove = (e: MouseEvent) => {
            const r = canvas.getBoundingClientRect()
            mouse.x = e.clientX - r.left
            mouse.y = e.clientY - r.top
        }
        const onLeave = () => { mouse.x = mouse.y = -9999 }
        const onVisibility = () => { if (!document.hidden) start() }

        const io = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
            if (visible) start()
        })
        io.observe(canvas)
        window.addEventListener("resize", onResize)
        document.addEventListener("visibilitychange", onVisibility)
        if (finePointer) {
            window.addEventListener("mousemove", onMove)
            document.addEventListener("mouseleave", onLeave)
        }
        return () => {
            cancelAnimationFrame(raf)
            io.disconnect()
            window.removeEventListener("resize", onResize)
            document.removeEventListener("visibilitychange", onVisibility)
            window.removeEventListener("mousemove", onMove)
            document.removeEventListener("mouseleave", onLeave)
        }
    }, [])

    return <canvas ref={canvasRef} aria-hidden className={`absolute inset-0 w-full h-full pointer-events-none ${className}`} />
}
