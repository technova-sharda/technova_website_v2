import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Preview,
    Section,
    Text,
    Hr,
    Button,
} from "@react-email/components";
import * as React from "react";

interface BlastEmailProps {
    eventName: string;
    userName: string;
    subject: string;
    message: string;
    eventUrl: string;
}

export const BlastEmail = ({
    eventName,
    userName,
    subject,
    message,
    eventUrl,
}: BlastEmailProps) => {
    return (
        <Html>
            <Head />
            <Preview>{subject}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={headerSection}>
                        <Heading style={h1}>{eventName}</Heading>
                    </Section>

                    <Section style={contentSection}>
                        <Text style={greeting}>Hi {userName},</Text>

                        <Text style={text}>
                            You&apos;re receiving this message because you&apos;re registered for <strong>{eventName}</strong>.
                        </Text>

                        <Section style={messageCard}>
                            <Text style={messageTitle}>{subject}</Text>
                            <Hr style={divider} />
                            <Text style={messageContent}>{message}</Text>
                        </Section>

                        <Section style={buttonContainer}>
                            <Button style={button} href={eventUrl}>
                                View Event
                            </Button>
                        </Section>
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

export default BlastEmail;

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
    backgroundColor: "#7c3aed",
    borderRadius: "12px 12px 0 0",
    padding: "32px 24px",
    textAlign: "center" as const,
};

const h1 = {
    color: "#ffffff",
    fontSize: "24px",
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

const messageCard = {
    backgroundColor: "#faf5ff",
    borderRadius: "8px",
    border: "1px solid #e9d5ff",
    padding: "20px",
    marginTop: "24px",
    marginBottom: "24px",
};

const messageTitle = {
    color: "#7c3aed",
    fontSize: "18px",
    fontWeight: "bold",
    margin: "0 0 12px 0",
};

const divider = {
    borderColor: "#e9d5ff",
    margin: "12px 0",
};

const messageContent = {
    color: "#3f3f46",
    fontSize: "15px",
    lineHeight: "24px",
    whiteSpace: "pre-wrap" as const,
};

const buttonContainer = {
    textAlign: "center" as const,
    marginBottom: "24px",
};

const button = {
    backgroundColor: "#7c3aed",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "bold",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
    padding: "14px 32px",
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
