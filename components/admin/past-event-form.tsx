"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, History, Upload, X } from "lucide-react"
import { Toast, useToast } from "@/components/ui/toast"
import { motion } from "framer-motion"
import Image from "next/image"

interface PastEventFormProps {
    clubs: { id: string; name: string }[]
    event?: any // Optional event for editing
}

export function PastEventForm({ clubs, event }: PastEventFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isPaid, setIsPaid] = useState(event?.is_paid ?? false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(event?.banner || null)
    const { toast, showToast, hideToast } = useToast()

    const isEditing = !!event

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setSelectedFile(file)
            setPreviewUrl(URL.createObjectURL(file))
        }
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)

        try {
            const formData = new FormData(e.currentTarget)

            // Manually append the file if selected because the input might be removed from DOM
            if (selectedFile) {
                formData.set('banner', selectedFile) // Use set to overwrite if exists or add
            }

            // Determine endpoint and method based on editing mode
            const url = isEditing ? `/api/events/past/${event.id}` : '/api/events/past'
            const method = isEditing ? 'PUT' : 'POST'

            const response = await fetch(url, {
                method,
                body: formData
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || `Failed to ${isEditing ? 'update' : 'create'} past event`)
            }

            showToast(`Past event ${isEditing ? 'updated' : 'created'} successfully!`, "success")
            setTimeout(() => {
                router.push('/admin/events')
                router.refresh()
            }, 1500)
        } catch (error: any) {
            console.error("Error:", error)
            showToast(error.message || "Something went wrong", "error")
            setLoading(false)
        }
    }

    // Format date for input (YYYY-MM-DDTHH:mm)
    const formatDateForInput = (dateString: string) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        // Convert to local ISO string for datetime-local input
        const offset = date.getTimezoneOffset()
        const localDate = new Date(date.getTime() - (offset * 60 * 1000))
        return localDate.toISOString().slice(0, 16)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Event Title */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Event Title *
                </label>
                <input
                    type="text"
                    name="title"
                    required
                    defaultValue={event?.title || ''}
                    placeholder="e.g., Hackathon 2024"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
            </div>

            {/* Club Selection */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Organizing Club *
                </label>
                <select
                    name="club_id"
                    required
                    defaultValue={event?.club_id || ''}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                    <option value="" className="bg-neutral-900 text-white">Select a club</option>
                    {clubs.map(club => (
                        <option key={club.id} value={club.id} className="bg-neutral-900 text-white">{club.name}</option>
                    ))}
                </select>
            </div>

            {/* Event Date & Time */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Event Date & Time *
                </label>
                <input
                    type="datetime-local"
                    name="event_date"
                    required
                    defaultValue={event?.start_time ? formatDateForInput(event.start_time) : ''}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
            </div>

            {/* Attendance Count */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Attendance Count *
                </label>
                <input
                    type="number"
                    name="attendance_count"
                    min="1"
                    required
                    defaultValue={event?.capacity || ''}
                    placeholder="Number of attendees"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <p className="text-sm text-gray-500 mt-1">Used for statistics and capacity tracking</p>
            </div>

            {/* Pricing Type */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Event Type *
                    </label>
                    <select
                        name="is_paid"
                        value={isPaid ? "true" : "false"}
                        onChange={(e) => setIsPaid(e.target.value === "true")}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                        <option value="false" className="bg-neutral-900 text-white">Free</option>
                        <option value="true" className="bg-neutral-900 text-white">Paid</option>
                    </select>
                </div>

                {isPaid && (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Ticket Price (₹) *
                        </label>
                        <input
                            type="number"
                            name="ticket_price"
                            min="0"
                            step="0.01"
                            required={isPaid}
                            defaultValue={event?.ticket_price || ''}
                            placeholder="e.g. 499"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </motion.div>
                )}
            </div>

            {/* Banner Upload */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Event Banner
                </label>
                <div className="relative">
                    {previewUrl ? (
                        <div className="relative rounded-xl overflow-hidden">
                            <Image
                                src={previewUrl}
                                alt="Banner preview"
                                width={600}
                                height={300}
                                className="w-full h-48 object-cover"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    setPreviewUrl(null)
                                    setSelectedFile(null)
                                }}
                                className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-blue-500/50 transition-colors">
                            <Upload className="w-8 h-8 text-gray-500 mb-2" />
                            <span className="text-gray-400">Click to upload banner</span>
                            <span className="text-gray-500 text-sm mt-1">PNG, JPG up to 5MB</span>
                            <input
                                type="file"
                                name="banner"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </label>
                    )}
                </div>
                {/* Hidden field to preserve existing banner URL if not uploading new */}
                {event?.banner && <input type="hidden" name="existing_banner" value={event.banner} />}
            </div>

            {/* Description (Optional) */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Short Description (Optional)
                </label>
                <textarea
                    name="description"
                    rows={3}
                    defaultValue={event?.description || ''}
                    placeholder="Brief description of the event..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                />
            </div>

            {/* Show on Club Page Toggle */}
            <div className="flex items-start gap-3 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                <input
                    type="checkbox"
                    name="show_on_club_page"
                    id="show_on_club_page"
                    defaultChecked={event?.show_on_club_page ?? true}
                    className="mt-1 w-5 h-5 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-purple-500/50 cursor-pointer"
                />
                <div>
                    <label htmlFor="show_on_club_page" className="block text-sm font-medium text-white cursor-pointer">
                        Show on Club Page
                    </label>
                    <p className="text-xs text-gray-400 mt-1">
                        When enabled, this event will appear in the &quot;Past Events&quot; section on the club&apos;s public page.
                    </p>
                </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-xl font-medium disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)]"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {isEditing ? 'Updating...' : 'Creating...'}
                        </>
                    ) : (
                        <>
                            <History className="w-4 h-4" />
                            {isEditing ? 'Update Past Event' : 'Add Past Event'}
                        </>
                    )}
                </button>
            </div>

            {/* Toast */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={hideToast}
                />
            )}
        </form>
    )
}

