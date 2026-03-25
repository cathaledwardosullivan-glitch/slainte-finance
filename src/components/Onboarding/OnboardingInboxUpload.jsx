import React, { useState, useEffect, useCallback } from 'react';
import { User, MessageCircle, FileSpreadsheet, Building2, Loader, CheckCircle, SkipForward, Inbox } from 'lucide-react';
import COLORS from '../../utils/colors';

/**
 * OnboardingInboxUpload - Copies bank statement files to the Slainte Inbox
 *
 * Instead of parsing files in-browser, this component sends the raw file bytes
 * to the Electron main process via IPC, which writes them to userData/inbox/.
 * The background processor (chokidar watcher) picks them up automatically and
 * runs the full pipeline: parse → convergence → Opus Pass 1 → staging.
 *
 * After onboarding completes, Finn detects staged results and guides the user
 * through review via the StagedReviewPanel.
 */

// Instant text display (typing animation disabled)
const useTypingEffect = (text) => {
  return { displayedText: text || '', isComplete: true };
};

export default function OnboardingInboxUpload({ onComplete, onSkip, onBack }) {
  const [isCopying, setIsCopying] = useState(false);
  const [copiedFiles, setCopiedFiles] = useState([]);
  const [error, setError] = useState('');

  // Finn messages
  const [showGreeting, setShowGreeting] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showTip, setShowTip] = useState(false);

  const greetingText = "Do you have bank statements ready?";
  const messageText = "Drop your bank statements here. I'll process them in the background and guide you through review once setup is complete.";
  const tipText = "You can upload multiple files at once — several months is great for building an accurate picture.";

  const { displayedText: greeting, isComplete: greetingComplete } = useTypingEffect(showGreeting ? greetingText : '', 25);
  const { displayedText: message, isComplete: messageComplete } = useTypingEffect(showMessage ? messageText : '', 15);
  const { displayedText: tip, isComplete: tipComplete } = useTypingEffect(showTip ? tipText : '', 15);

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
      const timer = setTimeout(() => setShowTip(true), 300);
      return () => clearTimeout(timer);
    }
  }, [messageComplete]);

  // Read file as ArrayBuffer and copy to inbox via IPC
  const copyFileToInbox = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = await window.electronAPI.backgroundProcessor.copyToInbox(
            file.name,
            reader.result // ArrayBuffer
          );
          if (result.success) {
            resolve(result.fileName);
          } else {
            reject(new Error(result.error || 'Failed to copy file'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }, []);

  // Handle file selection — copy to inbox, no parsing
  const handleFileSelect = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate file types
    const valid = files.filter(f => {
      const ext = f.name.toLowerCase();
      return ext.endsWith('.pdf') || ext.endsWith('.csv');
    });

    if (valid.length === 0) {
      setError('Please upload PDF or CSV bank statements');
      return;
    }

    setIsCopying(true);
    setError('');

    try {
      const results = [];
      for (const file of valid) {
        const savedName = await copyFileToInbox(file);
        results.push(savedName);
      }

      setCopiedFiles(prev => [...prev, ...results]);
      console.log(`[OnboardingInboxUpload] ${results.length} file(s) copied to inbox:`, results);
    } catch (err) {
      console.error('[OnboardingInboxUpload] Error copying files:', err);
      setError('Failed to send files to inbox: ' + (err.message || 'Unknown error'));
    } finally {
      setIsCopying(false);
    }
  }, [copyFileToInbox]);

  // Handle continue after files are copied
  const handleContinue = useCallback(() => {
    onComplete({ filesCopied: copiedFiles.length });
  }, [onComplete, copiedFiles]);

  return (
    <div style={{
      display: 'flex',
      gap: '2rem',
      alignItems: 'stretch',
      maxWidth: '1600px',
      margin: '0 auto',
      minHeight: 'min(65vh, 600px)'
    }}>
      {/* Left side - Finn Chat Box */}
      <div style={{
        flex: '1 1 45%',
        minWidth: '400px',
        maxWidth: '550px',
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
          gap: '1.25rem'
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

          {/* Tip */}
          {showTip && (
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
                  {tip}
                </div>
              </div>
            </div>
          )}

          {/* Copying message */}
          {isCopying && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.slainteBlue}15`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <Loader style={{ width: '18px', height: '18px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite' }} />
                <div style={{ fontSize: '0.9375rem', color: COLORS.textPrimary }}>
                  Sending files to the Slainte Inbox...
                </div>
              </div>
            </div>
          )}

          {/* Success message */}
          {copiedFiles.length > 0 && !isCopying && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.incomeColor}15`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.incomeColor}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem'
                }}>
                  <CheckCircle style={{ width: '18px', height: '18px', color: COLORS.incomeColor }} />
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: COLORS.textPrimary }}>
                    {copiedFiles.length} file{copiedFiles.length !== 1 ? 's' : ''} ready for processing
                  </span>
                </div>
                <div style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>
                  {copiedFiles.map((f, i) => (
                    <div key={i}>{f}</div>
                  ))}
                </div>
                <div style={{ fontSize: '0.8125rem', color: COLORS.textSecondary, marginTop: '0.5rem', fontStyle: 'italic' }}>
                  I'll analyse these while you finish setup, then guide you through review.
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
                <div style={{ fontSize: '0.875rem', color: COLORS.expenseColor }}>
                  {error}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Upload Area */}
      <div style={{
        flex: '1 1 55%',
        minWidth: '400px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        opacity: tipComplete ? 1 : 0.3,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: tipComplete ? 'auto' : 'none',
        justifyContent: 'center'
      }}>
        {/* Upload Card */}
        <div style={{
          backgroundColor: COLORS.white,
          border: `3px solid ${COLORS.slainteBlue}`,
          borderRadius: '16px',
          padding: '2rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Inbox style={{ width: '1.5rem', height: '1.5rem', color: COLORS.slainteBlue }} />
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: COLORS.textPrimary,
              margin: 0
            }}>
              Upload Bank Statements
            </h3>
          </div>
          <p style={{
            fontSize: '1rem',
            color: COLORS.textSecondary,
            marginBottom: '1.5rem'
          }}>
            Select one or more bank statement files (multiple months welcome)
          </p>

          {/* File type columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* PDF Column */}
            <div
              style={{
                border: `2px dashed ${COLORS.incomeColor}`,
                borderRadius: '0.5rem',
                padding: '1.5rem',
                textAlign: 'center',
                cursor: isCopying ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: isCopying ? 0.5 : 1
              }}
              onClick={() => {
                if (isCopying) return;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf';
                input.multiple = true;
                input.onchange = handleFileSelect;
                input.click();
              }}
              onMouseEnter={(e) => {
                if (!isCopying) e.currentTarget.style.backgroundColor = `${COLORS.incomeColor}10`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Building2 style={{ margin: '0 auto 0.75rem', height: '2.5rem', width: '2.5rem', color: COLORS.incomeColor }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.textPrimary }}>Bank Statement PDFs</h4>
              <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary }}>
                Multiple files supported
              </p>
              <p style={{ fontSize: '0.6875rem', color: COLORS.textSecondary, marginTop: '0.5rem', fontStyle: 'italic' }}>
                Bank of Ireland supported
              </p>
            </div>

            {/* CSV Column */}
            <div
              style={{
                border: `2px dashed ${COLORS.slainteBlue}`,
                borderRadius: '0.5rem',
                padding: '1.5rem',
                textAlign: 'center',
                cursor: isCopying ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: isCopying ? 0.5 : 1
              }}
              onClick={() => {
                if (isCopying) return;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv';
                input.multiple = true;
                input.onchange = handleFileSelect;
                input.click();
              }}
              onMouseEnter={(e) => {
                if (!isCopying) e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}10`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <FileSpreadsheet style={{ margin: '0 auto 0.75rem', height: '2.5rem', width: '2.5rem', color: COLORS.slainteBlue }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.textPrimary }}>CSV Exports</h4>
              <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary }}>
                From online banking
              </p>
            </div>
          </div>

          {/* Copying indicator */}
          {isCopying && (
            <div style={{
              padding: '1rem',
              backgroundColor: `${COLORS.slainteBlue}15`,
              borderRadius: '0.5rem',
              textAlign: 'center',
              marginBottom: '1rem'
            }}>
              <div style={{
                animation: 'spin 1s linear infinite',
                borderRadius: '9999px',
                height: '2rem',
                width: '2rem',
                border: `2px solid ${COLORS.slainteBlue}`,
                borderTopColor: 'transparent',
                margin: '0 auto'
              }} />
              <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginTop: '0.5rem' }}>
                Sending to Slainte Inbox...
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Continue button after files are copied */}
          {copiedFiles.length > 0 && !isCopying && (
            <button
              onClick={handleContinue}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: COLORS.white,
                backgroundColor: COLORS.incomeColor,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <CheckCircle style={{ width: '20px', height: '20px' }} />
              Continue — {copiedFiles.length} File{copiedFiles.length !== 1 ? 's' : ''} Queued
            </button>
          )}
        </div>

        {/* Skip option */}
        <div style={{
          textAlign: 'center',
          paddingTop: '1rem',
          borderTop: `1px solid ${COLORS.borderLight}`
        }}>
          <p style={{
            fontSize: '0.875rem',
            color: COLORS.textSecondary,
            marginBottom: '0.75rem'
          }}>
            Don't have a statement handy?
          </p>
          <button
            onClick={onSkip}
            disabled={isCopying}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: isCopying ? 'not-allowed' : 'pointer',
              border: `1px solid ${COLORS.borderLight}`,
              color: COLORS.textSecondary,
              backgroundColor: 'transparent',
              transition: 'all 0.2s'
            }}
          >
            <SkipForward style={{ width: '16px', height: '16px' }} />
            Skip for Now
          </button>
        </div>
      </div>
    </div>
  );
}
