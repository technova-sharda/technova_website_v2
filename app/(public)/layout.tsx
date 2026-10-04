import { Navbar } from "@/components/layout/navbar"
import { DevSpaceTabs } from "@/components/layout/devspace-tabs"

// No session read here: the navbar loads the signed-in user in the browser, so
// public pages can be pre-built and served from Vercel's CDN (instant navigation).
export default function PublicLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex flex-col min-h-screen bg-black text-white dark">
            <Navbar />
            <DevSpaceTabs />
            <main className="flex-1 pt-16">
                {children}
            </main>
        </div>
    )
}
