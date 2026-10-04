/**
 * Ticket for a paid registration, issued once Razorpay confirms the payment.
 * Same as the free-event flow in registerForEvent: in-person events get a QR
 * ticket by email; online events need no ticket.
 *
 * Server-only module (not 'use server').
 */
import { render } from "@react-email/render"
import { Resend } from "resend"
import { createAdminClient } from "@/lib/supabase/server"
import { generateQRToken } from "@/lib/qr/generate"
import { TicketEmail } from "@/emails/ticket-email"
import { sendEmailOrThrow } from "@/lib/email/send"
import { googleCalendarUrl, toCalendarEntry } from "@/lib/calendar/event-calendar"
import { formatDateShort, formatTime } from "@/lib/utils"

export async function issueTicketAfterPayment(registrationId: string): Promise<void> {
    const sb = createAdminClient()
    const { data: reg } = await sb
        .from("registrations")
        .select("id, user_id, event_id, payment_status, events(*)")
        .eq("id", registrationId)
        .maybeSingle()
    if (!reg || reg.payment_status !== "paid") return
    const event: any = Array.isArray(reg.events) ? reg.events[0] : reg.events
    if (!event || event.is_virtual) return

    const { data: user } = await sb.schema("next_auth").from("users")
        .select("name, email, system_id, year, course, section")
        .eq("id", reg.user_id)
        .maybeSingle()
    if (!user?.email) return

    const userData = {
        name: user.name || "", system_id: user.system_id || "", year: user.year?.toString() || "",
        course: user.course || "", section: user.section || "", email: user.email,
    }
    const { token, qrDataUrl } = await generateQRToken(reg.user_id, reg.event_id, userData)

    // qr_token_id held the Razorpay order id until now; it becomes the entry ticket.
    await sb.from("registrations").update({ qr_token_id: token }).eq("id", reg.id).eq("payment_status", "paid")

    const html = await render(TicketEmail({
        eventName: event.title,
        userName: user.name || "Student",
        eventDate: `${formatDateShort(event.start_time)}, ${formatTime(event.start_time)} IST`,
        venue: event.venue,
        qrDataUrl: "cid:qrcode",
        ticketId: token,
        calendarUrl: googleCalendarUrl(toCalendarEntry(event)),
    }))
    if (!process.env.RESEND_API_KEY) return
    await sendEmailOrThrow(new Resend(process.env.RESEND_API_KEY), {
        from: "Technova <noreply@technovashardauniversity.in>",
        to: user.email,
        subject: `Your Ticket for ${event.title}`,
        html,
        attachments: [{ filename: "qr-code.png", content: Buffer.from(qrDataUrl.split(",")[1], "base64"), contentType: "image/png", contentId: "qrcode" }],
    })
}
