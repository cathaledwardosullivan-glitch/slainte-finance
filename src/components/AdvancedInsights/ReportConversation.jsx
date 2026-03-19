import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Loader, X, Search, RefreshCw } from 'lucide-react';
import DOMPurify from 'dompurify';
import { useFinn } from '../../context/FinnContext';
import COLORS from '../../utils/colors';

const STARTER_PROMPTS = [
  'What are the key takeaways?',
  'What should I prioritise first?',
  'Are there any risks I should be aware of?'
];

/**
 * Simple markdown → HTML for chat messages.
 * Handles bold, italic, lists, and paragraphs.
 */
const formatChatMessage = (text) => {
  let html = text
    // Code blocks
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/, '').replace(/```$/, '');
      return `<pre style="background:${COLORS.bgHover};padding:0.75rem;border-radius:0.375rem;overflow-x:auto;font-size:0.8125rem">${code}</pre>`;
    })
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul style="margin:0.5rem 0;padding-left:1.25rem">$1</ul>')
    // Paragraphs (double newline)
    .replace(/\n\n+/g, '</p><p>')
    // Single newlines within paragraphs
    .replace(/\n/g, '<br/>');

  // Wrap in paragraph tags
  if (!html.startsWith('<')) html = `<p>${html}</p>`;
  else if (!html.startsWith('<p>') && !html.startsWith('<ul>') && !html.startsWith('<pre>')) {
    html = `<p>${html}</p>`;
  }

  return DOMPurify.sanitize(html);
};

/**
 * ReportConversation - Sticky side panel for follow-up questions about a report.
 * Uses agentic Q&A via FinnContext (tools: lookup_financial_data, search_transactions, lookup_saved_reports).
 */
const ReportConversation = ({ report, onClose, onReportRevised }) => {
  const { reportQA, reviseReport, backgroundTask, TASK_STATUS } = useFinn();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [revisionStarted, setRevisionStarted] = useState(false);
  const [revisionError, setRevisionError] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Track whether revision is in progress via background task
  const isRevising = revisionStarted && backgroundTask?.status === TASK_STATUS.RUNNING;

  // Detect completion of revision and notify parent
  useEffect(() => {
    if (revisionStarted && backgroundTask?.status === TASK_STATUS.COMPLETED && backgroundTask?.reportId === report.id) {
      // Revision finished — reload updated report from localStorage and notify parent
      const reports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');
      const updated = reports.find(r => r.id === report.id);
      if (updated && onReportRevised) {
        onReportRevised(updated);
      }
      setRevisionStarted(false);
      setMessages([]);
    } else if (revisionStarted && backgroundTask?.status === TASK_STATUS.FAILED) {
      setRevisionError('Revision failed — the original report is unchanged.');
      setRevisionStarted(false);
    }
  }, [revisionStarted, backgroundTask, report.id, onReportRevised]);

  // Fire-and-forget: kicks off background revision, user can navigate away
  const handleReviseReport = () => {
    if (isRevising || isLoading || backgroundTask?.status === TASK_STATUS.RUNNING) return;
    setRevisionStarted(true);
    setRevisionError(null);
    reviseReport(report, messages).catch(err => {
      console.error('[ReportConversation] Revision failed:', err);
      // Error state handled via backgroundTask effect above
    });
  };

  // Show revise button after at least one Q&A exchange (2+ messages)
  const canRevise = messages.length >= 2 && !isLoading && !isRevising && !revisionStarted;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 96) + 'px';
  };

  const sendMessage = async (text) => {
    const userMessage = text.trim();
    if (!userMessage || isLoading) return;

    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      // Build conversation history for the Q&A function (exclude error messages)
      const conversationHistory = newMessages
        .filter(m => !m.isError)
        .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

      const result = await reportQA(userMessage, report, conversationHistory);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.content,
        toolActions: result.toolActions?.length > 0 ? result.toolActions : undefined,
        isError: result.isError || false
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I wasn\'t able to process that question. Please try again.',
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div
      style={{
        position: 'sticky',
        top: '5.5rem',
        height: 'calc(100vh - 7rem)',
        width: '360px',
        minWidth: '360px',
        backgroundColor: COLORS.white,
        borderRadius: '0.75rem',
        border: `1px solid ${COLORS.borderLight}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '0.875rem 1rem',
          borderBottom: `1px solid ${COLORS.borderLight}`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexShrink: 0
        }}
      >
        <MessageCircle style={{ height: '1rem', width: '1rem', color: COLORS.slainteBlue }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary }}>
          Ask about this report
        </span>
        {messages.length > 0 && (
          <span style={{
            fontSize: '0.6875rem',
            color: COLORS.textSecondary,
            marginLeft: 'auto',
            marginRight: '0.25rem'
          }}>
            {messages.filter(m => m.role === 'user').length} question{messages.filter(m => m.role === 'user').length !== 1 ? 's' : ''}
          </span>
        )}
        {canRevise && (
          <button
            onClick={handleReviseReport}
            style={{
              padding: '0.3125rem 0.625rem',
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.slainteBlue}`,
              borderRadius: '0.375rem',
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: COLORS.slainteBlue,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              marginLeft: messages.length > 0 ? 0 : 'auto',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.slainteBlue;
              e.currentTarget.style.color = COLORS.white;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.white;
              e.currentTarget.style.color = COLORS.slainteBlue;
            }}
            title="Revise the report incorporating this conversation"
          >
            <RefreshCw style={{ height: '0.6875rem', width: '0.6875rem' }} />
            Revise Report
          </button>
        )}
        {isRevising && (
          <span style={{
            fontSize: '0.6875rem',
            color: COLORS.slainteBlue,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginLeft: messages.length > 0 ? 0 : 'auto'
          }}>
            <Loader style={{ height: '0.6875rem', width: '0.6875rem', animation: 'spin 1s linear infinite' }} />
            Revising...
          </span>
        )}
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: COLORS.textSecondary,
            padding: '0.25rem',
            borderRadius: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: messages.length > 0 ? 0 : 'auto'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = COLORS.textPrimary}
          onMouseLeave={(e) => e.currentTarget.style.color = COLORS.textSecondary}
        >
          <X style={{ height: '1rem', width: '1rem' }} />
        </button>
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: messages.length > 0 || isLoading ? 1 : 'none',
          padding: '1rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}
      >
        {/* Starter prompts — shown when no messages */}
        {messages.length === 0 && !isLoading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '0.5rem 0',
          }}>
            <p style={{
              fontSize: '0.8125rem',
              color: COLORS.textSecondary,
              margin: 0,
              lineHeight: 1.5
            }}>
              Ask Finn anything about this report — follow-up questions, what-if scenarios, or clarifications. Finn can look up your full financial data to answer.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: COLORS.bgPage,
                    border: `1px solid ${COLORS.borderLight}`,
                    borderRadius: '0.5rem',
                    fontSize: '0.8125rem',
                    color: COLORS.textPrimary,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = COLORS.slainteBlue;
                    e.currentTarget.style.color = COLORS.slainteBlue;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = COLORS.borderLight;
                    e.currentTarget.style.color = COLORS.textPrimary;
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{ maxWidth: '90%' }}>
                <div
                  style={{
                    padding: '0.625rem 0.875rem',
                    borderRadius: '0.75rem',
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                    backgroundColor: isUser
                      ? COLORS.slainteBlue
                      : msg.isError
                        ? `${COLORS.expenseColor}10`
                        : COLORS.bgPage,
                    color: isUser ? COLORS.white : COLORS.textPrimary,
                    border: msg.isError ? `1px solid ${COLORS.expenseColor}30` : 'none'
                  }}
                >
                  {isUser ? (
                    msg.content
                  ) : (
                    <div
                      className="report-conversation-content"
                      dangerouslySetInnerHTML={{ __html: formatChatMessage(msg.content) }}
                    />
                  )}
                </div>
                {/* Tool indicators — shown below assistant messages */}
                {!isUser && msg.toolActions?.length > 0 && (
                  <div style={{
                    marginTop: '0.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.125rem'
                  }}>
                    {msg.toolActions.map((action, j) => (
                      <div key={j} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.6875rem',
                        color: COLORS.textSecondary,
                        opacity: 0.8,
                        paddingLeft: '0.25rem'
                      }}>
                        <Search style={{ height: '0.5625rem', width: '0.5625rem', color: COLORS.slainteBlue }} />
                        <span>{action.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '0.625rem 0.875rem',
              borderRadius: '0.75rem',
              backgroundColor: COLORS.bgPage,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8125rem',
              color: COLORS.textSecondary
            }}>
              <Loader style={{
                height: '0.875rem',
                width: '0.875rem',
                animation: 'spin 1s linear infinite'
              }} />
              Finn is thinking...
            </div>
          </div>
        )}

        {/* Revision error */}
        {revisionError && (
          <div style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: `${COLORS.expenseColor}10`,
            border: `1px solid ${COLORS.expenseColor}30`,
            borderRadius: '0.5rem',
            fontSize: '0.8125rem',
            color: COLORS.expenseColor
          }}>
            {revisionError}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area — always visible */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderTop: `1px solid ${COLORS.borderLight}`,
          display: 'flex',
          alignItems: 'flex-end',
          gap: '0.5rem',
          flexShrink: 0
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up question..."
          rows={1}
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            border: `1px solid ${COLORS.borderLight}`,
            borderRadius: '0.5rem',
            fontSize: '0.8125rem',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.5,
            fontFamily: 'inherit',
            maxHeight: '96px',
            overflow: 'auto'
          }}
          onFocus={(e) => e.target.style.borderColor = COLORS.slainteBlue}
          onBlur={(e) => e.target.style.borderColor = COLORS.borderLight}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading || isRevising}
          style={{
            padding: '0.5rem',
            backgroundColor: input.trim() && !isLoading ? COLORS.slainteBlue : COLORS.borderLight,
            border: 'none',
            borderRadius: '0.5rem',
            cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background-color 0.2s'
          }}
        >
          <Send style={{ height: '1rem', width: '1rem', color: COLORS.white }} />
        </button>
      </div>

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .report-conversation-content p { margin: 0 0 0.5rem; }
        .report-conversation-content p:last-child { margin-bottom: 0; }
        .report-conversation-content ul { margin: 0.25rem 0; }
        .report-conversation-content li { margin-bottom: 0.125rem; }
        .report-conversation-content strong { font-weight: 600; }
      `}</style>
    </div>
  );
};

export default ReportConversation;
