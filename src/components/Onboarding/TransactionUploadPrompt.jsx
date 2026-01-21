import React, { useState, useEffect } from 'react';
import { Upload, SkipForward, CheckCircle, ArrowRight, User, MessageCircle, FileSpreadsheet } from 'lucide-react';
import COLORS from '../../utils/colors';

// Typing animation hook
const useTypingEffect = (text, speed = 30) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) return;

    let index = 0;
    setDisplayedText('');
    setIsComplete(false);

    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.substring(0, index + 1));
        index++;
      } else {
        setIsComplete(true);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayedText, isComplete };
};

export default function TransactionUploadPrompt({ onUpload, onSkip }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const [showGreeting, setShowGreeting] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const greetingText = "Great progress! Now let's import your data.";
  const messageText = "Upload your bank transactions and I'll help identify staff payments and categorize expenses automatically. This usually takes just 2-3 minutes.";

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

  useEffect(() => {
    if (messageComplete) {
      const timer = setTimeout(() => setShowSteps(true), 300);
      return () => clearTimeout(timer);
    }
  }, [messageComplete]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (selectedFile) => {
    const fileName = selectedFile.name.toLowerCase();
    const isValid = fileName.endsWith('.csv');

    if (isValid) {
      setFile(selectedFile);
    } else {
      alert('Please upload a CSV file');
    }
  };

  const handleUploadClick = () => {
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div style={{
      display: 'flex',
      gap: '2rem',
      alignItems: 'flex-start',
      maxWidth: '1600px',
      margin: '0 auto',
      height: 'min(70vh, 650px)'
    }}>
      {/* Left side - Cara Chat Box */}
      <div style={{
        flex: '1 1 45%',
        minWidth: '450px',
        maxWidth: '600px',
        height: '100%',
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
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>Cara</div>
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

          {/* Steps Message */}
          {showSteps && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: COLORS.backgroundGray,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: COLORS.darkGray,
                  marginBottom: '0.75rem'
                }}>
                  What happens next:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[
                    { step: '1', text: 'AI identifies staff payments' },
                    { step: '2', text: 'Suggest expense categories' },
                    { step: '3', text: 'You review and adjust' }
                  ].map(item => (
                    <div key={item.step} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: COLORS.slainteBlue,
                        color: COLORS.white,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        flexShrink: 0
                      }}>
                        {item.step}
                      </div>
                      <span style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* File selected message */}
          {file && (
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
                  color: COLORS.darkGray,
                  fontSize: '0.9375rem'
                }}>
                  <CheckCircle style={{ width: '18px', height: '18px', color: COLORS.incomeColor }} />
                  File ready: <strong>{file.name}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Upload Card */}
      <div style={{
        flex: '1 1 55%',
        minWidth: '400px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        opacity: messageComplete ? 1 : 0.3,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: messageComplete ? 'auto' : 'none',
        justifyContent: 'center'
      }}>
        {/* Upload Card */}
        <div style={{
          backgroundColor: COLORS.white,
          border: `3px solid ${COLORS.slainteBlue}`,
          borderRadius: '16px',
          padding: '2rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
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
              <FileSpreadsheet style={{ width: '24px', height: '24px', color: COLORS.slainteBlue }} />
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: COLORS.darkGray,
                marginBottom: '0.5rem'
              }}>
                Upload Transactions
              </h3>

              <p style={{
                fontSize: '1rem',
                color: COLORS.mediumGray,
                lineHeight: 1.6
              }}>
                Export a CSV file from your bank's online banking portal.
              </p>
            </div>
          </div>

          {/* Upload Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragActive ? COLORS.slainteBlue : file ? COLORS.incomeColor : COLORS.lightGray}`,
              borderRadius: '12px',
              padding: '2rem 1.5rem',
              textAlign: 'center',
              marginBottom: '1.5rem',
              backgroundColor: dragActive ? `${COLORS.slainteBlue}05` : file ? `${COLORS.incomeColor}05` : COLORS.backgroundGray,
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onClick={() => document.getElementById('file-upload').click()}
          >
            <input
              id="file-upload"
              type="file"
              accept=".csv"
              onChange={handleChange}
              style={{ display: 'none' }}
            />

            {!file ? (
              <>
                <Upload style={{ width: '40px', height: '40px', color: COLORS.mediumGray, margin: '0 auto 0.75rem' }} />
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: COLORS.darkGray,
                  marginBottom: '0.375rem'
                }}>
                  Drop your CSV file here
                </h3>
                <p style={{
                  fontSize: '0.875rem',
                  color: COLORS.mediumGray
                }}>
                  or click to browse
                </p>
              </>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem'
              }}>
                <CheckCircle style={{ width: '28px', height: '28px', color: COLORS.incomeColor }} />
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: COLORS.darkGray,
                    marginBottom: '0.125rem'
                  }}>
                    {file.name}
                  </h3>
                  <p style={{
                    fontSize: '0.8125rem',
                    color: COLORS.mediumGray
                  }}>
                    {(file.size / 1024).toFixed(1)} KB - Click to change
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Continue button */}
          <button
            onClick={handleUploadClick}
            disabled={!file}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.white,
              backgroundColor: file ? COLORS.incomeColor : COLORS.slainteBlue,
              border: 'none',
              borderRadius: '8px',
              cursor: file ? 'pointer' : 'not-allowed',
              opacity: file ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            {file ? 'Continue with This File' : 'Select a File to Continue'}
            <ArrowRight style={{ width: '20px', height: '20px' }} />
          </button>
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
            Don't have your transactions ready?
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
            Skip for Now
          </button>
        </div>
      </div>
    </div>
  );
}
