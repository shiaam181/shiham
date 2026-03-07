/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brandMark}>{siteName}</Text>
        </Section>
        <Heading style={h1}>Your login link</Heading>
        <Text style={text}>
          Click the button below to sign in to {siteName}. This link will expire shortly.
        </Text>
        <Section style={btnSection}>
          <Button style={button} href={confirmationUrl}>
            Sign In
          </Button>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          If you didn't request this link, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Outfit', 'Inter', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '520px', margin: '0 auto' }
const header = { marginBottom: '24px' }
const brandMark = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0B6CF4', margin: '0' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#0D1321', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#6B7080', lineHeight: '1.6', margin: '0 0 20px' }
const btnSection = { textAlign: 'center' as const, margin: '8px 0 32px' }
const button = {
  backgroundColor: '#0B6CF4',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '10px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const hr = { borderColor: '#E4E5E9', margin: '0 0 20px' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
