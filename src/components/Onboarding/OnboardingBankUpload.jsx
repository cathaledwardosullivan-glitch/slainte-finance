import React, { useState, useEffect } from 'react';
import { User, MessageCircle, FileSpreadsheet, Building2, Loader, CheckCircle, ArrowLeft, SkipForward } from 'lucide-react';
import COLORS from '../../utils/colors';
import Papa from 'papaparse';
import { parseBankStatementPDF } from '../../utils/bankStatementParser';

/**
 * OnboardingBankUpload - Lightweight single bank statement upload during onboarding
 *
 * This component ONLY parses the file and returns raw transactions.
 * No wave processing, no categorization, no ProcessingFlowPanel.
 * The interactive categorization happens at a later step once the practice profile
 * (and therefore category mapping) is complete.
 */

// Instant text display (typing animation disabled)
const useTypingEffect = (text) => {
  return { displayedText: text || '', isComplete: true };
};

export default function OnboardingBankUpload({ onComplete, onSkip, onBack }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [error, setError] = useState('');

  // Finn messages
  const [showGreeting, setShowGreeting] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showTip, setShowTip] = useState(false);

  const greetingText = "Do you have a bank statement ready?";
  const messageText = "Upload one recent month's bank statement. I'll parse the transactions now and analyse them in detail once we've finished your practice profile.";
  const tipText = "Just one month is perfect for getting started. You can add more statements later.";

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

  // Handle file selection - parse only, no categorization
  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError('');
    setParseResult(null);

    try {
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const isCsv = file.name.toLowerCase().endsWith('.csv');

      if (!isPdf && !isCsv) {
        setError('Please upload a PDF or CSV bank statement');
        setIsProcessing(false);
        return;
      }

      let transactions = [];
      let bank = 'unknown';
      let fileType = isPdf ? 'pdf' : 'csv';

      if (isPdf) {
        const result = await parseBankStatementPDF(file);
        bank = result.bank || 'unknown';

        transactions = result.transactions.map((tx, index) => {
          const dateObj = tx.date instanceof Date ? tx.date : new Date(tx.date);
          const monthYear = !isNaN(dateObj.getTime())
            ? dateObj.toISOString().substring(0, 7)
            : null;

          return {
            id: `${file.name}-${index}-${Date.now()}`,
            date: dateObj,
            monthYear,
            details: tx.details || '',
            debit: tx.debit || 0,
            credit: tx.credit || 0,
            amount: Math.abs(tx.debit || tx.credit || tx.amount || 0),
            balance: tx.balance || 0,
            fileName: file.name,
            source: 'bank-pdf',
            bank
          };
        });
      } else {
        // CSV parsing
        await new Promise((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
              transactions = results.data.map((row, index) => {
                const dateValue = row.Date || row.date || row.TransactionDate || row['Transaction Date'];
                const details = row.Details || row.details || row.Description || row.description || row.Narrative || '';
                const debit = parseFloat(row.Debit || row.debit || row['Debit Amount'] || 0) || 0;
                const credit = parseFloat(row.Credit || row.credit || row['Credit Amount'] || 0) || 0;
                const balance = parseFloat(row.Balance || row.balance || 0) || 0;

                const dateObj = dateValue ? new Date(dateValue) : new Date();
                const monthYear = !isNaN(dateObj.getTime())
                  ? dateObj.toISOString().substring(0, 7)
                  : null;

                return {
                  id: `${file.name}-${index}-${Date.now()}`,
                  date: dateObj,
                  monthYear,
                  details,
                  debit: Math.abs(debit),
                  credit: Math.abs(credit),
                  amount: Math.abs(debit || credit),
                  balance,
                  fileName: file.name,
                  source: 'csv'
                };
              }).filter(t => t.details && (t.debit > 0 || t.credit > 0));

              resolve();
            },
            error: reject
          });
        });
        fileType = 'csv';
      }

      if (transactions.length === 0) {
        setError('No transactions found in this file. Please check the file format.');
        setIsProcessing(false);
        return;
      }

      setParseResult({ transactions, bank, fileType, fileName: file.name });
      setIsProcessing(false);
    } catch (err) {
      console.error('[OnboardingBankUpload] Error parsing file:', err);
      setError('Failed to parse file: ' + (err.message || 'Unknown error'));
      setIsProcessing(false);
    }
  };

  // Handle continue after successful parse
  const handleContinue = () => {
    if (parseResult) {
      onComplete(parseResult);
    }
  };

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
          {/* Greeting */}
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
                  color: COLORS.darkGray,
                  lineHeight: 1.5
                }}>
                  {tip}
                </div>
              </div>
            </div>
          )}

          {/* Processing message */}
          {isProcessing && (
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
                <div style={{ fontSize: '0.9375rem', color: COLORS.darkGray }}>
                  Reading your bank statement...
                </div>
              </div>
            </div>
          )}

          {/* Success message */}
          {parseResult && (
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
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: COLORS.darkGray }}>
                    Found {parseResult.transactions.length} transactions
                  </span>
                </div>
                <div style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>
                  {parseResult.bank !== 'unknown' && <span>Bank: {parseResult.bank.toUpperCase()} | </span>}
                  File: {parseResult.fileName}
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
                  fontSize: '0.875rem',
                  color: COLORS.expenseColor
                }}>
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
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: COLORS.darkGray,
            marginBottom: '0.5rem'
          }}>
            Upload Bank Statement
          </h3>
          <p style={{
            fontSize: '1rem',
            color: COLORS.mediumGray,
            marginBottom: '1.5rem'
          }}>
            Select one month's bank statement (PDF or CSV)
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
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: isProcessing ? 0.5 : 1
              }}
              onClick={() => {
                if (isProcessing) return;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf';
                input.onchange = handleFileSelect;
                input.click();
              }}
              onMouseEnter={(e) => {
                if (!isProcessing) e.currentTarget.style.backgroundColor = `${COLORS.incomeColor}10`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Building2 style={{ margin: '0 auto 0.75rem', height: '2.5rem', width: '2.5rem', color: COLORS.incomeColor }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.darkGray }}>Bank Statement PDF</h4>
              <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>
                BOI and AIB supported
              </p>
            </div>

            {/* CSV Column */}
            <div
              style={{
                border: `2px dashed ${COLORS.slainteBlue}`,
                borderRadius: '0.5rem',
                padding: '1.5rem',
                textAlign: 'center',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: isProcessing ? 0.5 : 1
              }}
              onClick={() => {
                if (isProcessing) return;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv';
                input.onchange = handleFileSelect;
                input.click();
              }}
              onMouseEnter={(e) => {
                if (!isProcessing) e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}10`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <FileSpreadsheet style={{ margin: '0 auto 0.75rem', height: '2.5rem', width: '2.5rem', color: COLORS.slainteBlue }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.darkGray }}>CSV Export</h4>
              <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>
                From online banking
              </p>
            </div>
          </div>

          {/* Processing indicator */}
          {isProcessing && (
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
              <p style={{ fontSize: '0.875rem', color: COLORS.darkGray, marginTop: '0.5rem' }}>
                Processing your file...
              </p>
            </div>
          )}

          {/* Continue button after successful parse */}
          {parseResult && (
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
              Continue with {parseResult.transactions.length} Transactions
            </button>
          )}
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
            Don't have a statement handy?
          </p>
          <button
            onClick={onSkip}
            disabled={isProcessing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
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

        {/* Back button */}
        {onBack && (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={onBack}
              disabled={isProcessing}
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
                cursor: isProcessing ? 'not-allowed' : 'pointer'
              }}
            >
              <ArrowLeft style={{ width: '16px', height: '16px' }} />
              Back
            </button>
          </div>
        )}
      </div>

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
