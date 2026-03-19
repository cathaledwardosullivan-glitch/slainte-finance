import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageCircle, Send, Loader, X, Search } from 'lucide-react';
import DOMPurify from 'dompurify';
import { useFinn } from '../../context/FinnContext';
import { buildAreaSpecificContext } from '../../utils/gmsHealthCheckContext';
import COLORS from '../../utils/colors';
import { CARD_TITLES } from './AreaCard';

/**
 * Per-area starter prompts
 */
const AREA_STARTERS = {
  leave: [
    'How is my leave entitlement calculated?',
    'What should I do before 31st March?',
    'Why is this estimated?'
  ],
  practiceSupport: [
    'How are increment points determined?',
    'What should I do about unregistered staff?',
    'How does panel pro-rating work?'
  ],
  capitation: [
    'How do I find unregistered patients?',
    'Which age groups have the biggest gap?',
    'What should I prioritise first?'
  ],
  cervicalCheck: [
    'Why are some smears showing zero payment?',
    'How do I check my screening contract?',
    'What are the screening intervals?'
  ],
  stc: [
    'Which procedures am I under-claiming?',
    'How does benchmarking work?',
    'What\'s the LARC scheme?'
  ],
  cdm: [
    'How is the CDM payment calculated?',
    'What\'s the gap between my register and claims?',
    'What is Opportunistic Case Finding?'
  ]
};

/**
 * Simple markdown → HTML for chat messages.
 */
const formatChatMessage = (text) => {
  let html = text
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/, '').replace(/```$/, '');
      return `<pre style="background:${COLORS.bgHover || COLORS.bgPage};padding:0.75rem;border-radius:0.375rem;overflow-x:auto;font-size:0.8125rem">${code}</pre>`;
    })
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul style="margin:0.5rem 0;padding-left:1.25rem">$1</ul>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  if (!html.startsWith('<')) html = `<p>${html}</p>`;
  return DOMPurify.sanitize(html);
};

/**
 * AreaConversation - Side panel for per-area Q&A within the GMS Health Check v2.
 * Follows the same pattern as ReportConversation.
 */
const AreaConversation = ({ areaId, analysis, readiness, recommendations, onClose }) => {
  const { gmsAreaQA } = useFinn();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const starterPrompts = AREA_STARTERS[areaId] || AREA_STARTERS.leave;
  const title = CARD_TITLES[areaId] || areaId;

  // Build area context once (memoised)
  const areaContext = useMemo(() => {
    return buildAreaSpecificContext(
      areaId,
      analysis,
      readiness?.[areaId],
      recommendations
    );
  }, [areaId, analysis, readiness, recommendations]);

  // Auto-scroll
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
      const conversationHistory = newMessages
        .filter(m => !m.isError)
        .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

      const result = await gmsAreaQA(userMessage, areaId, areaContext, conversationHistory);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.content,
        toolActions: result.toolActions?.length > 0 ? result.toolActions : undefined,
        isError: result.isError || false
      }]);
    } catch {
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
    <div style={{
      width: '360px',
      minWidth: '360px',
      backgroundColor: COLORS.white,
      borderLeft: `1px solid ${COLORS.borderLight}`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '0.875rem 1rem',
        borderBottom: `1px solid ${COLORS.borderLight}`,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexShrink: 0
      }}>
        <MessageCircle style={{ height: '1rem', width: '1rem', color: COLORS.slainteBlue }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary, flex: 1 }}>
          Ask about {title}
        </span>
        {messages.length > 0 && (
          <span style={{ fontSize: '0.6875rem', color: COLORS.textSecondary }}>
            {messages.filter(m => m.role === 'user').length} Q
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
            alignItems: 'center'
          }}
        >
          <X style={{ height: '1rem', width: '1rem' }} />
        </button>
      </div>

      {/* Messages area */}
      <div style={{
        flex: messages.length > 0 || isLoading ? 1 : 'none',
        padding: '1rem',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        {/* Starter prompts */}
        {messages.length === 0 && !isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0' }}>
            <p style={{ fontSize: '0.8125rem', color: COLORS.textSecondary, margin: 0, lineHeight: 1.5 }}>
              Ask Finn about this area — how calculations work, what to prioritise, or what the findings mean. Finn has full reference data on GMS rates and rules.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {starterPrompts.map(prompt => (
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
            <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '90%' }}>
                <div style={{
                  padding: '0.625rem 0.875rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                  backgroundColor: isUser
                    ? COLORS.slainteBlue
                    : msg.isError ? `${COLORS.expenseColor}10` : COLORS.bgPage,
                  color: isUser ? COLORS.white : COLORS.textPrimary,
                  border: msg.isError ? `1px solid ${COLORS.expenseColor}30` : 'none'
                }}>
                  {isUser ? msg.content : (
                    <div
                      className="area-conversation-content"
                      dangerouslySetInnerHTML={{ __html: formatChatMessage(msg.content) }}
                    />
                  )}
                </div>
                {/* Tool indicators */}
                {!isUser && msg.toolActions?.length > 0 && (
                  <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
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
              <Loader style={{ height: '0.875rem', width: '0.875rem', animation: 'spin 1s linear infinite' }} />
              Finn is thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: '0.75rem 1rem',
        borderTop: `1px solid ${COLORS.borderLight}`,
        display: 'flex',
        alignItems: 'flex-end',
        gap: '0.5rem',
        flexShrink: 0
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask Finn about this area..."
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
          disabled={!input.trim() || isLoading}
          style={{
            padding: '0.5rem',
            backgroundColor: input.trim() && !isLoading ? COLORS.slainteBlue : COLORS.borderLight,
            border: 'none',
            borderRadius: '0.5rem',
            cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Send style={{ height: '1rem', width: '1rem', color: COLORS.white }} />
        </button>
      </div>

      {/* Styles */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .area-conversation-content p { margin: 0 0 0.5rem; }
        .area-conversation-content p:last-child { margin-bottom: 0; }
        .area-conversation-content ul { margin: 0.25rem 0; }
        .area-conversation-content li { margin-bottom: 0.125rem; }
        .area-conversation-content strong { font-weight: 600; }
      `}</style>
    </div>
  );
};

export default AreaConversation;
