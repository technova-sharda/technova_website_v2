'use client'

import { useState } from 'react'
import { Share2, Copy, Check, Gift, X, Lightbulb } from 'lucide-react'
import { getReferralLink } from '@/lib/actions/referrals'
import { motion, AnimatePresence } from 'framer-motion'

interface ReferralShareProps {
    eventSlugOrId: string
    eventTitle: string
}

export function ReferralShare({ eventSlugOrId, eventTitle }: ReferralShareProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [referralLink, setReferralLink] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleOpen = async () => {
        setIsOpen(true)
        if (!referralLink) {
            setLoading(true)
            try {
                const result = await getReferralLink(eventSlugOrId)
                if (result) {
                    setReferralLink(result.link)
                }
            } catch (error) {
                console.error('Failed to get referral link:', error)
            } finally {
                setLoading(false)
            }
        }
    }

    const handleCopy = async () => {
        if (referralLink) {
            await navigator.clipboard.writeText(referralLink)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleShare = async () => {
        if (referralLink && navigator.share) {
            try {
                await navigator.share({
                    title: `Join me at ${eventTitle}!`,
                    text: `I'm attending ${eventTitle}. Register using my link and we both earn XP!`,
                    url: referralLink
                })
            } catch (error) {
                // User cancelled or share failed
                console.error('Share failed:', error)
            }
        } else {
            handleCopy()
        }
    }

    return (
        <>
            {/* Share Button */}
            <button
                onClick={handleOpen}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-medium transition-all hover:scale-105 shadow-lg shadow-purple-500/25"
            >
                <Gift className="w-4 h-4" />
                Share & Earn XP
            </button>

            {/* Modal */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl border border-white/10 p-6 max-w-md w-full shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                                        <Gift className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Share & Earn</h3>
                                        <p className="text-gray-400 text-sm">Get 10 XP per referral</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="space-y-4">
                                <p className="text-gray-300">
                                    Share your unique link. When someone registers using it, you earn <span className="text-purple-400 font-bold">10 XP</span>!
                                </p>

                                {/* Link Box */}
                                <div className="bg-black/40 rounded-xl p-4 border border-white/10">
                                    {loading ? (
                                        <div className="flex items-center justify-center py-4">
                                            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    ) : referralLink ? (
                                        <div className="space-y-3">
                                            <p className="text-sm text-gray-400 font-mono break-all">
                                                {referralLink}
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleCopy}
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors font-medium"
                                                >
                                                    {copied ? (
                                                        <>
                                                            <Check className="w-4 h-4 text-green-400" />
                                                            <span className="text-green-400">Copied!</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-4 h-4" />
                                                            <span>Copy</span>
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={handleShare}
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg transition-all font-medium"
                                                >
                                                    <Share2 className="w-4 h-4" />
                                                    <span>Share</span>
                                                </button>
                                            </div>
                                            <a
                                                href={`https://wa.me/?text=${encodeURIComponent(`I'm attending ${eventTitle}! Register here: ${referralLink}`)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#1ebe5b] text-black rounded-lg transition-colors font-semibold"
                                            >
                                                Share on WhatsApp
                                            </a>
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 text-center py-4">
                                            Failed to generate link. Try again.
                                        </p>
                                    )}
                                </div>

                                {/* Tips */}
                                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                                    <p className="text-purple-300 text-sm flex items-start gap-2">
                                        <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" /> <span><strong>Tip:</strong> Share on WhatsApp groups, Instagram stories, or with friends to maximize your XP!</span>
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
