"use client"

import { useState } from "react"
import { registerForEvent, cancelRegistration, resumePayment } from "@/lib/actions/registrations"
import { useRouter } from "next/navigation"
import { Download, XCircle, Loader2 } from "lucide-react"
import { RegistrationModal } from "./registration-modal"
import { RegistrationField } from "@/components/admin/form-builder"
import { Toast, useToast } from "@/components/ui/toast"
import { ReferralShare } from "./referral-share"

declare global {
    interface Window {
        Razorpay: new (options: RazorpayOptions) => { open: () => void }
    }
}

interface RazorpayOptions {
    key: string
    amount: number | string
    currency: string
    name: string
    description: string
    order_id: string
    handler: (response: { razorpay_payment_id: string }) => void
    prefill: { name: string; email: string }
    theme: { color: string }
}

interface EventData {
    id: string
    title: string
    price: number
    capacity: number
    registered_count?: number
    registration_fields?: RegistrationField[] | string
    is_past_event?: boolean
    status?: string
    end_time?: string
    registrations_closed?: boolean
}

interface UserData {
    name?: string | null
    email?: string | null
}

interface RegistrationData {
    id: string
    payment_status: string
}

export function EventRegistrationCard({
    event,
    user,
    existingRegistration,
    qrCode,
    referralCode
}: {
    event: EventData
    user: UserData | null
    existingRegistration: RegistrationData | null
    qrCode?: string | null
    referralCode?: string | null
}) {
    const [loading, setLoading] = useState(false)
    const [canceling, setCanceling] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)
    const router = useRouter()
    const { toast, showToast, hideToast } = useToast()


    const registrationFields: RegistrationField[] = (() => {
        if (Array.isArray(event.registration_fields)) return event.registration_fields
        if (typeof event.registration_fields !== 'string') return []

        try {
            const parsed = JSON.parse(event.registration_fields)
            return Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    })()

    const handleRegisterClick = () => {
        if (!user) {
            router.push(`/login?callbackUrl=/events/${event.id}`)
            return
        }

        if (registrationFields.length > 0) {
            setShowModal(true)
        } else {
            processRegistration({})
        }
    }

    const processRegistration = async (answers: Record<string, any>) => {
        setLoading(true)
        setShowModal(false)

        try {
            const result = await registerForEvent(event.id, answers, referralCode || undefined)

            if (result.status === 'success') {
                showToast("Registration successful! QR code sent to your email", 'success')
                router.refresh()
            } else if (result.status === 'payment_required' && result.order) {
                const options: RazorpayOptions = {
                    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_placeholder",
                    amount: result.order.amount,
                    currency: result.order.currency,
                    name: "Technova",
                    description: event.title,
                    order_id: result.order.id,
                    handler: function () {
                        showToast("Payment successful! Your registration is being processed", 'success')
                        router.refresh()
                    },
                    prefill: {
                        name: user?.name || '',
                        email: user?.email || '',
                    },
                    theme: {
                        color: "#2563EB"
                    }
                }

                const rzp1 = new window.Razorpay(options)
                rzp1.open()
            }
        } catch (err: unknown) {
            const error = err as Error
            // Handle stale server action hash after deployment
            if (error.message?.includes('was not found on the server') || error.message?.includes('Server Action')) {
                showToast("Page outdated — refreshing now...", 'error')
                setTimeout(() => window.location.reload(), 1000)
                return
            }
            showToast(error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleCancelRegistration = async () => {
        if (!existingRegistration) return
        setCanceling(true)
        try {
            await cancelRegistration(existingRegistration.id)
            showToast("Registration cancelled successfully!", 'success')
            router.refresh()
        } catch (err: unknown) {
            const error = err as Error
            showToast(error.message, 'error')
        } finally {
            setCanceling(false)
            setShowCancelConfirm(false)
        }
    }

    const downloadQR = () => {
        if (!qrCode) return
        const link = document.createElement('a')
        link.href = qrCode
        link.download = `technova-ticket-${event.title.replace(/\s+/g, '-').toLowerCase()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const openCheckout = (order: { id: string; amount: number; currency: string }) => {
        const rzp = new window.Razorpay({
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_placeholder",
            amount: order.amount,
            currency: order.currency,
            name: "Technova",
            description: event.title,
            order_id: order.id,
            handler: function () {
                showToast("Payment successful! Your ticket is on its way by email", 'success')
                router.refresh()
            },
            prefill: { name: user?.name || '', email: user?.email || '' },
            theme: { color: "#2563EB" },
        })
        rzp.open()
    }

    const handleResumePayment = async () => {
        setLoading(true)
        try {
            const { order } = await resumePayment(event.id)
            openCheckout(order)
        } catch (err: unknown) {
            showToast((err as Error).message, 'error')
        } finally {
            setLoading(false)
        }
    }

    if (existingRegistration && existingRegistration.payment_status === 'pending') {
        return (
            <div className="w-full md:w-80 bg-amber-50 p-6 rounded-xl border border-amber-200">
                <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
                <p className="text-amber-800 font-bold text-lg text-center">Payment pending</p>
                <p className="text-amber-700 text-sm text-center mt-1">Your seat is held, but the payment didn&apos;t complete. Finish it to get your ticket.</p>
                <button
                    onClick={handleResumePayment}
                    disabled={loading}
                    className="mt-4 w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                    {loading ? "Opening payment..." : `Complete payment (₹${event.price})`}
                </button>
            </div>
        )
    }

    if (existingRegistration) {
        return (
            <div className="w-full md:w-80 bg-green-50 p-6 rounded-xl border border-green-200">
                <div className="mb-4 text-center">
                    <p className="text-green-700 font-bold text-lg">You are registered!</p>
                    <p className="text-green-600 text-sm">See you at the event.</p>
                </div>
                {qrCode && (
                    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg border border-green-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrCode} alt="Event Ticket QR" className="w-48 h-48" />
                        <p className="text-xs text-gray-400 mt-2">Scan at entrance</p>
                        <button
                            onClick={downloadQR}
                            className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Download QR
                        </button>
                    </div>
                )}

                {/* Share & Earn XP */}
                {user && (
                    <div className="mt-4 pt-4 border-t border-green-200">
                        <p className="text-green-700 text-sm mb-3 text-center">Invite friends and earn XP!</p>
                        <div className="flex justify-center">
                            <ReferralShare eventSlugOrId={event.id} eventTitle={event.title} />
                        </div>
                    </div>
                )}

                {/* Cancel Registration Section */}
                <div className="mt-4 pt-4 border-t border-green-200">
                    {!showCancelConfirm ? (
                        <button
                            onClick={() => setShowCancelConfirm(true)}
                            className="w-full py-2 text-red-600 hover:text-red-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            <XCircle className="w-4 h-4" />
                            Can&apos;t attend? Cancel registration
                        </button>
                    ) : (
                        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-4">
                            <div className="flex items-center gap-2 text-amber-800">
                                <XCircle className="w-5 h-5 flex-shrink-0" />
                                <p className="font-bold">Cancel Registration?</p>
                            </div>
                            <p className="text-sm text-amber-700">This action cannot be undone. You&apos;ll need to register again if you change your mind.</p>
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={handleCancelRegistration}
                                    disabled={canceling}
                                    className="w-full py-3 px-4 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    {canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                    Yes, Cancel My Registration
                                </button>
                                <button
                                    onClick={() => setShowCancelConfirm(false)}
                                    className="w-full py-3 px-4 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                                    disabled={canceling}
                                >
                                    No, Keep My Spot
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Check if event is past (is_past_event flag, completed status, or end_time has passed)
    const isPastEvent = event.is_past_event ||
        event.status === 'completed' ||
        (event.end_time && new Date(event.end_time) < new Date())

    if (isPastEvent) {
        const attendeeCount = event.registered_count || event.capacity || 0
        return (
            <div className="w-full md:w-80 bg-gray-100 p-6 rounded-xl border border-gray-200">
                <div className="text-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <p className="text-gray-700 font-bold text-lg mb-1">Event Completed</p>
                    <p className="text-gray-500 text-sm mb-4">This event has already concluded.</p>
                    {attendeeCount > 0 && (
                        <div className="bg-white rounded-lg px-4 py-3 border border-gray-200">
                            <p className="text-2xl font-bold text-gray-800">{attendeeCount}</p>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Attendees</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const registeredCount = event.registered_count || 0
    const filledPercentage = Math.min((registeredCount / event.capacity) * 100, 100)
    const isFull = registeredCount >= event.capacity
    // Admin pressed "Stop registrations"
    const isClosed = !!event.registrations_closed
    const cannotRegister = isFull || isClosed

    return (
        <div className="w-full md:w-80 bg-white p-6 rounded-xl shadow-lg border border-slate-200 text-slate-900">
            {/* Capacity Bar */}
            <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-500 mb-2">
                    <span>Capacity</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${filledPercentage}%` }}
                    />
                </div>
                <div className="text-right text-xs text-gray-500 mt-1">
                    {registeredCount} / {event.capacity} Filled
                </div>
            </div>

            <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>

            <button
                onClick={handleRegisterClick}
                disabled={loading || cannotRegister}
                className={`w-full py-3 rounded-xl font-bold text-white transition-all transform active:scale-95 ${cannotRegister
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-black hover:bg-gray-800 shadow-lg hover:shadow-xl"
                    }`}
            >
                {loading ? "Processing..." : isClosed ? "Registrations Closed" : isFull ? "Event Full" : event.price > 0 ? `Pay ₹${event.price}` : "Register Now"}
            </button>
            {isClosed && (
                <p className="text-xs text-gray-500 text-center mt-2">Registration time is up for this event.</p>
            )}

            {showModal && user && (
                <RegistrationModal
                    fields={registrationFields}
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    onConfirm={processRegistration}
                    loading={loading}
                />
            )}
            {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
        </div>
    )
}
