import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Html,
    Preview,
    Section,
    Text,
    Hr,
} from "@react-email/components";
import * as React from "react";

interface ReminderEmailProps {
    eventName: string;
    userName: string;
    eventDate: string;
    eventTime: string;
    venue: string;
    eventUrl: string;
    hoursUntilEvent: number;
}

export const ReminderEmail = ({
    eventName,
    userName,
    eventDate,
    eventTime,
    venue,
    eventUrl,
    hoursUntilEvent,
}: ReminderEmailProps) => {
    return (
        <Html>
            <Head />
            <Preview>{`${eventName} starts in ${hoursUntilEvent} hours!`}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={headerSection}>
                        <Heading style={h1}>Event Reminder</Heading>
                    </Section>

                    <Section style={contentSection}>
                        <Text style={greeting}>Hi {userName},</Text>
                        <Text style={text}>
                            This is a friendly reminder that <strong>{eventName}</strong> is starting soon!
                        </Text>

                        <Section style={eventCard}>
                            <Text style={eventTitle}>{eventName}</Text>
                            <Hr style={divider} />
                            <Text style={eventDetail}>
                                <strong>Date:</strong> {eventDate}
                            </Text>
                            <Text style={eventDetail}>
                                <strong>Time:</strong> {eventTime}
                            </Text>
                            <Text style={eventDetail}>
                                <strong>Venue:</strong> {venue}
                            </Text>
                        </Section>

                        <Text style={countdown}>
                            Starting in approximately <strong>{hoursUntilEvent} hours</strong>
                        </Text>

                        <Section style={buttonContainer}>
                            <Button style={button} href={eventUrl}>
                                View Event Details
                            </Button>
                        </Section>

                        <Text style={footer}>
                            Make sure you have everything ready. We&apos;re excited to see you there!
                        </Text>
                    </Section>

                    <Section style={footerSection}>
                        <Text style={footerText}>
                            Technova - Sharda University&apos;s Official Tech Community
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

export default ReminderEmail;

// Styles
const main = {
    backgroundColor: "#f4f4f5",
    fontFamily:
        '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
    margin: "0 auto",
    padding: "20px 0 48px",
    width: "580px",
    maxWidth: "100%",
};

const headerSection = {
    backgroundColor: "#18181b",
    borderRadius: "12px 12px 0 0",
    padding: "32px 24px",
    textAlign: "center" as const,
};

const h1 = {
    color: "#ffffff",
    fontSize: "28px",
    fontWeight: "bold",
    margin: "0",
};

const contentSection = {
    backgroundColor: "#ffffff",
    padding: "32px 24px",
};

const greeting = {
    color: "#18181b",
    fontSize: "18px",
    marginBottom: "16px",
};

const text = {
    color: "#3f3f46",
    fontSize: "16px",
    lineHeight: "26px",
};

const eventCard = {
    backgroundColor: "#fafafa",
    borderRadius: "8px",
    border: "1px solid #e4e4e7",
    padding: "20px",
    marginTop: "24px",
    marginBottom: "24px",
};

const eventTitle = {
    color: "#18181b",
    fontSize: "20px",
    fontWeight: "bold",
    margin: "0 0 12px 0",
};

const divider = {
    borderColor: "#e4e4e7",
    margin: "12px 0",
};

const eventDetail = {
    color: "#3f3f46",
    fontSize: "14px",
    margin: "8px 0",
};

const countdown = {
    color: "#2563eb",
    fontSize: "16px",
    fontWeight: "500",
    textAlign: "center" as const,
    padding: "16px",
    backgroundColor: "#eff6ff",
    borderRadius: "8px",
    marginBottom: "24px",
};

const buttonContainer = {
    textAlign: "center" as const,
    marginBottom: "24px",
};

const button = {
    backgroundColor: "#2563eb",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "bold",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
    padding: "14px 32px",
};

const footer = {
    color: "#71717a",
    fontSize: "14px",
    textAlign: "center" as const,
};

const footerSection = {
    backgroundColor: "#18181b",
    borderRadius: "0 0 12px 12px",
    padding: "20px",
    textAlign: "center" as const,
};

const footerText = {
    color: "#a1a1aa",
    fontSize: "12px",
    margin: "0",
};
