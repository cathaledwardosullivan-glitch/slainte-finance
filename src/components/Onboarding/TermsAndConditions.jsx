import React, { useState, useEffect, useRef } from 'react';
import { User, MessageCircle, FileText, CheckCircle, ArrowRight, X, Shield } from 'lucide-react';
import COLORS from '../../utils/colors';
import { CURRENT_VERSION, TERMS_SUMMARY, FULL_TERMS } from '../../data/termsAndConditions';

// Instant text display (typing animation disabled)
const useTypingEffect = (text) => {
  return { displayedText: text || '', isComplete: true };
};

export default function TermsAndConditions({ onAccept, onDecline }) {
  const scrollContainerRef = useRef(null);

  // State
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);

  // Animation states
  const [isReady, setIsReady] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showTermsPanel, setShowTermsPanel] = useState(false);

  // Messages
  const greetingText = "Welcome to Sláinte Finance! Before we get started, please review our Terms of Service.";

  const { displayedText: greeting, isComplete: greetingComplete } = useTypingEffect(showGreeting ? greetingText : '', 25);

  // Animation sequence
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => setShowGreeting(true), 200);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  useEffect(() => {
    if (greetingComplete) {
      const timer = setTimeout(() => setShowSummary(true), 300);
      return () => clearTimeout(timer);
    }
  }, [greetingComplete]);

  useEffect(() => {
    if (showSummary) {
      const timer = setTimeout(() => setShowTermsPanel(true), 500);
      return () => clearTimeout(timer);
    }
  }, [showSummary]);

  // Handle scroll tracking
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Consider scrolled to end if within 50px of bottom
    if (scrollHeight - scrollTop - clientHeight < 50) {
      setHasScrolledToEnd(true);
    }
  };

  // Handle accept
  const handleAccept = () => {
    if (hasScrolledToEnd && hasAgreed) {
      onAccept({
        version: CURRENT_VERSION,
        acceptedAt: new Date().toISOString(),
        scrolledToEnd: true
      });
    }
  };

  // Handle decline
  const handleDecline = () => {
    setShowDeclineConfirm(true);
  };

  const confirmDecline = () => {
    if (onDecline) {
      onDecline();
    } else if (window.electronAPI?.close) {
      window.electronAPI.close();
    } else {
      window.close();
    }
  };

  const canAccept = hasScrolledToEnd && hasAgreed;

  if (!isReady) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Shield style={{ width: '32px', height: '32px', color: COLORS.slainteBlue, margin: '0 auto 1rem' }} />
        <p style={{ color: COLORS.textSecondary }}>Loading Terms of Service...</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      gap: '2rem',
      alignItems: 'flex-start',
      maxWidth: '1600px',
      margin: '0 auto',
      height: 'min(80vh, 750px)'
    }}>
      {/* Left side - Finn Chat Box (summary) */}
      <div style={{
        flex: '1 1 55%',
        minWidth: '450px',
        maxWidth: '700px',
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
          {/* Greeting Message */}
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

          {/* Summary Points */}
          {showSummary && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: COLORS.bgPage,
                padding: '1rem',
                borderRadius: '12px',
                maxWidth: '90%'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: COLORS.textPrimary,
                  marginBottom: '0.75rem'
                }}>
                  Here's a summary of the key points:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {TERMS_SUMMARY.map((item, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'flex-start'
                    }}>
                      <CheckCircle style={{
                        width: '16px',
                        height: '16px',
                        color: COLORS.incomeColor,
                        flexShrink: 0,
                        marginTop: '2px'
                      }} />
                      <div>
                        <div style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: COLORS.textPrimary
                        }}>
                          {item.title}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: COLORS.textSecondary,
                          lineHeight: 1.4
                        }}>
                          {item.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Scroll prompt */}
          {showTermsPanel && !hasScrolledToEnd && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.highlightYellow}30`,
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.highlightYellow}`
              }}>
                <div style={{
                  fontSize: '0.8125rem',
                  color: COLORS.textPrimary
                }}>
                  Please scroll through the full terms on the right to continue.
                </div>
              </div>
            </div>
          )}

          {/* Ready to accept message */}
          {hasScrolledToEnd && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.incomeColor}15`,
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.incomeColor}`
              }}>
                <div style={{
                  fontSize: '0.8125rem',
                  color: COLORS.textPrimary
                }}>
                  {hasAgreed
                    ? "You're all set. Click 'Accept & Continue' to proceed with setup."
                    : "Check the box below to confirm you agree, then click 'Accept & Continue'."}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Area at bottom of chat */}
        <div style={{
          padding: '1rem',
          borderTop: `1px solid ${COLORS.borderLight}`,
          backgroundColor: COLORS.white,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          {/* Checkbox */}
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            cursor: hasScrolledToEnd ? 'pointer' : 'not-allowed',
            opacity: hasScrolledToEnd ? 1 : 0.5,
            padding: '0.5rem',
            borderRadius: '8px',
            backgroundColor: hasAgreed ? `${COLORS.incomeColor}10` : 'transparent',
            border: hasAgreed ? `1px solid ${COLORS.incomeColor}40` : '1px solid transparent',
            transition: 'all 0.2s'
          }}>
            <input
              type="checkbox"
              checked={hasAgreed}
              onChange={(e) => hasScrolledToEnd && setHasAgreed(e.target.checked)}
              disabled={!hasScrolledToEnd}
              style={{
                width: '18px',
                height: '18px',
                cursor: hasScrolledToEnd ? 'pointer' : 'not-allowed',
                accentColor: COLORS.slainteBlue,
                marginTop: '2px'
              }}
            />
            <span style={{
              fontSize: '0.875rem',
              color: COLORS.textPrimary,
              lineHeight: 1.4
            }}>
              I have read and agree to the Terms of Service and Privacy Policy
            </span>
          </label>

          {/* Accept Button */}
          <button
            onClick={handleAccept}
            disabled={!canAccept}
            style={{
              width: '100%',
              padding: '0.875rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.white,
              backgroundColor: canAccept ? COLORS.incomeColor : COLORS.borderLight,
              border: 'none',
              borderRadius: '8px',
              cursor: canAccept ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'background-color 0.2s'
            }}
          >
            Accept & Continue
            <ArrowRight style={{ width: '18px', height: '18px' }} />
          </button>

          {/* Decline link */}
          <button
            onClick={handleDecline}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.textSecondary,
              fontSize: '0.75rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '0.25rem'
            }}
          >
            I do not agree
          </button>
        </div>
      </div>

      {/* Right side - Full Terms */}
      <div style={{
        flex: '1 1 45%',
        minWidth: '400px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        opacity: showTermsPanel ? 1 : 0.3,
        transition: 'opacity 0.5s ease-out'
      }}>
        {/* Terms Card */}
        <div style={{
          backgroundColor: COLORS.white,
          border: `2px solid ${COLORS.borderLight}`,
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem 1.5rem',
            borderBottom: `1px solid ${COLORS.borderLight}`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: COLORS.bgPage
          }}>
            <FileText style={{ width: '24px', height: '24px', color: COLORS.slainteBlue }} />
            <div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: COLORS.textPrimary,
                margin: 0
              }}>
                Terms of Service
              </h3>
              <p style={{
                fontSize: '0.75rem',
                color: COLORS.textSecondary,
                margin: 0
              }}>
                Version {CURRENT_VERSION}
              </p>
            </div>
          </div>

          {/* Scrollable Terms Content */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              fontSize: '0.8125rem',
              lineHeight: 1.7,
              color: COLORS.textPrimary,
              whiteSpace: 'pre-wrap',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            {FULL_TERMS}
          </div>

          {/* Scroll indicator */}
          <div style={{
            padding: '0.75rem 1.5rem',
            borderTop: `1px solid ${COLORS.borderLight}`,
            backgroundColor: hasScrolledToEnd ? `${COLORS.incomeColor}10` : COLORS.bgPage,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'background-color 0.3s'
          }}>
            {hasScrolledToEnd ? (
              <>
                <CheckCircle style={{ width: '16px', height: '16px', color: COLORS.incomeColor }} />
                <span style={{ fontSize: '0.75rem', color: COLORS.incomeColor, fontWeight: 500 }}>
                  You've read the full terms
                </span>
              </>
            ) : (
              <span style={{ fontSize: '0.75rem', color: COLORS.textSecondary }}>
                Scroll down to read all terms
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Decline Confirmation Modal */}
      {showDeclineConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: COLORS.overlayDark,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: COLORS.white,
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '400px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: `${COLORS.expenseColor}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <X style={{ width: '20px', height: '20px', color: COLORS.expenseColor }} />
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: COLORS.textPrimary,
                margin: 0
              }}>
                Cannot Continue Without Agreement
              </h3>
            </div>

            <p style={{
              fontSize: '0.875rem',
              color: COLORS.textSecondary,
              lineHeight: 1.6,
              marginBottom: '1.5rem'
            }}>
              Sláinte Finance requires acceptance of the Terms of Service to function.
              If you do not agree, the application will close.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowDeclineConfirm(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: COLORS.textPrimary,
                  backgroundColor: COLORS.bgPage,
                  border: `1px solid ${COLORS.borderLight}`,
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Go Back
              </button>
              <button
                onClick={confirmDecline}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: COLORS.white,
                  backgroundColor: COLORS.expenseColor,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Exit App
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
