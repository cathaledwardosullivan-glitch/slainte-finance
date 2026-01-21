import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, BarChart3, FileText, TrendingUp, Download, MessageCircle, Activity, Sparkles, Brain } from 'lucide-react';
import COLORS from '../../utils/colors';

const TOUR_STEPS = [
  {
    id: 'welcome',
    icon: Sparkles,
    title: 'Welcome to your Sláinte Finance dashboard!',
    description: "Let me give you a quick tour of the key features you'll use to manage your practice finances.",
    highlight: null
  },
  {
    id: 'dashboard',
    icon: BarChart3,
    title: 'Dashboard Overview',
    description: "This is your home base. At a glance you can see your income streams (PCRS and private), expense breakdown by category, and financial trends over time.",
    highlight: 'dashboard',
    features: [
      'Summary cards showing total income, expenses, and net position',
      'Visual charts of your financial trends',
      'Quick access to recent transactions'
    ]
  },
  {
    id: 'transactions',
    icon: FileText,
    title: 'Transactions Page',
    description: "Every bank transaction with its category is shown here. This is where you can review and complete classification of any unidentified transactions.",
    highlight: 'transactions',
    features: [
      'View all transactions with smart filtering',
      'Edit categories with a single click',
      'Track which payments went to which team member'
    ]
  },
  {
    id: 'visualization',
    icon: TrendingUp,
    title: 'Data Visualization',
    description: "Beautiful charts and graphs to understand your practice's financial patterns and trends at a deeper level.",
    highlight: 'visualisation',
    features: [
      'Interactive charts showing expense breakdowns',
      'Time-series analysis of income and expenses',
      'Compare periods to identify trends'
    ]
  },
  {
    id: 'reports',
    icon: Download,
    title: 'Reports',
    description: "Generate professional reports for your accountant - Profit & Loss statements, expense summaries by category, and custom date range analysis. All formatted for Irish accounting standards.",
    highlight: 'export',
    features: [
      'P&L statements ready for your accountant',
      'Expense reports by category',
      'Export to PDF or Excel'
    ]
  },
  {
    id: 'gms-panel',
    icon: Activity,
    title: 'GMS Panel Analysis',
    description: "Track your PCRS income, panel sizes, and payment trends over time. Upload your PCRS PDFs to see detailed analysis of your GMS income.",
    highlight: 'gms-panel',
    features: [
      'Panel size tracking',
      'GMS payment analysis',
      'Income forecasting'
    ]
  },
  {
    id: 'assistants',
    icon: MessageCircle,
    title: 'Your AI Assistants: Cara & Finn',
    description: null,
    highlight: 'chat',
    isSpecial: true
  },
  {
    id: 'complete',
    icon: Sparkles,
    title: "You're all set!",
    description: "Your dashboard is ready to go. Start exploring, upload more data, or just ask Cara if you need help with anything!",
    highlight: null
  }
];

export default function FeatureTour({ onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      // Mark tour as completed
      localStorage.setItem('slainte_feature_tour_completed', 'true');
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const handleSkip = () => {
    localStorage.setItem('slainte_feature_tour_completed', 'true');
    onSkip();
  };

  const StepIcon = step.icon;

  return (
    <div>
      {/* Progress Indicator */}
      <div style={{
        marginBottom: '2rem',
        textAlign: 'center'
      }}>
        <div style={{
          display: 'inline-flex',
          gap: '0.5rem',
          marginBottom: '1rem'
        }}>
          {TOUR_STEPS.map((_, idx) => (
            <div
              key={idx}
              style={{
                width: idx === currentStep ? '32px' : '8px',
                height: '8px',
                borderRadius: '4px',
                backgroundColor: idx === currentStep ? COLORS.slainteBlue : idx < currentStep ? COLORS.incomeColor : COLORS.lightGray,
                transition: 'all 0.3s'
              }}
            />
          ))}
        </div>
        <div style={{
          fontSize: '0.875rem',
          color: COLORS.mediumGray
        }}>
          Step {currentStep + 1} of {TOUR_STEPS.length}
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        backgroundColor: COLORS.white,
        borderRadius: '16px',
        padding: '2.5rem',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Icon and Title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: `${COLORS.slainteBlue}15`,
            marginBottom: '1.5rem'
          }}>
            <StepIcon style={{ width: '32px', height: '32px', color: COLORS.slainteBlue }} />
          </div>

          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: COLORS.darkGray,
            marginBottom: '1rem'
          }}>
            {step.title}
          </h2>

          {!step.isSpecial && step.description && (
            <p style={{
              fontSize: '1.125rem',
              color: COLORS.mediumGray,
              maxWidth: '650px',
              marginLeft: 'auto',
              marginRight: 'auto',
              lineHeight: 1.6
            }}>
              {step.description}
            </p>
          )}
        </div>

        {/* Special Content for AI Assistants Step */}
        {step.isSpecial && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <p style={{
              fontSize: '1.125rem',
              color: COLORS.mediumGray,
              textAlign: 'center',
              lineHeight: 1.6,
              marginBottom: '1rem'
            }}>
              You have two AI assistants to help you - each with their own special role:
            </p>

            {/* Cara Card */}
            <div style={{
              backgroundColor: COLORS.backgroundGray,
              borderRadius: '12px',
              padding: '1.5rem',
              border: `2px solid ${COLORS.slainteBlue}`
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
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
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: COLORS.darkGray,
                    marginBottom: '0.5rem'
                  }}>
                    Cara - Your Guide
                  </h3>
                  <p style={{
                    fontSize: '1rem',
                    color: COLORS.mediumGray,
                    marginBottom: '0.75rem',
                    lineHeight: 1.5
                  }}>
                    I'm always here in the floating chat bubble at the bottom of your screen!
                    Ask me anything about:
                  </p>
                  <ul style={{
                    fontSize: '0.9375rem',
                    color: COLORS.darkGray,
                    marginLeft: '1.5rem',
                    lineHeight: 1.6
                  }}>
                    <li>How to use features of the app</li>
                    <li>Where to find specific information</li>
                    <li>How to update your practice details</li>
                    <li>Navigation and general help</li>
                  </ul>
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: `${COLORS.slainteBlue}10`,
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    color: COLORS.darkGray,
                    fontStyle: 'italic'
                  }}>
                    💡 Think of me as your friendly guide to using Sláinte Finance!
                  </div>
                </div>
              </div>
            </div>

            {/* Finn Card */}
            <div style={{
              backgroundColor: COLORS.backgroundGray,
              borderRadius: '12px',
              padding: '1.5rem',
              border: `2px solid ${COLORS.incomeColor}`
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: `${COLORS.incomeColor}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Brain style={{ width: '24px', height: '24px', color: COLORS.incomeColor }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: COLORS.darkGray,
                    marginBottom: '0.5rem'
                  }}>
                    Finn - Your Financial Analyst
                  </h3>
                  <p style={{
                    fontSize: '1rem',
                    color: COLORS.mediumGray,
                    marginBottom: '0.75rem',
                    lineHeight: 1.5
                  }}>
                    Find me in the "Financial Chat" tab. I have access to all your transaction
                    data and can provide detailed financial insights. Ask me things like:
                  </p>
                  <ul style={{
                    fontSize: '0.9375rem',
                    color: COLORS.darkGray,
                    marginLeft: '1.5rem',
                    lineHeight: 1.6
                  }}>
                    <li>"What were my biggest expenses last quarter?"</li>
                    <li>"How do my staff costs compare to typical GP practices?"</li>
                    <li>"Show me trends in medical supply spending"</li>
                    <li>"Generate a report for my accountant"</li>
                  </ul>
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: `${COLORS.incomeColor}10`,
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    color: COLORS.darkGray,
                    fontStyle: 'italic'
                  }}>
                    💡 Think of me as your personal financial analyst who knows your practice inside and out!
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Features List for Regular Steps */}
        {!step.isSpecial && step.features && (
          <div style={{
            backgroundColor: COLORS.backgroundGray,
            borderRadius: '12px',
            padding: '1.5rem',
            marginTop: 'auto'
          }}>
            <h4 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.darkGray,
              marginBottom: '1rem'
            }}>
              Key Features:
            </h4>
            <ul style={{
              fontSize: '1rem',
              color: COLORS.darkGray,
              marginLeft: '1.5rem',
              lineHeight: 2
            }}>
              {step.features.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '2rem',
        gap: '1rem'
      }}>
        <button
          onClick={handleSkip}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '0.9375rem',
            fontWeight: 500,
            color: COLORS.mediumGray,
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = COLORS.darkGray;
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = COLORS.mediumGray;
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          Skip Tour
        </button>

        <div style={{ display: 'flex', gap: '1rem' }}>
          {!isFirst && (
            <button
              onClick={handlePrevious}
              style={{
                padding: '0.875rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 500,
                color: COLORS.darkGray,
                backgroundColor: COLORS.white,
                border: `2px solid ${COLORS.lightGray}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = COLORS.mediumGray;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLORS.lightGray;
              }}
            >
              <ArrowLeft style={{ width: '18px', height: '18px' }} />
              Previous
            </button>
          )}

          <button
            onClick={handleNext}
            style={{
              padding: '0.875rem 2rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.white,
              backgroundColor: COLORS.slainteBlue,
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark;
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.slainteBlue;
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {isLast ? 'Get Started!' : 'Next'}
            <ArrowRight style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
