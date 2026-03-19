import React, { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { UnifiedAnalysisCard, GeneratedReportCard } from './CategoryReportCard';
import COLORS from '../../utils/colors';

/**
 * CategoryModal — Unified list of analyses for a category.
 * Each suggested analysis appears once: with Read/Re-generate if generated,
 * or Generate if not yet run. Custom reports (no matching analysis) appear at the end.
 */
const CategoryModal = ({
  category,
  generatedReports,
  suggestedAnalyses,
  generatedAnalysisIds,
  onClose,
  onReadReport,
  onGenerateAnalysis,
  onDeleteReport
}) => {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const color = category.color;

  // Build a map from analysisId → most recent report
  const reportByAnalysisId = useMemo(() => {
    const map = new Map();
    for (const report of generatedReports) {
      if (report.suggestedAnalysisId) {
        const existing = map.get(report.suggestedAnalysisId);
        if (!existing || new Date(report.generatedDate) > new Date(existing.generatedDate)) {
          map.set(report.suggestedAnalysisId, report);
        }
      }
    }
    return map;
  }, [generatedReports]);

  // Custom reports: those without a matching suggestedAnalysisId
  const customReports = useMemo(() =>
    generatedReports.filter(r => !r.suggestedAnalysisId),
    [generatedReports]
  );

  const generatedCount = suggestedAnalyses.filter(a => generatedAnalysisIds.has(a.id)).length;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: COLORS.overlayMedium,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: COLORS.white,
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
        }}
      >
        {/* Header with category color bar */}
        <div style={{
          borderTop: `4px solid ${color}`,
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${COLORS.borderLight}`
        }}>
          <div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: COLORS.textPrimary }}>
              {category.label}
            </div>
            <div style={{ fontSize: '0.8125rem', color: COLORS.textSecondary, marginTop: '0.125rem' }}>
              {suggestedAnalyses.length} available analyses · {generatedCount} generated
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              color: COLORS.textSecondary,
              display: 'flex'
            }}
          >
            <X style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>
        </div>

        {/* Scrollable content — unified list */}
        <div style={{
          overflow: 'auto',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          {suggestedAnalyses.map(analysis => (
            <UnifiedAnalysisCard
              key={analysis.id}
              analysis={analysis}
              report={reportByAnalysisId.get(analysis.id) || null}
              onRead={onReadReport}
              onGenerate={onGenerateAnalysis}
              onDelete={onDeleteReport}
            />
          ))}

          {/* Custom reports that don't match any suggested analysis */}
          {customReports.length > 0 && (
            <>
              <div style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: COLORS.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginTop: '0.75rem',
                marginBottom: '0.25rem'
              }}>
                Custom Reports
              </div>
              {customReports.map(report => (
                <GeneratedReportCard
                  key={report.id}
                  report={report}
                  onRead={onReadReport}
                  onDelete={onDeleteReport}
                />
              ))}
            </>
          )}

          {/* Empty state */}
          {suggestedAnalyses.length === 0 && customReports.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: COLORS.textSecondary,
              fontSize: '0.875rem'
            }}>
              No reports or analyses available for this category yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryModal;
