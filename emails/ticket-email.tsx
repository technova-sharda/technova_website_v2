import {
    Body,
    Container,
    Column,
    Head,
    Heading,
    Html,
    Img,
    Link,
    Preview,
    Row,
    Section,
    Text,
} from "@react-email/components";
import * as React from "react";

interface TicketEmailProps {
    eventName: string;
    userName: string;
    eventDate: string;
    venue: string;
    qrDataUrl: string;
    ticketId: string;
    /** Google Calendar "add event" link. Optional, so older callers still work. */
    calendarUrl?: string;
}

export const TicketEmail = ({
    eventName,
    userName,
    eventDate,
    venue,
    qrDataUrl,
    ticketId,
    calendarUrl,
}: TicketEmailProps) => {
    return (
        <Html>
            <Head />
            <Preview>Your ticket for {eventName}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={{ paddingBottom: "20px" }}>
                        <Heading style={h1}>Technova Ticket</Heading>
                        <Text style={text}>Hi {userName},</Text>
                        <Text style={text}>
                            You are successfully registered for <strong>{eventName}</strong>.
                        </Text>
                        <Section style={ticketContainer}>
                            <Row>
                                <Column>
                                    <Text style={ticketLabel}>Event</Text>
                                    <Text style={ticketValue}>{eventName}</Text>
                                </Column>
                            </Row>
                            <Row>
                                <Column>
                                    <Text style={ticketLabel}>Date & Time</Text>
                                    <Text style={ticketValue}>{eventDate}</Text>
                                </Column>
                                <Column>
                                    <Text style={ticketLabel}>Venue</Text>
                                    <Text style={ticketValue}>{venue}</Text>
                                </Column>
                            </Row>
                            <Section style={{ textAlign: "center", marginTop: "20px" }}>
                                <Img
                                    src={qrDataUrl}
                                    width="200"
                                    height="200"
                                    alt="QR Code"
                                    style={{ margin: "0 auto" }}
                                />
                                <Text style={{ ...ticketLabel, marginTop: "10px" }}>
                                    Ticket ID: {ticketId}
                                </Text>
                            </Section>
                        </Section>
                        <Text style={text}>
                            Please show this QR code at the entrance for scanning.
                        </Text>
                        {calendarUrl && (
                            <Text style={text}>
                                <Link href={calendarUrl} style={{ color: "#2563eb", fontWeight: 600 }}>
                                    📅 Add to Google Calendar
                                </Link>
                            </Text>
                        )}
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

export default TicketEmail;

const main = {
    backgroundColor: "#ffffff",
    fontFamily:
        '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
    margin: "0 auto",
    padding: "20px 0 48px",
    width: "580px",
    maxWidth: "100%",
};

const h1 = {
    color: "#333",
    fontSize: "24px",
    fontWeight: "bold",
    paddingBottom: "10px",
    borderBottom: "1px solid #e0e0e0",
    marginBottom: "20px",
};

const text = {
    color: "#333",
    fontSize: "16px",
    lineHeight: "26px",
};

const ticketContainer = {
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
    border: "1px solid #e0e0e0",
    padding: "20px",
    marginTop: "20px",
    marginBottom: "20px",
};

const ticketLabel = {
    color: "#666",
    fontSize: "12px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    marginBottom: "4px",
};

const ticketValue = {
    color: "#000",
    fontSize: "16px",
    fontWeight: "bold",
    marginBottom: "16px",
};
