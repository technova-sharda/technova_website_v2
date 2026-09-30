import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

import { getRoleFromEmail, isEmailAllowed } from "@/lib/auth/role-utils"

export const config = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          // Remove hd restriction to allow gmail.com for clubs
        },
      },
      profile(profile) {
        const email = profile.email || ''
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          // Assign role based on email pattern
          role: getRoleFromEmail(email),
          xp_points: 0,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email?.trim().toLowerCase()
        if (!email) {
          return false
        }

        // First check standard allowed emails
        if (isEmailAllowed(email)) return true

        // Then check if they're a hackathon evaluator or volunteer
        try {
          const { isHackathonEmail } = await import("@/lib/actions/hackathon")
          const isHackathon = await isHackathonEmail(email)
          if (isHackathon) return true
        } catch {
          // If table doesn't exist yet, gracefully fall through
        }

        return false
      }
      return true
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        let role = getRoleFromEmail(user.email || "")

        if (user.email) {
          try {
            const { getSupabase } = await import("@/lib/actions/hackathon")
            const supabase = await getSupabase()

            // 1. Check custom hackathon_roles first
            const { data: customRole } = await supabase
              .from('hackathon_roles')
              .select('role')
              .eq('email', user.email.toLowerCase())
              .maybeSingle()
            
            if (customRole) {
              role = customRole.role as any
            } else if (role === 'student') {
              // 2. Fall back to evaluator check if they are otherwise a student
              const { data: evaluator } = await supabase
                .from('hackathon_evaluators')
                .select('id')
                .eq('email', user.email.toLowerCase())
                .maybeSingle()
              
              if (evaluator) {
                role = 'evaluator' as any
              }
            }
          } catch {
            // Table may not exist yet or DB error
          }
        }

        token.role = role
        // @ts-ignore
        token.system_id = user.system_id
      }

      // If updating the session (e.g. after onboarding)
      if (trigger === "update" && session) {
        token = { ...token, ...session }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id ?? token.sub) as string
        session.user.role = (token.role ?? 'student') as 'student' | 'admin' | 'super_admin' | 'evaluator'
        session.user.system_id = token.system_id as string | undefined
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/auth/error', // Error code passed in query string as ?error=
  }
} satisfies NextAuthConfig
