'use client'

import { useEffect, useState } from 'react'
import LiveDashboardClient from '@/app/(public)/live/live-dashboard'
import { motion } from 'framer-motion'
import { Terminal } from 'lucide-react'

export default function HackathonLivePage() {
    const [liveData, setLiveData] = useState<{ settings: any; schedule: any[]; shortlistedTeams: any[] } | null>(null)
    useEffect(() => {
        async function fetchLiveData() {
            try {
                const res = await fetch('/api/hackathon-live')
                if (res.ok) {
                    const data = await res.json()
                    setLiveData(data)
                }
            } catch (e) {
                console.error('Failed to fetch live data', e)
            }
        }
        fetchLiveData()
        const liveInterval = setInterval(fetchLiveData, 15000)
        return () => clearInterval(liveInterval)
    }, [])


    if (!liveData) return <div className="min-h-screen bg-[#03030F] flex items-center justify-center text-white font-mono uppercase tracking-widest text-xs">AWAITING SYSTEM DATA...</div>

    return (
        <div className="min-h-screen bg-[#03030F] text-white pt-6 md:pt-10 pb-32">
            <LiveDashboardClient
                initialSettings={liveData.settings || null}
                initialSchedule={liveData.schedule || []}
                initialShortlisted={liveData.shortlistedTeams || []}
            />
        </div>
    )
}
