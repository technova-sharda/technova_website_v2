import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

// Routes that evaluators/hackathon users should be allowed to access
// even without completing onboarding (system_id)
function isEvaluatorRoute(pathname: string): boolean {
    return pathname.startsWith('/evaluate') ||
        pathname.startsWith('/admin/hackathon/evaluate') ||
        pathname.startsWith('/hackathon-portal')
}

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const { pathname } = req.nextUrl

    // Public routes that don't need auth checks
    const isAuthRoute = pathname.startsWith('/api/auth') || pathname.startsWith('/login')
    const isPublicRoute = pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname.startsWith('/assets') ||
        pathname === '/' ||
        pathname.startsWith('/about') ||
        pathname.startsWith('/events') ||
        pathname.startsWith('/clubs') ||
        pathname.startsWith('/leadership')

    // If logged in and on login page, redirect appropriately
    if (isLoggedIn && pathname === '/login') {
        // Check if there's a callbackUrl (e.g. evaluator returning from Google OAuth)
        const callbackUrl = req.nextUrl.searchParams.get('callbackUrl')
        if (callbackUrl) {
            // Only allow internal redirects (prevent open redirect)
            try {
                const target = new URL(callbackUrl, req.nextUrl.origin)
                if (target.origin === req.nextUrl.origin) {
                    return NextResponse.redirect(target)
                }
            } catch {
                // Invalid URL, fall through to default behavior
            }
        }

        // New users (students without system_id) should go to onboarding
        const user = req.auth?.user
        if (user?.role === 'student' && !user?.system_id) {
            return NextResponse.redirect(new URL('/onboarding', req.nextUrl))
        }
        return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
    }

    // If logged in as student without system_id and NOT on onboarding page
    if (isLoggedIn && req.auth?.user?.role === 'student' && !req.auth?.user?.system_id) {
        // Allow onboarding, api routes, and evaluator routes
        if (!pathname.startsWith('/onboarding') && !pathname.startsWith('/api') && !isEvaluatorRoute(pathname)) {
            return NextResponse.redirect(new URL('/onboarding', req.nextUrl))
        }
    }

    // If on onboarding page but already completed, redirect to dashboard
    if (isLoggedIn && pathname === '/onboarding' && req.auth?.user?.system_id) {
        return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
    }

    // If trying to access onboarding without being logged in
    if (!isLoggedIn && pathname === '/onboarding') {
        return NextResponse.redirect(new URL('/login', req.nextUrl))
    }

    // Signed-out visitors to signed-in areas go straight to login. Without this the
    // page renders alongside its layout and runs its queries before the layout redirects.
    const signedInArea = ['/admin', '/dashboard', '/profile', '/leaderboard'].some(p => pathname === p || pathname.startsWith(`${p}/`))
    if (!isLoggedIn && signedInArea) {
        const login = new URL('/login', req.nextUrl)
        login.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(login)
    }
})

// Sessions are stored in the database, so this proxy costs a Supabase round trip on
// every request it runs for. It only runs where its redirects matter (login,
// onboarding, signed-in areas, event registration pages); the public marketing
// pages (/, /events list, /clubs, /leadership, /partners, /hackathon, /verify) skip it
// so they can be served straight from the CDN.
export const config = {
    matcher: [
        "/login",
        "/onboarding",
        "/dashboard/:path*",
        "/profile/:path*",
        "/leaderboard",
        "/user/:path*",
        "/events/:id",
        "/community/:path*",
        "/showcase/:path*",
        "/buddy-finder",
        "/resources",
        "/forms/:path*",
        "/admin/:path*",
        "/scan",
        "/api/user/:path*",
    ],
}
