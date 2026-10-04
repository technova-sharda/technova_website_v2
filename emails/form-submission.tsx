import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Preview,
    Section,
    Text,
    Link,
    Hr,
} from '@react-email/components';
import * as React from 'react';

interface ResponseItem {
    question: string;
    answer: string;
}

interface FormSubmissionEmailProps {
    userName: string;
    formTitle: string;
    formUrl: string;
    responses?: ResponseItem[];
}

export const FormSubmissionEmail = ({
    userName = 'Student',
    formTitle = 'Form',
    formUrl = 'https://technovashardauniversity.in',
    responses = []
}: FormSubmissionEmailProps) => {
    return (
        <Html>
            <Head />
            <Preview>Your submission for {formTitle} was received!</Preview>
            <Body style={{ backgroundColor: '#09090b', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: '16px', margin: '40px 0' }}>
                <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#18181b', borderRadius: '24px', border: '1px solid #27272a', overflow: 'hidden' }}>
                    
                    {/* Hero Section */}
                    <Section style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed, #10b981)', padding: '40px', textAlign: 'center' as const }}>
                        <Heading style={{ color: '#ffffff', fontSize: '28px', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
                            Success!
                        </Heading>
                        <Text style={{ color: 'rgba(255,255,255,0.85)', marginTop: '8px', fontSize: '16px', fontWeight: 500 }}>
                            We&apos;ve safely received your entry.
                        </Text>
                    </Section>

                    {/* Content Section */}
                    <Section style={{ padding: '40px' }}>
                        <Text style={{ color: '#d4d4d8', fontSize: '17px', lineHeight: '1.6', marginTop: 0 }}>
                            Hey <strong style={{ color: '#ffffff' }}>{userName}</strong>,
                        </Text>
                        <Text style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: '1.7', marginTop: '16px' }}>
                            You just completed the <strong style={{ color: '#ffffff' }}>{formTitle}</strong> form. Thank you for taking the time to share your details!
                        </Text>

                        {/* Response Summary */}
                        {responses.length > 0 && (
                            <Section style={{ marginTop: '32px' }}>
                                <Text style={{ fontSize: '12px', fontWeight: 700, color: '#d4d4d8', textTransform: 'uppercase' as const, letterSpacing: '2px', marginBottom: '16px' }}>
                                    Your Responses
                                </Text>
                                {responses.map((item, index) => (
                                    <Section key={index} style={{
                                        marginBottom: '12px',
                                        backgroundColor: 'rgba(39,39,42,0.5)',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        border: '1px solid rgba(63,63,70,0.5)'
                                    }}>
                                        <Text style={{ fontSize: '11px', color: '#71717a', textTransform: 'uppercase' as const, letterSpacing: '1.5px', margin: '0 0 4px 0' }}>
                                            {item.question}
                                        </Text>
                                        <Text style={{ fontSize: '15px', color: '#ffffff', margin: 0, fontWeight: 500 }}>
                                            {item.answer || '—'}
                                        </Text>
                                    </Section>
                                ))}
                            </Section>
                        )}
                        
                        {/* CTA Box */}
                        <Section style={{ backgroundColor: '#27272a', borderRadius: '16px', padding: '24px', marginTop: '32px', border: '1px solid #3f3f46', textAlign: 'center' as const }}>
                            <Text style={{ color: '#d4d4d8', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                                Need to review or change your answers?
                            </Text>
                            <Link
                                href={formUrl}
                                style={{
                                    backgroundColor: '#ffffff',
                                    color: '#000000',
                                    padding: '14px 32px',
                                    borderRadius: '12px',
                                    fontWeight: 700,
                                    display: 'inline-block',
                                    textDecoration: 'none',
                                    fontSize: '13px',
                                    textTransform: 'uppercase' as const,
                                    letterSpacing: '2px',
                                }}
                            >
                                View Your Response
                            </Link>
                        </Section>
                    </Section>

                    {/* Footer */}
                    <Hr style={{ borderColor: '#27272a', margin: 0 }} />
                    <Section style={{ padding: '32px', textAlign: 'center' as const, backgroundColor: '#09090b' }}>
                        <Text style={{ color: '#52525b', fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '2px', fontWeight: 600, margin: 0 }}>
                            TechNova • Sharda University
                        </Text>
                        <Text style={{ color: '#3f3f46', fontSize: '11px', marginTop: '8px' }}>
                            For any questions, please reply to this email or contact support.
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

export default FormSubmissionEmail;
