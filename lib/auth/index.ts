import { cache } from "react"
import NextAuth from "next-auth"
import { SupabaseAdapter } from "@auth/supabase-adapter"
import { config } from "./config"

const nextAuth = NextAuth({
    ...config,
    adapter: SupabaseAdapter({
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        secret: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    }),
})

export const { handlers, signIn, signOut } = nextAuth

/**
 * Sessions live in the database, so every auth() is a round trip to Supabase.
 * A page render used to call it several times (layout, page, components, actions);
 * within one request the session is now read once and reused.
 * auth(handler) / auth(req, res) forms (the proxy) pass straight through.
 */
const sessionForThisRequest = cache(() => nextAuth.auth())

export const auth = ((...args: unknown[]) =>
    args.length === 0 ? sessionForThisRequest() : (nextAuth.auth as (...a: unknown[]) => unknown)(...args)
) as typeof nextAuth.auth
