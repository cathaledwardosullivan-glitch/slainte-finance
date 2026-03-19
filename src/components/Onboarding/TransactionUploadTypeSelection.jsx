import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Tag, Database, User, MessageCircle, ArrowRight, SkipForward } from 'lucide-react';
import COLORS from '../../utils/colors';

// Instant text display (typing animation disabled)
const useTypingEffect = (text) => {
  return { displayedText: text || '', isComplete: true };
};

export default function TransactionUploadTypeSelection({ onSelectRaw, onSelectLabelled, onSelectBackup, onSkip }) {
  const [showGreeting, setShowGreeting] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const greetingText = "Now let's import your transaction data.";
  const messageText = "What type of data do you have? If you've been tracking your expenses in a spreadsheet with categories, I can learn from your existing labels!";

  const { displayedText: greeting, isComplete: greetingComplete } = useTypingEffect(showGreeting ? greetingText : '', 25);
  const { displayedText: message, isComplete: messageComplete } = useTypingEffect(showMessage ? messageText : '', 15);

  // Animation sequence
  useEffect(() => {
    const timer = setTimeout(() => setShowGreeting(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (greetingComplete) {
      const timer = setTimeout(() => setShowMessage(true), 200);
      return () => clearTimeout(timer);
    }
  }, [greetingComplete]);

  useEffect(() => {
    if (messageComplete) {
      const timer = setTimeout(() => setShowOptions(true), 300);
      return () => clearTimeout(timer);
    }
  }, [messageComplete]);

  const uploadOptions = [
    {
      id: 'labelled',
      icon: Tag,
      title: 'Pre-Labelled Transactions',
      description: 'I have transactions with my own category labels (from a spreadsheet or accounting software)',
      highlight: true,
      recommended: true,
      onClick: onSelectLabelled
    },
    {
      id: 'raw',
      icon: FileSpreadsheet,
      title: 'Bank Statements',
      description: 'I have bank statements (PDF or CSV) without any category labels',
      highlight: false,
      onClick: onSelectRaw
    },
    {
      id: 'backup',
      icon: Database,
      title: 'Sláinte Backup',
      description: 'I have a backup file from a previous Sláinte installation',
      highlight: false,
      onClick: onSelectBackup
    }
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '2rem',
      alignItems: 'flex-start',
      maxWidth: '1600px',
      margin: '0 auto',
      height: 'min(70vh, 650px)'
    }}>
      {/* Left side - Finn Chat Box */}
      <div style={{
        flex: '1 1 45%',
        minWidth: '450px',
        maxWidth: '600px',
        height: '100%',
        backgroundColor: COLORS.white,
        borderRadius: '0.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: `1px solid ${COLORS.borderLight}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Chat Header */}
        <div style={{
          backgroundColor: COLORS.slainteBlue,
          color: COLORS.white,
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '2.5rem',
            height: '2.5rem',
            backgroundColor: COLORS.slainteBlueDark,
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <User style={{ height: '1.25rem', width: '1.25rem' }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>Finn</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Sláinte Guide</div>
          </div>
        </div>

        {/* Chat Messages Area */}
        <div style={{
          padding: '1.5rem',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          overflowY: 'auto'
        }}>
          {/* Greeting */}
          {showGreeting && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: COLORS.bgPage,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <MessageCircle style={{ width: '16px', height: '16px', color: COLORS.slainteBlue }} />
              </div>
              <div style={{
                backgroundColor: COLORS.bgPage,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%'
              }}>
                <div style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: COLORS.textPrimary
                }}>
                  {greeting}
                </div>
              </div>
            </div>
          )}

          {/* Message */}
          {showMessage && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: COLORS.bgPage,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%'
              }}>
                <div style={{
                  fontSize: '0.9375rem',
                  color: COLORS.textPrimary,
                  lineHeight: 1.5
                }}>
                  {message}
                </div>
              </div>
            </div>
          )}

          {/* Tip about labelled data */}
          {showOptions && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.highlightYellow}15`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.highlightYellow}50`
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  color: COLORS.textPrimary,
                  lineHeight: 1.5
                }}>
                  <strong>Tip:</strong> If you've been using a spreadsheet or accounting software to track expenses, upload that data! I can learn from your existing categories and save you time.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Skip option */}
        <div style={{
          padding: '1rem',
          borderTop: `1px solid ${COLORS.borderLight}`,
          textAlign: 'center'
        }}>
          <button
            onClick={onSkip}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              border: `1px solid ${COLORS.borderLight}`,
              color: COLORS.textSecondary,
              backgroundColor: 'transparent'
            }}
          >
            <SkipForward style={{ width: '16px', height: '16px' }} />
            Skip Transaction Upload
          </button>
        </div>
      </div>

      {/* Right side - Upload Options */}
      <div style={{
        flex: '1 1 55%',
        minWidth: '500px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        opacity: showOptions ? 1 : 0.3,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: showOptions ? 'auto' : 'none',
        justifyContent: 'center'
      }}>
        <div style={{
          backgroundColor: COLORS.white,
          border: `3px solid ${COLORS.slainteBlue}`,
          borderRadius: '16px',
          padding: '2rem'
        }}>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: COLORS.textPrimary,
            marginBottom: '0.5rem'
          }}>
            Choose Upload Type
          </h3>
          <p style={{
            fontSize: '1rem',
            color: COLORS.textSecondary,
            marginBottom: '1.5rem'
          }}>
            Select the type of transaction data you have
          </p>

          {/* Upload options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {uploadOptions.map(option => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={option.onClick}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    padding: '1.25rem',
                    border: option.highlight
                      ? `3px solid ${COLORS.highlightYellow}`
                      : `2px solid ${COLORS.borderLight}`,
                    borderRadius: '12px',
                    backgroundColor: option.highlight ? `${COLORS.highlightYellow}08` : COLORS.white,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = option.highlight ? COLORS.highlightYellow : COLORS.slainteBlue;
                    e.currentTarget.style.backgroundColor = option.highlight ? `${COLORS.highlightYellow}15` : `${COLORS.slainteBlue}05`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = option.highlight ? COLORS.highlightYellow : COLORS.borderLight;
                    e.currentTarget.style.backgroundColor = option.highlight ? `${COLORS.highlightYellow}08` : COLORS.white;
                  }}
                >
                  {/* Recommended badge */}
                  {option.recommended && (
                    <div style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '16px',
                      backgroundColor: COLORS.highlightYellow,
                      color: COLORS.textPrimary,
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.625rem',
                      borderRadius: '9999px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Recommended
                    </div>
                  )}

                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: option.highlight ? COLORS.highlightYellow : `${COLORS.slainteBlue}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon style={{
                      width: '24px',
                      height: '24px',
                      color: option.highlight ? COLORS.textPrimary : COLORS.slainteBlue
                    }} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <h4 style={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: COLORS.textPrimary,
                      marginBottom: '0.25rem'
                    }}>
                      {option.title}
                    </h4>
                    <p style={{
                      fontSize: '0.875rem',
                      color: COLORS.textSecondary,
                      lineHeight: 1.5
                    }}>
                      {option.description}
                    </p>
                  </div>

                  <ArrowRight style={{
                    width: '20px',
                    height: '20px',
                    color: COLORS.borderLight,
                    alignSelf: 'center'
                  }} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
