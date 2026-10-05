import { NextRequest } from "next/server"
import { deleteMobileSession } from "@/lib/mobile/session"
import { json } from "@/lib/mobile/api"

/** Signs the app out: deletes its session row. */
export async function POST(req: NextRequest) {
    const header = req.headers.get("authorization") ?? ""
    if (header.toLowerCase().startsWith("bearer ")) await deleteMobileSession(header.slice(7).trim())
    return json({ ok: true })
}
