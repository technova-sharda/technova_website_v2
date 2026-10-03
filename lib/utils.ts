import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Date/Time formatting utilities - India timezone (Asia/Kolkata)
const TIMEZONE = 'Asia/Kolkata'
const LOCALE = 'en-IN'

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Get date parts in IST
 */
function getISTParts(date: Date | string) {
    const d = typeof date === 'string' ? new Date(date) : date
    // This is the most reliable way to get IST parts without environmental variation in toLocaleString
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        // 'h23' (0-23). `hour12: false` makes some engines (older Chrome/Safari)
        // report midnight as "24", which turned 00:30 into "12:30 PM".
        hourCycle: 'h23'
    })

    const parts = formatter.formatToParts(d)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || ''

    return {
        year: getPart('year'),
        month: getPart('month'), // 1-12
        day: getPart('day'),
        hour: parseInt(getPart('hour')) % 24,
        minute: getPart('minute').padStart(2, '0')
    }
}

/**
 * Format date as DD/MM/YYYY
 */
export function formatDate(date: Date | string): string {
    const { day, month, year } = getISTParts(date)
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
}

/**
 * Format date as "28 Dec 2025" (short format for display)
 */
export function formatDateShort(date: Date | string): string {
    const { day, month, year } = getISTParts(date)
    const monthName = MONTHS_SHORT[parseInt(month) - 1]
    return `${day} ${monthName} ${year}`
}

/**
 * Format date as "28 Dec" (without year)
 */
export function formatDateCompact(date: Date | string): string {
    const { day, month } = getISTParts(date)
    const monthName = MONTHS_SHORT[parseInt(month) - 1]
    return `${day} ${monthName}`
}

/**
 * Format time as 12-hour format (e.g., "10:30 AM")
 */
export function formatTime(date: Date | string): string {
    const { hour, minute } = getISTParts(date)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const h12 = hour % 12 || 12
    return `${h12}:${minute} ${ampm}`
}

/**
 * Format date and time together
 */
export function formatDateTime(date: Date | string): string {
    return `${formatDate(date)} ${formatTime(date)}`
}

/**
 * Format date range (e.g., "28 Dec - 3 Jan 2025")
 */
export function formatDateRange(startDate: Date | string, endDate: Date | string): string {
    return `${formatDateCompact(startDate)} - ${formatDateShort(endDate)}`
}

/**
 * Convert a date to YYYY-MM-DDTHH:mm format adjusted for Asia/Kolkata
 * Useful for initializing datetime-local inputs
 */
export function toDateTimeLocalString(date: Date | string): string {
    const { year, month, day, hour, minute } = getISTParts(date)
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(hour).padStart(2, '0')}:${minute}`
}

/**
 * Parse a datetime-local string (YYYY-MM-DDTHH:mm) as Asia/Kolkata
 */
export function parseDateTimeLocal(value: string): string {
    if (!value) return ""
    // Append the IST offset if not already present
    return value.includes("+") || value.includes("Z") ? value : `${value}:00+05:30`
}
