'use client'

import { useState } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'

// Defined outside FlipbookViewer: a component declared inside it is a new type
// on every render, so React remounted the iframe (reloading the flipbook) each time.
function BookContent() {
    return (
        <div className="w-full h-full relative rounded-xl md:rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <iframe
                allowFullScreen={true}
                scrolling="no"
                className="w-full h-full border-0 bg-transparent"
                src="https://heyzine.com/flip-book/3a2b7c79bb.html"
            />
        </div>
    )
}

export function FlipbookViewer() {
    const [isFullscreen, setIsFullscreen] = useState(false)

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen)
    }

    return (
        <div className="w-full flex flex-col items-center gap-8 py-8">
            {/* Inline / Default View */}
            <div className={`relative w-full max-w-5xl h-[500px] md:h-[700px] mx-auto flex items-center justify-center bg-white/5 rounded-3xl p-2 md:p-8 mb-8 backdrop-blur-md border border-white/10 shadow-2xl transition-all duration-500`}
                style={{ opacity: isFullscreen ? 0 : 1, pointerEvents: isFullscreen ? 'none' : 'auto' }}
            >
                <BookContent />

                {/* Fullscreen Toggle for Inline View */}
                <button
                    onClick={toggleFullscreen}
                    className="absolute top-4 right-4 md:top-12 md:right-12 pointer-events-auto w-10 h-10 rounded-full bg-black/80 backdrop-blur-md border border-white/20 hidden md:flex items-center justify-center text-white hover:bg-blue-600 transition-colors z-20 shadow-xl"
                >
                    <Maximize2 className="w-5 h-5 cursor-pointer" />
                </button>
            </div>

            {/* Fullscreen Modal View */}
            {isFullscreen && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-0 md:p-8 animate-in fade-in duration-300">
                    <div className="relative w-full max-w-7xl h-full md:max-h-[95vh] flex items-center justify-center">
                        <BookContent />
                    </div>
                    <button
                        onClick={toggleFullscreen}
                        className="absolute top-4 right-4 md:top-6 md:right-6 pointer-events-auto w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-red-600 transition-colors z-20"
                    >
                        <X className="w-5 h-5 md:w-6 md:h-6 cursor-pointer" />
                    </button>
                </div>
            )}
        </div>
    )
}
