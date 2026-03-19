import React, { useState } from 'react';
import COLORS from '../../utils/colors';
import { useFinn } from '../../context/FinnContext';
import InsightDashboard from './InsightDashboard';
import ReportGallery from './ReportGallery';
import ReportReader from './ReportReader';
import SuggestedAnalyses from './SuggestedAnalyses';
import EmptyState from './EmptyState';
import AnalysisPreviewModal from './AnalysisPreviewModal';

/**
 * AdvancedInsights - Main tab component for AI-powered financial insights.
 * Shows a report gallery + suggested analyses, or an empty state if no reports exist.
 * Selecting a report replaces the view with a full-width ReportReader.
 */
const AdvancedInsights = ({ setCurrentView }) => {
  const { savedReports } = useFinn();
  const [selectedReport, setSelectedReport] = useState(null);
  const [previewAnalysis, setPreviewAnalysis] = useState(null);

  // Filter to only Finn-generated reports (same filter as FinnReportsPanel)
  const finnReports = savedReports.filter(
    r => r.type === 'AI Report' || r.metadata?.generatedBy === 'Finn AI'
  );

  // Report reader view
  if (selectedReport) {
    return (
      <ReportReader
        report={selectedReport}
        onBack={() => setSelectedReport(null)}
        onReportUpdated={(revised) => setSelectedReport(revised)}
      />
    );
  }

  // Two-column layout for both empty and populated states
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <InsightDashboard onPreviewAnalysis={setPreviewAnalysis} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.5rem',
        alignItems: 'stretch'
      }}>
        {/* Left column: Reports */}
        <div style={{
          backgroundColor: COLORS.white,
          border: `1px solid ${COLORS.borderLight}`,
          borderRadius: '0.75rem',
          padding: '1.25rem',
          minHeight: '400px'
        }}>
          {finnReports.length === 0 ? (
            <EmptyState onPreviewAnalysis={setPreviewAnalysis} />
          ) : (
            <ReportGallery
              reports={finnReports}
              onSelectReport={setSelectedReport}
              compact
            />
          )}
        </div>

        {/* Right column: Suggested Analyses */}
        <div style={{
          backgroundColor: COLORS.white,
          border: `1px solid ${COLORS.borderLight}`,
          borderRadius: '0.75rem',
          padding: '1.25rem',
          minHeight: '400px'
        }}>
          <SuggestedAnalyses onPreviewAnalysis={setPreviewAnalysis} compact />
        </div>
      </div>
      {previewAnalysis && (
        <AnalysisPreviewModal
          analysis={previewAnalysis}
          onClose={() => setPreviewAnalysis(null)}
          onReportReady={(report) => setSelectedReport(report)}
        />
      )}
    </div>
  );
};

export default AdvancedInsights;
