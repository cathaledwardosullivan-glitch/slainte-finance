import React, { useState } from 'react';
import { X, FileText, Download, Copy, Printer, Calendar } from 'lucide-react';
import { exportArtifactPDF, exportArtifactMarkdown, copyArtifactToClipboard } from '../../utils/artifactBuilder';
import ReportContentRenderer from '../shared/ReportContent';
import { useReportFeedback, ReportFeedbackThumbs, ReportFeedbackPanel } from '../shared/ReportFeedback';
import COLORS from '../../utils/colors';

/**
 * ReportModal - Full-screen modal for viewing Finn-generated reports
 * Uses shared ReportContentRenderer for content display
 */
const ReportModal = ({ report, onClose }) => {
  const [copied, setCopied] = useState(false);
  const feedback = useReportFeedback(report);

  // Convert report to artifact format for ArtifactViewer
  const artifact = {
    title: report.title,
    type: report.artifactType || 'report',
    content: report.content,
    created_at: report.generatedDate
  };

  const handleCopy = async () => {
    const success = await copyArtifactToClipboard(artifact);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    exportArtifactPDF(artifact);
  };

  const handleDownload = () => {
    exportArtifactMarkdown(artifact);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: COLORS.white,
          borderRadius: '0.75rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: `1px solid ${COLORS.borderLight}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: COLORS.white,
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                backgroundColor: `${COLORS.slainteBlue}15`,
                borderRadius: '0.625rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText style={{ height: '1.25rem', width: '1.25rem', color: COLORS.slainteBlue }} />
            </div>
            <div>
              <h2 style={{ fontWeight: 600, fontSize: '1.125rem', color: COLORS.textPrimary, margin: 0 }}>
                {report.title}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <Calendar style={{ height: '0.75rem', width: '0.75rem', color: COLORS.textSecondary }} />
                <span style={{ fontSize: '0.8125rem', color: COLORS.textSecondary }}>
                  {new Date(report.generatedDate).toLocaleDateString('en-IE', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              background: 'none',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              color: COLORS.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.bgPage;
              e.currentTarget.style.color = COLORS.textPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = COLORS.textSecondary;
            }}
          >
            <X style={{ height: '1.25rem', width: '1.25rem' }} />
          </button>
        </div>

        {/* Action Bar */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderBottom: `1px solid ${COLORS.borderLight}`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: COLORS.bgPage,
            flexShrink: 0
          }}
        >
          {/* Feedback thumbs */}
          <ReportFeedbackThumbs feedback={feedback} />

          {/* Separator */}
          <div style={{
            width: '1px',
            height: '1.25rem',
            backgroundColor: COLORS.borderLight,
            margin: '0 0.25rem'
          }} />

          <button
            onClick={handlePrint}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: COLORS.textPrimary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.slainteBlue}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.borderLight}
          >
            <Printer style={{ height: '0.875rem', width: '0.875rem' }} />
            Print / PDF
          </button>

          <button
            onClick={handleDownload}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: COLORS.textPrimary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.slainteBlue}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.borderLight}
          >
            <Download style={{ height: '0.875rem', width: '0.875rem' }} />
            Download
          </button>

          <button
            onClick={handleCopy}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: copied ? `${COLORS.incomeColor}15` : COLORS.white,
              border: `1px solid ${copied ? COLORS.incomeColor : COLORS.borderLight}`,
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: copied ? COLORS.incomeColor : COLORS.textPrimary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              if (!copied) e.currentTarget.style.borderColor = COLORS.slainteBlue;
            }}
            onMouseLeave={(e) => {
              if (!copied) e.currentTarget.style.borderColor = COLORS.borderLight;
            }}
          >
            <Copy style={{ height: '0.875rem', width: '0.875rem' }} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Feedback Panel — slides in below action bar when thumb is clicked */}
        {feedback.rating && !feedback.submitted && (
          <div style={{
            borderBottom: `1px solid ${COLORS.borderLight}`,
            flexShrink: 0
          }}>
            <ReportFeedbackPanel feedback={feedback} />
          </div>
        )}

        {/* Original Question */}
        {report.originalQuestion && (
          <div
            style={{
              padding: '0.875rem 1.5rem',
              backgroundColor: `${COLORS.slainteBlue}08`,
              borderBottom: `1px solid ${COLORS.borderLight}`,
              fontSize: '0.8125rem',
              color: COLORS.textSecondary,
              flexShrink: 0
            }}
          >
            <span style={{ fontWeight: 500, color: COLORS.textPrimary }}>Your question: </span>
            {report.originalQuestion}
          </div>
        )}

        {/* Report Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem'
          }}
        >
          <ReportContentRenderer report={report} />
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.875rem 1.5rem',
            borderTop: `1px solid ${COLORS.borderLight}`,
            backgroundColor: COLORS.bgPage,
            fontSize: '0.75rem',
            color: COLORS.textSecondary,
            textAlign: 'center',
            flexShrink: 0
          }}
        >
          Generated by Finn AI • Sláinte Finance
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
