import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { AdminShell } from "@/components/admin/admin-shell"
import { canViewAuditLog } from "@/lib/audit/viewers"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session) {
        redirect("/login")
    }

    // Only super_admin can access the admin dashboard
    // Admin role should use the scanner only
    if (session.user.role !== 'super_admin') {
        return (
            <div className="flex h-screen items-center justify-center bg-black">
                <div className="text-center p-8 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl max-w-md">
                    <h1 className="text-2xl font-bold text-red-400">Access Restricted</h1>
                    <p className="text-gray-400 mt-2">
                        {session.user.role === 'admin'
                            ? "As an admin, you have access to the event scanner only."
                            : "You do not have permission to access this area."}
                    </p>
                    <div className="flex gap-4 justify-center mt-6">
                        {session.user.role === 'admin' && (
                            <Link href="/scan" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                                Go to Scanner
                            </Link>
                        )}
                        <Link href="/" className="text-blue-400 hover:text-blue-300 underline">
                            Return Home
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <AdminShell
            userName={session.user.name}
            userRole={session.user.role}
            userImage={session.user.image}
            canViewLogs={canViewAuditLog(session.user.email)}
        >
            {children}
        </AdminShell>
    )
}
