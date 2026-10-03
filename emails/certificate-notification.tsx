import {
    Body,
    Button,
    Container,
    Column,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Row,
    Section,
    Text,
} from "@react-email/components";
import * as React from "react";

interface CertificateNotificationEmailProps {
    userName: string;
    eventName: string;
    eventDate: string;          // already formatted, e.g. "19 – 20 Sep 2026"
    organizerName: string;
    certificateType: string;
    roleTitle?: string;         // position title, e.g. "Top 1"
    certificateId?: string;
    issuedAt?: string;          // ISO date, used for the LinkedIn "add to profile" link
    downloadUrl: string;
    verifyUrl: string;
}

// Square 500×500 logo; keep width and height equal or it gets distorted
const LOGO_URL = "https://www.technovashardauniversity.in/assets/logo/technova-new.png";

export const CertificateNotificationEmail = ({
    userName,
    eventName,
    eventDate,
    organizerName,
    certificateType,
    roleTitle,
    certificateId,
    issuedAt,
    downloadUrl,
    verifyUrl,
}: CertificateNotificationEmailProps) => {
    const firstName = userName.trim().split(/\s+/)[0] || "there";
    const isPosition = !!roleTitle && certificateType !== "participation";
    const certificateName = isPosition
        ? `${roleTitle} – ${eventName}`
        : `Certificate of Participation – ${eventName}`;

    return (
        <Html>
            <Head />
            <Preview>
                {isPosition
                    ? `Congratulations on securing ${roleTitle} at ${eventName}! Your certificate is ready.`
                    : `Thank you for participating in ${eventName}. Your certificate is ready.`}
            </Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={header}>
                        <Img src={LOGO_URL} width="84" height="84" alt="Technova" style={logo} />
                    </Section>

                    <Section style={accentBar(isPosition)} />

                    <Section style={content}>
                        <Text style={eyebrow(isPosition)}>
                            {isPosition ? `${roleTitle} · ${eventName}` : `Certificate of Participation`}
                        </Text>

                        <Heading style={h1}>
                            {isPosition ? `Congratulations, ${firstName}!` : `Thank you, ${firstName}!`}
                        </Heading>

                        <Text style={text}>
                            {isPosition ? (
                                <>
                                    You secured <strong>{roleTitle}</strong> at <strong>{eventName}</strong>, organised by{" "}
                                    {organizerName}. Outstanding work. Your certificate is ready to download.
                                </>
                            ) : (
                                <>
                                    Thank you for being part of <strong>{eventName}</strong>, organised by {organizerName}.
                                    Your participation certificate is ready to download.
                                </>
                            )}
                        </Text>

                        <Section style={buttonWrap}>
                            <Button style={primaryButton} href={downloadUrl}>
                                Download Certificate
                            </Button>
                        </Section>

                        <Section style={detailsCard}>
                            <Row>
                                <Column style={detailCell}>
                                    <Text style={detailLabel}>Event</Text>
                                    <Text style={detailValue}>{eventName}</Text>
                                </Column>
                                <Column style={detailCell}>
                                    <Text style={detailLabel}>Date</Text>
                                    <Text style={detailValue}>{eventDate}</Text>
                                </Column>
                            </Row>
                            <Row>
                                <Column style={detailCell}>
                                    <Text style={detailLabel}>{isPosition ? "Position" : "Awarded for"}</Text>
                                    <Text style={detailValue}>{isPosition ? roleTitle : "Participation"}</Text>
                                </Column>
                                {certificateId && (
                                    <Column style={detailCell}>
                                        <Text style={detailLabel}>Certificate ID</Text>
                                        <Text style={{ ...detailValue, fontFamily: "Menlo,Consolas,monospace" }}>{certificateId}</Text>
                                    </Column>
                                )}
                            </Row>
                        </Section>

                        <Text style={smallText}>
                            The QR code on your certificate links to its verification page, so anyone can confirm it&apos;s genuine.
                        </Text>

                        <Text style={linksRow}>
                            <Link href={verifyUrl} style={inlineLink}>Verify certificate</Link>
                            <span style={dot}>&nbsp;&nbsp;·&nbsp;&nbsp;</span>
                            <Link
                                href={getLinkedInAddUrl(certificateName, organizerName, verifyUrl, certificateId, issuedAt)}
                                style={inlineLink}
                            >
                                Add to LinkedIn
                            </Link>
                        </Text>
                    </Section>

                    <Hr style={hr} />

                    <Section style={footer}>
                        <Text style={footerText}>Technova Technical Society · Sharda University, Greater Noida</Text>
                        <Text style={footerText}>
                            You received this because you registered for {eventName}.
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

/** LinkedIn's "Add licence or certification" form, pre-filled. */
function getLinkedInAddUrl(name: string, organization: string, certUrl: string, certId?: string, issuedAt?: string): string {
    const date = issuedAt ? new Date(issuedAt) : new Date();
    const params = new URLSearchParams({
        startTask: "CERTIFICATION_NAME",
        name,
        organizationName: `${organization} – Technova, Sharda University`,
        issueYear: String(date.getFullYear()),
        issueMonth: String(date.getMonth() + 1),
        certUrl,
    });
    if (certId) params.set("certId", certId);
    return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export default CertificateNotificationEmail;

// Styles
const main = {
    backgroundColor: "#f4f4f5",
    margin: "0",
    padding: "32px 12px",
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
};

const container = {
    width: "100%",
    maxWidth: "560px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    overflow: "hidden" as const,
    border: "1px solid #e4e4e7",
};

const header = {
    backgroundColor: "#0a0a0a",
    padding: "12px 24px",
    textAlign: "center" as const,
};

const logo = { margin: "0 auto", display: "block" };

const accentBar = (isPosition: boolean) => ({
    height: "4px",
    backgroundColor: isPosition ? "#b8860b" : "#7c3aed",
});

const content = {
    padding: "36px 40px 8px",
};

const eyebrow = (isPosition: boolean) => ({
    color: isPosition ? "#a16207" : "#6d28d9",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "1.2px",
    textTransform: "uppercase" as const,
    margin: "0 0 8px",
});

const h1 = {
    color: "#18181b",
    fontSize: "26px",
    lineHeight: "32px",
    fontWeight: 700,
    margin: "0 0 16px",
};

const text = {
    color: "#3f3f46",
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 28px",
};

const buttonWrap = {
    margin: "0 0 28px",
};

const primaryButton = {
    backgroundColor: "#18181b",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
    display: "inline-block",
    padding: "14px 28px",
};

const detailsCard = {
    backgroundColor: "#fafafa",
    border: "1px solid #e4e4e7",
    borderRadius: "10px",
    padding: "16px 20px 4px",
    margin: "0 0 24px",
};

const detailCell = {
    verticalAlign: "top" as const,
    width: "50%",
    paddingBottom: "12px",
};

const detailLabel = {
    color: "#71717a",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.6px",
    textTransform: "uppercase" as const,
    margin: "0 0 2px",
};

const detailValue = {
    color: "#18181b",
    fontSize: "15px",
    fontWeight: 600,
    margin: "0",
};

const smallText = {
    color: "#71717a",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "0 0 10px",
};

const linksRow = {
    fontSize: "14px",
    margin: "0 0 28px",
};

const inlineLink = {
    color: "#6d28d9",
    fontWeight: 600,
    textDecoration: "none",
};

const dot = { color: "#a1a1aa" };

const hr = {
    borderColor: "#e4e4e7",
    margin: "0",
};

const footer = {
    padding: "18px 40px 22px",
};

const footerText = {
    color: "#a1a1aa",
    fontSize: "12px",
    lineHeight: "18px",
    margin: "0",
};
