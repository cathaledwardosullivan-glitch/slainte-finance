import React, { useState, useRef, useEffect } from 'react';
import { useTour } from './TourProvider';
import { COLORS } from '../../utils/colors';
import { MessageCircle, Send, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { callClaude } from '../../utils/claudeAPI';
import { MODELS } from '../../data/modelConfig';

const TourCaraPanel = () => {
  const { currentStepData, isTransitioning } = useTour();
  const [showQuestionInput, setShowQuestionInput] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const inputRef = useRef(null);

  // Load API key on mount
  useEffect(() => {
    const loadApiKey = async () => {
      let savedKey = null;
      if (window.electronAPI?.isElectron) {
        savedKey = await window.electronAPI.getLocalStorage('claude_api_key');
      }
      if (!savedKey) {
        savedKey = localStorage.getItem('anthropic_api_key');
      }
      if (savedKey) {
        setApiKey(savedKey);
      }
    };
    loadApiKey();
  }, []);

  // Reset question state when step changes
  useEffect(() => {
    setShowQuestionInput(false);
    setQuestion('');
    setAnswer('');
  }, [currentStepData]);

  // Focus input when showing question field
  useEffect(() => {
    if (showQuestionInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showQuestionInput]);

  const handleAskQuestion = async () => {
    if (!question.trim() || isLoading) return;

    if (!apiKey) {
      setAnswer("I'd love to answer, but I need an API key set up first. You can configure this in the Admin Settings after the tour.");
      return;
    }

    setIsLoading(true);
    setAnswer('');

    try {
      const prompt = `You are Cara, a friendly guide for Sláinte Finance app. The user is currently on a tour of the app and is viewing the "${currentStepData?.title || 'feature tour'}" step.

The feature being shown is: ${currentStepData?.content || 'general app overview'}

The user has a follow-up question: "${question}"

Provide a helpful, concise answer (2-3 sentences max) that addresses their question in the context of this feature. Be friendly and encouraging. If the question is unrelated to the current feature, briefly acknowledge it and suggest they explore after the tour.`;

      const response = await callClaude(prompt, {
        model: MODELS.FAST,
        maxTokens: 300,
        apiKey: apiKey,
      });

      if (response.success) {
        setAnswer(response.content);
      } else {
        setAnswer("I'm having trouble connecting right now. Feel free to ask me again after the tour!");
      }
    } catch (error) {
      console.error('Tour Cara Q&A error:', error);
      setAnswer("Something went wrong. Don't worry - you can always ask me questions after the tour!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  };

  if (!currentStepData || isTransitioning) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '4.25rem',
        left: '1.5rem',
        width: '320px',
        backgroundColor: COLORS.white,
        borderRadius: '0.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: `1px solid ${COLORS.borderLight}`,
        zIndex: 10003,
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Header - matches live Cara styling */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '1rem',
          backgroundColor: COLORS.slainteBlue,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: '2rem',
            height: '2rem',
            backgroundColor: COLORS.slainteBlueDark,
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MessageCircle size={16} color={COLORS.white} />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontWeight: '600',
              fontSize: '0.875rem',
              color: COLORS.white,
            }}
          >
            Cara
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: COLORS.white,
              opacity: 0.9,
            }}
          >
            Your Sláinte Guide
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown size={20} color={COLORS.white} style={{ opacity: 0.8 }} />
        ) : (
          <ChevronUp size={20} color={COLORS.white} style={{ opacity: 0.8 }} />
        )}
      </div>

      {/* Content - collapsible */}
      {isExpanded && (
        <>
          {/* Cara's narration message */}
          <div
            style={{
              padding: '16px',
              fontSize: '14px',
              lineHeight: '1.6',
              color: COLORS.textPrimary,
              maxHeight: '150px',
              overflowY: 'auto',
            }}
          >
            {currentStepData.finnText || currentStepData.caraText}
          </div>

          {/* Q&A Section */}
          {currentStepData.allowQuestions && (
            <div
              style={{
                padding: '0 16px 16px',
                borderTop: `1px solid ${COLORS.borderLight}`,
                paddingTop: '12px',
              }}
            >
              {!showQuestionInput && !answer ? (
                <button
                  onClick={() => setShowQuestionInput(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    backgroundColor: `${COLORS.slainteBlue}10`,
                    border: `1px solid ${COLORS.slainteBlue}30`,
                    borderRadius: '8px',
                    color: COLORS.slainteBlue,
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    width: '100%',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = `${COLORS.slainteBlue}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = `${COLORS.slainteBlue}10`;
                  }}
                >
                  <HelpCircle size={16} />
                  Have a question about this?
                </button>
              ) : (
                <div>
                  {/* Question input */}
                  {showQuestionInput && !answer && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                      }}
                    >
                      <input
                        ref={inputRef}
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask about this feature..."
                        disabled={isLoading}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          border: `1px solid ${COLORS.borderLight}`,
                          borderRadius: '8px',
                          fontSize: '13px',
                          outline: 'none',
                          backgroundColor: isLoading ? COLORS.bgPage : COLORS.white,
                        }}
                      />
                      <button
                        onClick={handleAskQuestion}
                        disabled={isLoading || !question.trim()}
                        style={{
                          padding: '10px 14px',
                          backgroundColor: isLoading || !question.trim() ? COLORS.borderLight : COLORS.slainteBlue,
                          border: 'none',
                          borderRadius: '8px',
                          color: COLORS.white,
                          cursor: isLoading || !question.trim() ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  )}

                  {/* Loading indicator */}
                  {isLoading && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px',
                        backgroundColor: COLORS.bgPage,
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: COLORS.textSecondary,
                        textAlign: 'center',
                      }}
                    >
                      Cara is thinking...
                    </div>
                  )}

                  {/* Answer display */}
                  {answer && (
                    <div
                      style={{
                        marginTop: showQuestionInput ? '12px' : 0,
                        padding: '12px',
                        backgroundColor: `${COLORS.incomeColor}15`,
                        borderRadius: '8px',
                        fontSize: '13px',
                        lineHeight: '1.5',
                        color: COLORS.textPrimary,
                        borderLeft: `3px solid ${COLORS.incomeColor}`,
                      }}
                    >
                      {answer}
                    </div>
                  )}

                  {/* Ask another question */}
                  {answer && (
                    <button
                      onClick={() => {
                        setAnswer('');
                        setQuestion('');
                        setShowQuestionInput(true);
                      }}
                      style={{
                        marginTop: '8px',
                        padding: '6px 12px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: COLORS.slainteBlue,
                        fontSize: '12px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Ask another question
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TourCaraPanel;
