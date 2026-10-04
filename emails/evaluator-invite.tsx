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

interface EvaluatorInviteEmailProps {
    evaluatorName: string;
    formTitle: string;
    evaluateUrl: string;
}

export const EvaluatorInviteEmail = ({
    evaluatorName = 'Evaluator',
    formTitle = 'Form',
    evaluateUrl = 'https://technovashardauniversity.in',
}: EvaluatorInviteEmailProps) => {
    return (
        <Html>
            <Head />
            <Preview>You have been invited to evaluate candidates for {formTitle}</Preview>
            <Body style={{ backgroundColor: '#09090b', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: '16px', margin: '40px 0' }}>
                <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#18181b', borderRadius: '24px', border: '1px solid #27272a', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                    
                    {/* Hero Section */}
                    <Section style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)', padding: '48px 32px', textAlign: 'center' as const }}>
                        <Heading style={{ color: '#ffffff', fontSize: '28px', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
                            We need your expertise
                        </Heading>
                        <Text style={{ color: 'rgba(255,255,255,0.85)', marginTop: '12px', fontSize: '15px', fontWeight: 500 }}>
                            You&apos;ve been selected as an evaluator.
                        </Text>
                    </Section>

                    {/* Content Section */}
                    <Section style={{ padding: '40px 32px' }}>
                        <Text style={{ color: '#d4d4d8', fontSize: '17px', lineHeight: '1.6', marginTop: 0 }}>
                            Hey <strong style={{ color: '#ffffff' }}>{evaluatorName}</strong>,
                        </Text>
                        <Text style={{ color: '#a1a1aa', fontSize: '16px', lineHeight: '1.7', marginTop: '16px' }}>
                            As someone who is a deep part of Technova, we highly value your insight and judgment. We would be humbled if you could help us evaluate the submissions for the <strong style={{ color: '#ffffff' }}>{formTitle}</strong>.
                        </Text>
                        <Text style={{ color: '#a1a1aa', fontSize: '16px', lineHeight: '1.7', marginTop: '16px' }}>
                            You have been granted exclusive access to our evaluation portal where you can review candidate responses and provide your scores securely.
                        </Text>
                        <Text style={{ color: '#a1a1aa', fontSize: '16px', lineHeight: '1.7', marginTop: '16px' }}>
                            The evaluation will be start from <strong>9:30 PM to 11:30 PM</strong> for day <strong>Saturday 11 July 2026 to Sunday 12 July 2026</strong>. <br/><span style={{ fontSize: '14px', color: '#71717a' }}>(based on the nominations and also a complete schedule will be shared too)</span>
                        </Text>
                        
                        {/* CTA Box */}
                        <Section style={{ backgroundColor: '#27272a', borderRadius: '16px', padding: '32px', marginTop: '32px', border: '1px solid #3f3f46', textAlign: 'center' as const }}>
                            <Text style={{ color: '#d4d4d8', fontSize: '15px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                                Click below to access your unique evaluation portal:
                            </Text>
                            <Link
                                href={evaluateUrl}
                                style={{
                                    backgroundColor: '#ffffff',
                                    color: '#000000',
                                    padding: '16px 36px',
                                    borderRadius: '12px',
                                    fontWeight: 700,
                                    display: 'inline-block',
                                    textDecoration: 'none',
                                    fontSize: '14px',
                                    textTransform: 'uppercase' as const,
                                    letterSpacing: '2px',
                                }}
                            >
                                Open Evaluation Portal
                            </Link>
                            <Text style={{ color: '#71717a', fontSize: '12px', marginTop: '20px', marginBottom: 0 }}>
                                Note: Please do not share this link with anyone, as it grants direct access to your evaluator account.
                            </Text>
                        </Section>
                    </Section>

                    {/* Footer */}
                    <Hr style={{ borderColor: '#27272a', margin: 0 }} />
                    <Section style={{ padding: '32px', textAlign: 'center' as const, backgroundColor: '#09090b' }}>
                        <Text style={{ color: '#52525b', fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '2px', fontWeight: 600, margin: 0 }}>
                            Technova • Sharda University
                        </Text>
                        <Text style={{ color: '#3f3f46', fontSize: '11px', marginTop: '8px' }}>
                            For any questions, please reply to this email or contact the admin team.
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

export default EvaluatorInviteEmail;
