import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Play, Upload, User, MessageCircle, Wifi } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import COLORS from '../../utils/colors';

// Instant text display (typing animation disabled)
const useTypingEffect = (text) => {
  return { displayedText: text || '', isComplete: true };
};

export default function PathSelection({ onSelectSetup, onSelectDemo, onSelectQuickConnect }) {
  const {
    setTransactions,
    setUnidentifiedTransactions,
    setCategoryMapping,
    setPaymentAnalysisData
  } = useAppContext();

  const [showGreeting, setShowGreeting] = useState(false);
  const [showParagraph1, setShowParagraph1] = useState(false);
  const [showParagraph2, setShowParagraph2] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);

  const greetingText = "Hello! I'm Finn, your Sláinte.Finance guide";
  const paragraph1Text = "I'm here to help you set up your practice's financial management system, and I'll be with you every step of the way through the app. This setup will take about 5-7 minutes, and by the end, you'll have a personalized dashboard showing your practice's financial picture.";
  const paragraph2Text = "To give you the best experience, I'll need to learn a bit about your practice - particularly your team structure. You'll also have the option to upload your bank transactions and PCRS data.";
  const questionText = "How would you like to proceed?";

  const { displayedText: greeting, isComplete: greetingComplete } = useTypingEffect(showGreeting ? greetingText : '', 20);
  const { displayedText: para1, isComplete: para1Complete } = useTypingEffect(showParagraph1 ? paragraph1Text : '', 12);
  const { displayedText: para2, isComplete: para2Complete } = useTypingEffect(showParagraph2 ? paragraph2Text : '', 12);
  const { displayedText: question, isComplete: questionComplete } = useTypingEffect(showQuestion ? questionText : '', 20);

  // Start animation sequence on mount
  useEffect(() => {
    const timer = setTimeout(() => setShowGreeting(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Cascade animations
  useEffect(() => {
    if (greetingComplete) {
      const timer = setTimeout(() => setShowParagraph1(true), 200);
      return () => clearTimeout(timer);
    }
  }, [greetingComplete]);

  useEffect(() => {
    if (para1Complete) {
      const timer = setTimeout(() => setShowParagraph2(true), 300);
      return () => clearTimeout(timer);
    }
  }, [para1Complete]);

  useEffect(() => {
    if (para2Complete) {
      const timer = setTimeout(() => setShowQuestion(true), 400);
      return () => clearTimeout(timer);
    }
  }, [para2Complete]);

  return (
    <div style={{
      display: 'flex',
      gap: '3rem',
      alignItems: 'stretch',
      maxWidth: '1600px',
      margin: '0 auto',
      minHeight: 'min(65vh, 600px)'
    }}>
      {/* Left side - Finn Chat Box (styled like FloatingFinancialChat) */}
      <div style={{
        flex: '1 1 45%',
        minWidth: '450px',
        maxWidth: '600px',
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
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: COLORS.textPrimary,
                  marginBottom: '0.5rem'
                }}>
                  {greeting}
                </div>
              </div>
            </div>
          )}

          {/* Paragraph 1 Message */}
          {showParagraph1 && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} /> {/* Spacer for alignment */}
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
                  {para1}
                </div>
              </div>
            </div>
          )}

          {/* Paragraph 2 Message */}
          {showParagraph2 && (
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
                  {para2}
                </div>
              </div>
            </div>
          )}

          {/* Question Message */}
          {showQuestion && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: COLORS.bgPage,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%'
              }}>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: COLORS.textPrimary
                }}>
                  {question}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Option Cards */}
      <div style={{
        flex: '1 1 55%',
        minWidth: '400px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        opacity: questionComplete ? 1 : 0.3,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: questionComplete ? 'auto' : 'none',
        justifyContent: 'center'
      }}>
        {/* Card 1: Set Up My Practice */}
        <button
          onClick={onSelectSetup}
          style={{
            backgroundColor: COLORS.white,
            border: `3px solid ${COLORS.slainteBlue}`,
            borderRadius: '16px',
            padding: '2rem',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
            e.currentTarget.style.borderColor = COLORS.slainteBlueDark;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.borderColor = COLORS.slainteBlue;
          }}
        >
          {/* Primary Badge */}
          <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            backgroundColor: COLORS.slainteBlue,
            color: COLORS.white,
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            RECOMMENDED
          </div>

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
              <Sparkles style={{ width: '24px', height: '24px', color: COLORS.slainteBlue }} />
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: COLORS.textPrimary,
                marginBottom: '0.75rem'
              }}>
                Set Up My Practice
              </h3>

              <p style={{
                fontSize: '1rem',
                color: COLORS.textSecondary,
                marginBottom: '1.25rem',
                lineHeight: 1.6
              }}>
                I'll guide you through setting up your practice profile with a friendly conversation.
              </p>

              <div style={{
                fontSize: '0.875rem',
                color: COLORS.textSecondary,
                marginBottom: '1rem'
              }}>
                <span style={{ marginRight: '1.5rem' }}>⏱️ 5-7 minutes</span>
                <span>📋 Practice details, team structure</span>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: COLORS.slainteBlue,
                fontWeight: 600,
                fontSize: '1rem'
              }}>
                Get Started
                <ArrowRight style={{ width: '20px', height: '20px' }} />
              </div>
            </div>
          </div>
        </button>

        {/* Card 2: Explore with Demo Data */}
        <button
          onClick={onSelectDemo}
          style={{
            backgroundColor: COLORS.white,
            border: `2px solid ${COLORS.borderLight}`,
            borderRadius: '16px',
            padding: '2rem',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
            e.currentTarget.style.borderColor = COLORS.textSecondary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.borderColor = COLORS.borderLight;
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: COLORS.bgPage,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Play style={{ width: '24px', height: '24px', color: COLORS.textSecondary }} />
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: COLORS.textPrimary,
                marginBottom: '0.75rem'
              }}>
                Explore with Demo Data
              </h3>

              <p style={{
                fontSize: '1rem',
                color: COLORS.textSecondary,
                marginBottom: '1.25rem',
                lineHeight: 1.6
              }}>
                Take a quick tour with sample data before setting up your own practice.
              </p>

              <div style={{
                fontSize: '0.875rem',
                color: COLORS.textSecondary,
                marginBottom: '1rem'
              }}>
                <span style={{ marginRight: '1.5rem' }}>⏱️ 3 minutes</span>
                <span>👀 Sample dashboard & features</span>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: COLORS.textSecondary,
                fontWeight: 600,
                fontSize: '1rem'
              }}>
                Take a Tour
                <ArrowRight style={{ width: '20px', height: '20px' }} />
              </div>
            </div>
          </div>
        </button>

        {/* Card 3: Connect to Practice Computer */}
        {onSelectQuickConnect && (
          <button
            onClick={onSelectQuickConnect}
            style={{
              backgroundColor: COLORS.white,
              border: `2px solid ${COLORS.borderLight}`,
              borderRadius: '16px',
              padding: '1.25rem 2rem',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
              e.currentTarget.style.borderColor = COLORS.textSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = COLORS.borderLight;
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: COLORS.bgPage,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Wifi style={{ width: '20px', height: '20px', color: COLORS.textSecondary }} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: COLORS.textPrimary,
                  marginBottom: '0.25rem'
                }}>
                  Connect to Practice Computer
                </h3>
                <p style={{
                  fontSize: '0.875rem',
                  color: COLORS.textSecondary,
                  margin: 0,
                  lineHeight: 1.5
                }}>
                  Pull data from another computer on your network — ~1 minute
                </p>
              </div>
              <ArrowRight style={{ width: '20px', height: '20px', color: COLORS.textSecondary, flexShrink: 0 }} />
            </div>
          </button>
        )}

        {/* Helper Text */}
        <p style={{
          fontSize: '0.8125rem',
          color: COLORS.textSecondary,
          textAlign: 'center'
        }}>
          Don't worry - you can always set up your real practice later!
        </p>

        {/* Restore from Backup Option */}
        <div style={{
          textAlign: 'center',
          paddingTop: '1rem',
          borderTop: `1px solid ${COLORS.borderLight}`
        }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              border: `1px solid ${COLORS.borderLight}`,
              color: COLORS.textSecondary,
              backgroundColor: 'transparent',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.bgPage;
              e.currentTarget.style.borderColor = COLORS.textSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = COLORS.borderLight;
            }}
          >
            <Upload style={{ width: '14px', height: '14px' }} />
            Restore from Backup
            <input
              type="file"
              accept=".json"
              onChange={(event) => {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                  try {
                    const data = JSON.parse(e.target.result);

                    // Validate backup file
                    if (!data.version || !data.exportDate) {
                      alert('Invalid backup file. Please select a valid Slainte Finance backup file.');
                      return;
                    }

                    const backupDate = new Date(data.exportDate).toLocaleDateString();
                    const transCount = (data.transactions || []).length;
                    const unidentCount = (data.unidentifiedTransactions || []).length;
                    const pcrsCount = (data.paymentAnalysisData || []).length;

                    if (window.confirm(
                      `Restore backup from ${backupDate}?\n\n` +
                      `This backup contains:\n` +
                      `• ${transCount} categorised transactions\n` +
                      `• ${unidentCount} unidentified transactions\n` +
                      `• ${pcrsCount} PCRS payment records\n\n` +
                      `Continue?`
                    )) {
                      // Restore all data
                      setTransactions(data.transactions || []);
                      setUnidentifiedTransactions(data.unidentifiedTransactions || []);
                      if (data.categoryMapping) setCategoryMapping(data.categoryMapping);
                      if (data.paymentAnalysisData) setPaymentAnalysisData(data.paymentAnalysisData);

                      // Restore localStorage items
                      if (data.practiceProfile) {
                        localStorage.setItem('slainte_practice_profile', data.practiceProfile);
                      }
                      if (data.savedReports) {
                        localStorage.setItem('gp_finance_saved_reports', JSON.stringify(data.savedReports));
                      }
                      if (data.aiCorrections) {
                        localStorage.setItem('slainte_ai_corrections', data.aiCorrections);
                      }
                      if (data.categoryPreferences) {
                        localStorage.setItem('gp_finance_category_preferences', data.categoryPreferences);
                      }

                      alert('Backup restored successfully! The app will now reload.');
                      window.location.reload();
                    }
                  } catch (error) {
                    console.error('Restore error:', error);
                    alert('Error reading backup file. Please check the file is a valid JSON backup.');
                  }
                };
                reader.readAsText(file);
                event.target.value = '';
              }}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
