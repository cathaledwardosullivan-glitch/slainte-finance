import React, { useState, useEffect } from 'react';
import { Globe, AlertCircle, ArrowRight, ArrowLeft, SkipForward, User, MessageCircle } from 'lucide-react';
import COLORS from '../../utils/colors';
import { isValidUrl } from '../../utils/websiteAnalyzer';

/**
 * WebsiteAnalysis - Non-blocking website URL entry during onboarding
 *
 * User enters their website URL and clicks "Continue". The actual analysis
 * runs in the background (fired by the parent UnifiedOnboarding component)
 * while the user continues with the next onboarding steps.
 */

// Instant text display (typing animation disabled)
const useTypingEffect = (text) => {
  return { displayedText: text || '', isComplete: true };
};

export default function WebsiteAnalysis({ onComplete, onSkip, onBack }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const [showGreeting, setShowGreeting] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  const greetingText = "Let's find your practice!";
  const messageText = "If you have a website, enter it below. I'll analyse it in the background while you continue setting up — no waiting around!";

  const { displayedText: greeting, isComplete: greetingComplete } = useTypingEffect(showGreeting ? greetingText : '', 25);
  const { displayedText: message, isComplete: messageComplete } = useTypingEffect(showMessage ? messageText : '', 15);

  // Start animation sequence on mount
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

  const handleContinue = () => {
    if (!url.trim()) {
      setError('Please enter your practice website URL');
      return;
    }

    if (!isValidUrl(url)) {
      setError('Please enter a valid website URL');
      return;
    }

    // Pass URL to parent — parent handles background analysis
    onComplete({ url: url.trim() });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleContinue();
    }
  };

  return (
    <div style={{
      display: 'flex',
      gap: '3rem',
      alignItems: 'stretch',
      maxWidth: '1600px',
      margin: '0 auto',
      minHeight: 'min(65vh, 600px)'
    }}>
      {/* Left side - Finn Chat Box */}
      <div style={{
        flex: '1 1 45%',
        minWidth: '450px',
        maxWidth: '600px',
        backgroundColor: COLORS.white,
        borderRadius: '0.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: `1px solid ${COLORS.lightGray}`,
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
          gap: '1.25rem'
        }}>
          {/* Greeting Message */}
          {showGreeting && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: COLORS.backgroundGray,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <MessageCircle style={{ width: '16px', height: '16px', color: COLORS.slainteBlue }} />
              </div>
              <div style={{
                backgroundColor: COLORS.backgroundGray,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%'
              }}>
                <div style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: COLORS.darkGray
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
                backgroundColor: COLORS.backgroundGray,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%'
              }}>
                <div style={{
                  fontSize: '0.9375rem',
                  color: COLORS.darkGray,
                  lineHeight: 1.5
                }}>
                  {message}
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.expenseColor}10`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.expenseColor}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: COLORS.expenseColor,
                  fontSize: '0.875rem'
                }}>
                  <AlertCircle style={{ width: '16px', height: '16px' }} />
                  {error}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right side - URL Input Card */}
      <div style={{
        flex: '1 1 55%',
        minWidth: '400px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        opacity: messageComplete ? 1 : 0.3,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: messageComplete ? 'auto' : 'none',
        justifyContent: 'center'
      }}>
        {/* URL Input Card */}
        <div style={{
          backgroundColor: COLORS.white,
          border: `3px solid ${COLORS.slainteBlue}`,
          borderRadius: '16px',
          padding: '2rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: `${COLORS.slainteBlue}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Globe style={{ width: '24px', height: '24px', color: COLORS.slainteBlue }} />
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: COLORS.darkGray,
                marginBottom: '0.5rem'
              }}>
                Enter Your Website
              </h3>

              <p style={{
                fontSize: '1rem',
                color: COLORS.mediumGray,
                marginBottom: '1.5rem',
                lineHeight: 1.6
              }}>
                Enter your practice website URL and I'll extract your practice details in the background.
              </p>

              {/* URL Input */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    type="text"
                    placeholder="e.g., glasnevinmedical.ie"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setError('');
                    }}
                    onKeyDown={handleKeyDown}
                    style={{
                      flex: 1,
                      padding: '0.875rem 1rem',
                      fontSize: '1rem',
                      border: `2px solid ${error ? COLORS.expenseColor : COLORS.lightGray}`,
                      borderRadius: '8px',
                      outline: 'none',
                      backgroundColor: COLORS.white
                    }}
                  />
                  <button
                    onClick={handleContinue}
                    disabled={!url.trim()}
                    style={{
                      padding: '0.875rem 1.5rem',
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: COLORS.white,
                      backgroundColor: COLORS.slainteBlue,
                      border: 'none',
                      borderRadius: '8px',
                      cursor: !url.trim() ? 'not-allowed' : 'pointer',
                      opacity: !url.trim() ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Continue
                    <ArrowRight style={{ width: '18px', height: '18px' }} />
                  </button>
                </div>
              </div>

              {/* Background note */}
              <p style={{
                fontSize: '0.8125rem',
                color: COLORS.mediumGray,
                fontStyle: 'italic',
                margin: 0
              }}>
                Your website will be analysed while you continue setup. Results will pre-fill your practice profile.
              </p>
            </div>
          </div>
        </div>

        {/* Skip option */}
        <div style={{
          textAlign: 'center',
          paddingTop: '1rem',
          borderTop: `1px solid ${COLORS.lightGray}`
        }}>
          <p style={{
            fontSize: '0.875rem',
            color: COLORS.mediumGray,
            marginBottom: '0.75rem'
          }}>
            Don't have a website?
          </p>
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
              border: `1px solid ${COLORS.lightGray}`,
              color: COLORS.mediumGray,
              backgroundColor: 'transparent',
              transition: 'all 0.2s'
            }}
          >
            <SkipForward style={{ width: '16px', height: '16px' }} />
            Skip - Enter Details Manually
          </button>
        </div>

        {/* Back button */}
        {onBack && (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: COLORS.mediumGray,
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft style={{ width: '16px', height: '16px' }} />
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
