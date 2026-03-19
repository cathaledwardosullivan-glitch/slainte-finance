import React from 'react';
import { ChevronRight, CheckCircle, AlertTriangle, Circle, Sparkles } from 'lucide-react';
import COLORS from '../../utils/colors';

/**
 * Sector titles for each GMS area
 */
export const CARD_TITLES = {
  leave: 'Leave Payments',
  practiceSupport: 'Practice Support',
  capitation: 'Capitation',
  cervicalCheck: 'Cervical Screening',
  stc: 'Special Type Consultations',
  cdm: 'Chronic Disease Management'
};

/**
 * Color accent per area
 */
export const AREA_COLORS = {
  leave: '#4A90E2',
  practiceSupport: '#9B59B6',
  capitation: '#2ECC71',
  cervicalCheck: '#E67E22',
  stc: '#3498DB',
  cdm: '#E74C3C'
};

/**
 * Confidence badge styling
 */
const CONFIDENCE = {
  ready: { label: 'Actual data', color: COLORS.success, Icon: CheckCircle },
  partial: { label: 'Estimated', color: '#E6A817', Icon: AlertTriangle },
  'no-data': { label: 'No data', color: COLORS.textSecondary, Icon: Circle }
};

/**
 * AreaCard - Individual GMS area card.
 * Shows sector name, headline estimate, and confidence badge.
 * Clicking opens a modal (handled by parent via onClick).
 */
const AreaCard = ({ areaId, readiness, analysis, narrative, onClick }) => {
  const status = readiness?.[areaId]?.status || 'no-data';
  const conf = CONFIDENCE[status] || CONFIDENCE['no-data'];
  const accentColor = AREA_COLORS[areaId] || COLORS.slainteBlue;
  const title = CARD_TITLES[areaId] || areaId;

  // Headline figures
  const actual = analysis?.actual || 0;
  const potential = analysis?.potential || 0;
  const opportunity = Math.max(0, potential - actual);
  const hasAnalysis = analysis && readiness?.[areaId]?.canAnalyze;

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        backgroundColor: COLORS.white,
        borderRadius: '0.625rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        borderLeft: `4px solid ${accentColor}`,
        border: `1px solid ${COLORS.borderLight}`,
        borderLeftWidth: '4px',
        borderLeftColor: accentColor,
        padding: '1.1rem 1.25rem',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'box-shadow 0.2s ease, transform 0.15s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{
          margin: '0 0 0.25rem',
          fontSize: '0.95rem',
          fontWeight: 600,
          color: COLORS.textPrimary
        }}>
          {title}
        </h3>

        {hasAnalysis ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              {opportunity > 50 ? (
                <>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: accentColor }}>
                    €{Math.round(opportunity).toLocaleString()}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: COLORS.textSecondary }}>
                    potential opportunity
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '0.85rem', color: COLORS.success, fontWeight: 500 }}>
                  No significant issues found
                </span>
              )}
            </div>
            {narrative && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                marginTop: '0.3rem',
                fontSize: '0.75rem',
                color: COLORS.textSecondary,
                fontStyle: 'italic'
              }}>
                <Sparkles size={10} style={{ color: accentColor, flexShrink: 0 }} />
                {narrative}
              </div>
            )}
          </>
        ) : (
          <span style={{ fontSize: '0.8rem', color: COLORS.textSecondary }}>
            {status === 'no-data' ? 'Upload PCRS data to analyse' : 'More data needed for full analysis'}
          </span>
        )}
      </div>

      {/* Right side: confidence badge + chevron */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.2rem 0.5rem',
          borderRadius: '9999px',
          backgroundColor: `${conf.color}15`,
          fontSize: '0.72rem',
          fontWeight: 500,
          color: conf.color
        }}>
          <conf.Icon size={11} />
          {conf.label}
        </div>
        <ChevronRight size={18} style={{ color: COLORS.textSecondary }} />
      </div>
    </button>
  );
};

export default AreaCard;
