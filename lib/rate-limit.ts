/**
 * Simple in-memory rate limiter for API routes
 * Note: For production at scale, use Redis-based rate limiting
 * (on serverless each instance has its own memory, so limits are per instance).
 */

interface RateLimitEntry {
    count: number
    resetTime: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up old entries periodically
setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
        if (now > entry.resetTime) {
            store.delete(key)
        }
    }
}, 60000) // Clean every minute

export interface RateLimitConfig {
    /** Maximum requests allowed in the window */
    limit: number
    /** Time window in seconds */
    windowSeconds: number
    /**
     * Separate counter per route. Without it, every route shared one counter per
     * IP/user, so e.g. polling the hackathon live page used up the allowance for
     * certificate downloads from the same network.
     */
    bucket?: string
}

export interface RateLimitResult {
    success: boolean
    remaining: number
    resetTime: number
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): RateLimitResult {
    const now = Date.now()
    const key = config.bucket ? `${config.bucket}:${identifier}` : identifier
    const entry = store.get(key)

    // If no entry or expired, create new one
    if (!entry || now > entry.resetTime) {
        store.set(key, {
            count: 1,
            resetTime: now + (config.windowSeconds * 1000)
        })
        return {
            success: true,
            remaining: config.limit - 1,
            resetTime: now + (config.windowSeconds * 1000)
        }
    }

    // Increment count
    entry.count++

    // Check if over limit
    if (entry.count > config.limit) {
        return {
            success: false,
            remaining: 0,
            resetTime: entry.resetTime
        }
    }

    return {
        success: true,
        remaining: config.limit - entry.count,
        resetTime: entry.resetTime
    }
}

/**
 * Get client identifier from request (IP or user ID)
 */
export function getClientIdentifier(req: Request, userId?: string): string {
    if (userId) {
        return `user:${userId}`
    }

    // Try to get IP from headers (works behind proxies)
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown'

    return `ip:${ip}`
}
