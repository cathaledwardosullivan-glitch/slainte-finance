import React, { useState, useEffect } from 'react';
import { User, MessageCircle, Brain, Activity, CheckCircle, ArrowRight, ArrowLeft, Loader } from 'lucide-react';
import COLORS from '../../utils/colors';
import { useAppContext } from '../../context/AppContext';
import AIIdentifierSuggestions from '../AIIdentifierSuggestions';
import AIExpenseCategorization from '../AIExpenseCategorization';

// Instant text display (typing animation disabled)
const useTypingEffect = (text) => {
  return { displayedText: text || '', isComplete: true };
};

/**
 * OnboardingAIAnalysis - Wraps the AI suggestion modals with Finn guidance
 *
 * Shows AI Staff Suggestions first, then AI Expense Categorization
 * Finn explains what's happening at each step
 */
export default function OnboardingAIAnalysis({ onComplete, onBack }) {
  const { unidentifiedTransactions, transactions } = useAppContext();

  // Analysis phase: 'staff' | 'expenses' | 'complete'
  const [phase, setPhase] = useState('staff');
  const [staffComplete, setStaffComplete] = useState(false);
  const [expensesComplete, setExpensesComplete] = useState(false);

  // Finn messages
  const [showGreeting, setShowGreeting] = useState(false);

  // Get appropriate message based on phase
  const getFinnMessage = () => {
    if (phase === 'staff') {
      return {
        greeting: "Let's identify your staff payments!",
        message: "I'm analyzing your transactions to find salary payments. I'll match them to the staff members you entered earlier, and suggest new ones if I find payments I don't recognize.",
        tip: "Review each suggestion carefully. Click 'Add Identifier' to teach me which transactions belong to each staff member."
      };
    } else if (phase === 'expenses') {
      return {
        greeting: "Now let's categorize your expenses!",
        message: "I'm looking for recurring expense patterns like utility bills, subscriptions, and regular suppliers. I'll suggest the best category for each pattern.",
        tip: "You can change the suggested category if you prefer a different one. Click 'Apply' to add the identifier to that category."
      };
    } else {
      return {
        greeting: "Analysis complete!",
        message: `Great work! I've helped categorize your transactions. You now have ${transactions.length} categorized transactions${unidentifiedTransactions.length > 0 ? ` and ${unidentifiedTransactions.length} still need review` : ''}.`,
        tip: "You can always come back to categorize more transactions later from the main dashboard."
      };
    }
  };

  const currentMessage = getFinnMessage();
  const { displayedText: greeting, isComplete: greetingComplete } = useTypingEffect(
    showGreeting ? currentMessage.greeting : '',
    25
  );

  // Start animation on phase change
  useEffect(() => {
    setShowGreeting(false);
    const timer = setTimeout(() => setShowGreeting(true), 300);
    return () => clearTimeout(timer);
  }, [phase]);

  // Check if we should skip staff phase (no unidentified transactions)
  useEffect(() => {
    if (phase === 'staff' && unidentifiedTransactions.length === 0) {
      // No unidentified transactions, skip to complete
      setPhase('complete');
    }
  }, [phase, unidentifiedTransactions.length]);

  // Handle staff analysis close
  const handleStaffClose = () => {
    setStaffComplete(true);
    // Check if there are still unidentified transactions for expense analysis
    if (unidentifiedTransactions.length > 0) {
      setPhase('expenses');
    } else {
      setPhase('complete');
    }
  };

  // Handle expense analysis close
  const handleExpenseClose = () => {
    setExpensesComplete(true);
    setPhase('complete');
  };

  // Handle continue to next step
  const handleContinue = () => {
    onComplete({
      staffAnalyzed: staffComplete,
      expensesAnalyzed: expensesComplete,
      remainingUnidentified: unidentifiedTransactions.length
    });
  };

  return (
    <div style={{
      display: 'flex',
      gap: '1.5rem',
      alignItems: 'stretch',
      maxWidth: '1800px',
      margin: '0 auto',
      height: 'min(80vh, 750px)'
    }}>
      {/* Left side - Finn Guidance */}
      <div style={{
        flex: '0 0 320px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {/* Finn Card */}
        <div style={{
          backgroundColor: COLORS.white,
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
          border: `1px solid ${COLORS.borderLight}`,
          overflow: 'hidden',
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
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

          {/* Messages */}
          <div style={{
            padding: '1.5rem',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
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

            {/* Main message */}
            {greetingComplete && (
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
                    {currentMessage.message}
                  </div>
                </div>
              </div>
            )}

            {/* Tip */}
            {greetingComplete && phase !== 'complete' && (
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
                    <strong>Tip:</strong> {currentMessage.tip}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Phase indicator */}
          <div style={{
            padding: '1rem',
            borderTop: `1px solid ${COLORS.borderLight}`,
            backgroundColor: COLORS.bgPage
          }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {/* Staff phase indicator */}
              <div style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                backgroundColor: phase === 'staff' || staffComplete ? COLORS.slainteBlue : COLORS.borderLight,
                transition: 'background-color 0.3s'
              }} />
              {/* Expenses phase indicator */}
              <div style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                backgroundColor: phase === 'expenses' || expensesComplete ? COLORS.slainteBlue : COLORS.borderLight,
                transition: 'background-color 0.3s'
              }} />
              {/* Complete indicator */}
              <div style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                backgroundColor: phase === 'complete' ? COLORS.incomeColor : COLORS.borderLight,
                transition: 'background-color 0.3s'
              }} />
            </div>
            <div style={{
              fontSize: '0.75rem',
              color: COLORS.textSecondary,
              textAlign: 'center'
            }}>
              {phase === 'staff' && 'Step 1: Staff Identification'}
              {phase === 'expenses' && 'Step 2: Expense Categorization'}
              {phase === 'complete' && 'Analysis Complete'}
            </div>
          </div>
        </div>

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={onBack}
            style={{
              flex: 1,
              padding: '0.875rem',
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: COLORS.textSecondary,
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <ArrowLeft style={{ width: '18px', height: '18px' }} />
            Back
          </button>

          {phase === 'complete' && (
            <button
              onClick={handleContinue}
              style={{
                flex: 2,
                padding: '0.875rem',
                fontSize: '0.9375rem',
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
              Continue
              <ArrowRight style={{ width: '18px', height: '18px' }} />
            </button>
          )}
        </div>
      </div>

      {/* Right side - AI Analysis Modal */}
      <div style={{
        flex: 1,
        backgroundColor: COLORS.white,
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
        border: `1px solid ${COLORS.borderLight}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {phase === 'staff' && (
          <AIIdentifierSuggestions
            onClose={handleStaffClose}
            hideApiKeyInput={true}
          />
        )}

        {phase === 'expenses' && (
          <AIExpenseCategorization
            onClose={handleExpenseClose}
            hideApiKeyInput={true}
          />
        )}

        {phase === 'complete' && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem',
            textAlign: 'center'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: `${COLORS.incomeColor}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <CheckCircle style={{ width: '40px', height: '40px', color: COLORS.incomeColor }} />
            </div>

            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: COLORS.textPrimary,
              marginBottom: '0.75rem'
            }}>
              Analysis Complete!
            </h2>

            <p style={{
              fontSize: '1rem',
              color: COLORS.textSecondary,
              lineHeight: 1.6,
              maxWidth: '400px',
              marginBottom: '2rem'
            }}>
              Your transactions have been analyzed and categorized.
              {unidentifiedTransactions.length > 0
                ? ` You can review the remaining ${unidentifiedTransactions.length} unidentified transactions later from the dashboard.`
                : ' All transactions have been categorized!'}
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1rem',
              width: '100%',
              maxWidth: '400px'
            }}>
              <div style={{
                padding: '1.25rem',
                backgroundColor: `${COLORS.incomeColor}10`,
                borderRadius: '12px',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 700,
                  color: COLORS.incomeColor,
                  marginBottom: '0.25rem'
                }}>
                  {transactions.length}
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: COLORS.textSecondary
                }}>
                  Categorized
                </div>
              </div>

              <div style={{
                padding: '1.25rem',
                backgroundColor: unidentifiedTransactions.length > 0 ? `${COLORS.highlightYellow}15` : `${COLORS.incomeColor}10`,
                borderRadius: '12px',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 700,
                  color: unidentifiedTransactions.length > 0 ? COLORS.highlightYellow : COLORS.incomeColor,
                  marginBottom: '0.25rem'
                }}>
                  {unidentifiedTransactions.length}
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: COLORS.textSecondary
                }}>
                  Need Review
                </div>
              </div>
            </div>

            <button
              onClick={handleContinue}
              style={{
                marginTop: '2rem',
                padding: '1rem 2rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: COLORS.white,
                backgroundColor: COLORS.incomeColor,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              Continue to GMS Panel Setup
              <ArrowRight style={{ width: '20px', height: '20px' }} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
