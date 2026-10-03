/**
 * XP Calculator Module
 * 
 * Calculates XP rewards based on:
 * - Event type (base XP)
 * - Duration (multiplier)
 * - Difficulty level (multiplier)
 * 
 * Formula: Final XP = Base XP × Duration Multiplier × Difficulty Multiplier
 */

import { istDaySpan, spansMultipleIstDays } from '@/lib/dates/ist'

// ==========================================
// Types
// ==========================================

export type EventType = 'talk_seminar' | 'workshop' | 'hackathon' | 'competition'
export type DifficultyLevel = 'easy' | 'moderate' | 'hard' | 'elite'

export interface EventXPData {
    event_type?: EventType | null
    difficulty_level?: DifficultyLevel | null
    start_time: string
    end_time: string
    is_multi_day?: boolean
}

// ==========================================
// Base XP by Event Type
// ==========================================

const BASE_XP: Record<EventType, number> = {
    talk_seminar: 50,   // Pure learning
    workshop: 80,       // Hands-on learning
    hackathon: 150,     // Competitive, long effort (12-24hr)
    competition: 100    // Problem-solving challenge (<12hr)
}

/**
 * Get base XP for an event type
 * Defaults to 'workshop' if type is missing or invalid
 */
export function getBaseXP(eventType?: EventType | null): number {
    if (!eventType || !BASE_XP[eventType]) {
        return BASE_XP.workshop  // Default: 80 XP
    }
    return BASE_XP[eventType]
}

// ==========================================
// Duration Multiplier
// ==========================================

interface DurationTier {
    maxHours: number
    multiplier: number
    label: string
}

const DURATION_TIERS: DurationTier[] = [
    { maxHours: 1, multiplier: 1.0, label: '≤ 1 hour' },
    { maxHours: 2, multiplier: 1.2, label: '1-2 hours' },
    { maxHours: 4, multiplier: 1.5, label: '2-4 hours' },
    { maxHours: 24, multiplier: 2.0, label: 'Full day' },
    { maxHours: Infinity, multiplier: 3.0, label: 'Multi-day' }
]

/**
 * Calculate duration multiplier based on event start/end time
 * Multi-day events automatically get x3.0 multiplier
 */
export function getDurationMultiplier(
    startTime: string,
    endTime: string,
    isMultiDay?: boolean
): number {
    // Multi-day events get highest multiplier
    if (isMultiDay) {
        return 3.0
    }

    try {
        const start = new Date(startTime)
        const end = new Date(endTime)

        // Calculate hours difference
        const durationMs = end.getTime() - start.getTime()
        const durationHours = durationMs / (1000 * 60 * 60)

        // Check if spans multiple days (different IST calendar dates)
        if (spansMultipleIstDays(start, end)) {
            return 3.0  // Multi-day
        }

        // Find matching duration tier
        for (const tier of DURATION_TIERS) {
            if (durationHours <= tier.maxHours) {
                return tier.multiplier
            }
        }

        return 3.0  // Default to multi-day for very long events
    } catch {
        return 1.0  // Default on parse error
    }
}

/**
 * Get duration tier label for display purposes
 */
export function getDurationLabel(
    startTime: string,
    endTime: string,
    isMultiDay?: boolean
): string {
    if (isMultiDay) return 'Multi-day'

    try {
        const start = new Date(startTime)
        const end = new Date(endTime)
        const durationMs = end.getTime() - start.getTime()
        const durationHours = durationMs / (1000 * 60 * 60)

        if (spansMultipleIstDays(start, end)) return 'Multi-day'

        for (const tier of DURATION_TIERS) {
            if (durationHours <= tier.maxHours) {
                return tier.label
            }
        }
        return 'Multi-day'
    } catch {
        return 'Unknown'
    }
}

/**
 * Calculate the number of days for an event
 * Used for daily XP distribution
 */
export function getEventDayCount(
    startTime: string,
    endTime: string,
    isMultiDay?: boolean
): number {
    try {
        const start = new Date(startTime)
        const end = new Date(endTime)
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1

        // Count IST calendar days, both start and end day included (minimum 1)
        return istDaySpan(start, end)
    } catch {
        return 1  // Default to single day on parse error
    }
}

// ==========================================
// Difficulty Multiplier
// ==========================================

const DIFFICULTY_MULTIPLIERS: Record<DifficultyLevel, number> = {
    easy: 1.0,      // No prerequisite
    moderate: 1.3,  // Basic prerequisite
    hard: 1.6,      // Requires strong prerequisite
    elite: 2.0      // Primarily hackathons
}

/**
 * Get difficulty multiplier
 * Defaults to 'easy' (1.0) if level is missing or invalid
 */
export function getDifficultyMultiplier(level?: DifficultyLevel | null): number {
    if (!level || !DIFFICULTY_MULTIPLIERS[level]) {
        return DIFFICULTY_MULTIPLIERS.easy  // Default: 1.0
    }
    return DIFFICULTY_MULTIPLIERS[level]
}

// ==========================================
// Main XP Calculation
// ==========================================

export interface XPCalculationResult {
    baseXP: number
    durationMultiplier: number
    difficultyMultiplier: number
    finalXP: number
    breakdown: string
    // Daily XP distribution fields
    eventDays: number
    dailyXP: number
}

/**
 * Calculate final XP for an event
 * Formula: Final XP = Base XP × Duration Multiplier × Difficulty Multiplier
 */
export function calculateEventXP(event: EventXPData): XPCalculationResult {
    const baseXP = getBaseXP(event.event_type)
    const durationMultiplier = getDurationMultiplier(
        event.start_time,
        event.end_time,
        event.is_multi_day
    )
    const difficultyMultiplier = getDifficultyMultiplier(event.difficulty_level)

    // Calculate final XP (rounded to nearest integer)
    const finalXP = Math.round(baseXP * durationMultiplier * difficultyMultiplier)

    // Calculate event days and daily XP for distribution
    const eventDays = getEventDayCount(event.start_time, event.end_time, event.is_multi_day)
    const dailyXP = Math.floor(finalXP / eventDays)

    // Generate breakdown string for display/logging
    const breakdown = `${baseXP} × ${durationMultiplier} × ${difficultyMultiplier} = ${finalXP} XP (${dailyXP} XP/day × ${eventDays} days)`

    return {
        baseXP,
        durationMultiplier,
        difficultyMultiplier,
        finalXP,
        breakdown,
        eventDays,
        dailyXP
    }
}

/**
 * Validate event has required fields for XP calculation
 * Returns true if event can be used for XP calculation
 */
export function canCalculateXP(event: Partial<EventXPData>): boolean {
    return !!(event.start_time && event.end_time)
}
