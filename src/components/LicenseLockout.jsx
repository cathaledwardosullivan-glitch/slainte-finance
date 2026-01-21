import React from 'react';
import COLORS from '../utils/colors';
import SlainteLogo from './SlainteLogo';
import { AlertTriangle, Mail } from 'lucide-react';

/**
 * LicenseLockout Component
 * Full-screen lockout when license is invalid and grace period has expired
 */
export default function LicenseLockout() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        backgroundColor: COLORS.backgroundGray
      }}
    >
      <div
        style={{
          maxWidth: '28rem',
          width: '100%',
          textAlign: 'center',
          padding: '2rem',
          borderRadius: '1rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          backgroundColor: COLORS.white
        }}
      >
        <div style={{ marginBottom: '1.5rem' }}>
          <SlainteLogo size="large" showFinance={true} />
        </div>

        <div style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>
          <AlertTriangle
            style={{
              width: '4rem',
              height: '4rem',
              color: COLORS.expenseColor,
              margin: '0 auto'
            }}
          />
        </div>

        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: COLORS.darkGray,
            marginBottom: '1rem'
          }}
        >
          License Expired
        </h1>

        <p
          style={{
            color: COLORS.mediumGray,
            marginBottom: '1.5rem',
            lineHeight: 1.6
          }}
        >
          Your Sláinte Finance license is no longer valid.
          Please contact support to reactivate your account.
        </p>

        <div
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: `${COLORS.slainteBlue}10`
          }}
        >
          <Mail
            style={{
              width: '1.5rem',
              height: '1.5rem',
              color: COLORS.slainteBlue,
              margin: '0 auto 0.5rem'
            }}
          />
          <a
            href="mailto:support@slaintefinance.ie"
            style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: COLORS.slainteBlue,
              textDecoration: 'none'
            }}
          >
            support@slaintefinance.ie
          </a>
        </div>

        <p
          style={{
            marginTop: '1.5rem',
            fontSize: '0.875rem',
            color: COLORS.mediumGray
          }}
        >
          Please include your practice name when contacting support.
        </p>
      </div>
    </div>
  );
}
