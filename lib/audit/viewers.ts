/**
 * Who can open /admin/logs. Only the Tech Lead (Dushyant) by default, decided
 * 5 Oct 2026. AUDIT_LOG_VIEWERS (comma-separated emails) replaces the list
 * without a code change.
 */
const DEFAULT_VIEWERS = ["2025273581.dushyant@ug.sharda.ac.in"]

export function canViewAuditLog(email: string | null | undefined) {
    if (!email) return false
    const fromEnv = (process.env.AUDIT_LOG_VIEWERS ?? "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
    return (fromEnv.length ? fromEnv : DEFAULT_VIEWERS).includes(email.trim().toLowerCase())
}
