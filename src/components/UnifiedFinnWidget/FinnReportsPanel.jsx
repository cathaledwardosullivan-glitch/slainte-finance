import React, { useState, useRef } from 'react';
import { useFinn } from '../../context/FinnContext';
import ReportModal from './ReportModal';
import { FileText, Trash2, ExternalLink, Calendar, Clock, Send, MessageCircle } from 'lucide-react';
import COLORS from '../../utils/colors';

/**
 * FinnReportsPanel - List of generated reports in the Finn widget
 */
const FinnReportsPanel = () => {
  const { savedReports, deleteReport, loadSavedReports, sendMessage, isLoading, setActiveTab, apiKey, lastGeneratedReport } = useFinn();
  const [selectedReport, setSelectedReport] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [questionInput, setQuestionInput] = useState('');
  const inputRef = useRef(null);

  // Handle asking a question about a report
  const handleAskQuestion = () => {
    if (!questionInput.trim() || isLoading) return;

    // Switch to chat tab and send the message
    setActiveTab('chat');
    sendMessage(questionInput.trim());
    setQuestionInput('');
  };

  // Handle key press in question input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  };

  // Format relative time
  const formatRelativeTime = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  };

  // Handle delete with confirmation
  const handleDelete = (reportId, e) => {
    e.stopPropagation();
    if (confirmDelete === reportId) {
      deleteReport(reportId);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(reportId);
      // Auto-reset confirmation after 3 seconds
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  // Filter to show only Finn-generated reports
  const finnReports = savedReports.filter(r => r.type === 'AI Report' || r.metadata?.generatedBy === 'Finn AI');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Reports List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.75rem'
        }}
      >
        {finnReports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: COLORS.mediumGray }}>
            <FileText
              style={{
                margin: '0 auto 0.75rem',
                height: '2.5rem',
                width: '2.5rem',
                color: COLORS.lightGray
              }}
            />
            <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              No reports yet
            </div>
            <div style={{ fontSize: '0.75rem', color: COLORS.lightGray }}>
              Ask Finn to analyze your finances and generate a detailed report
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {finnReports.map((report) => (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report)}
                style={{
                  padding: '0.875rem',
                  backgroundColor: COLORS.backgroundGray,
                  borderRadius: '0.625rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: `1px solid transparent`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}10`;
                  e.currentTarget.style.borderColor = `${COLORS.slainteBlue}30`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = COLORS.backgroundGray;
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '2rem',
                      height: '2rem',
                      backgroundColor: `${COLORS.slainteBlue}15`,
                      borderRadius: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <FileText style={{ height: '1rem', width: '1rem', color: COLORS.slainteBlue }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: '0.8125rem',
                        color: COLORS.darkGray,
                        marginBottom: '0.25rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {report.title}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        fontSize: '0.6875rem',
                        color: COLORS.mediumGray
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock style={{ height: '0.625rem', width: '0.625rem' }} />
                        {formatRelativeTime(report.generatedDate)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    {/* View button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReport(report);
                      }}
                      style={{
                        padding: '0.375rem',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        color: COLORS.mediumGray,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}20`;
                        e.currentTarget.style.color = COLORS.slainteBlue;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = COLORS.mediumGray;
                      }}
                      title="View full screen"
                    >
                      <ExternalLink style={{ height: '0.875rem', width: '0.875rem' }} />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(report.id, e)}
                      style={{
                        padding: '0.375rem',
                        backgroundColor: confirmDelete === report.id ? `${COLORS.expenseColor}20` : 'transparent',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        color: confirmDelete === report.id ? COLORS.expenseColor : COLORS.mediumGray,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => {
                        if (confirmDelete !== report.id) {
                          e.currentTarget.style.backgroundColor = `${COLORS.expenseColor}15`;
                          e.currentTarget.style.color = COLORS.expenseColor;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (confirmDelete !== report.id) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = COLORS.mediumGray;
                        }
                      }}
                      title={confirmDelete === report.id ? "Click again to confirm" : "Delete report"}
                    >
                      <Trash2 style={{ height: '0.875rem', width: '0.875rem' }} />
                    </button>
                  </div>
                </div>

                {/* Preview of report content */}
                {report.originalQuestion && (
                  <div
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem',
                      backgroundColor: COLORS.white,
                      borderRadius: '0.375rem',
                      fontSize: '0.6875rem',
                      color: COLORS.mediumGray,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Q: {report.originalQuestion}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ask about reports section */}
      {finnReports.length > 0 && (
        <div
          style={{
            borderTop: `1px solid ${COLORS.lightGray}`,
            padding: '0.75rem',
            backgroundColor: COLORS.backgroundGray
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem'
            }}
          >
            <MessageCircle style={{ height: '0.875rem', width: '0.875rem', color: COLORS.mediumGray }} />
            <span style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>
              {lastGeneratedReport ? 'Ask about the report' : 'Ask Finn a question'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              ref={inputRef}
              type="text"
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={lastGeneratedReport ? "What would you like to know about this report?" : "Ask Finn a question..."}
              disabled={isLoading || !apiKey}
              style={{
                flex: 1,
                border: `1px solid ${COLORS.lightGray}`,
                borderRadius: '0.375rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.8125rem',
                outline: 'none',
                backgroundColor: (isLoading || !apiKey) ? COLORS.backgroundGray : COLORS.white
              }}
              onFocus={(e) => {
                e.target.style.borderColor = COLORS.slainteBlue;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = COLORS.lightGray;
              }}
            />
            <button
              onClick={handleAskQuestion}
              disabled={!questionInput.trim() || isLoading || !apiKey}
              style={{
                backgroundColor: COLORS.slainteBlue,
                color: COLORS.white,
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: (!questionInput.trim() || isLoading || !apiKey) ? 'not-allowed' : 'pointer',
                opacity: (!questionInput.trim() || isLoading || !apiKey) ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Send style={{ height: '0.875rem', width: '0.875rem' }} />
            </button>
          </div>
        </div>
      )}

      {/* Full-screen Report Modal */}
      {selectedReport && (
        <ReportModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
};

export default FinnReportsPanel;
