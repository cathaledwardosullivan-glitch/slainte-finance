import React, { useState, useEffect } from 'react';
import { Stethoscope, TrendingUp, AlertTriangle, Sparkles } from 'lucide-react';
import COLORS from '../../utils/colors';
import MiniDonut from './MiniDonut';

const ROTATION_INTERVAL = 8000; // 8 seconds between headline variants

/**
 * SummaryHeader - Top summary card showing total GMS opportunity, progress,
 * and AI-generated headline narrative with crossfade rotation.
 * Mini donut on the right shows data completeness across 6 areas.
 */
const SummaryHeader = ({ financialSummary, readiness, summary, narratives, narrativesLoading }) => {
  const { unclaimed = 0, growth = 0 } = financialSummary || {};
  const totalOpportunity = unclaimed + growth;
  const hasData = summary?.analyzableCount > 0;

  // Rotate through headline variants
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const headlines = narratives?.headline || [];

  useEffect(() => {
    if (headlines.length <= 1) return;
    const interval = setInterval(() => {
      setHeadlineIndex(i => (i + 1) % headlines.length);
    }, ROTATION_INTERVAL);
    return () => clearInterval(interval);
  }, [headlines.length]);

  return (
    <div style={{
      backgroundColor: COLORS.white,
      borderRadius: '0.75rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      borderTop: `3px solid ${COLORS.slainteBlue}`,
      padding: '1.5rem',
      marginBottom: '1.5rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {/* Main content */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Stethoscope size={20} style={{ color: COLORS.slainteBlue }} />
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: COLORS.textPrimary }}>
              GMS Health Check
            </h2>
          </div>

          {hasData ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 700, color: COLORS.slainteBlue }}>
                  €{Math.round(totalOpportunity).toLocaleString()}
                </span>
                <span style={{ fontSize: '0.9rem', color: COLORS.textSecondary }}>
                  estimated total opportunity
                </span>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                {unclaimed > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={14} style={{ color: COLORS.expenseColor }} />
                    <span style={{ color: COLORS.textPrimary }}>
                      Unclaimed: <strong>€{Math.round(unclaimed).toLocaleString()}</strong>
                    </span>
                  </div>
                )}
                {growth > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <TrendingUp size={14} style={{ color: COLORS.incomeColor }} />
                    <span style={{ color: COLORS.textPrimary }}>
                      Growth potential: <strong>€{Math.round(growth).toLocaleString()}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* AI narrative headline */}
              {narrativesLoading ? (
                <div style={{
                  height: '1.1rem',
                  width: '70%',
                  backgroundColor: COLORS.bgPage,
                  borderRadius: '0.25rem',
                  animation: 'shimmer 1.5s ease-in-out infinite'
                }} />
              ) : headlines.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.82rem',
                  color: COLORS.textSecondary,
                  fontStyle: 'italic',
                  transition: 'opacity 0.4s ease',
                  minHeight: '1.2rem'
                }}>
                  <Sparkles size={12} style={{ color: COLORS.slainteBlue, flexShrink: 0 }} />
                  <span key={headlineIndex} style={{ animation: 'fadeIn 0.4s ease' }}>
                    {headlines[headlineIndex]}
                  </span>
                </div>
              )}
            </>
          ) : (
            <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: '0.9rem' }}>
              Upload your PCRS monthly payment PDFs to see estimated opportunities across all 6 GMS areas.
            </p>
          )}
        </div>

        {/* Mini donut — right side, with label */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.35rem',
          flexShrink: 0
        }}>
          <MiniDonut readiness={readiness} size={72} />
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 500,
            color: COLORS.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.03em'
          }}>
            Data Completeness
          </span>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default SummaryHeader;
