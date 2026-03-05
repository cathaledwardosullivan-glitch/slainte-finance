import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Building2 } from 'lucide-react';
import COLORS from '../../utils/colors';

export default function StructureExplanation({ practiceName, onContinue, onBack }) {
  const [showChart, setShowChart] = useState(false);
  const [revealStage, setRevealStage] = useState(0);

  // Trigger chart animation after mount
  useEffect(() => {
    const timer = setTimeout(() => setShowChart(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleRevealNext = () => {
    setRevealStage(prev => prev + 1);
  };

  return (
    <div>
      {/* Finn's Introduction */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: `${COLORS.slainteBlue}15`,
          marginBottom: '1rem'
        }}>
          <Building2 style={{ width: '28px', height: '28px', color: COLORS.slainteBlue }} />
        </div>

        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: COLORS.darkGray,
          marginBottom: '1rem'
        }}>
          Let me show you how Sláinte Finance organizes your financial information
        </h2>

        <p style={{
          fontSize: '1rem',
          color: COLORS.mediumGray,
          maxWidth: '700px',
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.6
        }}>
          Before we dive into your specific practice, it's helpful to understand
          the structure we'll be building together.
        </p>
      </div>

      {/* Organizational Chart */}
      <div style={{
        backgroundColor: COLORS.backgroundGray,
        borderRadius: '16px',
        padding: '2rem',
        marginBottom: '2rem',
        opacity: showChart ? 1 : 0,
        transform: showChart ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.6s ease-out'
      }}>
        {/* Practice Name Header */}
        <div style={{
          backgroundColor: COLORS.slainteBlue,
          color: COLORS.white,
          padding: '1.5rem',
          borderRadius: '12px',
          textAlign: 'center',
          marginBottom: '2rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>
            {practiceName || 'YOUR PRACTICE'}
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
            Financial Overview
          </div>
        </div>

        {/* Main Three Categories */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {/* Income */}
          <div style={{
            backgroundColor: `${COLORS.incomeColor}15`,
            border: `2px solid ${COLORS.incomeColor}`,
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '2rem',
              marginBottom: '0.5rem'
            }}>
              💰
            </div>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: COLORS.darkGray,
              marginBottom: '0.5rem'
            }}>
              INCOME
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: COLORS.mediumGray,
              lineHeight: 1.4
            }}>
              Money coming IN
              <br />
              (PCRS, Private patients)
            </div>
          </div>

          {/* Expenditure */}
          <div style={{
            backgroundColor: `${COLORS.expenseColor}15`,
            border: `2px solid ${COLORS.expenseColor}`,
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '2rem',
              marginBottom: '0.5rem'
            }}>
              📊
            </div>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: COLORS.darkGray,
              marginBottom: '0.5rem'
            }}>
              EXPENDITURE
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: COLORS.mediumGray,
              lineHeight: 1.4
            }}>
              Money going OUT
              <br />
              (Practice costs)
            </div>
          </div>

          {/* Drawings */}
          <div style={{
            backgroundColor: `${COLORS.highlightYellow}15`,
            border: `2px solid ${COLORS.highlightYellow}`,
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '2rem',
              marginBottom: '0.5rem'
            }}>
              👥
            </div>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: COLORS.darkGray,
              marginBottom: '0.5rem'
            }}>
              DRAWINGS
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: COLORS.mediumGray,
              lineHeight: 1.4
            }}>
              Money going OUT
              <br />
              (Partner distributions)
            </div>
          </div>
        </div>

        {/* Expenditure Breakdown - Only show if revealStage >= 1 */}
        {revealStage >= 1 && (
          <div style={{
            backgroundColor: COLORS.white,
            borderRadius: '12px',
            padding: '1.5rem',
            opacity: revealStage >= 1 ? 1 : 0,
            transform: revealStage >= 1 ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s ease-out'
          }}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: COLORS.darkGray,
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              Your Expenditure is organized into groups that match how GP practices operate:
            </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem'
          }}>
            {[
              { icon: '👥', title: 'Staff Costs', desc: 'Your team payroll and related expenses' },
              { icon: '🏢', title: 'Premises', desc: 'Rent, utilities, maintenance, cleaning' },
              { icon: '🎓', title: 'Professional Development', desc: 'Training, memberships, indemnity' },
              { icon: '💊', title: 'Medical Supplies', desc: 'Clinical items, PPE, vaccines' },
              { icon: '💻', title: 'IT & Communications', desc: 'Software, phones, internet' },
              { icon: '📎', title: 'Office Supplies', desc: 'Stationery, printing, postage' },
              { icon: '📋', title: 'Other Sundry', desc: 'Everything else' }
            ].map((category, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: COLORS.backgroundGray,
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}
              >
                <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>
                  {category.icon}
                </div>
                <div>
                  <div style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: COLORS.darkGray,
                    marginBottom: '0.25rem'
                  }}>
                    {category.title}
                  </div>
                  <div style={{
                    fontSize: '0.8125rem',
                    color: COLORS.mediumGray,
                    lineHeight: 1.3
                  }}>
                    {category.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Key Point - Only show if revealStage >= 2 */}
        {revealStage >= 2 && (
        <div style={{
          backgroundColor: `${COLORS.slainteBlue}10`,
          border: `2px solid ${COLORS.slainteBlue}`,
          borderRadius: '12px',
          padding: '1.25rem',
          marginTop: '1.5rem',
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '1rem',
            color: COLORS.darkGray,
            lineHeight: 1.5,
            margin: 0,
            opacity: revealStage >= 2 ? 1 : 0,
            transform: revealStage >= 2 ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s ease-out'
          }}>
            <strong>Within each group, we can track specific details.</strong> For example, under Staff Costs,
            we can identify payments to each individual team member. That's why in a bit I'm going to ask about your team,
            but first if you have a website I'll have a look at it quickly to get an understanding of your practice.
          </p>
        </div>
        )}
      </div>

      {/* Finn's Closing or Continue Button */}
      <div style={{
        backgroundColor: COLORS.white,
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        textAlign: 'center'
      }}>
        {revealStage < 2 ? (
          <>
            <p style={{
              fontSize: '1rem',
              color: COLORS.mediumGray,
              marginBottom: '1.5rem'
            }}>
              Click below to learn more...
            </p>
            <button
              onClick={handleRevealNext}
              style={{
                padding: '0.875rem 2rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: COLORS.white,
                backgroundColor: COLORS.slainteBlue,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
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
              Continue
              <ArrowRight style={{ width: '18px', height: '18px' }} />
            </button>
          </>
        ) : (
          <>
            <p style={{
              fontSize: '1.125rem',
              color: COLORS.darkGray,
              fontWeight: 600,
              marginBottom: '1.5rem'
            }}>
              Ready to build YOUR practice's version of this?
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              {onBack && (
                <button
                  onClick={onBack}
                  style={{
                    padding: '0.875rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: COLORS.darkGray,
                    backgroundColor: COLORS.white,
                    border: `2px solid ${COLORS.lightGray}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'inline-flex',
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
                  Back
                </button>
              )}

              <button
                onClick={onContinue}
                style={{
                  padding: '0.875rem 2rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: COLORS.white,
                  backgroundColor: COLORS.slainteBlue,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'inline-flex',
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
                Let's Get Started
                <ArrowRight style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
