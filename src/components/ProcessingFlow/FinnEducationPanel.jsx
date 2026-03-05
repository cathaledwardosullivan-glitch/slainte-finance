import React, { useState, useEffect, useMemo } from 'react';
import { User, MessageCircle, ChevronDown, ChevronRight, CheckCircle, Loader, PanelLeftClose } from 'lucide-react';
import COLORS from '../../utils/colors';

// =============================================================================
// GROUP INFO ACCORDION (reused pattern from OnboardingTransactionUpload)
// =============================================================================

const GROUP_DEFINITIONS = [
  { code: 'INCOME', name: 'Income', desc: 'GMS payments, private consultations, insurance claims, other practice revenue' },
  { code: 'STAFF', name: 'Staff Costs', desc: 'GP salaries, locum fees, nursing staff, reception wages, PRSI, pensions' },
  { code: 'PREMISES', name: 'Premises', desc: 'Rent, rates, insurance, utilities, repairs, cleaning, security' },
  { code: 'MEDICAL', name: 'Medical Supplies', desc: 'Medications, vaccines, surgical supplies, lab testing, medical equipment' },
  { code: 'OFFICE', name: 'Office & IT', desc: 'Software, hardware, stationery, postage, phone, broadband' },
  { code: 'PROFESSIONAL', name: 'Professional Fees', desc: 'Accountancy, legal, consulting, training, subscriptions' },
  { code: 'MOTOR', name: 'Motor Expenses', desc: 'Fuel, insurance, maintenance, leasing for practice vehicles' },
  { code: 'OTHER', name: 'Petty Cash / Other', desc: 'Small purchases, sundries, bank charges, miscellaneous' },
  { code: 'NON_BUSINESS', name: 'Non-Business', desc: 'Personal drawings, non-practice transfers, personal expenses' }
];

const GroupInfoItem = ({ group }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          padding: '0.5rem 0.625rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: 'none',
          background: expanded ? `${COLORS.slainteBlue}10` : 'transparent',
          cursor: 'pointer',
          borderRadius: '6px',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: COLORS.slainteBlue,
          textAlign: 'left'
        }}
      >
        {group.name}
        <ChevronDown style={{
          width: '14px',
          height: '14px',
          color: COLORS.mediumGray,
          transition: 'transform 0.15s',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)'
        }} />
      </button>
      {expanded && (
        <div style={{
          padding: '0.25rem 0.625rem 0.5rem',
          fontSize: '0.75rem',
          color: COLORS.mediumGray,
          lineHeight: 1.4
        }}>
          {group.desc}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// CATEGORY TREE (grouped by section)
// =============================================================================

const CategorySection = ({ sectionName, categories }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          padding: '0.5rem 0.625rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: 'none',
          background: expanded ? `${COLORS.incomeColor}10` : 'transparent',
          cursor: 'pointer',
          borderRadius: '6px',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: COLORS.incomeColor,
          textAlign: 'left'
        }}
      >
        <span>{sectionName} <span style={{ fontWeight: 400, color: COLORS.mediumGray }}>({categories.length})</span></span>
        <ChevronDown style={{
          width: '14px',
          height: '14px',
          color: COLORS.mediumGray,
          transition: 'transform 0.15s',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)'
        }} />
      </button>
      {expanded && (
        <div style={{ padding: '0.25rem 0.625rem 0.5rem' }}>
          {categories.map(cat => (
            <div key={cat.code} style={{
              fontSize: '0.75rem',
              color: COLORS.mediumGray,
              lineHeight: 1.5,
              padding: '0.125rem 0',
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.375rem'
            }}>
              <span style={{ color: COLORS.darkGray, fontWeight: 500 }}>{cat.name}</span>
              {cat.personalization === 'Personalized' && (
                <span style={{
                  fontSize: '0.625rem',
                  backgroundColor: `${COLORS.slainteBlue}15`,
                  color: COLORS.slainteBlue,
                  padding: '0.125rem 0.375rem',
                  borderRadius: '4px',
                  fontWeight: 500
                }}>
                  Custom
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// FINN MESSAGE BUBBLE
// =============================================================================

const FinnBubble = ({ children, isGreeting, isTip }) => (
  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
    {isGreeting ? (
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
    ) : (
      <div style={{ width: '32px', flexShrink: 0 }} />
    )}
    <div style={{
      backgroundColor: isTip ? `${COLORS.highlightYellow}15` : COLORS.backgroundGray,
      padding: '0.875rem 1rem',
      borderRadius: '12px',
      maxWidth: '85%',
      ...(isTip ? { border: `1px solid ${COLORS.highlightYellow}50` } : {})
    }}>
      {children}
    </div>
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * FinnEducationPanel — Educational side panel shown during bulk upload processing.
 * Displays group explanations, category trees, and tips while AI processes in background.
 */
export default function FinnEducationPanel({
  transactionCount,
  aiStatus,         // { running: boolean, progress: number, total: number }
  waveInfo,         // { current: number, total: number }
  categoryMapping,  // Array of category definitions for category tree
  onCollapse        // Callback when user clicks collapse
}) {
  const [phase, setPhase] = useState('groups'); // 'groups' | 'categories' | 'tips' | 'ready'
  const [aiWasRunning, setAiWasRunning] = useState(false);

  // Track when AI starts running
  useEffect(() => {
    if (aiStatus?.running) {
      setAiWasRunning(true);
    }
  }, [aiStatus?.running]);

  // Auto-advance to 'ready' once — only when AI transitions from running → done
  useEffect(() => {
    if (aiWasRunning && aiStatus && !aiStatus.running) {
      setPhase('ready');
      setAiWasRunning(false); // Reset so it doesn't re-trigger on manual phase changes
    }
  }, [aiWasRunning, aiStatus]);

  // Group categories by section for the category tree
  const categorySections = useMemo(() => {
    if (!categoryMapping) return [];
    const sections = {};
    categoryMapping.forEach(cat => {
      const section = cat.section || 'Other';
      if (!sections[section]) sections[section] = [];
      sections[section].push(cat);
    });
    return Object.entries(sections).sort((a, b) => a[0].localeCompare(b[0]));
  }, [categoryMapping]);

  const aiProgressPercent = aiStatus?.total > 0
    ? Math.round((aiStatus.progress / aiStatus.total) * 100)
    : 0;

  return (
    <div style={{
      flex: '1 1 40%',
      minWidth: '350px',
      maxWidth: '500px',
      height: '100%',
      backgroundColor: COLORS.white,
      borderRadius: '0.75rem',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      border: `1px solid ${COLORS.lightGray}`,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: COLORS.slainteBlue,
        color: COLORS.white,
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <div style={{
          width: '2.25rem',
          height: '2.25rem',
          backgroundColor: COLORS.slainteBlueDark,
          borderRadius: '9999px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <User style={{ height: '1.125rem', width: '1.125rem' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Finn</div>
          <div style={{ fontSize: '0.6875rem', opacity: 0.9 }}>Processing Guide</div>
        </div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            title="Collapse panel"
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.white,
              cursor: 'pointer',
              padding: '0.25rem',
              opacity: 0.8,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <PanelLeftClose style={{ width: '18px', height: '18px' }} />
          </button>
        )}
      </div>

      {/* Content Area */}
      <div style={{
        padding: '1.25rem',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        overflowY: 'auto'
      }}>
        {/* Phase: Groups */}
        {phase === 'groups' && (
          <>
            <FinnBubble isGreeting>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: COLORS.darkGray }}>
                Sorting {transactionCount} transactions
              </div>
            </FinnBubble>

            <FinnBubble>
              <div style={{ fontSize: '0.875rem', color: COLORS.darkGray, lineHeight: 1.5 }}>
                While I work through these, here's a quick guide to how the Groups work. Click any Group to see what belongs there:
              </div>
            </FinnBubble>

            {/* Group Accordions */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: COLORS.white,
                padding: '0.5rem',
                borderRadius: '12px',
                border: `1px solid ${COLORS.lightGray}`,
                width: '100%',
                maxWidth: '85%'
              }}>
                {GROUP_DEFINITIONS.map(group => (
                  <GroupInfoItem key={group.code} group={group} />
                ))}
              </div>
            </div>

            {/* Navigation to tips */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
              <button
                onClick={() => setPhase('tips')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.5rem 1rem',
                  border: `1px solid ${COLORS.slainteBlue}30`,
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  color: COLORS.slainteBlue,
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Review Tips <ChevronRight style={{ width: '14px', height: '14px' }} />
              </button>
            </div>
          </>
        )}

        {/* Phase: Tips */}
        {phase === 'tips' && (
          <>
            <FinnBubble isGreeting>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: COLORS.darkGray }}>
                Tips for reviewing
              </div>
            </FinnBubble>

            <FinnBubble isTip>
              <div style={{ fontSize: '0.875rem', color: COLORS.darkGray, lineHeight: 1.5 }}>
                <strong>Corrections teach the system.</strong> Every time you change a Group assignment, that correction improves accuracy for future uploads.
              </div>
            </FinnBubble>

            <FinnBubble isTip>
              <div style={{ fontSize: '0.875rem', color: COLORS.darkGray, lineHeight: 1.5 }}>
                <strong>Review the suggestions.</strong> The AI has suggested groups for these transactions based on similar patterns. Most suggestions are good, but it's worth a quick scan. Any mistakes are easy to correct later.
              </div>
            </FinnBubble>

            <FinnBubble isTip>
              <div style={{ fontSize: '0.875rem', color: COLORS.darkGray, lineHeight: 1.5 }}>
                <strong>Apply to Similar.</strong> When you categorise a transaction, the system will offer to apply the same Group to all similar transactions — saving you time.
              </div>
            </FinnBubble>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
              <button
                onClick={() => setPhase('groups')}
                style={{
                  padding: '0.5rem 1rem',
                  border: `1px solid ${COLORS.lightGray}`,
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  color: COLORS.mediumGray,
                  fontSize: '0.8125rem',
                  cursor: 'pointer'
                }}
              >
                Back to Groups
              </button>
            </div>
          </>
        )}

        {/* Phase: Ready */}
        {phase === 'ready' && (
          <>
            <FinnBubble isGreeting>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: COLORS.incomeColor }}>
                Analysis complete!
              </div>
            </FinnBubble>

            <FinnBubble>
              <div style={{ fontSize: '0.875rem', color: COLORS.darkGray, lineHeight: 1.5 }}>
                I've finished analysing all the uncertain transactions. Review the results on the right — you can accept suggestions or change any assignment.
              </div>
            </FinnBubble>

            {/* Quick links back to reference */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                onClick={() => setPhase('groups')}
                style={{
                  padding: '0.375rem 0.75rem',
                  border: `1px solid ${COLORS.lightGray}`,
                  borderRadius: '6px',
                  backgroundColor: 'transparent',
                  color: COLORS.mediumGray,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Group Reference
              </button>
              <button
                onClick={() => setPhase('tips')}
                style={{
                  padding: '0.375rem 0.75rem',
                  border: `1px solid ${COLORS.lightGray}`,
                  borderRadius: '6px',
                  backgroundColor: 'transparent',
                  color: COLORS.mediumGray,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Review Tips
              </button>
            </div>
          </>
        )}
      </div>

      {/* Status Footer */}
      <div style={{
        padding: '0.625rem 1rem',
        borderTop: `1px solid ${COLORS.lightGray}`,
        backgroundColor: COLORS.backgroundGray,
        fontSize: '0.75rem',
        color: COLORS.mediumGray,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        {/* Wave info */}
        {waveInfo && (
          <span style={{ fontWeight: 500 }}>
            Wave {waveInfo.current} of {waveInfo.total}
          </span>
        )}

        {waveInfo && <span style={{ color: COLORS.lightGray }}>|</span>}

        {/* AI status */}
        {aiStatus?.running ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flex: 1 }}>
            <Loader style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
            Analysing {aiStatus.total} transactions...
            {aiStatus.total > 0 && (
              <>
                <span style={{
                  flex: 1,
                  height: '4px',
                  backgroundColor: COLORS.lightGray,
                  borderRadius: '2px',
                  overflow: 'hidden',
                  maxWidth: '80px'
                }}>
                  <span style={{
                    display: 'block',
                    height: '100%',
                    width: `${aiProgressPercent}%`,
                    backgroundColor: COLORS.slainteBlue,
                    borderRadius: '2px',
                    transition: 'width 0.3s ease'
                  }} />
                </span>
                <span>{aiProgressPercent}%</span>
              </>
            )}
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <CheckCircle style={{ width: '12px', height: '12px', color: COLORS.incomeColor }} />
            Ready for review
          </span>
        )}
      </div>

      {/* Spin animation for loader */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
