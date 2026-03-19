import React from 'react';
import { Sparkles, MessageCircle, Library } from 'lucide-react';
import { useFinn } from '../../context/FinnContext';
import COLORS from '../../utils/colors';

/**
 * EmptyState - Shown in the left column when no AI reports have been generated yet.
 * Displays an inviting hero section encouraging the user to generate their first report.
 */
const EmptyState = ({ onPreviewAnalysis }) => {
  const { openWidget } = useFinn();

  const handleAskFinn = () => {
    openWidget();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header matching ReportGallery */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <Library style={{ height: '1.25rem', width: '1.25rem', color: COLORS.slainteBlue }} />
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: COLORS.textPrimary, margin: 0 }}>
          Your Reports
        </h3>
        <span style={{
          padding: '0.125rem 0.5rem',
          backgroundColor: `${COLORS.slainteBlue}15`,
          borderRadius: '0.75rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: COLORS.slainteBlue
        }}>
          0
        </span>
      </div>

      {/* Hero */}
      <div
        style={{
          background: `linear-gradient(135deg, ${COLORS.slainteBlue}08 0%, ${COLORS.slainteBlue}15 50%, ${COLORS.incomeColor}08 100%)`,
          borderRadius: '0.75rem',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          border: `1px solid ${COLORS.slainteBlue}15`,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            width: '3.5rem',
            height: '3.5rem',
            margin: '0 auto 1.25rem',
            backgroundColor: `${COLORS.slainteBlue}12`,
            borderRadius: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Sparkles style={{ height: '1.75rem', width: '1.75rem', color: COLORS.slainteBlue }} />
        </div>

        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: COLORS.textPrimary,
          margin: '0 0 0.75rem'
        }}>
          Your Reports Will Appear Here
        </h2>

        <p style={{
          fontSize: '0.875rem',
          color: COLORS.textSecondary,
          maxWidth: '380px',
          margin: '0 auto 1.25rem',
          lineHeight: 1.6
        }}>
          Ask Finn a question or choose a suggested analysis to generate your first report.
        </p>

        <button
          onClick={handleAskFinn}
          style={{
            padding: '0.625rem 1.25rem',
            backgroundColor: COLORS.slainteBlue,
            color: COLORS.white,
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark;
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = COLORS.slainteBlue;
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <MessageCircle style={{ height: '0.875rem', width: '0.875rem' }} />
          Ask Finn a Question
        </button>
      </div>
    </div>
  );
};

export default EmptyState;
