import React, { useState, useEffect } from 'react';
import { useFinn } from '../../context/FinnContext';
import { useTour } from '../Tour';
import { callClaude } from '../../utils/claudeAPI';
import {
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  HelpCircle,
  Send
} from 'lucide-react';
import COLORS from '../../utils/colors';

/**
 * FinnTourMode - Finn's appearance during app tour
 * Ported from FloatingFinancialChat.jsx tour mode
 */
const FinnTourMode = () => {
  const { apiKey } = useFinn();
  const {
    currentStep,
    totalSteps,
    currentStepData,
    nextStep,
    prevStep,
    skipTour,
    isFirstStep,
    isLastStep,
    isTransitioning
  } = useTour();

  const [isExpanded, setIsExpanded] = useState(true);
  const [showQuestion, setShowQuestion] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isQALoading, setIsQALoading] = useState(false);

  // Reset Q&A state when step changes
  useEffect(() => {
    setShowQuestion(false);
    setQuestion('');
    setAnswer('');
  }, [currentStep]);

  // Handle tour Q&A
  const handleQuestion = async () => {
    if (!question.trim() || isQALoading) return;

    if (!apiKey) {
      setAnswer("I'd love to answer, but I need an API key set up first. You can configure this in Admin Settings after the tour.");
      return;
    }

    setIsQALoading(true);
    setAnswer('');

    try {
      const prompt = `You are Finn, a friendly financial advisor for Sláinte Finance app. The user is currently on a tour of the app and is viewing the "${currentStepData?.title || 'feature tour'}" step.

The feature being shown is: ${currentStepData?.content || 'general app overview'}

The user has a follow-up question: "${question}"

Provide a helpful, concise answer (2-3 sentences max) that addresses their question in the context of this feature. Be friendly and encouraging. If the question is unrelated to the current feature, briefly acknowledge it and suggest they explore after the tour.`;

      const response = await callClaude(prompt, {
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 300,
        apiKey: apiKey,
      });

      if (response.success) {
        setAnswer(response.content);
      } else {
        setAnswer("I'm having trouble connecting right now. Feel free to ask me again after the tour!");
      }
    } catch (error) {
      console.error('Tour Q&A error:', error);
      setAnswer("Something went wrong. Don't worry - you can always ask me questions after the tour!");
    } finally {
      setIsQALoading(false);
    }
  };

  if (!currentStepData) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '4.25rem',
        left: '1.5rem',
        width: '320px',
        backgroundColor: COLORS.white,
        borderRadius: '0.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: `1px solid ${COLORS.lightGray}`,
        zIndex: 10003, // Above tour overlay
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      }}
      data-tour-id="finn-button"
    >
      {/* Header - clickable to expand/collapse */}
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
            backgroundColor: COLORS.slainteBlueDark || '#3D7BC7',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MessageCircle size={16} color={COLORS.white} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '600', fontSize: '0.875rem', color: COLORS.white }}>
            Finn
          </div>
          <div style={{ fontSize: '0.75rem', color: COLORS.white, opacity: 0.9 }}>
            Step {currentStep + 1} of {totalSteps}
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown size={20} color={COLORS.white} style={{ opacity: 0.8 }} />
        ) : (
          <ChevronUp size={20} color={COLORS.white} style={{ opacity: 0.8 }} />
        )}
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <>
          {/* Finn's narration message */}
          <div
            style={{
              padding: '1rem',
              fontSize: '0.875rem',
              lineHeight: '1.6',
              color: COLORS.darkGray,
              maxHeight: '180px',
              overflowY: 'auto',
            }}
          >
            {currentStepData.caraText}
          </div>

          {/* Q&A Section */}
          {currentStepData.allowQuestions && (
            <div
              style={{
                padding: '0 1rem 0.75rem',
                borderTop: `1px solid ${COLORS.lightGray}`,
                paddingTop: '0.75rem',
              }}
            >
              {!showQuestion && !answer ? (
                <button
                  onClick={() => setShowQuestion(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: `${COLORS.slainteBlue}10`,
                    border: `1px solid ${COLORS.slainteBlue}30`,
                    borderRadius: '0.5rem',
                    color: COLORS.slainteBlue,
                    fontSize: '0.8125rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    width: '100%',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = `${COLORS.slainteBlue}20`}
                  onMouseLeave={(e) => e.target.style.backgroundColor = `${COLORS.slainteBlue}10`}
                >
                  <HelpCircle size={16} />
                  Have a question about this?
                </button>
              ) : (
                <div>
                  {/* Question input */}
                  {showQuestion && !answer && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleQuestion()}
                        placeholder="Ask about this feature..."
                        disabled={isQALoading}
                        style={{
                          flex: 1,
                          padding: '0.625rem 0.75rem',
                          border: `1px solid ${COLORS.lightGray}`,
                          borderRadius: '0.5rem',
                          fontSize: '0.8125rem',
                          outline: 'none',
                          backgroundColor: isQALoading ? COLORS.backgroundGray : COLORS.white,
                        }}
                      />
                      <button
                        onClick={handleQuestion}
                        disabled={isQALoading || !question.trim()}
                        style={{
                          padding: '0.625rem 0.875rem',
                          backgroundColor: isQALoading || !question.trim() ? COLORS.lightGray : COLORS.slainteBlue,
                          border: 'none',
                          borderRadius: '0.5rem',
                          color: COLORS.white,
                          cursor: isQALoading || !question.trim() ? 'not-allowed' : 'pointer',
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
                  {isQALoading && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        backgroundColor: COLORS.backgroundGray,
                        borderRadius: '0.5rem',
                        fontSize: '0.8125rem',
                        color: COLORS.mediumGray,
                        textAlign: 'center',
                      }}
                    >
                      Finn is thinking...
                    </div>
                  )}

                  {/* Answer display */}
                  {answer && (
                    <div
                      style={{
                        marginTop: showQuestion ? '0.75rem' : 0,
                        padding: '0.75rem',
                        backgroundColor: `${COLORS.incomeColor}15`,
                        borderRadius: '0.5rem',
                        fontSize: '0.8125rem',
                        lineHeight: '1.5',
                        color: COLORS.darkGray,
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
                        setShowQuestion(true);
                      }}
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.375rem 0.75rem',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: COLORS.slainteBlue,
                        fontSize: '0.75rem',
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

          {/* Navigation Controls */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderTop: `1px solid ${COLORS.lightGray}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: COLORS.backgroundGray,
            }}
          >
            {/* Skip button */}
            <button
              onClick={skipTour}
              disabled={isTransitioning}
              style={{
                padding: '0.375rem 0.75rem',
                backgroundColor: 'transparent',
                border: 'none',
                color: COLORS.mediumGray,
                fontSize: '0.8125rem',
                cursor: isTransitioning ? 'not-allowed' : 'pointer',
                opacity: isTransitioning ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <X size={14} />
              Skip
            </button>

            {/* Prev/Next buttons */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={prevStep}
                disabled={isFirstStep || isTransitioning}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2rem',
                  height: '2rem',
                  backgroundColor: isFirstStep ? COLORS.backgroundGray : COLORS.white,
                  border: `1px solid ${isFirstStep ? COLORS.lightGray : COLORS.slainteBlue}`,
                  borderRadius: '50%',
                  color: isFirstStep ? COLORS.lightGray : COLORS.slainteBlue,
                  cursor: isFirstStep || isTransitioning ? 'not-allowed' : 'pointer',
                  opacity: isTransitioning ? 0.5 : 1,
                }}
              >
                <ChevronLeft size={18} />
              </button>

              <button
                onClick={nextStep}
                disabled={isTransitioning}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: isLastStep ? '0.5rem 1rem' : '0.5rem 0.75rem',
                  backgroundColor: isLastStep ? COLORS.incomeColor : COLORS.slainteBlue,
                  border: 'none',
                  borderRadius: '1rem',
                  color: COLORS.white,
                  fontSize: '0.8125rem',
                  fontWeight: '600',
                  cursor: isTransitioning ? 'not-allowed' : 'pointer',
                  opacity: isTransitioning ? 0.5 : 1,
                }}
              >
                {isLastStep ? (
                  <>
                    <Check size={16} />
                    Finish
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FinnTourMode;
