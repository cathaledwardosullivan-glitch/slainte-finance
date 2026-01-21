import React, { useState, useEffect } from 'react';
import { CheckCircle, ArrowRight, SkipForward } from 'lucide-react';
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

export default function ProgressCheckpoint({ profile, onContinue, onSkipToUpload }) {
  const [revealStage, setRevealStage] = useState(0);
  const [showTitle, setShowTitle] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showClosing, setShowClosing] = useState(false);

  const titleText = "Wonderful! Here's your practice taking shape";
  const subtitleText = "Look at what we've built together! Your practice structure is ready for financial tracking.";
  const closingText = "Perfect! Your practice structure is ready.";

  const { displayedText: title, isComplete: titleComplete } = useTypingEffect(showTitle ? titleText : '', 20);
  const { displayedText: subtitle, isComplete: subtitleComplete } = useTypingEffect(showSubtitle ? subtitleText : '', 12);
  const { displayedText: closing } = useTypingEffect(showClosing ? closingText : '', 15);

  // Count collected data
  const partnersCount = profile?.gps?.partners?.length || 0;
  const salariedCount = profile?.gps?.salaried?.length || 0;
  const staffCount = profile?.staff?.length || 0;
  const hasAccountant = !!profile?.practiceDetails?.accountant;
  const hasYearEnd = !!profile?.practiceDetails?.yearEndDate;

  // Group staff by role
  const staffByRole = {};
  if (profile?.staff) {
    profile.staff.forEach(member => {
      const role = member.role || 'Other';
      if (!staffByRole[role]) staffByRole[role] = [];
      staffByRole[role].push(member.name);
    });
  }

  // Start typing animation sequence on mount
  useEffect(() => {
    const timer = setTimeout(() => setShowTitle(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Cascade animations
  useEffect(() => {
    if (titleComplete) {
      const timer = setTimeout(() => setShowSubtitle(true), 200);
      return () => clearTimeout(timer);
    }
  }, [titleComplete]);

  // Auto-advance to stage 2 after stage 1 is revealed
  useEffect(() => {
    if (revealStage === 1) {
      const timer = setTimeout(() => setRevealStage(2), 800);
      return () => clearTimeout(timer);
    }
  }, [revealStage]);

  // Reveal closing message with stage 2
  useEffect(() => {
    if (revealStage >= 2) {
      const timer = setTimeout(() => setShowClosing(true), 300);
      return () => clearTimeout(timer);
    }
  }, [revealStage]);

  const handleRevealStructure = () => {
    setRevealStage(1);
  };

  return (
    <div>
      {/* Success Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: `${COLORS.incomeColor}15`,
          marginBottom: '1rem'
        }}>
          <CheckCircle style={{ width: '32px', height: '32px', color: COLORS.incomeColor }} />
        </div>

        <h2 style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: COLORS.darkGray,
          marginBottom: '1rem',
          minHeight: '3rem'
        }}>
          {title}
        </h2>

        <p style={{
          fontSize: '1.125rem',
          color: COLORS.mediumGray,
          maxWidth: '600px',
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.6,
          minHeight: '4rem'
        }}>
          {subtitle}
        </p>
      </div>

      {/* Populated Organizational Chart */}
      <div style={{
        backgroundColor: COLORS.backgroundGray,
        borderRadius: '16px',
        padding: '2rem',
        marginBottom: '2rem'
      }}>
        {/* Practice Name Header */}
        <div style={{
          backgroundColor: COLORS.slainteBlue,
          color: COLORS.white,
          padding: '1.5rem',
          borderRadius: '12px',
          textAlign: 'center',
          marginBottom: '2rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          position: 'relative'
        }}>
          <CheckCircle style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            width: '24px',
            height: '24px'
          }} />
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>
            {profile?.practiceDetails?.practiceName || 'YOUR PRACTICE'}
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
            Financial Overview
          </div>
          {profile?.practiceDetails?.locations?.length > 0 && (
            <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '0.5rem' }}>
              📍 {profile.practiceDetails.locations.join(', ')}
            </div>
          )}
        </div>

        {/* Main Categories Row */}
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
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💰</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600, color: COLORS.darkGray }}>
              INCOME
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
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600, color: COLORS.darkGray }}>
              EXPENDITURE
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
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600, color: COLORS.darkGray }}>
              DRAWINGS
            </div>
          </div>
        </div>

        {/* Reveal Button - Show when subtitle is complete but structure not yet revealed */}
        {subtitleComplete && revealStage < 1 && (
          <div style={{
            textAlign: 'center',
            marginTop: '2rem',
            opacity: subtitleComplete ? 1 : 0,
            transition: 'opacity 0.5s ease-out'
          }}>
            <button
              onClick={handleRevealStructure}
              style={{
                padding: '1rem 2rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: COLORS.white,
                backgroundColor: COLORS.incomeColor,
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>👥</span>
              Show My Team Structure
              <ArrowRight style={{ width: '20px', height: '20px' }} />
            </button>
          </div>
        )}

        {/* Staff Structure Detail - The Star of the Show */}
        {revealStage >= 1 && (
          <div style={{
            backgroundColor: COLORS.white,
            borderRadius: '12px',
            padding: '1.5rem',
            border: `3px solid ${COLORS.incomeColor}`,
            position: 'relative',
            opacity: revealStage >= 1 ? 1 : 0,
            transform: revealStage >= 1 ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s ease-out'
          }}>
          <div style={{
            position: 'absolute',
            top: '-12px',
            left: '1.5rem',
            backgroundColor: COLORS.incomeColor,
            color: COLORS.white,
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            ✓ COMPLETE
          </div>

          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: COLORS.darkGray,
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '1.5rem' }}>👥</span>
            Staff Costs - Team Structure
          </h3>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {/* Partners */}
            {partnersCount > 0 && (
              <div style={{
                backgroundColor: COLORS.backgroundGray,
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: COLORS.mediumGray,
                  marginBottom: '0.5rem'
                }}>
                  GP PARTNERS ({partnersCount})
                </div>
                <div style={{ fontSize: '0.9375rem', color: COLORS.darkGray }}>
                  {profile.gps.partners.map(p => p.name).join(' • ')}
                </div>
              </div>
            )}

            {/* Salaried GPs */}
            {salariedCount > 0 && (
              <div style={{
                backgroundColor: COLORS.backgroundGray,
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: COLORS.mediumGray,
                  marginBottom: '0.5rem'
                }}>
                  SALARIED GPs ({salariedCount})
                </div>
                <div style={{ fontSize: '0.9375rem', color: COLORS.darkGray }}>
                  {profile.gps.salaried.map(g => g.name).join(' • ')}
                </div>
              </div>
            )}

            {/* Staff by Role */}
            {Object.entries(staffByRole).map(([role, names]) => (
              <div
                key={role}
                style={{
                  backgroundColor: COLORS.backgroundGray,
                  borderRadius: '8px',
                  padding: '1rem'
                }}
              >
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: COLORS.mediumGray,
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase'
                }}>
                  {role} ({names.length})
                </div>
                <div style={{ fontSize: '0.9375rem', color: COLORS.darkGray }}>
                  {names.join(' • ')}
                </div>
              </div>
            ))}

            {/* Total count */}
            <div style={{
              textAlign: 'center',
              paddingTop: '0.75rem',
              borderTop: `2px solid ${COLORS.lightGray}`,
              fontSize: '0.875rem',
              color: COLORS.mediumGray,
              fontWeight: 600
            }}>
              Total Team Members: {partnersCount + salariedCount + staffCount}
            </div>
          </div>
        </div>
        )}

        {/* Other Details (if collected) */}
        {(hasAccountant || hasYearEnd) && (
          <div style={{
            backgroundColor: COLORS.white,
            borderRadius: '12px',
            padding: '1.5rem',
            marginTop: '1.5rem'
          }}>
            <h4 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.darkGray,
              marginBottom: '1rem'
            }}>
              Additional Details Collected:
            </h4>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {hasAccountant && (
                <div style={{ fontSize: '0.9375rem', color: COLORS.darkGray }}>
                  ✓ Accountant: <strong>{profile.practiceDetails.accountant}</strong>
                </div>
              )}
              {hasYearEnd && (
                <div style={{ fontSize: '0.9375rem', color: COLORS.darkGray }}>
                  ✓ Accounting Year End: <strong>{profile.practiceDetails.yearEndDate}</strong>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cara's Next Steps */}
      {revealStage >= 2 && (
        <div style={{
          backgroundColor: `${COLORS.slainteBlue}10`,
          border: `2px solid ${COLORS.slainteBlue}`,
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          opacity: revealStage >= 2 ? 1 : 0,
          transform: revealStage >= 2 ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s ease-out'
        }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: COLORS.darkGray,
            marginBottom: '0.75rem',
            minHeight: '1.5rem'
          }}>
            {closing}
          </h3>
          <p style={{
            fontSize: '1rem',
            color: COLORS.mediumGray,
            lineHeight: 1.5,
            opacity: closing.length > 0 ? 1 : 0,
            transition: 'opacity 0.3s'
          }}>
            You can continue to upload financial data, or skip ahead to your dashboard and add data later.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
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
          <ArrowRight style={{ width: '18px', height: '18px' }} />
          Continue
        </button>

        <button
          onClick={onSkipToUpload}
          style={{
            padding: '0.875rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 500,
            color: COLORS.mediumGray,
            backgroundColor: 'transparent',
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
            e.currentTarget.style.color = COLORS.darkGray;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = COLORS.lightGray;
            e.currentTarget.style.color = COLORS.mediumGray;
          }}
        >
          <SkipForward style={{ width: '18px', height: '18px' }} />
          Skip to Dashboard
        </button>
      </div>
    </div>
  );
}
