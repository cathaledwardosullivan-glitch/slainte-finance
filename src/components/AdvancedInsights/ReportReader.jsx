import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Printer, Download, Copy, Calendar, MessageCircle, Trash2 } from 'lucide-react';
import { exportArtifactPDF, exportArtifactMarkdown, copyArtifactToClipboard } from '../../utils/artifactBuilder';
import ReportContentRenderer from '../shared/ReportContent';
import { useReportFeedback, ReportFeedbackThumbs, ReportFeedbackPanel } from '../shared/ReportFeedback';
import ReportConversation from './ReportConversation';
import DeleteConfirmDialog from '../AdvancedInsightsV2/DeleteConfirmDialog';
import COLORS from '../../utils/colors';

/**
 * Get model display name from metadata.
 */
const getModelLabel = (report) => {
  const model = report.metadata?.model || '';
  if (model.includes('opus')) return 'Claude Opus';
  if (model.includes('sonnet')) return 'Claude Sonnet';
  return 'Finn AI';
};

/**
 * ReportReader - Full-width inline report viewer for the Advanced Insights tab.
 * Replaces the gallery view when a report is selected (not a modal).
 * Includes an optional sticky side panel for follow-up questions.
 */
const ReportReader = ({ report, onBack, onDelete, onReportUpdated }) => {
  const [copied, setCopied] = useState(false);
  const [showConversation, setShowConversation] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const feedback = useReportFeedback(report);

  // Scroll to top when report opens
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Back + Action Bar — sticky so it stays visible while scrolling */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: COLORS.bgPage,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '1rem',
          paddingTop: '0.25rem'
        }}
      >
        <button
          onClick={onBack}
          style={{
            padding: '0.5rem 0.875rem',
            backgroundColor: COLORS.white,
            border: `1px solid ${COLORS.borderLight}`,
            borderRadius: '0.5rem',
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: COLORS.textSecondary,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = COLORS.slainteBlue;
            e.currentTarget.style.color = COLORS.slainteBlue;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = COLORS.borderLight;
            e.currentTarget.style.color = COLORS.textSecondary;
          }}
        >
          <ArrowLeft style={{ height: '0.875rem', width: '0.875rem' }} />
          Back to Reports
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Feedback thumbs */}
          <ReportFeedbackThumbs feedback={feedback} />

          {/* Separator */}
          <div style={{
            width: '1px',
            height: '1.25rem',
            backgroundColor: COLORS.borderLight,
            margin: '0 0.25rem'
          }} />

          {/* Ask about report toggle */}
          <button
            onClick={() => setShowConversation(!showConversation)}
            style={{
              padding: '0.5rem 0.875rem',
              backgroundColor: showConversation ? COLORS.white : COLORS.incomeColor,
              border: `1px solid ${COLORS.incomeColor}`,
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: showConversation ? COLORS.incomeColor : COLORS.white,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              transition: 'all 0.2s'
            }}
          >
            <MessageCircle style={{ height: '0.875rem', width: '0.875rem' }} />
            {showConversation ? 'Hide Q&A' : 'Ask About Report'}
          </button>

          <button
            onClick={handlePrint}
            style={{
              padding: '0.5rem 0.875rem',
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: COLORS.textPrimary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem'
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
              padding: '0.5rem 0.875rem',
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: COLORS.textPrimary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem'
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
              padding: '0.5rem 0.875rem',
              backgroundColor: copied ? `${COLORS.incomeColor}15` : COLORS.white,
              border: `1px solid ${copied ? COLORS.incomeColor : COLORS.borderLight}`,
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: copied ? COLORS.incomeColor : COLORS.textPrimary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem'
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

          {onDelete && (
            <>
              {/* Separator */}
              <div style={{
                width: '1px',
                height: '1.25rem',
                backgroundColor: COLORS.borderLight,
                margin: '0 0.25rem'
              }} />

              <button
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete report"
                style={{
                  padding: '0.5rem 0.875rem',
                  backgroundColor: COLORS.white,
                  border: `1px solid ${COLORS.borderLight}`,
                  borderRadius: '0.5rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: COLORS.textSecondary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = COLORS.expenseColor;
                  e.currentTarget.style.color = COLORS.expenseColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = COLORS.borderLight;
                  e.currentTarget.style.color = COLORS.textSecondary;
                }}
              >
                <Trash2 style={{ height: '0.875rem', width: '0.875rem' }} />
              </button>
            </>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <DeleteConfirmDialog
          title={report.title}
          onConfirm={() => { onDelete(report.id); setShowDeleteConfirm(false); onBack(); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Feedback Panel — tags, comment, submit (slides in below action bar) */}
      {feedback.rating && !feedback.submitted && (
        <div style={{
          backgroundColor: COLORS.white,
          border: `1px solid ${COLORS.borderLight}`,
          borderRadius: '0.5rem',
          marginBottom: '0.75rem'
        }}>
          <ReportFeedbackPanel feedback={feedback} />
        </div>
      )}

      {/* Report + Conversation Layout */}
      <div
        style={{
          display: 'flex',
          gap: showConversation ? '1.5rem' : '0',
          alignItems: 'flex-start'
        }}
      >
        {/* Report Container */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: COLORS.white,
            borderRadius: '0.75rem',
            border: `1px solid ${COLORS.borderLight}`,
            overflow: 'hidden'
          }}
        >
          {/* Report Header */}
          <div
            style={{
              padding: '1.5rem 2rem',
              borderBottom: `1px solid ${COLORS.borderLight}`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div
                style={{
                  width: '2.75rem',
                  height: '2.75rem',
                  backgroundColor: `${COLORS.slainteBlue}12`,
                  borderRadius: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <FileText style={{ height: '1.375rem', width: '1.375rem', color: COLORS.slainteBlue }} />
              </div>
              <div>
                <h1 style={{
                  fontSize: '1.375rem',
                  fontWeight: 700,
                  color: COLORS.textPrimary,
                  margin: '0 0 0.5rem'
                }}>
                  {report.title}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: COLORS.textSecondary }}>
                    <Calendar style={{ height: '0.75rem', width: '0.75rem' }} />
                    {new Date(report.generatedDate).toLocaleDateString('en-IE', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  <span style={{
                    padding: '0.125rem 0.5rem',
                    backgroundColor: `${COLORS.slainteBlue}10`,
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: COLORS.slainteBlue
                  }}>
                    {getModelLabel(report)}
                  </span>
                  {report.metadata?.revisedAt && (
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      backgroundColor: `${COLORS.incomeColor}15`,
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: COLORS.incomeColor
                    }}>
                      Revised{report.metadata.revisionNumber > 1 ? ` (${report.metadata.revisionNumber}x)` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Original Question */}
          {report.originalQuestion && (
            <div
              style={{
                padding: '0.875rem 2rem',
                backgroundColor: `${COLORS.slainteBlue}06`,
                borderBottom: `1px solid ${COLORS.borderLight}`,
                fontSize: '0.875rem',
                color: COLORS.textSecondary
              }}
            >
              <span style={{ fontWeight: 500, color: COLORS.textPrimary }}>Your question: </span>
              {report.originalQuestion}
            </div>
          )}

          {/* Report Content */}
          <div
            style={{
              padding: '2rem',
              maxWidth: '900px',
              margin: '0 auto'
            }}
          >
            <ReportContentRenderer report={report} />
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '0.875rem 2rem',
              borderTop: `1px solid ${COLORS.borderLight}`,
              backgroundColor: COLORS.bgPage,
              fontSize: '0.75rem',
              color: COLORS.textSecondary,
              textAlign: 'center'
            }}
          >
            Generated by Finn AI • Sláinte Finance
          </div>
        </div>

        {/* Side Panel */}
        {showConversation && (
          <ReportConversation
            report={report}
            onClose={() => setShowConversation(false)}
            onReportRevised={(revised) => onReportUpdated?.(revised)}
          />
        )}
      </div>
    </div>
  );
};

export default ReportReader;
