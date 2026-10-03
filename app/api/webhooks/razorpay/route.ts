import { headers } from "next/headers"
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Constant-time comparison, so the signature can't be guessed byte by byte from response timing. */
function signaturesMatch(expected: string, received: string): boolean {
    const a = Buffer.from(expected, "utf8")
    const b = Buffer.from(received, "utf8")
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function POST(req: Request) {
    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get("x-razorpay-signature") || ""
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET

    if (!secret) {
        console.error("RAZORPAY_WEBHOOK_SECRET is not configured")
        return new Response("Invalid signature", { status: 400 })
    }

    const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex")

    if (!signaturesMatch(expectedSignature, signature)) {
        console.error("Invalid Razorpay Signature")
        return new Response("Invalid signature", { status: 400 })
    }

    let event: any
    try {
        event = JSON.parse(body)
    } catch {
        return new Response("Invalid payload", { status: 400 })
    }

    if (event.event === "payment.captured") {
        const payment = event.payload?.payment?.entity
        const orderId = payment?.order_id
        if (!orderId) return new Response("OK", { status: 200 })

        // Find registration by order_id (stored in qr_token_id when the order was created)
        const { data: reg } = await supabase
            .from("registrations")
            .select("id, payment_status, events(price)")
            .eq("qr_token_id", orderId)
            .maybeSingle()

        if (!reg) {
            console.error("Payment captured for an order with no registration:", orderId)
            return new Response("OK", { status: 200 })
        }

        // Razorpay retries webhooks; a second delivery must not do anything
        if (reg.payment_status === "paid") return new Response("OK", { status: 200 })

        // The amount actually paid must match the event price
        const eventRow = Array.isArray(reg.events) ? reg.events[0] : reg.events
        const expectedPaise = Math.round(Number(eventRow?.price) * 100)
        if (payment.currency !== "INR" || payment.amount !== expectedPaise) {
            console.error("Payment amount mismatch", { orderId, paid: payment.amount, currency: payment.currency, expectedPaise })
            // 200 so Razorpay stops retrying; the registration stays 'pending' for an admin to review
            return new Response("Amount mismatch", { status: 200 })
        }

        await supabase
            .from("registrations")
            .update({ payment_status: "paid" })
            .eq("id", reg.id)
            .eq("payment_status", "pending")
    }

    return new Response("OK", { status: 200 })
}
