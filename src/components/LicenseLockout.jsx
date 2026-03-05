import React, { useState } from 'react';
import COLORS from '../utils/colors';
import SlainteLogo from './SlainteLogo';
import { AlertTriangle, Mail, RefreshCw } from 'lucide-react';

/**
 * LicenseLockout Component
 * Full-screen lockout when license is invalid and grace period has expired.
 * Includes a Retry button to re-validate (handles transient network failures).
 */
export default function LicenseLockout({ onRetry }) {
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    setRetryFailed(false);
    try {
      await onRetry();
      // If onRetry doesn't unlock (i.e. we're still showing this screen), show failure message
      setRetryFailed(true);
    } catch {
      setRetryFailed(true);
    } finally {
      setRetrying(false);
    }
  };

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
          Your Sláinte Finance license could not be validated.
          This may be due to a temporary network issue.
        </p>

        {/* Retry button */}
        <button
          onClick={handleRetry}
          disabled={retrying}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            backgroundColor: retrying ? COLORS.mediumGray : COLORS.slainteBlue,
            color: COLORS.white,
            fontSize: '1rem',
            fontWeight: 600,
            cursor: retrying ? 'not-allowed' : 'pointer',
            marginBottom: '1.5rem',
            transition: 'background-color 0.2s'
          }}
        >
          <RefreshCw
            style={{
              width: '1.125rem',
              height: '1.125rem',
              animation: retrying ? 'spin 1s linear infinite' : 'none'
            }}
          />
          {retrying ? 'Checking...' : 'Retry'}
        </button>

        {retryFailed && (
          <p style={{ color: COLORS.expenseColor, fontSize: '0.875rem', marginBottom: '1rem' }}>
            Validation failed. Please check your internet connection and try again.
          </p>
        )}

        <div
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: `${COLORS.slainteBlue}10`
          }}
        >
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: COLORS.mediumGray }}>
            If this issue persists, please contact support:
          </p>
          <Mail
            style={{
              width: '1.5rem',
              height: '1.5rem',
              color: COLORS.slainteBlue,
              margin: '0 auto 0.5rem'
            }}
          />
          <a
            href="mailto:slainte.finance@gmail.com"
            style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: COLORS.slainteBlue,
              textDecoration: 'none'
            }}
          >
            slainte.finance@gmail.com
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

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
