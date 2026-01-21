import React, { useState, useRef, useEffect } from 'react';
import { useFinn } from '../../context/FinnContext';
import { useTour } from '../Tour';
import { Send, MessageCircle, Loader2, X, FileText, Play, RefreshCw, SkipForward } from 'lucide-react';
import COLORS from '../../utils/colors';

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
    backgroundTask,
    startBackgroundReport,
    cancelBackgroundTask,
    pendingReportOffer,
    setActiveTab,
    getFinancialContext,
    pendingClarifications,
    submitClarifications,
    skipClarifications
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

  // Check if message is a tour request
  const isTourRequest = (message) => {
    const lowerMsg = message.toLowerCase();
    const tourPhrases = [
      'tour', 'show me around', 'walk me through', 'guide me',
      'how does this work', 'getting started'
    ];
    return tourPhrases.some(phrase => lowerMsg.includes(phrase));
  };

  // Handle generate detailed report button click
  const handleGenerateReport = () => {
    if (pendingReportOffer) {
      startBackgroundReport(pendingReportOffer);
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
                : COLORS.backgroundGray,
            color: isUser ? COLORS.white : COLORS.darkGray,
            border: isError ? `1px solid ${COLORS.expenseColor}40` : 'none'
          }}
        >
          {message.content}

          {/* Offer detailed report button */}
          {message.offerDetailedReport && message.reportContext && backgroundTask?.status !== 'running' && (
            <button
              onClick={() => startBackgroundReport(message.reportContext)}
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
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark || '#3D7BC7'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlue}
            >
              <FileText style={{ height: '0.875rem', width: '0.875rem' }} />
              Generate Detailed Report
            </button>
          )}

          {/* Report ready notification */}
          {message.isReportNotification && (
            <button
              onClick={() => setActiveTab('reports')}
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
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3db8ab'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.incomeColor}
            >
              <FileText style={{ height: '0.875rem', width: '0.875rem' }} />
              View Report
            </button>
          )}

          {/* Retry button for errors */}
          {message.canRetry && pendingReportOffer && (
            <button
              onClick={handleGenerateReport}
              style={{
                marginTop: '0.75rem',
                width: '100%',
                padding: '0.625rem 1rem',
                backgroundColor: COLORS.mediumGray,
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

          {/* Tour launch button */}
          {message.showTourButton && (
            <button
              onClick={() => startTour()}
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
            >
              <Play style={{ height: '0.875rem', width: '0.875rem' }} />
              Start App Tour
            </button>
          )}

          {/* Timestamp for assistant messages */}
          {!isUser && message.timestamp && (
            <div style={{ fontSize: '0.6875rem', color: COLORS.mediumGray, marginTop: '0.375rem' }}>
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
            <div style={{ color: COLORS.darkGray, lineHeight: '1.5' }}>
              {getWelcomeMessage()}
            </div>
          </div>
        )}

        {/* No data message */}
        {!hasData && (
          <div style={{ textAlign: 'center', color: COLORS.mediumGray, padding: '2rem 1rem' }}>
            <MessageCircle
              style={{
                margin: '0 auto 0.75rem',
                height: '2.5rem',
                width: '2.5rem',
                color: COLORS.lightGray
              }}
            />
            <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Upload transaction data to start chatting with Finn
            </div>
            <div style={{ fontSize: '0.75rem', color: COLORS.lightGray }}>
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
                backgroundColor: COLORS.backgroundGray,
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
              <span style={{ color: COLORS.mediumGray }}>Finn is thinking...</span>
            </div>
          </div>
        )}

        {/* Background task indicator */}
        {backgroundTask?.status === 'running' && (
          <div
            style={{
              backgroundColor: `${COLORS.highlightYellow}20`,
              border: `1px solid ${COLORS.highlightYellow}`,
              borderRadius: '0.75rem',
              padding: '0.875rem',
              marginBottom: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Loader2
                style={{
                  height: '1rem',
                  width: '1rem',
                  color: COLORS.darkGray,
                  animation: 'spin 1s linear infinite'
                }}
              />
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: COLORS.darkGray }}>
                Working on your report...
              </span>
            </div>
            <button
              onClick={cancelBackgroundTask}
              style={{
                padding: '0.375rem 0.75rem',
                backgroundColor: 'transparent',
                border: `1px solid ${COLORS.mediumGray}`,
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                color: COLORS.mediumGray,
                cursor: 'pointer'
              }}
            >
              <X style={{ height: '0.75rem', width: '0.75rem', marginRight: '0.25rem', verticalAlign: 'middle' }} />
              Cancel
            </button>
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
            <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: COLORS.darkGray, marginBottom: '0.75rem' }}>
              Quick clarifications to improve your report:
            </div>

            {pendingClarifications.questions.map((q, idx) => (
              <div key={q.id} style={{ marginBottom: idx < pendingClarifications.questions.length - 1 ? '0.75rem' : 0 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    color: COLORS.darkGray,
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
                    border: `1px solid ${COLORS.lightGray}`,
                    borderRadius: '0.375rem',
                    outline: 'none',
                    backgroundColor: COLORS.white
                  }}
                  onFocus={(e) => e.target.style.borderColor = COLORS.slainteBlue}
                  onBlur={(e) => e.target.style.borderColor = COLORS.lightGray}
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
                  backgroundColor: COLORS.backgroundGray,
                  color: COLORS.mediumGray,
                  border: `1px solid ${COLORS.lightGray}`,
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
          borderTop: `1px solid ${COLORS.lightGray}`,
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
              border: `1px solid ${COLORS.lightGray}`,
              borderRadius: '0.5rem',
              padding: '0.625rem 0.875rem',
              fontSize: '0.875rem',
              outline: 'none',
              backgroundColor: (!hasData || isLoading || !apiKey) ? COLORS.backgroundGray : COLORS.white,
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
              e.target.style.borderColor = COLORS.lightGray;
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
                e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark || '#3D7BC7';
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
          <div style={{ fontSize: '0.6875rem', color: COLORS.mediumGray, marginTop: '0.375rem' }}>
            Enter to send • Shift+Enter for new line
          </div>
        )}

        {/* API key warning */}
        {!apiKey && hasData && (
          <div style={{ fontSize: '0.6875rem', color: COLORS.expenseColor, marginTop: '0.375rem' }}>
            API key required. Configure in Admin Settings.
          </div>
        )}
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

export default FinnChatPanel;
