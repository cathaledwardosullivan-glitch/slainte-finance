import React, { useRef, useState, useEffect } from 'react';
import { Activity, SkipForward, ArrowRight, CheckCircle, Loader, User, MessageCircle, Upload, FileText, X } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { usePracticeProfile } from '../../hooks/usePracticeProfile';
import { parsePCRSPaymentPDF, validateExtractedData } from '../../utils/pdfParser';
import COLORS from '../../utils/colors';

// Instant text display (typing animation disabled)
const useTypingEffect = (text) => {
  return { displayedText: text || '', isComplete: true };
};

export default function GMSPanelUploadPrompt({ onUpload, onSkip }) {
  const fileInputRef = useRef(null);
  const { setPaymentAnalysisData } = useAppContext();
  const { profile } = usePracticeProfile();

  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // null, 'success', 'error', 'partial'
  const [errorMessage, setErrorMessage] = useState('');
  const [filesProcessed, setFilesProcessed] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // Animation states
  const [isReady, setIsReady] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showUploadArea, setShowUploadArea] = useState(false);

  // Get partner count from profile
  const partnerCount = profile?.gps?.partners?.length || 0;
  const partnerNames = profile?.gps?.partners?.map(p => p.name) || [];

  // Build greeting based on partner count
  const greetingText = "Nearly there! Upload your PCRS payment PDFs.";
  const messageText = partnerCount > 1
    ? `You have ${partnerCount} partners, so you'll likely have ${partnerCount} panels to upload. You can select multiple files at once.`
    : "Each GP partner has their own GMS panel. Select one or more PCRS payment PDFs to upload.";

  const { displayedText: greeting, isComplete: greetingComplete } = useTypingEffect(showGreeting ? greetingText : '', 25);
  const { displayedText: message, isComplete: messageComplete } = useTypingEffect(showMessage ? messageText : '', 15);

  // Animation sequence
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => setShowGreeting(true), 300);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  useEffect(() => {
    if (greetingComplete) {
      const timer = setTimeout(() => setShowMessage(true), 200);
      return () => clearTimeout(timer);
    }
  }, [greetingComplete]);

  useEffect(() => {
    if (messageComplete) {
      const timer = setTimeout(() => setShowUploadArea(true), 300);
      return () => clearTimeout(timer);
    }
  }, [messageComplete]);

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsProcessing(true);
    setUploadStatus(null);
    setErrorMessage('');
    setTotalFiles(files.length);
    setFilesProcessed(0);

    const errors = [];
    let successCount = 0;
    const newUploadedFiles = [];

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        if (file.type !== 'application/pdf') {
          errors.push(`${file.name}: Not a PDF file`);
          continue;
        }

        // Parse the PCRS PDF
        const extractedData = await parsePCRSPaymentPDF(file);
        extractedData.fileName = file.name;

        // Validate the extracted data
        const validationErrors = validateExtractedData(extractedData);
        if (validationErrors.length > 0) {
          errors.push(`${file.name}: ${validationErrors.join(', ')}`);
          continue;
        }

        // Add to payment analysis data
        setPaymentAnalysisData(prev => {
          // Check for duplicates (same doctor, same month)
          const existing = prev.findIndex(
            d => d.doctorNumber === extractedData.doctorNumber &&
              d.month === extractedData.month &&
              d.year === extractedData.year
          );

          if (existing >= 0) {
            // Replace existing data
            const updated = [...prev];
            updated[existing] = extractedData;
            return updated;
          } else {
            // Add new data
            return [...prev, extractedData];
          }
        });

        newUploadedFiles.push({
          name: file.name,
          doctorNumber: extractedData.doctorNumber,
          month: extractedData.month,
          year: extractedData.year
        });

        successCount++;
        setFilesProcessed(i + 1);

      } catch (error) {
        console.error(`[GMSPanelUploadPrompt] Error processing ${file.name}:`, error);
        errors.push(`${file.name}: ${error.message || 'Processing failed'}`);
        setFilesProcessed(i + 1);
      }
    }

    setUploadedFiles(prev => [...prev, ...newUploadedFiles]);

    // Show final status
    if (errors.length > 0 && successCount === 0) {
      setUploadStatus('error');
      setErrorMessage(errors.join('; '));
    } else if (errors.length > 0) {
      setUploadStatus('partial');
      setErrorMessage(`Successfully processed ${successCount} of ${files.length} files. Errors: ${errors.join('; ')}`);
    } else {
      setUploadStatus('success');
    }

    setIsProcessing(false);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const removeUploadedFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleContinue = () => {
    onUpload(null);
  };

  if (!isReady) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Loader style={{ width: '32px', height: '32px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ color: COLORS.mediumGray }}>Preparing GMS panel upload...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
      height: 'min(75vh, 700px)'
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
            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Slainte Guide</div>
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

          {/* Partner-aware message */}
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

          {/* Processing message */}
          {isProcessing && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.slainteBlue}10`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.slainteBlue}30`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: COLORS.darkGray,
                  fontSize: '0.9375rem'
                }}>
                  <Loader style={{ width: '18px', height: '18px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite' }} />
                  Processing file {filesProcessed} of {totalFiles}...
                </div>
              </div>
            </div>
          )}

          {/* Success message */}
          {uploadStatus === 'success' && (
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
                  {totalFiles > 1
                    ? `All ${totalFiles} files uploaded successfully!`
                    : 'File uploaded successfully!'}
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {uploadStatus === 'error' && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.expenseColor}15`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.expenseColor}`
              }}>
                <div style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>
                  {errorMessage}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Continue Button at bottom of chat */}
        <div style={{
          padding: '1rem',
          borderTop: `1px solid ${COLORS.lightGray}`,
          backgroundColor: COLORS.white
        }}>
          <button
            onClick={uploadedFiles.length > 0 ? handleContinue : onSkip}
            style={{
              width: '100%',
              padding: '0.875rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.white,
              backgroundColor: COLORS.slainteBlue,
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            {uploadedFiles.length > 0 ? 'Continue to Dashboard' : 'Skip for Now'}
            <ArrowRight style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
      </div>

      {/* Right side - Upload Area */}
      <div style={{
        flex: '1 1 55%',
        minWidth: '500px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        opacity: showUploadArea ? 1 : 0.3,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: showUploadArea ? 'auto' : 'none',
        overflowY: 'auto'
      }}>
        {/* Main Upload Card */}
        <div style={{
          backgroundColor: COLORS.white,
          border: `3px solid ${COLORS.slainteBlue}`,
          borderRadius: '16px',
          padding: '1.5rem',
          flexShrink: 0
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
              <Activity style={{ width: '24px', height: '24px', color: COLORS.slainteBlue }} />
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: COLORS.darkGray,
                marginBottom: '0.25rem'
              }}>
                GMS Panel Upload
              </h3>

              <p style={{
                fontSize: '0.875rem',
                color: COLORS.mediumGray,
                lineHeight: 1.5
              }}>
                {partnerCount > 0
                  ? `Upload PCRS payment PDFs for your ${partnerCount} panel${partnerCount > 1 ? 's' : ''}`
                  : 'Upload your PCRS payment PDFs'}
              </p>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {/* Upload Drop Zone */}
          <div
            onClick={handleUploadClick}
            style={{
              border: `2px dashed ${COLORS.lightGray}`,
              borderRadius: '12px',
              padding: '2rem',
              textAlign: 'center',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              backgroundColor: COLORS.backgroundGray,
              transition: 'all 0.2s',
              opacity: isProcessing ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.borderColor = COLORS.slainteBlue;
                e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}05`;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = COLORS.lightGray;
              e.currentTarget.style.backgroundColor = COLORS.backgroundGray;
            }}
          >
            {isProcessing ? (
              <>
                <Loader style={{ width: '32px', height: '32px', color: COLORS.slainteBlue, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: '1rem', fontWeight: 600, color: COLORS.darkGray, marginBottom: '0.25rem' }}>
                  Processing...
                </p>
                <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                  File {filesProcessed} of {totalFiles}
                </p>
              </>
            ) : (
              <>
                <Upload style={{ width: '32px', height: '32px', color: COLORS.slainteBlue, margin: '0 auto 0.75rem' }} />
                <p style={{ fontSize: '1rem', fontWeight: 600, color: COLORS.darkGray, marginBottom: '0.25rem' }}>
                  Click to upload PCRS PDFs
                </p>
                <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                  Select one or multiple PDF files
                </p>
              </>
            )}
          </div>

          {/* How to get data - collapsible info */}
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: `${COLORS.slainteBlue}08`,
            borderRadius: '8px',
            fontSize: '0.8125rem',
            color: COLORS.mediumGray
          }}>
            <strong style={{ color: COLORS.darkGray }}>How to get your PCRS PDFs:</strong>
            <ol style={{ marginLeft: '1.25rem', marginTop: '0.5rem', lineHeight: 1.6 }}>
              <li>Log in to your PCRS portal</li>
              <li>Navigate to "Payment Reports"</li>
              <li>Download the monthly payment PDF(s)</li>
            </ol>
          </div>
        </div>

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div style={{
            backgroundColor: COLORS.white,
            border: `2px solid ${COLORS.lightGray}`,
            borderRadius: '16px',
            padding: '1.25rem',
            flex: 1,
            overflowY: 'auto'
          }}>
            <h4 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.darkGray,
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <CheckCircle style={{ width: '18px', height: '18px', color: COLORS.incomeColor }} />
              Uploaded Files ({uploadedFiles.length})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: `${COLORS.incomeColor}10`,
                    border: `1px solid ${COLORS.incomeColor}30`,
                    borderRadius: '8px'
                  }}
                >
                  <FileText style={{ width: '20px', height: '20px', color: COLORS.incomeColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: COLORS.darkGray,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {file.name}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>
                      Panel: {file.doctorNumber} | {file.month}/{file.year}
                    </p>
                  </div>
                  <button
                    onClick={() => removeUploadedFile(index)}
                    style={{
                      padding: '0.25rem',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: COLORS.mediumGray,
                      borderRadius: '4px'
                    }}
                  >
                    <X style={{ width: '16px', height: '16px' }} />
                  </button>
                </div>
              ))}
            </div>

            {/* Upload more button */}
            <button
              onClick={handleUploadClick}
              disabled={isProcessing}
              style={{
                width: '100%',
                marginTop: '1rem',
                padding: '0.75rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: COLORS.slainteBlue,
                backgroundColor: COLORS.white,
                border: `2px solid ${COLORS.slainteBlue}`,
                borderRadius: '8px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <Upload style={{ width: '16px', height: '16px' }} />
              Upload More Files
            </button>
          </div>
        )}

      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
