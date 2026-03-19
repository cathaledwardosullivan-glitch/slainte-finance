import React, { useState, useRef, useEffect } from 'react';
import { useFinn } from '../../context/FinnContext';
import { useTour } from '../Tour';
import { Send, MessageCircle, Loader2, X, FileText, Play, RefreshCw, SkipForward, Download, FolderOpen, MessageSquare, CheckCircle, Navigation, Search, FileSearch, BookOpen, Copy, Mail, CheckSquare } from 'lucide-react';
import COLORS from '../../utils/colors';
import { isDemoMode, getDemoApiKey, setDemoApiKey, getDemoKeyTimeRemaining } from '../../utils/demoMode';

/**
 * FinnChatPanel - Chat interface for the unified Finn widget
 */
const FinnChatPanel = ({ currentView = 'dashboard' }) => {
  const {
    messages,
    isLoading,
    sendMessage,
    hasData,
    apiKey,
    setApiKey,
    backgroundTask,
    cancelBackgroundTask,
    getFinancialContext,
    pendingClarifications,
    submitClarifications,
    skipClarifications,
    TASK_TYPES,
    pcrsDownloadProgress,
    openFeedback,
    closeWidget
  } = useFinn();

  const { startTour } = useTour();

  const [inputValue, setInputValue] = useState('');
  const [clarificationAnswers, setClarificationAnswers] = useState({});
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle sending a message
  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue.trim());
    setInputValue('');
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Get welcome message based on current page
  const getWelcomeMessage = () => {
    if (!hasData) return null;

    const pageMessages = {
      dashboard: `Good morning. How can I help you today?`,
      transactions: `I can help with transaction queries, category analysis, or identifying patterns. What would you like to look at?`,
      export: `What report would you like me to help you prepare?`,
      'gms-panel': `Do you have any questions about your GMS payments?`,
      'gms-health-check': `What aspects of the Health Check would you like to discuss?`,
      admin: `How can I assist with your settings or configuration?`,
      default: `How can I assist you today?`
    };

    return pageMessages[currentView] || pageMessages.default;
  };

  // Render a single message
  const renderMessage = (message, index) => {
    const isUser = message.type === 'user';
    const isError = message.isError;

    return (
      <div
        key={message.id || index}
        style={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginBottom: '0.75rem'
        }}
      >
        <div
          style={{
            maxWidth: '85%',
            padding: '0.75rem',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            backgroundColor: isUser
              ? COLORS.slainteBlue
              : isError
                ? `${COLORS.expenseColor}15`
                : COLORS.bgPage,
            color: isUser ? COLORS.white : COLORS.textPrimary,
            border: isError ? `1px solid ${COLORS.expenseColor}40` : 'none'
          }}
        >
          {message.content}

          {/* Tool execution indicators */}
          {message.toolActions?.length > 0 && (
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {message.toolActions.map((action, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.375rem',
                  backgroundColor: `${COLORS.slainteBlue}10`,
                  fontSize: '0.75rem',
                  color: COLORS.textSecondary
                }}>
                  {action.name === 'navigate' && action.input?.target === 'tasks:create' ? (
                    <CheckSquare size={12} color={COLORS.incomeColor} />
                  ) : action.name === 'navigate' ? (
                    <Navigation size={12} color={COLORS.slainteBlue} />
                  ) : action.name === 'generate_report' && action.input?.reportType === 'communication_draft' ? (
                    <Mail size={12} color={COLORS.slainteBlue} />
                  ) : action.name === 'search_transactions' ? (
                    <FileSearch size={12} color={COLORS.slainteBlue} />
                  ) : action.name === 'generate_report' ? (
                    <FileText size={12} color={COLORS.slainteBlue} />
                  ) : action.name === 'lookup_saved_reports' ? (
                    <BookOpen size={12} color={COLORS.slainteBlue} />
                  ) : action.name === 'lookup_financial_data' ? (
                    <Search size={12} color={COLORS.slainteBlue} />
                  ) : action.name === 'start_app_tour' ? (
                    <Play size={12} color={COLORS.slainteBlue} />
                  ) : action.name === 'send_feedback' ? (
                    <MessageSquare size={12} color={COLORS.slainteBlue} />
                  ) : (
                    <CheckCircle size={12} color={COLORS.incomeColor} />
                  )}
                  <span>{action.description}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tour offer action button */}
          {message.action?.type === 'start_tour' && (
            <button
              onClick={() => {
                startTour();
                // Close Finn widget so the tour overlay is visible
                closeWidget();
              }}
              style={{
                marginTop: '0.75rem',
                width: '100%',
                padding: '0.625rem 1rem',
                backgroundColor: COLORS.slainteBlue,
                color: COLORS.white,
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlue}
            >
              <Play style={{ height: '0.875rem', width: '0.875rem' }} />
              {message.action.label || 'Start Tour'}
            </button>
          )}

          {/* Report ready notification */}
          {message.isReportNotification && !message.isCommunicationDraft && (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('navigate:advancedInsights'));
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('advanced-insights:openReport', {
                    detail: { reportId: message.reportId }
                  }));
                }, 400);
                closeWidget();
              }}
              style={{
                marginTop: '0.75rem',
                width: '100%',
                padding: '0.625rem 1rem',
                backgroundColor: COLORS.incomeColor,
                color: COLORS.white,
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.incomeColorDark}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.incomeColor}
            >
              <FileText style={{ height: '0.875rem', width: '0.875rem' }} />
              View Report
            </button>
          )}

          {/* Communication draft notification */}
          {message.isReportNotification && message.isCommunicationDraft && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Contact info card */}
              {message.contactInfo && (
                <div style={{
                  backgroundColor: `${COLORS.slainteBlue}10`,
                  borderRadius: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.75rem',
                  border: `1px solid ${COLORS.slainteBlue}20`
                }}>
                  <div style={{ fontWeight: 500, color: COLORS.textPrimary, marginBottom: '0.125rem' }}>
                    {message.contactInfo.name}
                  </div>
                  {message.contactInfo.email && (
                    <div style={{ color: COLORS.textSecondary }}>{message.contactInfo.email}</div>
                  )}
                  {message.contactInfo.phone && (
                    <div style={{ color: COLORS.textSecondary }}>{message.contactInfo.phone}</div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {/* View full draft */}
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('navigate:advancedInsights'));
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('advanced-insights:openReport', {
                        detail: { reportId: message.reportId }
                      }));
                    }, 400);
                    closeWidget();
                  }}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    backgroundColor: COLORS.incomeColor,
                    color: COLORS.white,
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.incomeColorDark}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.incomeColor}
                >
                  <FileText style={{ height: '0.75rem', width: '0.75rem' }} />
                  View Draft
                </button>

                {/* Copy to clipboard */}
                <button
                  onClick={async () => {
                    try {
                      const reports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');
                      const report = reports.find(r => r.id === message.reportId);
                      if (report?.content) {
                        await navigator.clipboard.writeText(report.content);
                        // Brief visual feedback
                        const btn = document.activeElement;
                        if (btn) {
                          const origText = btn.textContent;
                          btn.textContent = 'Copied!';
                          setTimeout(() => { btn.textContent = origText; }, 1500);
                        }
                      }
                    } catch (err) {
                      console.error('Failed to copy:', err);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    backgroundColor: COLORS.bgPage,
                    color: COLORS.textPrimary,
                    border: `1px solid ${COLORS.borderLight}`,
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem'
                  }}
                >
                  <Copy style={{ height: '0.75rem', width: '0.75rem' }} />
                  Copy
                </button>

                {/* Open in email client */}
                {message.contactInfo?.email && (
                  <button
                    onClick={() => {
                      const subject = encodeURIComponent(message.emailSubject || 'Query from GP Practice');
                      const body = encodeURIComponent(message.emailBody || '');
                      window.open(`mailto:${message.contactInfo.email}?subject=${subject}&body=${body}`);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.75rem',
                      backgroundColor: COLORS.slainteBlue,
                      color: COLORS.white,
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.375rem'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlue}
                  >
                    <Mail style={{ height: '0.75rem', width: '0.75rem' }} />
                    Email
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PCRS download complete notification */}
          {message.isPCRSNotification && message.pcrsComplete && (
            <div style={{ marginTop: '0.75rem' }}>
              {message.downloadedFiles?.length > 0 && (
                <div style={{
                  backgroundColor: `${COLORS.incomeColor}15`,
                  borderRadius: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  marginBottom: '0.5rem',
                  fontSize: '0.75rem'
                }}>
                  <div style={{ fontWeight: 500, marginBottom: '0.25rem', color: COLORS.textPrimary }}>
                    Downloaded files:
                  </div>
                  {message.downloadedFiles.map((file, idx) => (
                    <div key={idx} style={{ color: COLORS.textSecondary }}>
                      {file.panelName}: {file.filename}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => {
                  // Navigate to Data section in Settings
                  // This would typically be handled by a callback or navigation
                  window.dispatchEvent(new CustomEvent('navigate-to-data-section'));
                }}
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  backgroundColor: COLORS.incomeColor,
                  color: COLORS.white,
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.incomeColorDark}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.incomeColor}
              >
                <FolderOpen style={{ height: '0.875rem', width: '0.875rem' }} />
                Import to Payment Analysis
              </button>
            </div>
          )}

          {/* PCRS download error notification */}
          {message.isPCRSNotification && message.pcrsError && message.canRetryPCRS && (
            <button
              onClick={() => {
                // Re-open the PCRS downloader modal
                window.dispatchEvent(new CustomEvent('open-pcrs-downloader'));
              }}
              style={{
                marginTop: '0.75rem',
                width: '100%',
                padding: '0.625rem 1rem',
                backgroundColor: COLORS.textSecondary,
                color: COLORS.white,
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <RefreshCw style={{ height: '0.875rem', width: '0.875rem' }} />
              Try Again
            </button>
          )}

          {/* Timestamp for assistant messages */}
          {!isUser && message.timestamp && (
            <div style={{ fontSize: '0.6875rem', color: COLORS.textSecondary, marginTop: '0.375rem' }}>
              Finn • {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Welcome message */}
        {messages.length === 0 && hasData && (
          <div
            style={{
              backgroundColor: `${COLORS.slainteBlue}10`,
              padding: '0.875rem',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
              border: `1px solid ${COLORS.slainteBlue}30`,
              marginBottom: '0.75rem'
            }}
          >
            <div style={{ color: COLORS.textPrimary, lineHeight: '1.5' }}>
              {getWelcomeMessage()}
            </div>
          </div>
        )}

        {/* No data message */}
        {!hasData && (
          <div style={{ textAlign: 'center', color: COLORS.textSecondary, padding: '2rem 1rem' }}>
            <MessageCircle
              style={{
                margin: '0 auto 0.75rem',
                height: '2.5rem',
                width: '2.5rem',
                color: COLORS.borderLight
              }}
            />
            <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Upload transaction data to start chatting with Finn
            </div>
            <div style={{ fontSize: '0.75rem', color: COLORS.borderLight }}>
              Go to Transactions to import your data
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((message, index) => renderMessage(message, index))}

        {/* Loading indicator */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
            <div
              style={{
                backgroundColor: COLORS.bgPage,
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Loader2
                style={{
                  height: '1rem',
                  width: '1rem',
                  color: COLORS.slainteBlue,
                  animation: 'spin 1s linear infinite'
                }}
              />
              <span style={{ color: COLORS.textSecondary }}>Finn is thinking...</span>
            </div>
          </div>
        )}

        {/* Background task indicator */}
        {backgroundTask?.status === 'running' && (
          <div
            style={{
              backgroundColor: backgroundTask.type === TASK_TYPES?.PCRS_DOWNLOAD
                ? `${COLORS.incomeColor}15`
                : `${COLORS.highlightYellow}20`,
              border: `1px solid ${backgroundTask.type === TASK_TYPES?.PCRS_DOWNLOAD
                ? COLORS.incomeColor
                : COLORS.highlightYellow}`,
              borderRadius: '0.75rem',
              padding: '0.875rem',
              marginBottom: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {backgroundTask.type === TASK_TYPES?.PCRS_DOWNLOAD ? (
                <Download
                  style={{
                    height: '1rem',
                    width: '1rem',
                    color: COLORS.incomeColor
                  }}
                />
              ) : (
                <Loader2
                  style={{
                    height: '1rem',
                    width: '1rem',
                    color: COLORS.textPrimary,
                    animation: 'spin 1s linear infinite'
                  }}
                />
              )}
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: COLORS.textPrimary }}>
                {backgroundTask.type === TASK_TYPES?.PCRS_DOWNLOAD
                  ? 'Downloading PCRS statements...'
                  : 'Working on your report...'}
              </span>
            </div>

            {/* PCRS progress indicator */}
            {backgroundTask.type === TASK_TYPES?.PCRS_DOWNLOAD && pcrsDownloadProgress && (
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginBottom: '0.25rem' }}>
                  {pcrsDownloadProgress.currentPanel && `Downloading: ${pcrsDownloadProgress.currentPanel}`}
                </div>
                {pcrsDownloadProgress.total > 0 && (
                  <div style={{
                    height: '4px',
                    backgroundColor: `${COLORS.incomeColor}30`,
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${(pcrsDownloadProgress.completed / pcrsDownloadProgress.total) * 100}%`,
                      backgroundColor: COLORS.incomeColor,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                )}
                <div style={{ fontSize: '0.6875rem', color: COLORS.textSecondary, marginTop: '0.25rem' }}>
                  {pcrsDownloadProgress.completed} of {pcrsDownloadProgress.total} panels complete
                </div>
              </div>
            )}

            {backgroundTask.type !== TASK_TYPES?.PCRS_DOWNLOAD && (
              <button
                onClick={cancelBackgroundTask}
                style={{
                  padding: '0.375rem 0.75rem',
                  backgroundColor: 'transparent',
                  border: `1px solid ${COLORS.textSecondary}`,
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  color: COLORS.textSecondary,
                  cursor: 'pointer'
                }}
              >
                <X style={{ height: '0.75rem', width: '0.75rem', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Clarification questions UI */}
        {pendingClarifications && pendingClarifications.phase === 'asking' && (
          <div
            style={{
              backgroundColor: `${COLORS.slainteBlue}08`,
              border: `1px solid ${COLORS.slainteBlue}30`,
              borderRadius: '0.75rem',
              padding: '1rem',
              marginBottom: '0.75rem'
            }}
          >
            <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: COLORS.textPrimary, marginBottom: '0.75rem' }}>
              Quick clarifications to improve your report:
            </div>

            {pendingClarifications.questions.map((q, idx) => (
              <div key={q.id} style={{ marginBottom: idx < pendingClarifications.questions.length - 1 ? '0.75rem' : 0 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    color: COLORS.textPrimary,
                    marginBottom: '0.375rem'
                  }}
                >
                  {q.question}
                </label>
                <input
                  type="text"
                  value={clarificationAnswers[q.id] || ''}
                  onChange={(e) => setClarificationAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder={q.placeholder || 'Your answer...'}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8125rem',
                    border: `1px solid ${COLORS.borderLight}`,
                    borderRadius: '0.375rem',
                    outline: 'none',
                    backgroundColor: COLORS.white
                  }}
                  onFocus={(e) => e.target.style.borderColor = COLORS.slainteBlue}
                  onBlur={(e) => e.target.style.borderColor = COLORS.borderLight}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem' }}>
              <button
                onClick={() => {
                  submitClarifications(clarificationAnswers);
                  setClarificationAnswers({});
                }}
                style={{
                  flex: 1,
                  padding: '0.625rem 1rem',
                  backgroundColor: COLORS.slainteBlue,
                  color: COLORS.white,
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.375rem'
                }}
              >
                <Send style={{ height: '0.75rem', width: '0.75rem' }} />
                Submit & Generate Report
              </button>
              <button
                onClick={() => {
                  skipClarifications();
                  setClarificationAnswers({});
                }}
                style={{
                  padding: '0.625rem 1rem',
                  backgroundColor: COLORS.bgPage,
                  color: COLORS.textSecondary,
                  border: `1px solid ${COLORS.borderLight}`,
                  borderRadius: '0.5rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.375rem'
                }}
              >
                <SkipForward style={{ height: '0.75rem', width: '0.75rem' }} />
                Skip
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        style={{
          borderTop: `1px solid ${COLORS.borderLight}`,
          padding: '0.75rem',
          backgroundColor: COLORS.white,
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              // Auto-resize textarea
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={handleKeyPress}
            placeholder={!hasData ? "Upload data first..." : "Ask Finn a question..."}
            disabled={!hasData || isLoading || !apiKey}
            rows={1}
            style={{
              flex: 1,
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: '0.5rem',
              padding: '0.625rem 0.875rem',
              fontSize: '0.875rem',
              outline: 'none',
              backgroundColor: (!hasData || isLoading || !apiKey) ? COLORS.bgPage : COLORS.white,
              transition: 'box-shadow 0.2s, border-color 0.2s',
              resize: 'none',
              minHeight: '2.5rem',
              maxHeight: '7.5rem',
              lineHeight: '1.4',
              fontFamily: 'inherit'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = COLORS.slainteBlue;
              e.target.style.boxShadow = `0 0 0 2px ${COLORS.slainteBlue}30`;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = COLORS.borderLight;
              e.target.style.boxShadow = 'none';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading || !hasData || !apiKey}
            style={{
              backgroundColor: COLORS.slainteBlue,
              color: COLORS.white,
              padding: '0.625rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: (!inputValue.trim() || isLoading || !hasData || !apiKey) ? 'not-allowed' : 'pointer',
              opacity: (!inputValue.trim() || isLoading || !hasData || !apiKey) ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
              height: '2.5rem',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              if (inputValue.trim() && !isLoading && hasData && apiKey) {
                e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.slainteBlue;
            }}
          >
            <Send style={{ height: '1rem', width: '1rem' }} />
          </button>
        </div>

        {/* Helper text */}
        {hasData && apiKey && (
          <div style={{ fontSize: '0.6875rem', color: COLORS.textSecondary, marginTop: '0.375rem' }}>
            Enter to send • Shift+Enter for new line
          </div>
        )}

        {/* API key warning / demo key entry */}
        {!apiKey && hasData && (
          isDemoMode() ? (
            <DemoKeyPrompt onKeySaved={(key) => { setDemoApiKey(key); setApiKey(key); }} />
          ) : (
            <div style={{ fontSize: '0.6875rem', color: COLORS.expenseColor, marginTop: '0.375rem' }}>
              API key required. Configure in Admin Settings.
            </div>
          )
        )}
        {apiKey && isDemoMode() && (
          <div style={{ fontSize: '0.6875rem', color: COLORS.textSecondary, marginTop: '0.375rem' }}>
            Demo key expires in {getDemoKeyTimeRemaining() || 'soon'}
          </div>
        )}
      </div>

      {/* Persistent disclaimer footer */}
      <div style={{
        padding: '0.5rem 0.75rem',
        backgroundColor: COLORS.bgPage,
        borderTop: `1px solid ${COLORS.borderLight}`,
        fontSize: '0.875rem',
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: '1.4',
        flexShrink: 0
      }}>
        Finn provides financial insights, not professional advice. Always verify important information.{' '}
        <span
          onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-settings', { detail: { section: 'privacy' } }))}
          style={{ textDecoration: 'underline', cursor: 'pointer' }}
        >Learn more</span>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

/**
 * Inline prompt for entering a demo API key in the chat panel.
 */
const DemoKeyPrompt = ({ onKeySaved }) => {
  const [showInput, setShowInput] = React.useState(false);
  const [key, setKey] = React.useState('');

  if (!showInput) {
    return (
      <button
        onClick={() => setShowInput(true)}
        style={{
          fontSize: '0.6875rem',
          color: COLORS.slainteBlue,
          marginTop: '0.375rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline'
        }}
      >
        Set demo API key to chat with Finn
      </button>
    );
  }

  return (
    <div style={{ marginTop: '0.375rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="sk-ant-..."
        autoFocus
        style={{
          fontSize: '0.6875rem',
          padding: '0.25rem 0.375rem',
          border: `1px solid ${COLORS.borderLight}`,
          borderRadius: '0.25rem',
          flex: 1,
          minWidth: 0
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && key.trim()) {
            onKeySaved(key.trim());
            setShowInput(false);
          } else if (e.key === 'Escape') {
            setShowInput(false);
          }
        }}
      />
      <button
        onClick={() => { if (key.trim()) { onKeySaved(key.trim()); setShowInput(false); } }}
        style={{
          fontSize: '0.6875rem',
          padding: '0.25rem 0.5rem',
          backgroundColor: COLORS.slainteBlue,
          color: 'white',
          border: 'none',
          borderRadius: '0.25rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}
      >
        Save
      </button>
    </div>
  );
};

export default FinnChatPanel;
