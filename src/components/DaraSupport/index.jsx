import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Image, X, Loader2, RotateCcw, AlertTriangle, HelpCircle, Monitor
} from 'lucide-react';
import COLORS from '../../utils/colors';
import { usePracticeProfile } from '../../hooks/usePracticeProfile';
import { isAIEnabled } from '../../utils/privacyGate';
import { MODELS } from '../../data/modelConfig';
import {
  buildDaraContext,
  buildDaraSystemPrompt,
  getDaraWelcome
} from '../../utils/daraContextBuilder';

const STORAGE_KEY = 'dara_chat_history';
const PII_WARNING_KEY = 'dara_pii_warning_seen';

/**
 * DaraSupport — Virtual EHR IT Support Chat
 * Full-page view for the Dara agent
 */
const DaraSupport = () => {
  const { profile } = usePracticeProfile();
  const ehrSystem = profile?.practiceDetails?.ehrSystem || '';

  // Chat state
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Image upload state
  const [pendingImage, setPendingImage] = useState(null); // { base64, mimeType, name }
  const [showPiiWarning, setShowPiiWarning] = useState(false);
  const [piiWarningSeen, setPiiWarningSeen] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // EHR display name
  const ehrLabels = {
    socrates: 'Socrates',
    healthone: 'HealthOne',
    practicemanager: 'Helix Practice Manager',
    completegp: 'CompleteGP'
  };
  const ehrName = ehrLabels[ehrSystem] || 'your EHR system';

  // Load conversation history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setMessages(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('[Dara] Failed to load chat history:', e);
    }
    // Check if PII warning has been acknowledged
    setPiiWarningSeen(localStorage.getItem(PII_WARNING_KEY) === 'true');
  }, []);

  // Save conversation history
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (e) {
        console.warn('[Dara] Failed to save chat history:', e);
      }
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Get welcome data
  const { welcomeMessage, quickTopics } = getDaraWelcome(ehrSystem);

  /**
   * Get authentication token
   */
  const getAuthToken = async () => {
    if (window.electronAPI?.isElectron) {
      return await window.electronAPI.getInternalToken();
    }
    return localStorage.getItem('partner_token');
  };

  /**
   * Send a message to Dara
   */
  const handleSend = useCallback(async (messageText) => {
    const text = messageText || inputValue.trim();
    if (!text || isLoading) return;

    // Check privacy gate
    if (!isAIEnabled()) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'user',
        content: text,
        timestamp: new Date().toISOString()
      }, {
        id: Date.now() + 1,
        type: 'assistant',
        content: 'Local Only Mode is enabled. AI features are unavailable. Please disable Local Only Mode in Settings > Privacy & AI to use Dara.',
        timestamp: new Date().toISOString(),
        isError: true
      }]);
      setInputValue('');
      return;
    }

    // Create user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      image: pendingImage ? { name: pendingImage.name } : undefined
    };

    const imageToSend = pendingImage;
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setPendingImage(null);
    setIsLoading(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Build context from knowledge base
      const relevantContext = buildDaraContext(text, ehrSystem);
      const systemPrompt = buildDaraSystemPrompt(ehrSystem, profile);

      // Build conversation history (last 10 messages)
      const recentMessages = [...messages, userMessage].slice(-10);
      const conversationHistory = recentMessages.map(m => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

      // Build current message content
      let currentContent;
      const queryText = relevantContext
        ? `${relevantContext}\n\n---\n\nUser question: ${text}`
        : text;

      if (imageToSend) {
        currentContent = [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageToSend.mimeType,
              data: imageToSend.base64
            }
          },
          { type: 'text', text: queryText }
        ];
      } else {
        currentContent = queryText;
      }

      // Replace last user message in history with enriched version
      conversationHistory[conversationHistory.length - 1] = {
        role: 'user',
        content: currentContent
      };

      // Prepend system context as first exchange
      const allMessages = [
        { role: 'user', content: systemPrompt },
        { role: 'assistant', content: `Understood. I'm Dara, ready to help with ${ehrName}. I have the practice context and will follow all behaviour rules including patient data protection.` },
        ...conversationHistory
      ];

      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: JSON.stringify({
            model: MODELS.FAST,
            max_tokens: 1500,
            messages: allMessages
          })
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Dara] API error:', response.status, errorText);
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      // Extract response text
      let responseText = '';
      if (data.content && Array.isArray(data.content)) {
        responseText = data.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n\n');
      }

      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'assistant',
        content: responseText || 'I apologise, I wasn\'t able to generate a response. Please try again.',
        timestamp: new Date().toISOString()
      }]);

    } catch (error) {
      console.error('[Dara] Error:', error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'assistant',
        content: `I'm sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages, pendingImage, ehrSystem, profile, ehrName]);

  /**
   * Handle image upload
   */
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, etc.)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]; // Remove data:image/...;base64, prefix
      setPendingImage({
        base64,
        mimeType: file.type,
        name: file.name
      });

      // Show PII warning on first image upload
      if (!piiWarningSeen) {
        setShowPiiWarning(true);
      }
    };
    reader.readAsDataURL(file);

    // Reset file input
    e.target.value = '';
  };

  /**
   * Acknowledge PII warning
   */
  const acknowledgePiiWarning = () => {
    setShowPiiWarning(false);
    setPiiWarningSeen(true);
    localStorage.setItem(PII_WARNING_KEY, 'true');
  };

  /**
   * Clear conversation
   */
  const handleNewConversation = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    inputRef.current?.focus();
  };

  /**
   * Handle key press
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * Render markdown-lite content (bold, lists, code)
   */
  const renderContent = (text) => {
    if (!text) return null;

    // Split by lines and process
    const lines = text.split('\n');
    const elements = [];
    let inList = false;
    let listItems = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
            {listItems.map((item, i) => (
              <li key={i} style={{ marginBottom: '0.25rem' }}>{processInline(item)}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    const processInline = (line) => {
      // Bold: **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        // Inline code: `text`
        const codeParts = part.split(/(`[^`]+`)/g);
        return codeParts.map((cp, j) => {
          if (cp.startsWith('`') && cp.endsWith('`')) {
            return (
              <code
                key={`${i}-${j}`}
                style={{
                  backgroundColor: 'rgba(0,0,0,0.06)',
                  padding: '0.125rem 0.25rem',
                  borderRadius: '3px',
                  fontSize: '0.8125rem'
                }}
              >
                {cp.slice(1, -1)}
              </code>
            );
          }
          return cp;
        });
      });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Numbered list item
      if (/^\d+\.\s/.test(line)) {
        if (!inList) {
          flushList();
          inList = true;
        }
        listItems.push(line.replace(/^\d+\.\s/, ''));
        continue;
      }

      // Bullet list item
      if (/^[-•]\s/.test(line)) {
        if (!inList) {
          flushList();
          inList = true;
        }
        listItems.push(line.replace(/^[-•]\s/, ''));
        continue;
      }

      // Not a list item — flush any pending list
      flushList();

      // Heading: ### text
      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={i} style={{ fontWeight: 600, marginTop: '0.75rem', marginBottom: '0.25rem' }}>
            {line.slice(4)}
          </h4>
        );
        continue;
      }

      // Empty line = paragraph break
      if (line.trim() === '') {
        elements.push(<div key={i} style={{ height: '0.5rem' }} />);
        continue;
      }

      // Regular paragraph
      elements.push(
        <p key={i} style={{ margin: '0.25rem 0' }}>{processInline(line)}</p>
      );
    }

    flushList();
    return elements;
  };

  // No EHR selected state
  if (!ehrSystem) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '2rem',
        textAlign: 'center',
        color: COLORS.mediumGray
      }}>
        <Monitor style={{ width: '3rem', height: '3rem', marginBottom: '1rem', color: COLORS.lightGray }} />
        <h3 style={{ color: COLORS.darkGray, marginBottom: '0.5rem' }}>No EHR System Selected</h3>
        <p style={{ maxWidth: '400px', lineHeight: 1.6 }}>
          To use Dara, please set your Electronic Health Record (EHR) system in
          Settings &gt; Practice Profile first.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: COLORS.white
    }}>
      {/* Header — constrained to same width as chat */}
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: `1px solid ${COLORS.lightGray}`,
        flexShrink: 0,
        backgroundColor: COLORS.backgroundGray
      }}>
        <div style={{
          maxWidth: '700px',
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '50%',
              backgroundColor: '#7C3AED',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: COLORS.white,
              fontWeight: 700,
              fontSize: '1rem'
            }}>
              D
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: COLORS.darkGray }}>
                Dara — IT Support
              </h2>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: COLORS.mediumGray }}>
                Virtual IT support for {ehrName}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* EHR badge */}
            <span style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 500,
              backgroundColor: '#7C3AED15',
              color: '#7C3AED',
              border: '1px solid #7C3AED30'
            }}>
              {ehrName}
            </span>
            {/* New conversation */}
            <button
              onClick={handleNewConversation}
              title="New conversation"
              style={{
                background: 'none',
                border: `1px solid ${COLORS.lightGray}`,
                borderRadius: '0.375rem',
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                color: COLORS.mediumGray,
                fontSize: '0.8125rem'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.white}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <RotateCcw style={{ width: '0.875rem', height: '0.875rem' }} />
              New chat
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable content area — messages + input all flow together */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '1.5rem'
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Welcome message if no messages */}
          {messages.length === 0 && (
            <>
              {/* Welcome */}
              <div style={{
                display: 'flex',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  backgroundColor: '#7C3AED',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: COLORS.white,
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  flexShrink: 0,
                  marginTop: '0.25rem'
                }}>
                  D
                </div>
                <div style={{
                  padding: '0.875rem 1rem',
                  borderRadius: '0 0.75rem 0.75rem 0.75rem',
                  backgroundColor: COLORS.backgroundGray,
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  color: COLORS.darkGray,
                  whiteSpace: 'pre-line'
                }}>
                  {welcomeMessage}
                </div>
              </div>

              {/* Quick topic buttons */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                paddingLeft: '2.75rem'
              }}>
                {quickTopics.map((topic, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(topic.query)}
                    disabled={isLoading}
                    style={{
                      padding: '0.5rem 0.875rem',
                      borderRadius: '9999px',
                      border: '1px solid #7C3AED30',
                      backgroundColor: '#7C3AED08',
                      color: '#7C3AED',
                      fontSize: '0.8125rem',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.backgroundColor = '#7C3AED15';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#7C3AED08';
                    }}
                  >
                    {topic.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Message list */}
          {messages.map((message) => {
            const isUser = message.type === 'user';
            const isError = message.isError;

            return (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: isUser ? 'flex-end' : 'flex-start'
                }}
              >
                {/* Dara avatar */}
                {!isUser && (
                  <div style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    backgroundColor: isError ? COLORS.expenseColor : '#7C3AED',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: COLORS.white,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    flexShrink: 0,
                    marginTop: '0.25rem'
                  }}>
                    {isError ? '!' : 'D'}
                  </div>
                )}

                <div style={{
                  maxWidth: '85%',
                  padding: '0.75rem 1rem',
                  borderRadius: isUser
                    ? '0.75rem 0.75rem 0 0.75rem'
                    : '0 0.75rem 0.75rem 0.75rem',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  backgroundColor: isUser
                    ? COLORS.slainteBlue
                    : isError
                      ? `${COLORS.expenseColor}10`
                      : COLORS.backgroundGray,
                  color: isUser ? COLORS.white : COLORS.darkGray,
                  border: isError ? `1px solid ${COLORS.expenseColor}30` : 'none'
                }}>
                  {/* Image attachment indicator */}
                  {isUser && message.image && (
                    <div style={{
                      fontSize: '0.75rem',
                      opacity: 0.8,
                      marginBottom: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <Image style={{ width: '0.75rem', height: '0.75rem' }} />
                      Screenshot attached
                    </div>
                  )}
                  {isUser ? message.content : renderContent(message.content)}
                </div>
              </div>
            );
          })}

          {/* Loading indicator */}
          {isLoading && (
            <div style={{
              display: 'flex',
              gap: '0.75rem'
            }}>
              <div style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '50%',
                backgroundColor: '#7C3AED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: COLORS.white,
                flexShrink: 0,
                marginTop: '0.25rem'
              }}>
                <Loader2 style={{ width: '0.875rem', height: '0.875rem', animation: 'spin 1s linear infinite' }} />
              </div>
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '0 0.75rem 0.75rem 0.75rem',
                backgroundColor: COLORS.backgroundGray,
                fontSize: '0.875rem',
                color: COLORS.mediumGray,
                fontStyle: 'italic'
              }}>
                Dara is thinking...
              </div>
            </div>
          )}

          {/* Input area — inline, same width as messages */}
          <div style={{ marginTop: '0.5rem' }}>
            {/* Image Preview */}
            {pendingImage && (
              <div style={{
                padding: '0.5rem 0.75rem',
                marginBottom: '0.5rem',
                backgroundColor: COLORS.backgroundGray,
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '0.375rem',
                  overflow: 'hidden',
                  border: `1px solid ${COLORS.lightGray}`,
                  flexShrink: 0
                }}>
                  <img
                    src={`data:${pendingImage.mimeType};base64,${pendingImage.base64}`}
                    alt="Screenshot preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <span style={{ fontSize: '0.8125rem', color: COLORS.mediumGray, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pendingImage.name}
                </span>
                <button
                  onClick={() => setPendingImage(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0.25rem',
                    cursor: 'pointer',
                    color: COLORS.mediumGray,
                    display: 'flex'
                  }}
                >
                  <X style={{ width: '1rem', height: '1rem' }} />
                </button>
              </div>
            )}

            {/* Privacy reminder */}
            <div style={{
              fontSize: '0.6875rem',
              color: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              marginBottom: '0.5rem'
            }}>
              <AlertTriangle style={{ width: '0.75rem', height: '0.75rem' }} />
              Do not share patient-identifiable information in messages or screenshots
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '0.5rem'
            }}>
              {/* Image upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Upload screenshot"
                style={{
                  background: 'none',
                  border: `1px solid ${COLORS.lightGray}`,
                  borderRadius: '0.5rem',
                  padding: '0.625rem',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: pendingImage ? '#7C3AED' : COLORS.mediumGray,
                  opacity: isLoading ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) e.currentTarget.style.backgroundColor = COLORS.backgroundGray;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Image style={{ width: '1.125rem', height: '1.125rem' }} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />

              {/* Text input */}
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={`Ask Dara about ${ehrName}...`}
                disabled={isLoading}
                rows={1}
                style={{
                  flex: 1,
                  padding: '0.625rem 0.875rem',
                  borderRadius: '0.5rem',
                  border: `1px solid ${COLORS.lightGray}`,
                  fontSize: '0.875rem',
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  minHeight: '2.5rem',
                  maxHeight: '6rem',
                  overflow: 'auto',
                  backgroundColor: COLORS.white,
                  color: COLORS.darkGray
                }}
                onFocus={(e) => e.target.style.borderColor = '#7C3AED'}
                onBlur={(e) => e.target.style.borderColor = COLORS.lightGray}
              />

              {/* Send button */}
              <button
                onClick={() => handleSend()}
                disabled={isLoading || (!inputValue.trim() && !pendingImage)}
                style={{
                  backgroundColor: '#7C3AED',
                  color: COLORS.white,
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.625rem',
                  cursor: (isLoading || (!inputValue.trim() && !pendingImage)) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: (isLoading || (!inputValue.trim() && !pendingImage)) ? 0.5 : 1
                }}
              >
              {isLoading
                ? <Loader2 style={{ width: '1.125rem', height: '1.125rem', animation: 'spin 1s linear infinite' }} />
                : <Send style={{ width: '1.125rem', height: '1.125rem' }} />
              }
              </button>
            </div>
          </div>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* PII Warning Modal */}
      {showPiiWarning && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '2rem'
        }}>
          <div style={{
            backgroundColor: COLORS.white,
            borderRadius: '12px',
            padding: '1.5rem',
            maxWidth: '450px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <AlertTriangle style={{ width: '1.5rem', height: '1.5rem', color: '#F59E0B' }} />
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: COLORS.darkGray }}>
                Patient Data Warning
              </h3>
            </div>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: COLORS.darkGray, marginBottom: '0.75rem' }}>
              Before uploading a screenshot, please ensure it does <strong>not contain any patient-identifiable information</strong> such as:
            </p>
            <ul style={{ fontSize: '0.875rem', lineHeight: 1.8, color: COLORS.darkGray, paddingLeft: '1.25rem', marginBottom: '1rem' }}>
              <li>Patient names, dates of birth, or PPS numbers</li>
              <li>Addresses, phone numbers, or email addresses</li>
              <li>Medical record numbers or health information</li>
            </ul>
            <p style={{ fontSize: '0.8125rem', color: COLORS.mediumGray, marginBottom: '1.25rem' }}>
              If your screenshot contains patient data, please crop or redact it before uploading.
              Dara will also flag any patient data it detects.
            </p>
            <button
              onClick={acknowledgePiiWarning}
              style={{
                width: '100%',
                padding: '0.625rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: '#7C3AED',
                color: COLORS.white,
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              I understand — continue
            </button>
          </div>
        </div>
      )}

      {/* CSS animation for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DaraSupport;
